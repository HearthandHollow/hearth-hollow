'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Site {
  id: string;
  name: string;
  url: string;
  stagingUrl: string | null;
  repoUrl: string | null;
  hostingNotes: string | null;
  ga4PropertyId: string | null;
  config: Record<string, unknown>;
  configToken: string;
  lastOk: boolean | null;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  lastCheckedAt: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodLabel: string;
  lineItems: { description: string; amount: number }[];
  total: number;
  notes: string | null;
  status: string;
  sentAt: string | null;
  paidAt: string | null;
}

interface Client {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  monthlyRate: number | null;
  billingDay: number | null;
  sites: Site[];
  invoices: Invoice[];
}

// The "standard basics" every client site can read live from
// /api/sites/config?token=… — edit these here, they change on the site
// without a deploy (once the site fetches its config).
const QUICK_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'announcement', label: 'Announcement banner', placeholder: 'e.g. Closed Labor Day · Reopens Tuesday 8am' },
  { key: 'phone', label: 'Public phone', placeholder: 'e.g. (704) 555-0134' },
  { key: 'email', label: 'Public email', placeholder: 'e.g. frontdesk@…' },
  { key: 'hours', label: 'Hours', placeholder: 'e.g. Mon–Fri 8–5, Sat 9–1' },
  { key: 'address', label: 'Address', placeholder: 'Street, City, ST' },
];

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // profile edit
  const [profile, setProfile] = useState({
    businessName: '', contactName: '', email: '', phone: '',
    status: 'active', notes: '', monthlyRate: '', billingDay: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // site add/edit
  const [showAddSite, setShowAddSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: '', url: '', ga4PropertyId: '', repoUrl: '', hostingNotes: '' });
  const [savingSite, setSavingSite] = useState(false);
  const [openSite, setOpenSite] = useState<string | null>(null);
  const [configDrafts, setConfigDrafts] = useState<Record<string, Record<string, string>>>({});
  const [advancedJson, setAdvancedJson] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});

  // invoice create
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invItems, setInvItems] = useState<{ description: string; amount: string }[]>([]);
  const [invPeriod, setInvPeriod] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`);
      if (res.status === 401) { router.push('/admin'); return; }
      if (res.status === 404) { setError('Client not found'); setLoading(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const c: Client = data.client;
      setClient(c);
      setProfile({
        businessName: c.businessName,
        contactName: c.contactName || '',
        email: c.email || '',
        phone: c.phone || '',
        status: c.status,
        notes: c.notes || '',
        monthlyRate: c.monthlyRate != null ? String(c.monthlyRate) : '',
        billingDay: c.billingDay != null ? String(c.billingDay) : '',
      });
      const drafts: Record<string, Record<string, string>> = {};
      const advanced: Record<string, string> = {};
      for (const s of c.sites) {
        const cfg = (s.config || {}) as Record<string, unknown>;
        const quick: Record<string, string> = {};
        for (const f of QUICK_FIELDS) quick[f.key] = typeof cfg[f.key] === 'string' ? (cfg[f.key] as string) : '';
        drafts[s.id] = quick;
        const extras: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cfg)) {
          if (!QUICK_FIELDS.some((f) => f.key === k)) extras[k] = v;
        }
        advanced[s.id] = JSON.stringify(extras, null, 2);
      }
      setConfigDrafts(drafts);
      setAdvancedJson(advanced);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.status === 401) { router.push('/admin'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      flash('Profile saved');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const deleteClient = async () => {
    if (!client) return;
    if (!window.confirm(`Delete ${client.businessName} and all their sites and invoices? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/clients/${clientId}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/clients');
    else setError('Failed to delete client');
  };

  const addSite = async () => {
    if (!siteForm.name.trim() || !siteForm.url.trim()) { setError('Site name and URL are required'); return; }
    setSavingSite(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm),
      });
      if (res.status === 401) { router.push('/admin'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add site');
      setShowAddSite(false);
      setSiteForm({ name: '', url: '', ga4PropertyId: '', repoUrl: '', hostingNotes: '' });
      flash('Site added');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add site');
    } finally {
      setSavingSite(false);
    }
  };

  const saveSiteConfig = async (site: Site) => {
    setError('');
    let extras: Record<string, unknown> = {};
    const advText = (advancedJson[site.id] || '').trim();
    if (advText && advText !== '{}') {
      try {
        extras = JSON.parse(advText);
      } catch {
        setError(`"${site.name}": the advanced JSON isn't valid JSON — fix it or clear it, then save again`);
        return;
      }
    }
    const quick = configDrafts[site.id] || {};
    const config: Record<string, unknown> = { ...extras };
    for (const f of QUICK_FIELDS) {
      const v = (quick[f.key] || '').trim();
      if (v) config[f.key] = v;
    }
    const res = await fetch(`/api/admin/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    if (res.status === 401) { router.push('/admin'); return; }
    if (res.ok) { flash(`${site.name}: live content saved`); await load(); }
    else setError('Failed to save site content');
  };

  const checkSiteNow = async (site: Site) => {
    const res = await fetch(`/api/admin/sites/${site.id}/check`, { method: 'POST' });
    if (res.status === 401) { router.push('/admin'); return; }
    if (res.ok) await load();
  };

  const rotateToken = async (site: Site) => {
    if (!window.confirm(`Rotate the config token for ${site.name}? The site must be updated with the new token before it can read its live content again.`)) return;
    const res = await fetch(`/api/admin/sites/${site.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotateToken: true }),
    });
    if (res.ok) { flash('Token rotated'); await load(); }
    else setError('Failed to rotate token');
  };

  const deleteSite = async (site: Site) => {
    if (!window.confirm(`Remove ${site.name}?`)) return;
    const res = await fetch(`/api/admin/sites/${site.id}`, { method: 'DELETE' });
    if (res.ok) { flash('Site removed'); await load(); }
    else setError('Failed to remove site');
  };

  const openInvoiceForm = () => {
    if (!client) return;
    setInvItems([
      {
        description: `Website care plan — ${client.businessName}`,
        amount: client.monthlyRate != null ? String(client.monthlyRate) : '',
      },
    ]);
    setInvPeriod(new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    setInvNotes('');
    setShowAddInvoice(true);
  };

  const createInvoice = async () => {
    setSavingInvoice(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodLabel: invPeriod,
          notes: invNotes,
          lineItems: invItems.map((li) => ({ description: li.description, amount: Number(li.amount) })),
        }),
      });
      if (res.status === 401) { router.push('/admin'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
      setShowAddInvoice(false);
      flash(`Invoice ${data.invoice.invoiceNumber} created as a draft`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const sendInvoice = async (invoice: Invoice) => {
    if (!client?.email) { setError('Add an email address to the client profile before sending invoices'); return; }
    if (!window.confirm(`Email invoice ${invoice.invoiceNumber} ($${invoice.total.toFixed(2)}) to ${client.email} with a pay link?`)) return;
    setSendingInvoiceId(invoice.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/client-invoices/${invoice.id}/send`, { method: 'POST' });
      if (res.status === 401) { router.push('/admin'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invoice');
      flash(data.payLinkIncluded ? 'Invoice emailed with a Stripe pay link' : 'Invoice emailed (no pay link — Stripe unavailable)');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invoice');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const markInvoice = async (invoice: Invoice, status: string) => {
    const res = await fetch(`/api/admin/client-invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { flash(`Invoice marked ${status}`); await load(); }
    else setError('Failed to update invoice');
  };

  const deleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Delete draft invoice ${invoice.invoiceNumber}?`)) return;
    const res = await fetch(`/api/admin/client-invoices/${invoice.id}`, { method: 'DELETE' });
    if (res.ok) { flash('Invoice deleted'); await load(); }
    else setError('Failed to delete invoice');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-themeMuted">Loading client…</p>
      </div>
    );
  }
  if (!client) {
    return (
      <div className="min-h-screen bg-themeBg p-6">
        <p className="text-red-600">{error || 'Client not found'}</p>
        <Link href="/admin/clients" className="text-brand underline">Back to Clients</Link>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-themeBorder rounded-lg';

  return (
    <div className="min-h-screen bg-themeBg">
      {/* Header */}
      <div className="bg-white border-b border-themeBorder px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-themeText">{client.businessName}</h1>
          <p className="text-themeMuted">Client profile, sites, live content, and invoices</p>
        </div>
        <Link
          href="/admin/clients"
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg self-start sm:self-auto sm:mr-14"
        >
          Back to Clients
        </Link>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">{success}</div>
        )}

        {/* Profile */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-bold text-themeText mb-4">👤 Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Business name</label>
              <input value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Contact name</label>
              <input value={profile.contactName} onChange={(e) => setProfile({ ...profile, contactName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Email (invoices go here)</label>
              <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Phone</label>
              <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Status</label>
              <select value={profile.status} onChange={(e) => setProfile({ ...profile, status: e.target.value })} className={inputCls}>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="paused">Paused</option>
                <option value="former">Former</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Monthly rate ($)</label>
                <input type="number" value={profile.monthlyRate} onChange={(e) => setProfile({ ...profile, monthlyRate: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Billing day</label>
                <input type="number" min={1} max={28} value={profile.billingDay} onChange={(e) => setProfile({ ...profile, billingDay: e.target.value })} className={inputCls} placeholder="1–28" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold mb-2">Notes</label>
              <textarea value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} rows={3} className={inputCls} placeholder="Agreements, preferences, history — anything worth remembering" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-between">
            <button onClick={saveProfile} disabled={savingProfile} className="bg-brand hover:bg-brandDark disabled:bg-gray-400 text-white font-semibold px-5 py-2 rounded-lg transition">
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
            <button onClick={deleteClient} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg">
              Delete client
            </button>
          </div>
        </div>

        {/* Sites */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-themeText">🌐 Sites &amp; apps</h2>
            <button onClick={() => setShowAddSite((v) => !v)} className="px-4 py-2 bg-brand hover:bg-brandDark text-white font-semibold rounded-lg transition">
              + Add site
            </button>
          </div>

          {showAddSite && (
            <div className="border border-themeBorder rounded-lg p-4 mb-4 bg-amber-50/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Name *</label>
                  <input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} className={inputCls} placeholder="e.g. Urgent care website" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Live URL *</label>
                  <input value={siteForm.url} onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })} className={inputCls} placeholder="https://…" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">GA4 property ID</label>
                  <input value={siteForm.ga4PropertyId} onChange={(e) => setSiteForm({ ...siteForm, ga4PropertyId: e.target.value })} className={inputCls} placeholder="numeric id, e.g. 543475870" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Repo URL</label>
                  <input value={siteForm.repoUrl} onChange={(e) => setSiteForm({ ...siteForm, repoUrl: e.target.value })} className={inputCls} placeholder="https://github.com/…" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-2">Hosting notes</label>
                  <textarea value={siteForm.hostingNotes} onChange={(e) => setSiteForm({ ...siteForm, hostingNotes: e.target.value })} rows={2} className={inputCls} placeholder="Where it runs, DNS, where credentials live (never the secrets themselves)" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={addSite} disabled={savingSite} className="bg-brand hover:bg-brandDark disabled:bg-gray-400 text-white font-semibold px-5 py-2 rounded-lg transition">
                  {savingSite ? 'Saving…' : 'Add site'}
                </button>
                <button onClick={() => setShowAddSite(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {client.sites.length === 0 && !showAddSite && (
            <p className="text-themeMuted">No sites yet — add the live site to start monitoring it and editing its content.</p>
          )}

          <div className="space-y-3">
            {client.sites.map((site) => {
              const isOpen = openSite === site.id;
              const dot = site.lastOk === null ? 'bg-gray-300' : site.lastOk ? 'bg-green-500' : 'bg-red-500';
              const statusLabel =
                site.lastOk === null
                  ? 'Not checked yet'
                  : site.lastOk
                    ? `Up · HTTP ${site.lastStatusCode} · ${site.lastLatencyMs}ms`
                    : `DOWN · ${site.lastStatusCode ?? 'no response'}`;
              return (
                <div key={site.id} className="border border-themeBorder rounded-lg">
                  <button
                    onClick={() => setOpenSite(isOpen ? null : site.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <span className={`inline-block w-3 h-3 rounded-full ${dot}`} />
                    <span className="font-semibold text-themeText flex-1">{site.name}</span>
                    <span className="text-sm text-themeMuted hidden sm:inline">{statusLabel}</span>
                    <span className="text-themeMuted">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-themeBorder p-4 space-y-4">
                      {/* Links + actions */}
                      <div className="flex flex-wrap gap-2 text-sm">
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-themeText">
                          🔗 Open site
                        </a>
                        {site.ga4PropertyId && (
                          <a
                            href={`https://analytics.google.com/analytics/web/#/p${site.ga4PropertyId}/reports/intelligenthome`}
                            target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-themeText"
                          >
                            📊 Analytics
                          </a>
                        )}
                        {site.repoUrl && (
                          <a href={site.repoUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-themeText">
                            📦 Repo
                          </a>
                        )}
                        <button onClick={() => checkSiteNow(site)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-themeText">
                          📡 Check now
                        </button>
                        <button onClick={() => deleteSite(site)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-700">
                          Remove
                        </button>
                      </div>
                      <p className="text-sm text-themeMuted sm:hidden">{statusLabel}</p>
                      {site.hostingNotes && (
                        <p className="text-sm text-themeMuted whitespace-pre-wrap">{site.hostingNotes}</p>
                      )}

                      {/* Live content */}
                      <div>
                        <h3 className="font-semibold text-themeText mb-1">✏️ Live content</h3>
                        <p className="text-sm text-themeMuted mb-3">
                          These values are served to the site at{' '}
                          <code className="bg-gray-100 px-1 rounded text-xs break-all">/api/sites/config?token={site.configToken}</code>{' '}
                          — once the site reads them, edits here go live without a deploy.
                          <button onClick={() => rotateToken(site)} className="ml-2 underline text-themeMuted hover:text-themeText">rotate token</button>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {QUICK_FIELDS.map((f) => (
                            <div key={f.key} className={f.key === 'announcement' ? 'sm:col-span-2' : ''}>
                              <label className="block text-sm font-medium text-themeMuted mb-1">{f.label}</label>
                              <input
                                value={configDrafts[site.id]?.[f.key] || ''}
                                onChange={(e) =>
                                  setConfigDrafts({
                                    ...configDrafts,
                                    [site.id]: { ...configDrafts[site.id], [f.key]: e.target.value },
                                  })
                                }
                                className={inputCls}
                                placeholder={f.placeholder}
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowAdvanced({ ...showAdvanced, [site.id]: !showAdvanced[site.id] })}
                          className="text-sm text-themeMuted underline mt-2"
                        >
                          {showAdvanced[site.id] ? 'Hide' : 'Show'} advanced JSON (extra fields)
                        </button>
                        {showAdvanced[site.id] && (
                          <textarea
                            value={advancedJson[site.id] || ''}
                            onChange={(e) => setAdvancedJson({ ...advancedJson, [site.id]: e.target.value })}
                            rows={5}
                            className={`${inputCls} font-mono text-sm mt-2`}
                            spellCheck={false}
                          />
                        )}
                        <div className="mt-3">
                          <button onClick={() => saveSiteConfig(site)} className="bg-brand hover:bg-brandDark text-white font-semibold px-5 py-2 rounded-lg transition">
                            Save live content
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-themeText">🧾 Invoices</h2>
            <button onClick={openInvoiceForm} className="px-4 py-2 bg-brand hover:bg-brandDark text-white font-semibold rounded-lg transition">
              + New invoice
            </button>
          </div>

          {showAddInvoice && (
            <div className="border border-themeBorder rounded-lg p-4 mb-4 bg-amber-50/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-semibold mb-2">Billing period</label>
                  <input value={invPeriod} onChange={(e) => setInvPeriod(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Notes (shown on the invoice)</label>
                  <input value={invNotes} onChange={(e) => setInvNotes(e.target.value)} className={inputCls} placeholder="optional" />
                </div>
              </div>
              <label className="block text-sm font-semibold mb-2">Line items</label>
              {invItems.map((li, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={li.description}
                    onChange={(e) => setInvItems(invItems.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                    className={`${inputCls} flex-1`}
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    value={li.amount}
                    onChange={(e) => setInvItems(invItems.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    className={`${inputCls} w-28`}
                    placeholder="$"
                  />
                  <button onClick={() => setInvItems(invItems.filter((_, j) => j !== i))} className="px-3 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                </div>
              ))}
              <button onClick={() => setInvItems([...invItems, { description: '', amount: '' }])} className="text-sm text-brand underline mb-3">
                + add line item
              </button>
              <div className="flex gap-2">
                <button onClick={createInvoice} disabled={savingInvoice} className="bg-brand hover:bg-brandDark disabled:bg-gray-400 text-white font-semibold px-5 py-2 rounded-lg transition">
                  {savingInvoice ? 'Creating…' : 'Create draft'}
                </button>
                <button onClick={() => setShowAddInvoice(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {client.invoices.length === 0 && !showAddInvoice ? (
            <p className="text-themeMuted">
              No invoices yet.{client.monthlyRate ? ` "New invoice" prefills the $${client.monthlyRate}/mo care-plan line.` : ' Set a monthly rate on the profile to prefill them.'}
            </p>
          ) : (
            <div className="space-y-2">
              {client.invoices.map((inv) => (
                <div key={inv.id} className="border border-themeBorder rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-themeText">{inv.invoiceNumber}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : inv.status === 'sent'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                      <span className="text-sm text-themeMuted">{inv.periodLabel}</span>
                    </div>
                    <p className="text-sm text-themeMuted">
                      ${inv.total.toFixed(2)}
                      {inv.sentAt ? ` · sent ${new Date(inv.sentAt).toLocaleDateString()}` : ''}
                      {inv.paidAt ? ` · paid ${new Date(inv.paidAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {inv.status !== 'paid' && (
                      <button
                        onClick={() => sendInvoice(inv)}
                        disabled={sendingInvoiceId === inv.id}
                        className="px-3 py-1.5 bg-brand hover:bg-brandDark disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition"
                      >
                        {sendingInvoiceId === inv.id ? 'Sending…' : inv.status === 'sent' ? '📧 Resend' : '📧 Send'}
                      </button>
                    )}
                    {inv.status === 'sent' && (
                      <button onClick={() => markInvoice(inv, 'paid')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">
                        Mark paid
                      </button>
                    )}
                    {inv.status !== 'paid' && (
                      <button onClick={() => deleteInvoice(inv)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm rounded-lg">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
