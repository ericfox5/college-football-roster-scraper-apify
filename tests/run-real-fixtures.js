// Runs the extractor over real saved roster pages in tests/fixtures/real/*.html (not committed: several MB each).
// File name convention: <slug>-<platform>.html, e.g. brown-nextgen.html, howard-classic.html, ccsu-presto.html.
// Prints per-page coverage and fails when a page extracts far fewer players than it has roster profile links,
// or (nextgen) when headshots are missing.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { extractRosterPage } from '../src/extractors.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'real');
if (!existsSync(dir)) { console.log(`no real fixtures at ${dir}; skipping`); process.exit(0); }
const files = readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
const only = process.argv[2];
let failures = 0;

for (const f of files) {
  if (only && !f.includes(only)) continue;
  const html = readFileSync(join(dir, f), 'utf8');
  const platform = (f.match(/-([a-z]+)\.html$/) || [])[1] || '';
  const url = platform === 'presto' ? 'https://example.edu/sports/fball/2026-27/roster' : 'https://example.edu/sports/football/roster/2026';
  const $ = cheerio.load(html);
  const links = new Set();
  $('a[href]').each((_, a) => { const h = $(a).attr('href') || ''; if (/\/sports\/football\/roster\/[a-z0-9-]+\/\d+/i.test(h) || /\/bios\/[a-z0-9-]+/i.test(h)) links.add(h.replace(/[?#].*$/, '')); });
  const t0 = Date.now();
  const result = extractRosterPage({ $, request: { url, userData: { team_name: f.replace(/-[a-z]+\.html$/, '') } }, input: { sport: 'football', season: '2026', adapterMode: 'auto' } });
  const p = result.players;
  const n = p.length;
  const pct = (k) => (n ? Math.round((100 * p.filter(k).length) / n) : 0);
  const methods = {};
  for (const r of p) methods[r.extraction_method] = (methods[r.extraction_method] || 0) + 1;
  const coachLeaks = p.filter((r) => /coach|coordinator|director/i.test(`${r.position} ${r.full_name}`)).length;
  console.log(`${f}: platform=${result.platform} players=${n} links=${links.size} headshot=${pct((r) => r.headshot_url)}% pos=${pct((r) => r.position)}% jersey=${pct((r) => r.jersey_number)}% class=${pct((r) => r.class_year)}% ht=${pct((r) => r.height_inches)}% wt=${pct((r) => r.weight)}% hometown=${pct((r) => r.hometown)}% coachLeaks=${coachLeaks} methods=${JSON.stringify(methods)} ${Date.now() - t0}ms`);
  for (const r of p.slice(0, 2)) console.log('   ', JSON.stringify({ name: r.full_name, no: r.jersey_number, pos: r.position, ht: r.height, wt: r.weight, cls: r.class_year, home: r.hometown, hs: r.high_school, prev: r.previous_school, photo: r.headshot_url.slice(0, 90) }));
  try {
    assert.ok(n >= 0.9 * links.size, `${f}: only ${n} players for ${links.size} profile links`);
    assert.equal(coachLeaks, 0, `${f}: ${coachLeaks} coach-like rows`);
    assert.ok(pct((r) => r.position) >= 95, `${f}: positions missing`);
    assert.ok(pct((r) => r.class_year) >= 90, `${f}: class years missing`);
    if (platform === 'nextgen') assert.ok(pct((r) => r.headshot_url) >= 95, `${f}: nextgen headshots missing`);
    if (platform === 'nextgen') assert.ok(p.every((r) => !/images\.sidearmdev\.com/.test(r.headshot_url)), `${f}: crop URLs not decoded`);
  } catch (e) { failures++; console.log('   FAIL', e.message); }
}
if (failures) { console.log(`${failures} real fixture(s) failed`); process.exit(1); }
console.log(`Real fixtures passed: ${files.length}`);
