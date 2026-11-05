import { genericCardAdapter } from './genericCards.js';
import { jsonStateAdapter } from './jsonState.js';
import { prestoAdapter } from './presto.js';
import { sidearmAdapter } from './sidearm.js';
import { sidearmNextgenAdapter } from './sidearmNextgen.js';
import { tableAdapter } from './tables.js';

export const ADAPTERS = [
  sidearmNextgenAdapter,
  sidearmAdapter,
  prestoAdapter,
  jsonStateAdapter,
  tableAdapter,
  genericCardAdapter,
];

export function detectPlatform(context) {
  const matches = ADAPTERS.filter((adapter) => safeDetect(adapter, context)).map((adapter) => adapter.name);
  return matches.length ? matches.join('+') : 'generic';
}

// Platform adapters know the page layout; the rest are heuristics that exist for pages no platform adapter
// understands. In auto mode the heuristics only run when the platform adapters found fewer than this many players,
// otherwise they add duplicate / partial rows (embedded state blobs, stats tables, staff cards) that survive dedupe.
const PLATFORM_ADAPTERS = new Set(['sidearm-nextgen', 'sidearm', 'presto']);
const FALLBACK_THRESHOLD = 15;

export function runAdapters(context) {
  const mode = context.input.adapterMode || 'auto';
  const diagnostics = [];
  const selected = mode === 'auto'
    ? ADAPTERS
    : ADAPTERS.filter((adapter) => adapter.name === mode || adapter.name.replace(/-/g, '') === String(mode).replace(/-/g, ''));

  const rows = [];
  let platformRows = 0;
  for (const adapter of selected) {
    const isPlatform = PLATFORM_ADAPTERS.has(adapter.name);
    if (mode === 'auto' && !isPlatform && platformRows >= FALLBACK_THRESHOLD && !context.input.alwaysRunFallbacks) {
      diagnostics.push({ adapter: adapter.name, status: 'skipped', reason: `platform adapters found ${platformRows} rows` });
      continue;
    }
    const shouldRun = mode !== 'auto' || safeDetect(adapter, context) || adapter.name === 'table' || adapter.name === 'generic-card';
    if (!shouldRun) {
      diagnostics.push({ adapter: adapter.name, status: 'skipped' });
      continue;
    }

    try {
      const extracted = adapter.extract(context) || [];
      diagnostics.push({ adapter: adapter.name, status: 'ok', rows: extracted.length });
      rows.push(...extracted);
      if (isPlatform) platformRows += extracted.length;
    } catch (error) {
      diagnostics.push({ adapter: adapter.name, status: 'error', error: error?.message || String(error) });
    }
  }

  return { rows, diagnostics };
}

function safeDetect(adapter, context) {
  try {
    return Boolean(adapter.detect?.(context));
  } catch {
    return false;
  }
}
