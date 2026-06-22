import { detectPlatform, runAdapters } from './adapters/index.js';
import {
  clean,
  dedupePlayers,
  inferSeason,
  isLikelyPlayer,
  makeDiagnosticRow,
  normalizePlayerRow,
} from './lib/utils.js';

export function extractRosterPage({ $, request, input = {} }) {
  const pageUrl = request.url;
  const teamName = inferTeamName($, request);
  const season = input.season || inferSeason(pageUrl) || '';
  const platform = detectPlatform({ $, pageUrl, teamName, season, input, request });
  const context = { $, request, pageUrl, teamName, season, platform, input };

  const { rows, diagnostics } = runAdapters(context);
  const players = dedupePlayers(rows)
    .filter((row) => isLikelyPlayer(row))
    .map((row) => normalizePlayerRow(row, context));

  const zeroPlayerDiagnostic = !players.length ? buildZeroPlayerDiagnostic($, context, diagnostics, rows.length) : null;

  return {
    players,
    diagnostics,
    zeroPlayerDiagnostic,
    platform,
    teamName,
    season,
    rawRows: rows.length,
  };
}

export function extractPlayers(args) {
  return extractRosterPage(args).players;
}

function inferTeamName($, request) {
  const userData = request.userData || {};
  const title = clean($('title').first().text());
  const h1 = clean($('h1').first().text());
  const ogSite = clean($('meta[property="og:site_name"]').attr('content'));
  const ogTitle = clean($('meta[property="og:title"]').attr('content'));

  const candidate = clean(
    userData.team_name
    || userData.teamName
    || stripRosterTitle(h1)
    || stripRosterTitle(ogTitle)
    || stripRosterTitle(title)
    || ogSite
  );

  return candidate
    .replace(/\s+Official Athletics Site$/i, '')
    .replace(/\s+Athletics$/i, '')
    .replace(/^The\s+/i, '')
    .trim();
}

function stripRosterTitle(value) {
  return clean(value)
    .replace(/20\d{2}\s+Football\s+Roster/i, '')
    .replace(/Football\s+Roster/i, '')
    .replace(/\bRoster\b/i, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+\|\s+.*$/, '')
    .trim();
}

function buildZeroPlayerDiagnostic($, context, diagnostics, rawRows) {
  return {
    url: context.pageUrl,
    team_name: context.teamName,
    season: context.season,
    source_platform: context.platform,
    page_title: clean($('title').first().text()),
    h1: clean($('h1').first().text()),
    raw_rows_before_filter: rawRows,
    table_count: $('table').length,
    image_count: $('img').length,
    roster_link_count: $('a[href*="/roster/"]').length,
    sidearm_card_count: $('.sidearm-roster-player, [class*="sidearm-roster-player"]').length,
    adapter_diagnostics: diagnostics,
    body_sample: clean($('body').text()).slice(0, 700),
  };
}

export function diagnosticRowFromPage(result, input = {}) {
  return makeDiagnosticRow({
    pageUrl: result.zeroPlayerDiagnostic?.url || '',
    teamName: result.zeroPlayerDiagnostic?.team_name || '',
    season: result.zeroPlayerDiagnostic?.season || '',
    platform: result.zeroPlayerDiagnostic?.source_platform || '',
    input,
  });
}
