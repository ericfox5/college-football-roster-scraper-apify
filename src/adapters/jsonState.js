import {
  absUrl,
  clean,
  cleanName,
  extractClass,
  extractHeight,
  extractWeight,
  findPosition,
  firstValue,
  looksBadName,
} from '../lib/utils.js';

const PLAYER_KEY_RE = /player|athlete|studentAthlete|student-athlete|roster/i;
const NAME_KEY_RE = /^(full_?name|name|display_?name)$/i;

export const jsonStateAdapter = {
  name: 'json-state',
  detect({ $ }) {
    return $('script[type="application/ld+json"], script#__NEXT_DATA__, script').filter((_, el) => /roster|studentAthlete|athlete|players|jersey|position/i.test($(el).html() || '')).length > 0;
  },
  extract({ $, pageUrl, teamName, season }) {
    const candidates = [];
    const scripts = $('script[type="application/ld+json"], script#__NEXT_DATA__, script').toArray();

    for (const script of scripts) {
      const raw = cleanScript($(script).html() || '');
      if (!raw || !/roster|studentAthlete|athlete|players|jersey|position/i.test(raw)) continue;

      for (const jsonText of possibleJsonChunks(raw)) {
        try {
          const parsed = JSON.parse(jsonText);
          walk(parsed, (value, path) => {
            const row = objectToPlayer(value, path, { pageUrl, teamName, season });
            if (row) candidates.push(row);
          });
        } catch {
          // Ignore opaque JavaScript state blobs that are not valid JSON.
        }
      }
    }

    return candidates.slice(0, 300);
  },
};

function cleanScript(value) {
  return String(value || '').replace(/^\s*window\.[\w$]+\s*=\s*/, '').replace(/;\s*$/, '').trim();
}

function possibleJsonChunks(raw) {
  const chunks = [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) chunks.push(trimmed);

  const nextDataMatch = trimmed.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) chunks.push(nextDataMatch[1].trim());

  // Conservative fallback for assignment-style state: take the largest JSON-ish object.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) chunks.push(trimmed.slice(firstBrace, lastBrace + 1));

  return [...new Set(chunks)];
}

function walk(value, visitor, path = []) {
  if (!value || typeof value !== 'object') return;
  visitor(value, path);

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...path, String(index)]));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') walk(child, visitor, [...path, key]);
  }
}

function objectToPlayer(obj, path, { pageUrl, teamName, season }) {
  if (!obj || Array.isArray(obj) || typeof obj !== 'object') return null;

  const pathText = path.join('.');
  const keysText = Object.keys(obj).join(' ');
  if (!PLAYER_KEY_RE.test(`${pathText} ${keysText}`)) return null;

  const fullName = cleanName(firstValue([
    valueByKeys(obj, ['fullName', 'full_name', 'displayName', 'display_name', 'name']),
    [valueByKeys(obj, ['firstName', 'first_name', 'givenName']), valueByKeys(obj, ['lastName', 'last_name', 'familyName'])].filter(Boolean).join(' '),
  ]));

  if (looksBadName(fullName)) return null;

  const position = valueByKeys(obj, ['position', 'pos', 'positionShort', 'position_short']);
  const jersey = valueByKeys(obj, ['jersey', 'jerseyNumber', 'jersey_number', 'number', 'uniformNumber']);
  const height = valueByKeys(obj, ['height', 'heightText', 'height_text', 'ht']);
  const weight = valueByKeys(obj, ['weight', 'weightText', 'weight_text', 'wt']);
  const classYear = valueByKeys(obj, ['classYear', 'class_year', 'academicYear', 'academic_year', 'year', 'yr', 'class']);

  const evidence = `${position} ${jersey} ${height} ${weight} ${classYear}`;
  if (!evidence || !(findPosition(position) || extractHeight(height) || extractWeight(weight) || extractClass(classYear) || /^\d{1,3}$/.test(clean(jersey)))) return null;

  return {
    team_name: teamName,
    season,
    full_name: fullName,
    first_name: valueByKeys(obj, ['firstName', 'first_name', 'givenName']),
    last_name: valueByKeys(obj, ['lastName', 'last_name', 'familyName']),
    jersey_number: jersey,
    position,
    height,
    weight,
    class_year: classYear,
    hometown: valueByKeys(obj, ['hometown', 'homeTown', 'home_town', 'cityState', 'city_state']),
    high_school: valueByKeys(obj, ['highSchool', 'high_school', 'highschool', 'hs']),
    previous_school: valueByKeys(obj, ['previousSchool', 'previous_school', 'previousCollege', 'lastSchool']),
    player_profile_url: absUrl(valueByKeys(obj, ['url', 'href', 'link', 'profileUrl', 'profile_url']), pageUrl),
    headshot_url: absUrl(valueByKeys(obj, ['headshot', 'headshotUrl', 'headshot_url', 'image', 'imageUrl', 'image_url', 'photo', 'photoUrl']), pageUrl),
    headshot_confidence: valueByKeys(obj, ['headshot', 'headshotUrl', 'image', 'photo']) ? 'medium' : '',
    extraction_method: 'json_state',
  };
}

function valueByKeys(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && typeof obj[key] !== 'object') return clean(obj[key]);
  }

  for (const [key, value] of Object.entries(obj)) {
    if (keys.some((target) => key.toLowerCase() === target.toLowerCase()) && value !== undefined && value !== null && typeof value !== 'object') return clean(value);
    if (NAME_KEY_RE.test(key) && keys.some((target) => /name/i.test(target)) && value !== undefined && value !== null && typeof value !== 'object') return clean(value);
  }

  return '';
}
