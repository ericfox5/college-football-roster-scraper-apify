import { genericCardAdapter } from './genericCards.js';
import { jsonStateAdapter } from './jsonState.js';
import { prestoAdapter } from './presto.js';
import { sidearmAdapter } from './sidearm.js';
import { tableAdapter } from './tables.js';

export const ADAPTERS = [
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

export function runAdapters(context) {
  const mode = context.input.adapterMode || 'auto';
  const diagnostics = [];
  const selected = mode === 'auto'
    ? ADAPTERS
    : ADAPTERS.filter((adapter) => adapter.name === mode || adapter.name.replace(/-/g, '') === String(mode).replace(/-/g, ''));

  const rows = [];
  for (const adapter of selected) {
    const shouldRun = mode !== 'auto' || safeDetect(adapter, context) || adapter.name === 'table' || adapter.name === 'generic-card';
    if (!shouldRun) {
      diagnostics.push({ adapter: adapter.name, status: 'skipped' });
      continue;
    }

    try {
      const extracted = adapter.extract(context) || [];
      diagnostics.push({ adapter: adapter.name, status: 'ok', rows: extracted.length });
      rows.push(...extracted);
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
