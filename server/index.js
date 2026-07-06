import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { UAParser } from 'ua-parser-js';
import { openDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- config -----------------------------------------------------------
const PORT = process.env.PORT || 5302;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'links.db');
const BASE_URL = process.env.BASE_URL || ''; // e.g. https://go.yourbrand.com
const DEFAULT_REDIRECT_TYPE = Number(process.env.DEFAULT_REDIRECT_TYPE || 302);

const db = openDb(DB_PATH);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: 'text/csv', limit: '10mb' }));

// ---- auth (simple session cookie, HMAC-derived from admin password) ---
const SESSION_TOKEN = crypto
  .createHmac('sha256', ADMIN_PASSWORD)
  .update('link-shortener-admin-session-v1')
  .digest('hex');

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function isAuthed(req) {
  const tok = getCookie(req, 'ls_session');
  if (!tok || tok.length !== SESSION_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(SESSION_TOKEN));
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  const given = Buffer.from(String(password || ''));
  const want = Buffer.from(ADMIN_PASSWORD);
  const ok = given.length === want.length && crypto.timingSafeEqual(given, want);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  res.setHeader(
    'Set-Cookie',
    `ls_session=${SESSION_TOKEN}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
  );
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'ls_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req) }));

// ---- helpers -----------------------------------------------------------
const RESERVED = new Set(['api', 'assets', 'favicon.ico', 'robots.txt', 'index.html', '']);
const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // unambiguous

function randomSlug(len = 6) {
  let s = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return s;
}

function uniqueSlug() {
  for (let i = 0; i < 50; i++) {
    const slug = randomSlug(6 + Math.floor(i / 10));
    if (!RESERVED.has(slug) && !db.prepare('SELECT 1 FROM links WHERE slug = ?').get(slug)) return slug;
  }
  throw new Error('Could not generate unique slug');
}

function validDestination(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function baseUrl(req) {
  if (BASE_URL) return BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function linkRow(row) {
  return { ...row, enabled: !!row.enabled };
}

// ---- link CRUD ---------------------------------------------------------
app.get('/api/links', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*,
              (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id) AS total_clicks,
              (SELECT COUNT(DISTINCT visitor_hash) FROM clicks c WHERE c.link_id = l.id) AS unique_clicks
         FROM links l ORDER BY l.created_at DESC, l.id DESC`
    )
    .all();
  res.json(rows.map(linkRow));
});

app.post('/api/links', requireAuth, (req, res) => {
  let { slug, destination, redirect_type } = req.body || {};
  if (!destination || !validDestination(destination))
    return res.status(400).json({ error: 'Destination must be a valid http(s) URL' });
  redirect_type = Number(redirect_type) === 301 ? 301 : Number(redirect_type) === 302 ? 302 : DEFAULT_REDIRECT_TYPE;
  if (slug) {
    slug = String(slug).trim();
    if (!SLUG_RE.test(slug) || RESERVED.has(slug.toLowerCase()))
      return res.status(400).json({ error: 'Invalid or reserved slug (letters, digits, - and _ only)' });
    if (db.prepare('SELECT 1 FROM links WHERE slug = ?').get(slug))
      return res.status(409).json({ error: 'Slug already in use' });
  } else {
    slug = uniqueSlug();
  }
  const info = db
    .prepare('INSERT INTO links (slug, destination, redirect_type) VALUES (?, ?, ?)')
    .run(slug, destination, redirect_type);
  const row = db.prepare('SELECT * FROM links WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(linkRow(row));
});

app.put('/api/links/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { destination, redirect_type, enabled, slug } = req.body || {};
  const next = { ...row };
  if (destination !== undefined) {
    if (!validDestination(destination)) return res.status(400).json({ error: 'Invalid destination URL' });
    next.destination = destination;
  }
  if (redirect_type !== undefined) {
    if (![301, 302].includes(Number(redirect_type))) return res.status(400).json({ error: 'redirect_type must be 301 or 302' });
    next.redirect_type = Number(redirect_type);
  }
  if (enabled !== undefined) next.enabled = enabled ? 1 : 0;
  if (slug !== undefined && slug !== row.slug) {
    if (!SLUG_RE.test(slug) || RESERVED.has(String(slug).toLowerCase()))
      return res.status(400).json({ error: 'Invalid or reserved slug' });
    if (db.prepare('SELECT 1 FROM links WHERE slug = ? AND id != ?').get(slug, row.id))
      return res.status(409).json({ error: 'Slug already in use' });
    next.slug = slug;
  }
  db.prepare('UPDATE links SET slug=?, destination=?, redirect_type=?, enabled=? WHERE id=?').run(
    next.slug, next.destination, next.redirect_type, next.enabled, row.id
  );
  res.json(linkRow(db.prepare('SELECT * FROM links WHERE id = ?').get(row.id)));
});

app.delete('/api/links/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM clicks WHERE link_id = ?').run(req.params.id);
  const info = db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---- analytics ---------------------------------------------------------
