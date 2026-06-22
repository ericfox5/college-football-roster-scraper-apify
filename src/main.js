import { Actor } from 'apify';
import { CheerioCrawler, log } from 'crawlee';
import { DEFAULT_FCS_ROSTER_URLS } from './default-fcs-roster-urls.js';
import { diagnosticRowFromPage, extractRosterPage } from './extractors.js';

await Actor.init();

const input = await Actor.getInput() ?? {};
const summary = {
  started_at: new Date().toISOString(),
  requested_urls: 0,
  finished_urls: 0,
  failed_urls: 0,
  players_pushed: 0,
  diagnostic_rows_pushed: 0,
  pages_with_zero_players: [],
  adapter_stats: {},
  failures: [],
};

try {
  const startUrls = buildStartUrls(input);
  summary.requested_urls = startUrls.length;

  if (!startUrls.length) {
    throw new Error('No start URLs provided. Add roster page URLs or enable useDefaultFcsUrls.');
  }

  log.info(`Starting College Football Roster Scraper with ${startUrls.length} roster URL(s).`);

  const crawler = new CheerioCrawler({
    maxConcurrency: Number(input.maxConcurrency ?? 10),
    maxRequestRetries: Number(input.maxRequestRetries ?? 2),
    requestHandlerTimeoutSecs: Number(input.requestHandlerTimeoutSecs ?? 45),
    navigationTimeoutSecs: Number(input.navigationTimeoutSecs ?? 30),
    useSessionPool: Boolean(input.useSessionPool ?? true),
    respectRobotsTxtFile: Boolean(input.respectRobotsTxtFile ?? false),
    requestHandler: async ({ $, request }) => {
      const result = extractRosterPage({ $, request, input });
      summary.finished_urls += 1;
      addAdapterStats(summary.adapter_stats, result.diagnostics);

      if (!result.players.length) {
        const diagnostic = result.zeroPlayerDiagnostic || { url: request.url, team_name: request.userData?.team_name || '' };
        summary.pages_with_zero_players.push(diagnostic);
        log.warning(`No player rows found for ${request.url}`);

        if (Boolean(input.emitDiagnosticRows ?? false)) {
          await Actor.pushData(diagnosticRowFromPage(result, input));
          summary.diagnostic_rows_pushed += 1;
        }
        return;
      }

      const cappedPlayers = Number(input.maxPlayersPerTeam ?? 0) > 0
        ? result.players.slice(0, Number(input.maxPlayersPerTeam))
        : result.players;

      await Actor.pushData(cappedPlayers);
      summary.players_pushed += cappedPlayers.length;
      log.info(`Pushed ${cappedPlayers.length} player rows for ${result.teamName || request.userData?.team_name || request.url}.`);
    },
    failedRequestHandler: async ({ request, error }) => {
      summary.failed_urls += 1;
      summary.failures.push({
        url: request.url,
        team_name: request.userData?.team_name || '',
        error: error?.message || String(error),
      });
      log.error(`Failed ${request.url}: ${error?.message || error}`);
    },
  });

  await crawler.run(startUrls);
  summary.finished_at = new Date().toISOString();
  await Actor.setValue('RUN_SUMMARY', summary, { contentType: 'application/json' });
  await Actor.setValue('ZERO_PLAYER_PAGES', summary.pages_with_zero_players, { contentType: 'application/json' });
  log.info(`Done. Pushed ${summary.players_pushed} player row(s). Zero-player pages: ${summary.pages_with_zero_players.length}.`);
} finally {
  await Actor.exit();
}

function buildStartUrls(input) {
  const useDefaultFcsUrls = Boolean(input.useDefaultFcsUrls ?? true);
  const provided = normalizeStartUrls(input.startUrls ?? []);
  const defaults = useDefaultFcsUrls ? DEFAULT_FCS_ROSTER_URLS : [];
  const merged = [...defaults, ...provided];
  const seen = new Set();
  const deduped = [];

  for (const item of merged) {
    const normalized = normalizeStartUrl(item);
    if (!normalized?.url) continue;

    const key = normalized.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  const maxRosterUrls = Number(input.maxRosterUrls ?? 10);
  return maxRosterUrls > 0 ? deduped.slice(0, maxRosterUrls) : deduped;
}

function normalizeStartUrls(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeStartUrl).filter(Boolean);
}

function normalizeStartUrl(value) {
  if (typeof value === 'string') {
    return { url: value, userData: {} };
  }

  if (value?.url) {
    return {
      url: value.url,
      userData: value.userData ?? {},
    };
  }

  return null;
}

function addAdapterStats(stats, diagnostics = []) {
  for (const item of diagnostics) {
    const key = item.adapter || 'unknown';
    if (!stats[key]) stats[key] = { runs: 0, rows: 0, errors: 0, skipped: 0 };
    stats[key].runs += item.status === 'ok' ? 1 : 0;
    stats[key].rows += Number(item.rows || 0);
    stats[key].errors += item.status === 'error' ? 1 : 0;
    stats[key].skipped += item.status === 'skipped' ? 1 : 0;
  }
}
