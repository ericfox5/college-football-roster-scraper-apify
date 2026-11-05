export const POSITION_CODES = [
  'QB', 'RB', 'HB', 'FB', 'WR', 'TE', 'OL', 'C', 'G', 'OG', 'LG', 'RG', 'T', 'OT', 'LT', 'RT',
  'DL', 'DE', 'DT', 'NT', 'NG', 'EDGE', 'LB', 'OLB', 'ILB', 'MLB', 'DB', 'CB', 'S', 'FS', 'SS',
  'K', 'PK', 'P', 'LS', 'ATH', 'KR', 'PR'
];

export const COACH_WORDS_RE = /\b(coach|coordinator|director|assistant|trainer|strength|conditioning|operations|recruiting|analyst|staff|administrator|athletic trainer|quality control|graduate assistant|head coach|position coach|video coordinator)\b/i;
export const BAD_NAME_RE = /^(view|bio|full bio|player bio|football|roster|schedule|news|tickets|staff|coaches|coaching staff|student-athlete)$/i;
export const PHOTO_BAD_RE = /(logo|placeholder|default|blank|silhouette|sprite|icon|loading|no-image|staff|coach|coaches|favicon)/i;

export function clean(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function absUrl(href, baseUrl) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return '';
  }
}

export function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function firstValue(values) {
  return values.map((value) => clean(value)).find(Boolean) || '';
}

export function splitName(fullName) {
  const parts = cleanName(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };

  const suffixes = new Set(['jr.', 'jr', 'sr.', 'sr', 'ii', 'iii', 'iv', 'v']);
  const last = parts[parts.length - 1].toLowerCase();
  const lastName = suffixes.has(last) && parts.length >= 3
    ? `${parts[parts.length - 2]} ${parts[parts.length - 1]}`
    : parts[parts.length - 1];

  return { first_name: parts[0], last_name: lastName };
}

