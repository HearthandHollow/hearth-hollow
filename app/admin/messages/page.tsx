'use client';

// WhatsApp Comms Hub inbox (Brain, 2026-10-21). One number, every project.
// Mobile-first: list view and thread view swap on phones; side by side on desktop.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const PROJECTS = ['RACKERTRACKER', 'HANDYMAN', 'HOMESTEAD', 'FABRICATION', 'CLIENT_SITES', 'GENERAL'] as const;
const LABEL: Record<string, string> = {
  RACKERTRACKER: 'RackerTracker', HANDYMAN: 'Handyman', HOMESTEAD: 'Farm & eggs',
  FABRICATION: 'Welding & fab', CLIENT_SITES: 'Client sites', GENERAL: 'General', UNTAGGED: 'Untagged',
};

type ConvRow = {
  id: string; project: string | null; status: string; unreadCount: number; lastMessageAt: string; windowOpen: boolean;
  contact: { waId: string; profileName: string | null; optedIn: boolean; optedOutAt: string | null };
  last: { body: string | null; type: string; direction: string } | null;
};
type Msg = {
  id: string; direction: string; type: string; body: string | null; status: string; createdAt: string;
  mediaUrl: string | null; mediaMime: string | null; errorTitle: string | null; sentBy: string | null; templateName: string | null;
};
type Thread = {
  id: string; project: string | null; status: string; windowOpen: boolean; windowClosesAt: string | null;
  contact: { id: string; waId: string; profileName: string | null; optedIn: boolean; optedOutAt: string | null; projects: string[] };
  messages: Msg[];
};
type Template = { name: string; language: string; category: string; body: string };

