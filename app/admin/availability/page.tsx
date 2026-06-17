'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
];
const WEEKDAY_KEYS = WEEKDAYS.map((w) => w.key);
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Settings {
  sunday: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  bookingWindowWeeks: number;
}

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0));
}

type DayStatus = 'out' | 'past' | 'booked' | 'off' | 'blocked' | 'available';

export default function AvailabilityPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [booked, setBooked] = useState<Record<string, string>>({});
  const [viewMonth, setViewMonth] = useState<Date>(firstOfMonthUTC(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const todayKey = keyOf(new Date());
  const thisMonth = firstOfMonthUTC(new Date());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/availability');
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSettings({
        sunday: data.sunday,
        monday: data.monday,
        tuesday: data.tuesday,
        wednesday: data.wednesday,
        thursday: data.thursday,
        friday: data.friday,
        saturday: data.saturday,
        bookingWindowWeeks: data.bookingWindowWeeks,
      });
      setBlocked(new Set<string>(data.blockedDates || []));
      const map: Record<string, string> = {};
      (data.bookedDates || []).forEach((b: any) => {
        map[b.date] = b.name;
      });
      setBooked(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleWeekday = (key: string) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !(settings as any)[key] });
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMessage('Saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const weekdayOn = (d: Date): boolean => {
    if (!settings) return false;
    return (settings as any)[WEEKDAY_KEYS[d.getUTCDay()]];
  };

  const statusOf = (date: Date, inMonth: boolean): DayStatus => {
    if (!inMonth) return 'out';
    const key = keyOf(date);
    if (key < todayKey) return 'past';
    if (booked[key] !== undefined) return 'booked';
    if (!weekdayOn(date)) return 'off';
    if (blocked.has(key)) return 'blocked';
    return 'available';
  };

  // Persist a set of block/unblock changes (optimistic).
  const applyBlock = async (keys: string[], block: boolean) => {
    if (keys.length === 0) return;
    const next = new Set(blocked);
    keys.forEach((k) => (block ? next.add(k) : next.delete(k)));
    setBlocked(next);
    setError('');
    try {
      const res = await fetch('/api/admin/availability/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: keys, blocked: block }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update dates');
      load(); // revert to server truth
    }
  };

  const onDayClick = (date: Date, status: DayStatus) => {
    const key = keyOf(date);
    if (status === 'available') applyBlock([key], true);
    else if (status === 'blocked') applyBlock([key], false);
  };

  // Build the 6-week grid for the viewed month.
  const weeks = useMemo(() => {
    const year = viewMonth.getUTCFullYear();
    const month = viewMonth.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1, 12));
    const lead = first.getUTCDay();
    const startCell = new Date(first);
    startCell.setUTCDate(1 - lead);
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startCell);
      d.setUTCDate(startCell.getUTCDate() + i);
      cells.push({ date: d, inMonth: d.getUTCMonth() === month });
    }
    const rows: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < 42; i += 7) rows.push(cells.slice(i, i + 7));
    // Drop a trailing fully-out-of-month week.
    return rows.filter((row) => row.some((c) => c.inMonth));
  }, [viewMonth]);

  // For a week row: togglable days (in month, not past, not booked, working weekday).
  const weekToggle = (row: { date: Date; inMonth: boolean }[]) => {
    const togglable = row.filter((c) => {
      const s = statusOf(c.date, c.inMonth);
      return s === 'available' || s === 'blocked';
    });
    const available = togglable.filter((c) => statusOf(c.date, c.inMonth) === 'available');
    if (togglable.length === 0) return null;
    if (available.length > 0) {
      return {
        label: 'Close week',
        action: () => applyBlock(available.map((c) => keyOf(c.date)), true),
      };
    }
    return {
      label: 'Open week',
      action: () => applyBlock(togglable.map((c) => keyOf(c.date)), false),
    };
  };

  const cellClass = (status: DayStatus): string => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-900 border-green-300 hover:bg-green-200 cursor-pointer';
      case 'blocked':
        return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200 cursor-pointer line-through';
      case 'booked':
        return 'bg-amber-200 text-amber-900 border-amber-300 cursor-default';
      case 'off':
        return 'bg-gray-50 text-gray-400 border-gray-200 cursor-default';
      case 'past':
        return 'bg-gray-50 text-gray-300 border-gray-100 cursor-default';
      default:
        return 'bg-transparent text-transparent border-transparent';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <p className="text-red-600">{error || 'Could not load settings'}</p>
      </div>
    );
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const canGoPrev = viewMonth.getTime() > thisMonth.getTime();
  const goPrev = () => {
    const d = new Date(viewMonth);
    d.setUTCMonth(d.getUTCMonth() - 1);
    setViewMonth(d);
  };
  const goNext = () => {
    const d = new Date(viewMonth);
    d.setUTCMonth(d.getUTCMonth() + 1);
    setViewMonth(d);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Recurring weekday defaults */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold mb-1">Scheduling Availability</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Set your normal working days, then use the calendar below to close off specific dates or weeks. One job per available day.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{message}</div>
          )}

          <p className="text-sm font-semibold mb-2">Normal working days</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.key}
                onClick={() => toggleWeekday(d.key)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  (settings as any)[d.key]
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                }`}
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2">
              How far ahead can clients book? (weeks)
            </label>
            <input
              type="number"
              min={1}
              max={52}
              value={settings.bookingWindowWeeks}
              onChange={(e) =>
                setSettings({ ...settings, bookingWindowWeeks: parseInt(e.target.value) || 1 })
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-semibold"
          >
            {saving ? 'Saving…' : 'Save working days'}
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goPrev}
              disabled={!canGoPrev}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <h2 className="text-lg font-bold">{monthLabel}</h2>
            <button
              onClick={goNext}
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Next ›
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Click a green day to close it, or a red day to reopen it. Use “Close week” to block a whole row.
          </p>

          {/* Weekday header */}
          <div className="grid grid-cols-8 gap-1 mb-1">
            <div className="text-xs" />
            {DOW_LABELS.map((l) => (
              <div key={l} className="text-center text-xs font-semibold text-gray-500">
                {l}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="space-y-1">
            {weeks.map((row, ri) => {
              const wt = weekToggle(row);
              return (
                <div key={ri} className="grid grid-cols-8 gap-1 items-stretch">
                  <button
                    onClick={wt?.action}
                    disabled={!wt}
                    title={wt ? wt.label : ''}
                    className={`text-[10px] leading-tight rounded px-1 ${
                      wt
                        ? 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                        : 'text-transparent'
                    }`}
                  >
                    {wt ? wt.label.replace(' ', '\n') : ''}
                  </button>
                  {row.map((c, ci) => {
                    const status = statusOf(c.date, c.inMonth);
                    const key = keyOf(c.date);
                    const dayNum = c.date.getUTCDate();
                    return (
                      <button
                        key={ci}
                        onClick={() => onDayClick(c.date, status)}
                        disabled={status === 'out' || status === 'past' || status === 'off' || status === 'booked'}
                        title={status === 'booked' ? `Booked: ${booked[key]}` : key}
                        className={`h-12 rounded border text-sm flex flex-col items-center justify-center ${cellClass(status)}`}
                      >
                        {status !== 'out' && <span>{dayNum}</span>}
                        {status === 'booked' && <span className="text-[9px] leading-none">booked</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Open</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Closed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-300 inline-block" /> Booked</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200 inline-block" /> Not a working day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