export function cleanName(value) {
  return clean(value)
    .replace(/\bFull Bio\b/gi, '')
    .replace(/\bView Bio\b/gi, '')
    .replace(/\bPlayer Bio\b/gi, '')
    .replace(/\bBiography\b/gi, '')
    .replace(/^#?\d{1,3}\s+/, '')
    .replace(/\s+#?\d{1,3}$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksBadName(name) {
  const value = cleanName(name);
  return !value || BAD_NAME_RE.test(value) || COACH_WORDS_RE.test(value) || value.length < 2;
}

export function normalizeJersey(value) {
  const text = clean(value);
  const match = text.match(/#?\s*(\d{1,3})/);
  if (!match) return '';
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number > 99) return '';
  return String(number);
}

export function normalizePosition(value) {
  const found = findPosition(value);
  if (found) return found;
  return clean(value)
    .replace(/\b(Position|Pos\.?):?\b/gi, '')
    .replace(/\b[4-7]\s*(?:'|-|ft\.?\s*)\s*\d{1,2}(?:\s*(?:\"|in\.?))?\b.*$/i, '')
    .replace(/\b[1-3]\d{2}\s*(?:lbs?\.?|pounds)?\b.*$/i, '')
    .trim();
}

export function normalizeHeightText(value) {
  const match = clean(value).match(/([4-7])\s*(?:'|’|′|-|ft\.?\s*)\s*(\d{1,2})/i);
  return match ? `${match[1]}'${match[2]}` : clean(value);
}

export function heightToInches(value) {
  const match = normalizeHeightText(value).match(/([4-7])'(\d{1,2})/);
  if (!match) return '';
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches) || inches > 11) return '';
  return feet * 12 + inches;
}

export function normalizeWeight(value) {
  const match = clean(value).match(/\b([1-3]\d{2})\b/);
  return match ? match[1] : '';
}

export function normalizeClassYear(value) {
  const text = clean(value)
    .replace(/^(class|academic year|year|yr\.?|cl\.?)\s*:?\s*/i, '')
    .replace(/\.$/, '')
    .trim();
  if (!text) return '';

  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const redshirt = /^r[-\s]?/.test(lower) || lower === 'rf' || /redshirt/.test(lower);

  if (/graduate|grad|^gr\.?$/.test(lower)) return 'GR';
  if (/freshman|^fr\.?$|^rf\.?$/.test(lower)) return redshirt ? 'R-FR' : 'FR';
  if (/sophomore|^so\.?$/.test(lower)) return redshirt ? 'R-SO' : 'SO';
  if (/junior|^jr\.?$/.test(lower)) return redshirt ? 'R-JR' : 'JR';
  if (/senior|^sr\.?$/.test(lower)) return redshirt ? 'R-SR' : 'SR';

  const compact = lower.toUpperCase().replace(/^R\s+/, 'R-');
  if (/^(FR|SO|JR|SR|GR|R-FR|R-SO|R-JR|R-SR)$/.test(compact)) return compact;
  return text.toUpperCase();
}

export function inferSeason(url) {
  const match = clean(url).match(/\/roster\/(20\d{2})/);
  return match ? match[1] : '';
}

export function findPosition(text) {
  const compact = ` ${clean(text).replace(/[\/|,;:()]/g, ' ')} `;
  const sorted = [...POSITION_CODES].sort((a, b) => b.length - a.length);
  for (const code of sorted) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(code)}(?:\\s|$)`, 'i');
    if (re.test(compact)) return code.toUpperCase();
  }
  return '';
}

export function extractHeight(text) {
  const match = clean(text).match(/\b([4-7])\s*(?:'|’|′|-|ft\.?\s*)\s*(\d{1,2})(?:\s*(?:\"|in\.?))?\b/i);
  return match ? `${match[1]}'${match[2]}` : '';
}

export function extractWeight(text) {
  const match = clean(text).match(/\b([1-3]\d{2})\s*(?:lbs?\.?|pounds)?\b/i);
  return match ? match[1] : '';
}

export function extractClass(text) {
  const match = clean(text).match(/\b(R[-\s]?)?(Fr\.?|Freshman|So\.?|Sophomore|Jr\.?|Junior|Sr\.?|Senior|Gr\.?|Grad\.?|Graduate|Rf\.?)\b/i);
  return match ? normalizeClassYear(match[0]) : '';
}

export function parseFreeText(text) {
  const cleaned = clean(text);
  return {
    height: extractHeight(cleaned),
    weight: extractWeight(cleaned),
    class_year: extractClass(cleaned),
    position: findPosition(cleaned),
    jersey_number: (cleaned.match(/(?:^|\s)#\s*(\d{1,3})\b|\bNo\.?\s*(\d{1,3})\b/i) || [])[1] || (cleaned.match(/(?:^|\s)#\s*(\d{1,3})\b|\bNo\.?\s*(\d{1,3})\b/i) || [])[2] || '',
  };
}

export function nameFromProfileUrl(profileUrl) {
  if (!profileUrl) return '';
  try {
    const parts = new URL(profileUrl).pathname.split('/').filter(Boolean);
    const rosterIndex = parts.indexOf('roster');
    const slug = rosterIndex >= 0 ? parts[rosterIndex + 1] : '';
    if (!slug || /^\d+$/.test(slug) || /coaches?/i.test(slug)) return '';
    return slug
      .split('-')
      .filter((part) => part && !/^\d+$/.test(part))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .replace(/\bJr\b/i, 'Jr.')
      .replace(/\bSr\b/i, 'Sr.')
      .trim();
  } catch {
    return '';
  }
}

export function getProfileHref($, scope, pageUrl, sport = 'football') {
  const anchors = scope.find('a[href]').toArray();
  const sportPattern = new RegExp(`/sports/${escapeRegExp(sport)}/roster/`, 'i');
  const preferred = anchors.find((a) => {
    const href = $(a).attr('href') || '';
    return sportPattern.test(href) && !/\/coaches?\//i.test(href);
  });
  if (preferred) return $(preferred).attr('href') || '';

  const fallback = anchors.find((a) => {
    const href = $(a).attr('href') || '';
    try {
      const abs = new URL(href, pageUrl).href;
      // Sidearm: /sports/<sport>/roster/<slug>/<id>; Presto: /sports/<code>/<season>/bios/<slug>
      return /\/(roster|bios)\//i.test(abs) && !/\/coaches?\//i.test(abs);
    } catch {
      return false;
    }
  });

  return fallback ? ($(fallback).attr('href') || '') : '';
}

export function textFromSelectors($, scope, selectors) {
  for (const selector of selectors) {
    const value = clean(scope.find(selector).first().text());
    if (value) return value;
  }
  return '';
}

export function findText($, scope, selectors) {
  return textFromSelectors($, scope, selectors);
}

export function valueAfterLabels($, scope, labels) {
  const labelPattern = labels.map(escapeRegExp).join('|');
  const re = new RegExp(`^(?:${labelPattern})\\s*:?\\s*(.+)$`, 'i');
  const compactRe = new RegExp(`(?:${labelPattern})\\s*:?\\s*([^|•\\n]{1,80})`, 'i');

  const elements = scope.find('li, dd, dt, span, div, p, strong').toArray();
  for (const el of elements) {
    const text = clean($(el).text());
    if (!text || text.length > 180) continue;
    const match = text.match(re) || text.match(compactRe);
    if (match?.[1]) return clean(match[1]);
  }

  return '';
}

export function getImageSrc(image, baseUrl) {
  const attrs = ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-srcset', 'srcset', 'data-image', 'data-img'];

  for (const attr of attrs) {
    let value = image.attr(attr);
    if (!value) continue;
    if (attr.includes('srcset')) {
      const parts = value.split(',').map((item) => clean(item).split(/\s+/)[0]).filter(Boolean);
      value = parts[parts.length - 1] || '';
    }
    const out = absUrl(value, baseUrl);
    if (out) return out;
  }

  const style = image.attr('style') || '';
  const match = style.match(/url\(['"]?([^'")]+)['"]?\)/i);
  return match ? absUrl(match[1], baseUrl) : '';
}

export function bestImage($, scope, baseUrl, fullName) {
  const normalizedName = slugify(fullName);
  const lastName = slugify(splitName(fullName).last_name);
  const candidates = [];

  scope.find('img, [style*="background-image"]').each((_, img) => {
    const image = $(img);
    const src = getImageSrc(image, baseUrl);
    if (!src || PHOTO_BAD_RE.test(src) || /\.svg(?:\?|$)/i.test(src)) return;

    const alt = clean(image.attr('alt'));
    const cls = clean(image.attr('class'));
    const id = clean(image.attr('id'));
    const haystack = `${src} ${alt} ${cls} ${id}`.toLowerCase();
    let score = 0;

    if (normalizedName && haystack.includes(normalizedName)) score += 250;
    if (lastName && lastName.length > 2 && haystack.includes(lastName)) score += 125;
    if (/headshot|portrait|profile|bio|roster|player|athlete|student-athlete|mug/.test(haystack)) score += 100;
    if (/sidearm|player-image|roster-player|person__image|athlete-image|bio-image|headshot/.test(haystack)) score += 75;
    if (/width=([7-9]\d{2}|\d{4,})/i.test(src)) score -= 75;
    if (/mode=crop/i.test(src)) score += 20;

    candidates.push({ url: src, score, alt });
  });

  if (!candidates.length) return { url: '', confidence: '' };
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const confidence = best.score >= 225 ? 'high' : best.score >= 100 ? 'medium' : 'low';
  return { url: best.url, confidence };
}

export function findHeader(headers, patterns) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(clean(header))));
}

export function cellAt(cells, index) {
  return index >= 0 ? clean(cells[index]) : '';
}

export function isLikelyPlayer(row) {
  const text = `${row.full_name || ''} ${row.position || ''} ${row.player_profile_url || ''}`;
  if (!row.full_name || looksBadName(row.full_name)) return false;
  if (COACH_WORDS_RE.test(text)) return false;
  if (/\/coaches?\//i.test(row.player_profile_url || '')) return false;

  // Reduce false positives from generic profile cards: players normally have at least one roster attribute or a roster profile link.
  return Boolean(row.position || row.height || row.weight || row.class_year || row.jersey_number || /\/(roster|bios)\//i.test(row.player_profile_url || ''));
}

export function dedupePlayers(rows) {
  const map = new Map();

  for (const row of rows) {
    const fullName = cleanName(row.full_name);
    if (!fullName) continue;
    const key = row.player_profile_url
      ? `profile:${row.player_profile_url.toLowerCase().replace(/\/$/, '')}`
      : `name:${slugify(row.team_name)}:${slugify(fullName)}:${normalizeJersey(row.jersey_number)}`;

    if (!key || key.endsWith('::')) continue;
    if (map.has(key)) {
      const previous = map.get(key);
      map.set(key, mergeRows(previous, { ...row, full_name: fullName }));
    } else {
      map.set(key, { ...row, full_name: fullName });
    }
  }

  return [...map.values()];
}

export function mergeRows(a, b) {
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (!clean(merged[key]) && clean(value)) merged[key] = value;
  }

  if (!merged.headshot_url && b.headshot_url) {
    merged.headshot_url = b.headshot_url;
    merged.headshot_confidence = b.headshot_confidence;
  }

  const aScore = methodScore(a.extraction_method);
  const bScore = methodScore(b.extraction_method);
  if (bScore > aScore) merged.extraction_method = b.extraction_method;
  return merged;
}

function methodScore(method = '') {
  if (method.includes('sidearm')) return 5;
  if (method.includes('json')) return 4;
  if (method.includes('presto')) return 3;
  if (method.includes('table')) return 2;
  if (method.includes('card')) return 1;
  return 0;
}

export function normalizePlayerRow(row, context) {
  const nameParts = splitName(row.full_name);
  const height = normalizeHeightText(row.height);
  return {
    scraped_at: new Date().toISOString(),
    sport: context.input.sport || 'football',
    season: row.season || context.season,
    team_name: row.team_name || context.teamName,
    roster_url: context.pageUrl,
    source_url: context.pageUrl,
    source_platform: context.platform || '',
    player_profile_url: row.player_profile_url || '',
    headshot_url: row.headshot_url || '',
    headshot_confidence: row.headshot_confidence || '',
    first_name: row.first_name || nameParts.first_name,
    last_name: row.last_name || nameParts.last_name,
    full_name: cleanName(row.full_name),
    jersey_number: normalizeJersey(row.jersey_number),
    position: normalizePosition(row.position),
    height,
    height_inches: heightToInches(height),
    weight: normalizeWeight(row.weight),
    class_year: normalizeClassYear(row.class_year),
    hometown: clean(row.hometown),
    high_school: clean(row.high_school),
    previous_school: clean(row.previous_school),
    extraction_method: row.extraction_method || 'generic',
  };
}

export function makeDiagnosticRow(context, reason = 'NO_PLAYERS_EXTRACTED') {
  return {
    scraped_at: new Date().toISOString(),
    sport: context.input.sport || 'football',
    season: context.season,
    team_name: context.teamName,
    roster_url: context.pageUrl,
    source_url: context.pageUrl,
    source_platform: context.platform || '',
    player_profile_url: '',
    headshot_url: '',
    headshot_confidence: '',
    first_name: '',
    last_name: '',
    full_name: reason,
    jersey_number: '',
    position: '',
    height: '',
    height_inches: '',
    weight: '',
    class_year: '',
    hometown: '',
    high_school: '',
    previous_school: '',
    extraction_method: 'diagnostic',
    diagnostic_reason: reason,
  };
}
