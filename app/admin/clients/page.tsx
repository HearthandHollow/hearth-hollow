'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClientSite {
  id: string;
  name: string;
  url: string;
  lastOk: boolean | null;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  lastCheckedAt: string | null;
}

interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  periodLabel: string;
  total: number;
  status: string;
}

interface Client {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  monthlyRate: number | null;
  sites: ClientSite[];
  invoices: ClientInvoice[];
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  prospect: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  former: 'bg-gray-200 text-gray-600',
};

function uptimeDot(site: ClientSite) {
  if (site.lastOk === null) return { dot: 'bg-gray-300', label: 'not checked yet' };
  if (site.lastOk) return { dot: 'bg-green-500', label: `up (${site.lastStatusCode}, ${site.lastLatencyMs}ms)` };
  return { dot: 'bg-red-500', label: `down (${site.lastStatusCode ?? 'no response'})` };
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    monthlyRate: '',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clients');
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load clients');
      setClients(data.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const addClient = async () => {
    if (!addForm.businessName.trim()) {
      setError('Business name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add client');
      setShowAdd(false);
      setAddForm({ businessName: '', contactName: '', email: '', phone: '', monthlyRate: '', status: 'active' });
      router.push(`/admin/clients/${data.client.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add client');
    } finally {
      setSaving(false);
    }
  };

  const checkAllSites = async () => {
    setChecking(true);
    setError('');
    try {
      const siteIds = clients.flatMap((c) => c.sites.map((s) => s.id));
      for (const id of siteIds) {
        await fetch(`/api/admin/sites/${id}/check`, { method: 'POST' });
      }
      await load();
    } catch {
      setError('Some site checks failed');
    } finally {
      setChecking(false);
    }
  };

  const totalMrr = clients
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + (c.monthlyRate || 0), 0);

  return (
    <div className="min-h-screen bg-themeBg">
      {/* Header */}
      <div className="bg-white border-b border-themeBorder px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-themeText">Clients</h1>
          <p className="text-themeMuted">Websites, apps, analytics, and invoices for every client business</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto sm:mr-14">
          <button
            onClick={checkAllSites}
            disabled={checking || clients.every((c) => c.sites.length === 0)}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg"
          >
            {checking ? 'Checking…' : '📡 Check all sites'}
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="px-4 py-2 bg-brand hover:bg-brandDark text-white font-semibold rounded-lg transition"
          >
            + Add client
          </button>
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Add client form */}
        {showAdd && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <h2 className="text-lg font-bold text-themeText mb-4">New client</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Business name *</label>
                <input
                  value={addForm.businessName}
                  onChange={(e) => setAddForm({ ...addForm, businessName: e.target.value })}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder="e.g. Badin Urgent Care"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Contact name</label>
                <input
                  value={addForm.contactName}
                  onChange={(e) => setAddForm({ ...addForm, contactName: e.target.value })}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Phone</label>
                <input
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Monthly rate ($)</label>
                <input
                  type="number"
                  value={addForm.monthlyRate}
                  onChange={(e) => setAddForm({ ...addForm, monthlyRate: e.target.value })}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                  placeholder="e.g. 150"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Status</label>
                <select
                  value={addForm.status}
                  onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-themeBorder rounded-lg"
                >
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="paused">Paused</option>
                  <option value="former">Former</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={addClient}
                disabled={saving}
                className="bg-brand hover:bg-brandDark disabled:bg-gray-400 text-white font-semibold px-5 py-2 rounded-lg transition"
              >
                {saving ? 'Saving…' : 'Create client'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Summary strip */}
        {!loading && clients.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-themeText">{clients.length}</div>
              <div className="text-sm text-themeMuted">Clients</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-themeText">
                {clients.reduce((n, c) => n + c.sites.length, 0)}
              </div>
              <div className="text-sm text-themeMuted">Sites &amp; apps</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-themeText">${totalMrr.toFixed(0)}</div>
              <div className="text-sm text-themeMuted">Monthly recurring</div>
            </div>
          </div>
        )}

        {/* Client list */}
        {loading ? (
          <p className="text-themeMuted">Loading clients…</p>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-themeMuted">
            No clients yet. Add your first one — the urgent care and farrier businesses are good candidates.
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => {
              const unpaid = client.invoices.filter((i) => i.status === 'sent');
              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="block bg-white rounded-lg shadow p-4 sm:p-6 hover:shadow-md transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-lg font-bold text-themeText">{client.businessName}</h2>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[client.status] || STATUS_STYLES.former}`}
                        >
                          {client.status}
                        </span>
                        {client.monthlyRate ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-brandDark">
                            ${client.monthlyRate}/mo
                          </span>
                        ) : null}
                        {unpaid.length > 0 && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-800">
                            {unpaid.length} unpaid invoice{unpaid.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-themeMuted mt-1">
                        {client.contactName || 'No contact'}
                        {client.email ? ` · ${client.email}` : ''}
                        {client.phone ? ` · ${client.phone}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {client.sites.length === 0 ? (
                        <span className="text-sm text-themeMuted">No sites yet</span>
                      ) : (
                        client.sites.map((site) => {
                          const s = uptimeDot(site);
                          return (
                            <span key={site.id} className="flex items-center gap-2 text-sm text-themeText">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`} title={s.label} />
                              {site.name}
                              <span className="text-themeMuted text-xs">{s.label}</span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