app.get('/api/links/:id/analytics', requireAuth, (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const totals = db
    .prepare('SELECT COUNT(*) AS total, COUNT(DISTINCT visitor_hash) AS unique_visitors FROM clicks WHERE link_id = ?')
    .get(link.id);

  const series = db
    .prepare(
      `SELECT substr(ts, 1, 10) AS date, COUNT(*) AS clicks
         FROM clicks WHERE link_id = ? AND ts >= ?
        GROUP BY date ORDER BY date`
    )
    .all(link.id, since);

  const top = (col, mapNull) =>
    db
      .prepare(
        `SELECT COALESCE(NULLIF(${col}, ''), ?) AS name, COUNT(*) AS count
           FROM clicks WHERE link_id = ?
          GROUP BY name ORDER BY count DESC LIMIT 10`
      )
      .all(mapNull, link.id);

  res.json({
    link: linkRow(link),
    totalClicks: totals.total,
    uniqueClicks: totals.unique_visitors,
    series,
    referrers: top('referrer', 'Direct / none'),
    devices: top('device', 'Unknown'),
    browsers: top('browser', 'Unknown'),
    countries: top('country', 'Unknown'),
  });
});

// ---- QR code -----------------------------------------------------------
app.get('/api/links/:id/qr', requireAuth, async (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  const url = `${baseUrl(req)}/${link.slug}`;
  const opts = { margin: 2, width: 512, color: { dark: '#000000', light: '#ffffff' } };
  try {
    if (req.query.format === 'svg') {
      const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${link.slug}-qr.svg"`);
      return res.send(svg);
    }
    const png = await QRCode.toBuffer(url, { ...opts, type: 'png' });
    res.setHeader('Content-Type', 'image/png');
    if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="${link.slug}-qr.png"`);
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// ---- CSV import / export ----------------------------------------------
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  // minimal RFC4180 parser
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

app.get('/api/export.csv', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.slug, l.destination, l.redirect_type, l.enabled, l.created_at,
              (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id) AS total_clicks
         FROM links l ORDER BY l.id`
    )
    .all();
  const header = 'slug,destination,redirect_type,enabled,created_at,total_clicks';
  const body = rows
    .map((r) => [r.slug, r.destination, r.redirect_type, r.enabled, r.created_at, r.total_clicks].map(csvEscape).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="links-export.csv"');
  res.send(header + '\n' + body + '\n');
});

app.post('/api/import', requireAuth, (req, res) => {
  const text = typeof req.body === 'string' ? req.body : req.body?.csv;
  if (!text) return res.status(400).json({ error: 'Send CSV as text/csv body or {"csv": "..."}' });
  const rows = parseCsv(text);
  if (!rows.length) return res.status(400).json({ error: 'Empty CSV' });
  let header = rows[0].map((h) => h.trim().toLowerCase());
  let start = 1;
  if (!header.includes('destination')) { header = ['slug', 'destination', 'redirect_type', 'enabled']; start = 0; }
  const col = (name) => header.indexOf(name);
  const results = { imported: 0, skipped: [] };
  const insert = db.prepare('INSERT INTO links (slug, destination, redirect_type, enabled) VALUES (?, ?, ?, ?)');
  const tx = db.transaction(() => {
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const destination = (r[col('destination')] || '').trim();
      let slug = col('slug') >= 0 ? (r[col('slug')] || '').trim() : '';
      const rt = col('redirect_type') >= 0 && Number(r[col('redirect_type')]) === 301 ? 301 : DEFAULT_REDIRECT_TYPE;
      const enabledRaw = col('enabled') >= 0 ? String(r[col('enabled')]).trim().toLowerCase() : '1';
      const enabled = ['0', 'false', 'no'].includes(enabledRaw) ? 0 : 1;
      if (!validDestination(destination)) { results.skipped.push({ row: i + 1, reason: 'invalid destination' }); continue; }
      if (slug) {
        if (!SLUG_RE.test(slug) || RESERVED.has(slug.toLowerCase())) { results.skipped.push({ row: i + 1, reason: 'invalid slug' }); continue; }
        if (db.prepare('SELECT 1 FROM links WHERE slug = ?').get(slug)) { results.skipped.push({ row: i + 1, reason: 'duplicate slug' }); continue; }
      } else slug = uniqueSlug();
      insert.run(slug, destination, rt, enabled);
      results.imported++;
    }
  });
  tx();
  res.json(results);
});

// ---- static frontend ----------------------------------------------------
const DIST = path.join(ROOT, 'dist');
if (fs.existsSync(DIST)) {
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y' }));
  app.get('/', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  app.get('/favicon.ico', (req, res) => {
    const f = path.join(DIST, 'favicon.ico');
    fs.existsSync(f) ? res.sendFile(f) : res.status(204).end();
  });
} else {
  app.get('/', (req, res) => res.send('Link Shortener API running. Build the dashboard with `npm run build`.'));
}

// ---- redirect + click logging -------------------------------------------
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

app.get('/:slug', (req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE slug = ?').get(req.params.slug);
  if (!link || !link.enabled) return res.status(404).send('Link not found');

  try {
    const ua = req.headers['user-agent'] || '';
    const parsed = UAParser(ua);
    const ip = clientIp(req);
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = crypto.createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 32);
    const country =
      req.headers['cf-ipcountry'] || req.headers['x-country-code'] || req.headers['x-vercel-ip-country'] || 'Unknown';
    db.prepare(
      `INSERT INTO clicks (link_id, referrer, user_agent, device, browser, os, country, visitor_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      link.id,
      req.headers['referer'] || req.headers['referrer'] || '',
      ua,
      parsed.device?.type || 'desktop',
      parsed.browser?.name || '',
      parsed.os?.name || '',
      String(country).toUpperCase() === 'XX' ? 'Unknown' : String(country),
      visitorHash
    );
  } catch (e) {
    console.error('click log failed:', e.message);
  }

  res.redirect(link.redirect_type === 301 ? 301 : 302, link.destination);
});

app.listen(PORT, () => {
  console.log(`Link Shortener running on http://localhost:${PORT}`);
});
