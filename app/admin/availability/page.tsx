'use client';

import { useEffect, useState } from 'react';
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

export default function AvailabilityPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/availability');
        if (res.status === 401) {
          router.push('/admin');
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setSettings(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const toggle = (key: string) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !(settings as any)[key] });
  };

  const save = async () => {
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
      setSettings(data);
      setMessage('Saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold mb-1">Scheduling Availability</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Choose which weekdays clients can book after approving a quote. One job per available day.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
              {message}
            </div>
          )}

          <div className="space-y-2 mb-6">
            {WEEKDAYS.map((d) => (
              <label
                key={d.key}
                className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <span className="font-medium text-gray-800">{d.label}</span>
                <input
                  type="checkbox"
                  checked={(settings as any)[d.key]}
                  onChange={() => toggle(d.key)}
                  className="h-5 w-5 rounded border-gray-300"
                />
              </label>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">
              How far ahead can clients book? (weeks)
            </label>
            <input
              type="number"
              min={1}
              max={52}
              value={settings.bookingWindowWeeks}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  bookingWindowWeeks: parseInt(e.target.value) || 1,
                })
              }
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-semibold"
          >
            {saving ? 'Saving…' : 'Save Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
