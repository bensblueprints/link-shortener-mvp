import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Plus, Copy, Check, QrCode, BarChart3, Pencil, Trash2, Power,
  Download, Upload, LogOut, Lock, Globe, MousePointerClick, Users,
  ExternalLink, X, Wand2, ChevronDown, Loader2, Monitor, Compass, Flag,
} from 'lucide-react';

// ---------- api helper ----------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body && typeof opts.body === 'string' && !opts.csv
      ? { 'Content-Type': 'application/json' }
      : undefined,
    ...opts,
  });
  if (res.status === 401) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const fmt = (n) => (n ?? 0).toLocaleString();
const shortUrl = (slug) => `${window.location.origin}/${slug}`;

// ---------- shared bits ----------
function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function Btn({ children, variant = 'default', className = '', ...props }) {
  const styles = {
    default: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700',
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/50',
    ghost: 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100',
    danger: 'hover:bg-red-950/60 text-zinc-400 hover:text-red-400',
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors';

// ---------- login ----------
function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="w-96 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">Link Shortener</h1>
              <p className="text-xs text-zinc-500">Self-hosted · yours forever</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                autoFocus
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Btn variant="primary" className="w-full justify-center" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock dashboard'}
            </Btn>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

// ---------- create form (with UTM builder) ----------
function CreateForm({ onCreated }) {
  const [destination, setDestination] = useState('');
  const [slug, setSlug] = useState('');
  const [redirectType, setRedirectType] = useState('302');
  const [showUtm, setShowUtm] = useState(false);
  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '', term: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finalDestination = useMemo(() => {
    if (!destination) return '';
    try {
      const u = new URL(destination);
      for (const [k, v] of Object.entries(utm)) {
        if (v.trim()) u.searchParams.set(`utm_${k}`, v.trim());
      }
      return u.toString();
    } catch {
      return destination;
    }
  }, [destination, utm]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/links', {
        method: 'POST',
        body: JSON.stringify({
          destination: finalDestination,
          slug: slug.trim() || undefined,
          redirect_type: Number(redirectType),
        }),
      });
      setDestination('');
      setSlug('');
      setUtm({ source: '', medium: '', campaign: '', term: '', content: '' });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit}>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            placeholder="https://your-long-url.com/campaign/landing-page"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <div className="flex gap-3">
            <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950/70 focus-within:border-indigo-500">
              <span className="pl-3 text-sm text-zinc-500">/</span>
              <input
                placeholder="custom-slug (optional)"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-44 bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none"
              />
            </div>
            <select
              value={redirectType}
              onChange={(e) => setRedirectType(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-2 py-2 text-sm text-zinc-300 outline-none focus:border-indigo-500"
              title="Redirect type"
            >
              <option value="302">302 temp</option>
              <option value="301">301 perm</option>
            </select>
            <Btn variant="primary" disabled={busy || !destination}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Shorten
            </Btn>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowUtm((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-indigo-400 transition-colors"
        >
          <Wand2 className="h-3.5 w-3.5" />
          UTM builder
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showUtm ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showUtm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-3">
                {['source', 'medium', 'campaign', 'term', 'content'].map((k) => (
                  <input
                    key={k}
                    placeholder={`utm_${k}`}
                    value={utm[k]}
                    onChange={(e) => setUtm({ ...utm, [k]: e.target.value })}
                    className={inputCls}
                  />
                ))}
              </div>
              {finalDestination && finalDestination !== destination && (
                <p className="pt-2 text-xs text-zinc-500 break-all">
                  <span className="text-zinc-400 font-medium">Final URL:</span> {finalDestination}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </form>
    </Card>
  );
}

// ---------- tiny SVG bar chart ----------
function BarChart({ series }) {
  if (!series.length) {
    return <p className="text-sm text-zinc-500 py-10 text-center">No clicks in this period yet.</p>;
  }
  const W = 640, H = 160, pad = 4;
  const max = Math.max(...series.map((d) => d.clicks), 1);
  const bw = Math.max((W - pad * 2) / series.length - 3, 2);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Clicks over time">
        {series.map((d, i) => {
          const h = Math.max((d.clicks / max) * H, 2);
          const x = pad + i * ((W - pad * 2) / series.length);
          return (
            <g key={d.date}>
              <rect x={x} y={H - h} width={bw} height={h} rx="2" fill="#6366f1" opacity="0.85">
                <title>{`${d.date}: ${d.clicks} clicks`}</title>
              </rect>
              {(series.length <= 14 || i % Math.ceil(series.length / 10) === 0) && (
                <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#71717a">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TopList({ title, icon: Icon, items }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div>
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h4>
      {items.length === 0 && <p className="text-sm text-zinc-600">—</p>}
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.name} className="relative rounded-md overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-indigo-500/15 rounded-md"
              style={{ width: `${(it.count / max) * 100}%` }}
            />
            <div className="relative flex justify-between gap-2 px-2 py-1 text-sm">
              <span className="truncate text-zinc-300" title={it.name}>{it.name}</span>
              <span className="text-zinc-500 tabular-nums">{fmt(it.count)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- analytics modal ----------
function AnalyticsModal({ link, onClose }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api(`/api/links/${link.id}/analytics?days=${days}`).then(setData).catch((e) => setError(e.message));
  }, [link.id, days]);

  return (
    <Modal onClose={onClose} title={`Analytics — /${link.slug}`} wide>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500 truncate pr-4">{link.destination}</p>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-300 outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!data && !error && (
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                <MousePointerClick className="h-4 w-4" /> Total clicks
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums">{fmt(data.totalClicks)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider">
                <Users className="h-4 w-4" /> Unique visitors
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums">{fmt(data.uniqueClicks)}</p>
            </Card>
          </div>
          <Card className="p-4 mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Clicks over time</h4>
            <BarChart series={data.series} />
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <TopList title="Top referrers" icon={Compass} items={data.referrers} />
            <TopList title="Devices" icon={Monitor} items={data.devices} />
            <TopList title="Browsers" icon={Globe} items={data.browsers} />
            <TopList title="Countries" icon={Flag} items={data.countries} />
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------- QR modal ----------
function QrModal({ link, onClose }) {
  return (
    <Modal onClose={onClose} title={`QR code — /${link.slug}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-xl bg-white p-3">
          <img src={`/api/links/${link.id}/qr`} alt={`QR code for ${shortUrl(link.slug)}`} className="h-56 w-56" />
        </div>
        <p className="text-sm text-zinc-400">{shortUrl(link.slug)}</p>
        <div className="flex gap-2">
          <a href={`/api/links/${link.id}/qr?download=1`} download>
            <Btn><Download className="h-4 w-4" /> PNG</Btn>
          </a>
          <a href={`/api/links/${link.id}/qr?format=svg`} download>
            <Btn><Download className="h-4 w-4" /> SVG</Btn>
          </a>
        </div>
      </div>
    </Modal>
  );
}

// ---------- edit modal ----------
function EditModal({ link, onClose, onSaved }) {
  const [destination, setDestination] = useState(link.destination);
  const [slug, setSlug] = useState(link.slug);
  const [redirectType, setRedirectType] = useState(String(link.redirect_type));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/api/links/${link.id}`, {
        method: 'PUT',
        body: JSON.stringify({ destination, slug, redirect_type: Number(redirectType) }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Edit — /${link.slug}`}>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">
          <span className="text-zinc-400">Destination</span>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Redirect type</span>
          <select
            value={redirectType}
            onChange={(e) => setRedirectType(e.target.value)}
            className={`${inputCls} mt-1`}
          >
            <option value="302">302 — temporary (recount every click)</option>
            <option value="301">301 — permanent (browsers may cache)</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ---------- generic modal ----------
function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} my-8`}
      >
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ---------- link row ----------
function LinkRow({ link, onChanged, onAnalytics, onQr, onEdit }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(shortUrl(link.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggle = async () => {
    await api(`/api/links/${link.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !link.enabled }) });
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete /${link.slug} and all its click data?`)) return;
    await api(`/api/links/${link.id}`, { method: 'DELETE' });
    onChanged();
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Card className={`p-4 flex flex-col md:flex-row md:items-center gap-3 ${link.enabled ? '' : 'opacity-50'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-indigo-400">/{link.slug}</span>
            <button onClick={copy} title="Copy short URL" className="text-zinc-500 hover:text-zinc-200 transition-colors">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <span className="rounded-full border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
              {link.redirect_type}
            </span>
            {!link.enabled && (
              <span className="rounded-full bg-red-950/60 px-1.5 py-0.5 text-[10px] text-red-400">disabled</span>
            )}
          </div>
          <a
            href={link.destination}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 truncate transition-colors"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{link.destination}</span>
          </a>
        </div>
        <div className="flex items-center gap-4 text-sm tabular-nums">
          <div className="text-right" title="Total clicks">
            <p className="font-semibold">{fmt(link.total_clicks)}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">clicks</p>
          </div>
          <div className="text-right" title="Unique visitors">
            <p className="font-semibold">{fmt(link.unique_clicks)}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">unique</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Btn variant="ghost" onClick={() => onAnalytics(link)} title="Analytics"><BarChart3 className="h-4 w-4" /></Btn>
          <Btn variant="ghost" onClick={() => onQr(link)} title="QR code"><QrCode className="h-4 w-4" /></Btn>
          <Btn variant="ghost" onClick={() => onEdit(link)} title="Edit"><Pencil className="h-4 w-4" /></Btn>
          <Btn variant="ghost" onClick={toggle} title={link.enabled ? 'Disable' : 'Enable'}>
            <Power className={`h-4 w-4 ${link.enabled ? 'text-emerald-400' : ''}`} />
          </Btn>
          <Btn variant="danger" onClick={del} title="Delete"><Trash2 className="h-4 w-4" /></Btn>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------- dashboard ----------
function Dashboard({ onLogout }) {
  const [links, setLinks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState(null);
  const [qrFor, setQrFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);

  const refresh = () =>
    api('/api/links')
      .then((rows) => { setLinks(rows); setLoaded(true); })
      .catch((e) => { if (e.code === 401) onLogout(); });

  useEffect(() => { refresh(); }, []);

  const totalClicks = links.reduce((a, l) => a + (l.total_clicks || 0), 0);

  const importCsv = async (file) => {
    const text = await file.text();
    try {
      const r = await api('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text, csv: true });
      setImportMsg(`Imported ${r.imported} link${r.imported === 1 ? '' : 's'}${r.skipped.length ? `, skipped ${r.skipped.length}` : ''}`);
      setTimeout(() => setImportMsg(''), 4000);
      refresh();
    } catch (e) {
      setImportMsg(`Import failed: ${e.message}`);
      setTimeout(() => setImportMsg(''), 5000);
    }
  };

  const logout = async () => {
    await api('/api/logout', { method: 'POST' });
    onLogout();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 mr-auto">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Link2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">Link Shortener</h1>
            <p className="text-xs text-zinc-500">
              {fmt(links.length)} links · {fmt(totalClicks)} total clicks
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ''; }}
        />
        <Btn onClick={() => fileRef.current.click()} title="Bulk import links from CSV">
          <Upload className="h-4 w-4" /> Import CSV
        </Btn>
        <a href="/api/export.csv" download>
          <Btn title="Export all links as CSV"><Download className="h-4 w-4" /> Export</Btn>
        </a>
        <Btn variant="ghost" onClick={logout} title="Log out"><LogOut className="h-4 w-4" /></Btn>
      </header>

      {importMsg && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 text-sm text-indigo-300">
          {importMsg}
        </motion.p>
      )}

      <div className="mb-6">
        <CreateForm onCreated={refresh} />
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {links.map((l) => (
            <LinkRow
              key={l.id}
              link={l}
              onChanged={refresh}
              onAnalytics={setAnalyticsFor}
              onQr={setQrFor}
              onEdit={setEditFor}
            />
          ))}
        </AnimatePresence>
        {loaded && links.length === 0 && (
          <Card className="p-12 text-center text-zinc-500">
            <Link2 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            No links yet. Paste a long URL above to create your first branded short link.
          </Card>
        )}
      </div>

      <AnimatePresence>
        {analyticsFor && <AnalyticsModal key="a" link={analyticsFor} onClose={() => setAnalyticsFor(null)} />}
        {qrFor && <QrModal key="q" link={qrFor} onClose={() => setQrFor(null)} />}
        {editFor && (
          <EditModal key="e" link={editFor} onClose={() => setEditFor(null)} onSaved={refresh} />
        )}
      </AnimatePresence>

      <footer className="mt-10 text-center text-xs text-zinc-600">
        Link Shortener · self-hosted · MIT · no subscription, ever
      </footer>
    </div>
  );
}

// ---------- root ----------
export default function App() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    api('/api/me').then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }
  return authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <Login onLogin={() => setAuthed(true)} />;
}
