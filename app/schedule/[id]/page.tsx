'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function SchedulePage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const token = search.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [alreadyBooked, setAlreadyBooked] = useState<{ date: string; slot: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slot, setSlot] = useState<'morning' | 'afternoon'>('morning');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ date: string; slot: string } | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/schedule/${id}/availability?token=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load availability');
      setCustomerName(data.customerName || '');
      setDates(data.dates || []);
      setAlreadyBooked(data.alreadyBooked || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability');
    } finally {
      setLoading(false);
    }
  };

  const fmtLong = (key: string) => {
    const d = new Date(`${key}T12:00:00Z`);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const fmtShort = (key: string) => {
    const d = new Date(`${key}T12:00:00Z`);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  const submit = async () => {
    if (!selectedDate) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(
        `/api/schedule/${id}/book?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, slot }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not book that date');
      setConfirmed({ date: selectedDate, slot });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book that date');
      // Refresh availability in case the date was just taken.
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-themeBg py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8">{children}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <p className="text-themeMuted">Loading available dates…</p>
      </Shell>
    );
  }

  if (error && dates.length === 0 && !confirmed && !alreadyBooked) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold mb-2">Scheduling</h1>
        <p className="text-red-600">{error}</p>
        <p className="text-themeMuted mt-3 text-sm">
          If this link isn&apos;t working, reply to your estimate email and we&apos;ll help you book.
        </p>
      </Shell>
    );
  }

  if (confirmed) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-2xl font-bold mb-2">You&apos;re booked!</h1>
          <p className="text-themeMuted">
            {fmtLong(confirmed.date)} — {confirmed.slot === 'afternoon' ? 'Afternoon' : 'Morning'}
          </p>
          <p className="text-themeMuted mt-4 text-sm">
            We&apos;ve emailed you a confirmation and will reach out to confirm the exact arrival time. Thanks for choosing The Hearth &amp; Hollow!
          </p>
        </div>
      </Shell>
    );
  }

  if (alreadyBooked) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold mb-2">You&apos;re already scheduled</h1>
        <p className="text-themeMuted">
          {fmtLong(alreadyBooked.date)} —{' '}
          {alreadyBooked.slot === 'afternoon' ? 'Afternoon' : 'Morning'}
        </p>
        <p className="text-themeMuted mt-4 text-sm">
          Need to change it? Reply to your confirmation email and we&apos;ll sort it out.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-1">Schedule your project</h1>
      <p className="text-themeMuted mb-6">
        {customerName ? `Thanks, ${customerName}! ` : ''}Pick a day that works for you.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {dates.length === 0 ? (
        <p className="text-themeMuted">
          No open dates right now — please reply to your estimate email and we&apos;ll find a time.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`px-3 py-3 rounded-lg border text-sm font-medium ${
                  selectedDate === d
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-themeMuted border-themeBorder hover:border-brand'
                }`}
              >
                {fmtShort(d)}
              </button>
            ))}
          </div>

          {selectedDate && (
            <div className="border-t pt-5">
              <p className="font-semibold mb-1">{fmtLong(selectedDate)}</p>
              <p className="text-sm text-themeMuted mb-3">What time of day works best?</p>
              <div className="flex gap-2 mb-5">
                {(['morning', 'afternoon'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium ${
                      slot === s
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-themeMuted border-themeBorder hover:border-brand'
                    }`}
                  >
                    {s === 'morning' ? 'Morning' : 'Afternoon'}
                  </button>
                ))}
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                {submitting ? 'Booking…' : `Confirm ${fmtShort(selectedDate)} (${slot === 'morning' ? 'Morning' : 'Afternoon'})`}
              </button>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
