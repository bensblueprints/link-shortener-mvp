// Smoke test: boots the real server on a test port, creates a link via the
// API, hits the redirect twice with different user agents, and asserts the
// redirect + click logging + analytics aggregation all work end to end.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..', 'server', 'index.js');
const PORT = process.env.TEST_PORT || 5397;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'smoke-test-password';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-shortener-smoke-'));
const DB_PATH = path.join(tmpDir, 'test.db');

const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let server;
let cookie = '';
let failed = false;

function log(msg) {
  console.log(`  ✓ ${msg}`);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/me`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start');
}

async function main() {
  console.log('Starting server on test port', PORT);
  server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: PASSWORD, DB_PATH },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await waitForServer();
  log('server booted');

  // --- auth ---
  const bad = await fetch(`${BASE}/api/links`);
  assert.equal(bad.status, 401, 'unauthenticated API access must be rejected');
  log('unauthenticated access rejected (401)');

  const login = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(login.status, 200, 'login should succeed');
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie.startsWith('ls_session='), 'session cookie set');
  log('login sets session cookie');

  // --- create link ---
  const create = await fetch(`${BASE}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug: 'smoke', destination: 'https://example.com/landing?x=1', redirect_type: 302 }),
  });
  assert.equal(create.status, 201, 'link created');
  const link = await create.json();
  assert.equal(link.slug, 'smoke');
  log(`created link /${link.slug} -> ${link.destination}`);

  // --- redirect twice with different UAs ---
  for (const [name, ua, ref] of [
    ['desktop', UA_DESKTOP, 'https://twitter.com/somepost'],
    ['mobile', UA_MOBILE, 'https://news.ycombinator.com/'],
  ]) {
    const r = await fetch(`${BASE}/smoke`, {
      redirect: 'manual',
      headers: { 'User-Agent': ua, Referer: ref, 'CF-IPCountry': name === 'desktop' ? 'US' : 'GB' },
    });
    assert.ok(r.status === 301 || r.status === 302, `redirect returns 30x (got ${r.status})`);
    assert.equal(r.status, 302, 'configured 302 respected');
    assert.equal(r.headers.get('location'), 'https://example.com/landing?x=1', 'Location header points at destination');
    log(`${name} click redirected with 302 + correct Location`);
  }

  // --- analytics aggregation ---
  const an = await fetch(`${BASE}/api/links/${link.id}/analytics?days=7`, { headers: { Cookie: cookie } });
  assert.equal(an.status, 200);
  const a = await an.json();
  assert.equal(a.totalClicks, 2, 'two click rows logged');
  assert.equal(a.uniqueClicks, 2, 'different UAs = two unique visitors');
  assert.equal(a.series.reduce((s, d) => s + d.clicks, 0), 2, 'series sums to 2');
  const deviceNames = a.devices.map((d) => d.name);
  assert.ok(deviceNames.includes('mobile'), 'mobile device parsed from UA');
  const browserNames = a.browsers.map((b) => b.name);
  assert.ok(browserNames.some((b) => /chrome/i.test(b)), 'Chrome parsed from desktop UA');
  const countries = a.countries.map((c) => c.name);
  assert.ok(countries.includes('US') && countries.includes('GB'), 'CF-IPCountry header recorded');
  const refs = a.referrers.map((r) => r.name);
  assert.ok(refs.includes('https://twitter.com/somepost'), 'referrer recorded');
  log('analytics aggregates: totals, uniques, series, devices, browsers, countries, referrers');

  // --- same visitor counted once for uniques ---
  await fetch(`${BASE}/smoke`, { redirect: 'manual', headers: { 'User-Agent': UA_DESKTOP } });
  const a2 = await (await fetch(`${BASE}/api/links/${link.id}/analytics`, { headers: { Cookie: cookie } })).json();
  assert.equal(a2.totalClicks, 3, 'third click logged');
  assert.equal(a2.uniqueClicks, 2, 'repeat visitor (same IP+UA+day) not double counted');
  log('unique visitor dedupe (IP+UA daily hash) works');

  // --- disable link -> 404 ---
  await fetch(`${BASE}/api/links/${link.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ enabled: false }),
  });
  const disabled = await fetch(`${BASE}/smoke`, { redirect: 'manual' });
  assert.equal(disabled.status, 404, 'disabled link returns 404');
  await fetch(`${BASE}/api/links/${link.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ enabled: true }),
  });
  log('disable/enable toggle respected by redirect route');

  // --- QR code ---
  const qr = await fetch(`${BASE}/api/links/${link.id}/qr`, { headers: { Cookie: cookie } });
  assert.equal(qr.status, 200);
  assert.equal(qr.headers.get('content-type'), 'image/png');
  const png = Buffer.from(await qr.arrayBuffer());
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'QR endpoint returns a real PNG');
  const qrSvg = await fetch(`${BASE}/api/links/${link.id}/qr?format=svg`, { headers: { Cookie: cookie } });
  assert.ok((qrSvg.headers.get('content-type') || '').includes('svg'), 'QR SVG variant works');
  log('QR code PNG + SVG generation');

  // --- CSV import/export ---
  const csv = 'slug,destination,redirect_type\nbulk-one,https://example.org/a,301\n,https://example.org/b,302\n';
  const imp = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv', Cookie: cookie },
    body: csv,
  });
  const impBody = await imp.json();
  assert.equal(impBody.imported, 2, 'CSV import creates 2 links (one auto-slug)');
  const exp = await fetch(`${BASE}/api/export.csv`, { headers: { Cookie: cookie } });
  const expText = await exp.text();
  assert.ok(expText.includes('bulk-one,https://example.org/a,301'), 'export contains imported link');
  assert.ok(expText.startsWith('slug,destination,redirect_type,enabled,created_at,total_clicks'), 'export header');
  log('CSV bulk import + export round trip');

  // --- 301 respected ---
  const r301 = await fetch(`${BASE}/bulk-one`, { redirect: 'manual' });
  assert.equal(r301.status, 301, '301 redirect type respected');
  log('301 redirect type respected');

  console.log('\nAll smoke tests passed.');
}

main()
  .catch((err) => {
    failed = true;
    console.error('\nSMOKE TEST FAILED:', err.message);
  })
  .finally(() => {
    if (server) server.kill();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(failed ? 1 : 0);
  });
