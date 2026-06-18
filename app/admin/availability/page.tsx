'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

interface Job {
  id: string;
  name: string;
  category: string;
  slot: string | null;
  status: string;
}

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}
function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0));
}
function fmtLong(key: string): string {
  return dateFromKey(key).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type DayStatus = 'out' | 'past' | 'booked' | 'off' | 'blocked' | 'available';

export default function AvailabilityPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [jobsByDate, setJobsByDate] = useState<Record<string, Job[]>>({});
  const [viewMonth, setViewMonth] = useState<Date>(firstOfMonthUTC(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
      setOpen(new Set<string>(data.openDates || []));
      const map: Record<string, Job[]> = {};
      (data.bookedDates || []).forEach((b: any) => {
        (map[b.date] ||= []).push({
          id: b.id,
          name: b.name,
          category: b.category,
          slot: b.slot,
          status: b.status,
        });
      });
      setJobsByDate(map);
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
    if (jobsByDate[key]?.length) return 'booked';
    if (key < todayKey) return 'past';
    const on = weekdayOn(date) || open.has(key);
    if (!on) return 'off';
    if (blocked.has(key)) return 'blocked';
    return 'available';
  };

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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update dates');
      load();
    }
  };

  const applyOpen = async (keys: string[], makeOpen: boolean) => {
    if (keys.length === 0) return;
    const nextOpen = new Set(open);
    const nextBlocked = new Set(blocked);
    keys.forEach((k) => {
      if (makeOpen) {
        nextOpen.add(k);
        nextBlocked.delete(k);
      } else {
        nextOpen.delete(k);
      }
    });
    setOpen(nextOpen);
    setBlocked(nextBlocked);
    setError('');
    try {
      const res = await fetch('/api/admin/availability/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: keys, open: makeOpen }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update dates');
      load();
    }
  };

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
    return rows.filter((row) => row.some((c) => c.inMonth));
  }, [viewMonth]);

  const weekToggle = (row: { date: Date; inMonth: boolean }[]) => {
    const togglable = row.filter((c) => {
      const s = statusOf(c.date, c.inMonth);
      return s === 'available' || s === 'blocked';
    });
    const available = togglable.filter((c) => statusOf(c.date, c.inMonth) === 'available');
    if (togglable.length === 0) return null;
    if (available.length > 0) {
      return { label: 'Close week', action: () => applyBlock(available.map((c) => keyOf(c.date)), true) };
    }
    return { label: 'Open week', action: () => applyBlock(togglable.map((c) => keyOf(c.date)), false) };
  };

  const cellClass = (status: DayStatus): string => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-900 border-green-300 hover:bg-green-200 cursor-pointer';
      case 'blocked':
        return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200 cursor-pointer line-through';
      case 'booked':
        return 'bg-amber-200 text-brandDark border-brand hover:bg-amber-300 cursor-pointer';
      case 'off':
        return 'bg-themeBg text-gray-400 border-themeBorder hover:bg-gray-100 cursor-pointer';
      case 'past':
        return 'bg-themeBg text-gray-300 border-gray-100 cursor-pointer';
      default:
        return 'bg-transparent text-transparent border-transparent';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-themeMuted">Loading…</p>
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-red-600">{error || 'Could not load settings'}</p>
      </div>
    );
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
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

  // Modal status derived live from current state.
  const modalStatus: DayStatus | null = selectedDate
    ? statusOf(dateFromKey(selectedDate), true)
    : null;
  const modalJobs = selectedDate ? jobsByDate[selectedDate] || [] : [];
  const modalWeekdayOn = selectedDate ? weekdayOn(dateFromKey(selectedDate)) : false;

  return (
    <div className="min-h-screen bg-themeBg py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Recurring weekday defaults */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8">
          <h1 className="text-2xl font-bold mb-1">Scheduling Availability</h1>
          <p className="text-themeMuted mb-6 text-sm">
            Set your normal working days, then use the calendar to close off, open, or inspect any day. One job per available day.
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
          {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{message}</div>}

          <p className="text-sm font-semibold mb-2">Normal working days</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.key}
                onClick={() => toggleWeekday(d.key)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  (settings as any)[d.key]
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-themeMuted border-themeBorder hover:border-brand'
                }`}
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2">How far ahead can clients book? (weeks)</label>
            <input
              type="number"
              min={1}
              max={52}
              value={settings.bookingWindowWeeks}
              onChange={(e) => setSettings({ ...settings, bookingWindowWeeks: parseInt(e.target.value) || 1 })}
              className="w-32 px-3 py-2 border border-themeBorder rounded-lg"
            />
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-5 py-2 bg-brand text-white rounded-lg hover:bg-brandDark disabled:opacity-50 font-semibold"
          >
            {saving ? 'Saving…' : 'Save working days'}
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <button onClick={goPrev} disabled={!canGoPrev} className="px-3 py-1 rounded border border-themeBorder text-themeMuted hover:bg-themeBg disabled:opacity-40">‹ Prev</button>
            <h2 className="text-base sm:text-lg font-bold">{monthLabel}</h2>
            <button onClick={goNext} className="px-3 py-1 rounded border border-themeBorder text-themeMuted hover:bg-themeBg">Next ›</button>
          </div>

          <p className="text-xs text-themeMuted mb-3">Click any day to view jobs or open/close it. “Close week” blocks a whole row.</p>

          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-8 gap-1 mb-1">
                <div className="text-xs" />
                {DOW_LABELS.map((l) => (
                  <div key={l} className="text-center text-xs font-semibold text-themeMuted">{l}</div>
                ))}
              </div>

              <div className="space-y-1">
                {weeks.map((row, ri) => {
                  const wt = weekToggle(row);
                  return (
                    <div key={ri} className="grid grid-cols-8 gap-1 items-stretch">
                      <button
                        onClick={wt?.action}
                        disabled={!wt}
                        className={`text-[10px] leading-tight rounded px-1 ${wt ? 'text-themeMuted hover:bg-gray-100 border border-themeBorder' : 'text-transparent'}`}
                      >
                        {wt ? wt.label : ''}
                      </button>
                      {row.map((c, ci) => {
                        const status = statusOf(c.date, c.inMonth);
                        const key = keyOf(c.date);
                        const dayNum = c.date.getUTCDate();
                        return (
                          <button
                            key={ci}
                            onClick={() => status !== 'out' && setSelectedDate(key)}
                            disabled={status === 'out'}
                            className={`h-12 rounded border text-sm flex flex-col items-center justify-center ${cellClass(status)}`}
                          >
                            {status !== 'out' && <span>{dayNum}</span>}
                            {status === 'booked' && <span className="text-[9px] leading-none">{jobsByDate[key]?.length} job</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4 text-xs text-themeMuted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Open</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Closed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-brand inline-block" /> Booked</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-themeBg border border-themeBorder inline-block" /> Not a working day</span>
          </div>
        </div>
      </div>

      {/* Day-detail modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-2 mb-3">
              <h3 className="text-lg font-bold break-words">{fmtLong(selectedDate)}</h3>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-themeMuted text-xl leading-none">×</button>
            </div>

            <p className="text-sm text-themeMuted mb-4">
              Status:{' '}
              <span className="font-semibold">
                {modalStatus === 'booked' && 'Booked'}
                {modalStatus === 'available' && 'Open for booking'}
                {modalStatus === 'blocked' && 'Closed'}
                {modalStatus === 'off' && 'Not a working day'}
                {modalStatus === 'past' && 'Past date'}
              </span>
            </p>

            {/* Scheduled jobs */}
            {modalJobs.length > 0 ? (
              <div className="mb-4">
                <p className="text-sm font-semibold mb-2">Scheduled job{modalJobs.length > 1 ? 's' : ''}</p>
                <div className="space-y-2">
                  {modalJobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/admin/quotes/${j.id}`}
                      className="block border border-themeBorder rounded-lg p-3 hover:bg-themeBg"
                    >
                      <p className="font-semibold text-themeText">{j.name}</p>
                      <p className="text-sm text-themeMuted">
                        {j.category}
                        {j.slot ? ` · ${j.slot === 'afternoon' ? 'Afternoon' : 'Morning'}` : ''}
                      </p>
                      <p className="text-xs text-accent mt-1">Open ticket →</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-themeMuted mb-4">No jobs scheduled this day.</p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {modalStatus === 'available' && modalWeekdayOn && (
                <button
                  onClick={() => { applyBlock([selectedDate], true); setSelectedDate(null); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold"
                >
                  Close this day
                </button>
              )}
              {modalStatus === 'available' && !modalWeekdayOn && (
                <button
                  onClick={() => { applyOpen([selectedDate], false); setSelectedDate(null); }}
                  className="px-4 py-2 bg-themeBg0 text-white rounded-lg hover:bg-gray-600 text-sm font-semibold"
                >
                  Remove one-off opening
                </button>
              )}
              {modalStatus === 'blocked' && (
                <button
                  onClick={() => { applyBlock([selectedDate], false); setSelectedDate(null); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                >
                  Reopen this day
                </button>
              )}
              {modalStatus === 'off' && (
                <button
                  onClick={() => { applyOpen([selectedDate], true); setSelectedDate(null); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                >
                  Make this day available
                </button>
              )}
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 bg-gray-200 text-themeMuted rounded-lg hover:bg-gray-300 text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