const fmtTime = (s: string) => {
  const d = new Date(s);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
const tick = (m: Msg) => (m.direction !== 'out' ? '' : m.status === 'read' ? '✓✓ read' : m.status === 'delivered' ? '✓✓' : m.status === 'sent' ? '✓' : m.status === 'failed' ? '⚠ failed' : '…');
const who = (c: { profileName: string | null; waId: string }) => c.profileName || '+' + c.waId;

function Inbox() {
  const router = useRouter();
  const search = useSearchParams();
  const [filter, setFilter] = useState<string>('ALL');
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [selected, setSelected] = useState<string | null>(search.get('c'));
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tpl, setTpl] = useState('');
  const [vars, setVars] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const q = new URLSearchParams({ status });
    if (filter !== 'ALL') q.set('project', filter);
    const res = await fetch('/api/admin/whatsapp/conversations?' + q);
    if (res.status === 401) return router.push('/admin');
    const data = await res.json();
    if (res.ok) setRows(data.conversations);
  }, [filter, status, router]);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch('/api/admin/whatsapp/conversations/' + id);
    if (res.status === 401) return router.push('/admin');
    if (res.ok) setThread(await res.json());
  }, [router]);

  useEffect(() => { loadList(); const t = setInterval(loadList, 10000); return () => clearInterval(t); }, [loadList]);
  useEffect(() => {
    if (!selected) { setThread(null); return; }
    loadThread(selected); const t = setInterval(() => loadThread(selected), 8000); return () => clearInterval(t);
  }, [selected, loadThread]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread?.messages.length]);
  useEffect(() => { fetch('/api/admin/whatsapp/templates').then((r) => r.json()).then((d) => setTemplates(d.templates || [])).catch(() => {}); }, []);

  const patch = async (body: Record<string, unknown>) => {
    if (!thread) return;
    await fetch('/api/admin/whatsapp/conversations/' + thread.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    loadThread(thread.id); loadList();
  };
  const send = async (body: Record<string, unknown>) => {
    if (!thread) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${thread.id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Send failed');
      setText(''); setTpl(''); setVars([]);
      loadThread(thread.id); loadList();
    } catch (e) { setError(e instanceof Error ? e.message : 'Send failed'); } finally { setBusy(false); }
  };
  const tplObj = templates.find((t) => t.name === tpl);
  const tplVarCount = tplObj ? (tplObj.body.match(/\{\{\d+\}\}/g) || []).length : 0;

  return (
    <div className="min-h-screen bg-themeBg flex flex-col">
      <div className="bg-white border-b border-themeBorder px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {selected && <button className="sm:hidden text-brand font-semibold" onClick={() => setSelected(null)}>← Back</button>}
          <h1 className="text-xl font-bold text-brandDark">💬 WhatsApp</h1>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-brand mr-12">Dashboard</Link>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Conversation list */}
        <div className={`${selected ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-96 border-r border-themeBorder bg-white`}>
          <div className="p-2 flex flex-wrap gap-1 border-b border-themeBorder">
            {['ALL', ...PROJECTS, 'UNTAGGED'].map((p) => (
              <button key={p} onClick={() => setFilter(p)}
                className={`px-2 py-1 rounded-full text-xs border ${filter === p ? 'bg-brand text-white border-brand' : 'border-themeBorder text-themeMuted'}`}>
                {p === 'ALL' ? 'All' : LABEL[p]}
              </button>
            ))}
            <button onClick={() => setStatus(status === 'open' ? 'closed' : 'open')} className="ml-auto px-2 py-1 text-xs text-brand">
              {status === 'open' ? 'Show closed' : 'Show open'}
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {rows.length === 0 && <p className="p-4 text-themeMuted text-sm">No {status} conversations.</p>}
            {rows.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-themeBorder ${selected === c.id ? 'bg-themeBg' : ''}`}>
                <div className="flex justify-between gap-2">
                  <span className={`truncate ${c.unreadCount ? 'font-bold' : 'font-medium'}`}>{who(c.contact)}</span>
                  <span className="text-xs text-themeMuted shrink-0">{fmtTime(c.lastMessageAt)}</span>
                </div>
                <div className="flex justify-between gap-2 mt-1">
                  <span className="text-sm text-themeMuted truncate">
                    {c.last ? (c.last.direction === 'out' ? 'You: ' : '') + (c.last.body || `[${c.last.type}]`) : ''}
                  </span>
                  {c.unreadCount > 0 && <span className="shrink-0 bg-accent text-white text-xs rounded-full px-2">{c.unreadCount}</span>}
                </div>
                <span className="inline-block mt-1 text-[11px] px-2 rounded-full border border-themeBorder text-themeMuted">{LABEL[c.project || 'UNTAGGED']}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={`${selected ? 'flex' : 'hidden sm:flex'} flex-col flex-1 min-w-0`}>
          {!thread ? (
            <div className="m-auto text-themeMuted">Select a conversation</div>
          ) : (
            <>
              <div className="bg-white border-b border-themeBorder p-3 flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0">
                  <div className="font-semibold truncate">{who(thread.contact)}</div>
                  <div className="text-xs text-themeMuted">
                    +{thread.contact.waId} · {thread.contact.optedOutAt && !thread.contact.optedIn ? 'opted OUT (STOP)' : thread.contact.optedIn ? 'opted in' : 'not opted in'}
                  </div>
                </div>
                <select value={thread.project || ''} onChange={(e) => patch({ project: e.target.value || null })}
                  className="border border-themeBorder rounded px-2 py-1 text-sm">
                  <option value="">Untagged</option>
                  {PROJECTS.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
                </select>
                <button onClick={() => patch({ status: thread.status === 'open' ? 'closed' : 'open' })}
                  className="px-3 py-1 text-sm border border-themeBorder rounded">
                  {thread.status === 'open' ? 'Close' : 'Reopen'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {thread.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.direction === 'out' ? 'bg-brand text-white' : 'bg-white border border-themeBorder'}`}>
                      {m.mediaUrl && (m.mediaMime || '').startsWith('image/') && (
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer"><img src={m.mediaUrl} alt="attachment" className="rounded mb-1 max-h-64" /></a>
                      )}
                      {m.mediaUrl && !(m.mediaMime || '').startsWith('image/') && (
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline block mb-1">📎 {m.type} attachment</a>
                      )}
                      {!m.mediaUrl && ['image', 'video', 'audio', 'document', 'sticker'].includes(m.type) && <div className="italic opacity-70">[{m.type} — saving…]</div>}
                      {m.body}
                      <div className={`text-[10px] mt-1 ${m.direction === 'out' ? 'text-white/70' : 'text-themeMuted'}`}>
                        {fmtTime(m.createdAt)} {tick(m)} {m.sentBy === 'auto' ? '· auto' : m.sentBy?.startsWith('api:') ? '· ' + m.sentBy.slice(4) : ''}
                        {m.status === 'failed' && m.errorTitle ? ` — ${m.errorTitle}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="bg-white border-t border-themeBorder p-3 space-y-2">
                {error && <p className="text-red-600 text-sm">{error}</p>}
                {thread.contact.optedOutAt && !thread.contact.optedIn ? (
                  <p className="text-sm text-themeMuted">This person replied STOP. You can't message them unless they send START.</p>
                ) : thread.windowOpen ? (
                  <div className="flex gap-2">
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Type a reply…"
                      className="flex-1 border border-themeBorder rounded px-2 py-1 text-base" />
                    <button disabled={busy || !text.trim()} onClick={() => send({ text })}
                      className="px-4 bg-brand hover:bg-brandDark text-white rounded disabled:opacity-50">Send</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-themeMuted">The 24-hour reply window is closed — WhatsApp only allows an approved template until they message again.</p>
                    <select value={tpl} onChange={(e) => { setTpl(e.target.value); setVars([]); }} className="w-full border border-themeBorder rounded px-2 py-1 text-sm">
                      <option value="">{templates.length ? 'Choose a template…' : 'No approved templates yet'}</option>
                      {templates.map((t) => <option key={t.name + t.language} value={t.name}>{t.name} ({t.language})</option>)}
                    </select>
                    {tplObj && <p className="text-xs text-themeMuted whitespace-pre-wrap">{tplObj.body}</p>}
                    {Array.from({ length: tplVarCount }).map((_, i) => (
                      <input key={i} value={vars[i] || ''} placeholder={`{{${i + 1}}}`} onChange={(e) => { const v = [...vars]; v[i] = e.target.value; setVars(v); }}
                        className="w-full border border-themeBorder rounded px-2 py-1 text-sm" />
                    ))}
                    <button disabled={busy || !tpl} onClick={() => send({ template_name: tpl, language: tplObj?.language, variables: vars })}
                      className="w-full py-2 bg-brand hover:bg-brandDark text-white rounded disabled:opacity-50">Send template</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-themeMuted">Loading…</div>}>
      <Inbox />
    </Suspense>
  );
}
