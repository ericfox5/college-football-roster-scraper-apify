import {
  absUrl,
  bestImage,
  cellAt,
  clean,
  cleanName,
  extractClass,
  extractHeight,
  extractWeight,
  findHeader,
  findPosition,
  getProfileHref,
  looksBadName,
  nameFromProfileUrl,
  parseFreeText,
} from '../lib/utils.js';

const NAME_HEADERS = [/^name$/i, /^player$/i, /student-athlete/i, /athlete/i, /full name/i];
const JERSEY_HEADERS = [/^no\.?$/i, /^#$/i, /jersey/i, /number/i];
const POS_HEADERS = [/^pos\.?$/i, /position/i];
const HT_HEADERS = [/^ht\.?$/i, /^height$/i];
const WT_HEADERS = [/^wt\.?$/i, /^weight$/i];
const CLASS_HEADERS = [/^cl\.?$/i, /^yr\.?$/i, /class/i, /year/i, /academic/i];
const HOMETOWN_HEADERS = [/hometown/i, /home town/i, /^city$/i, /home\/high school/i];
const HS_HEADERS = [/high school/i, /highschool/i, /^hs$/i, /home\/high school/i];
const PREV_HEADERS = [/previous school/i, /previous college/i, /last school/i, /transfer/i];

export const tableAdapter = {
  name: 'table',
  detect({ $ }) {
    return $('table').length > 0;
  },
  extract({ $, pageUrl, teamName, season, input }) {
    const out = [];

    $('table').each((_, tableEl) => {
      const table = $(tableEl);
      const headerRows = table.find('thead tr, tr').slice(0, 2).toArray();
      let headers = [];
      let headerRowIndex = -1;

      headerRows.forEach((rowEl, idx) => {
        if (headers.length) return;
        const values = $(rowEl).find('th,td').map((__, th) => clean($(th).text())).get();
        const joined = values.join(' | ');
        if (/name|player|student-athlete|pos|height|ht\.?|weight|wt\.?|class|year|hometown/i.test(joined)) {
          headers = values;
          headerRowIndex = idx;
        }
      });

      if (headers.length >= 2) {
        out.push(...extractHeaderTable({ $, table, headers, headerRowIndex, pageUrl, teamName, season, input }));
      } else {
        out.push(...extractHeuristicRows({ $, table, pageUrl, teamName, season, input }));
      }
    });

    return out;
  },
};

function extractHeaderTable({ $, table, headers, headerRowIndex, pageUrl, teamName, season, input }) {
  const out = [];
  const index = {
    name: findHeader(headers, NAME_HEADERS),
    jersey: findHeader(headers, JERSEY_HEADERS),
    position: findHeader(headers, POS_HEADERS),
    height: findHeader(headers, HT_HEADERS),
    weight: findHeader(headers, WT_HEADERS),
    classYear: findHeader(headers, CLASS_HEADERS),
    hometown: findHeader(headers, HOMETOWN_HEADERS),
    highSchool: findHeader(headers, HS_HEADERS),
    previousSchool: findHeader(headers, PREV_HEADERS),
  };

  if (index.name === -1) return out;

  // Presto-style tables repeat the column label inside each cell for small screens ("<span class=label>Pos.:</span> LB")
  // and combine "Hometown/Last School" into one cell ("Lynn, MA / Lynn Classical (Wagner)").
  const cellText = (td, headerIdx) => {
    const copy = $(td).clone();
    copy.find('span.label, .sr-only, .visually-hidden').remove();
    let value = clean(copy.text());
    const header = clean(headers[headerIdx] || '');
    if (header && value.toLowerCase().startsWith(`${header.toLowerCase()}:`)) value = clean(value.slice(header.length + 1));
    return value;
  };
  const combinedHometown = index.hometown >= 0 && /hometown.*(last school|high school|school)/i.test(headers[index.hometown] || '');

  table.find('tbody tr, tr').each((rowNumber, rowEl) => {
    if (rowNumber <= headerRowIndex) return;
    const row = $(rowEl);
    const cells = row.find('td,th').map((i, td) => cellText(td, i)).get();
    if (cells.length <= index.name) return;

    const rowText = clean(row.text());
    if (!rowText) return;

    const nameCell = row.find('td,th').eq(index.name);
    const profileHref = getProfileHref($, nameCell, pageUrl, input.sport || 'football') || getProfileHref($, row, pageUrl, input.sport || 'football');
    const profileUrl = absUrl(profileHref, pageUrl);

    // the name cell may hold the name twice (visible link + print-only link): prefer the first link's text
    let fullName = cleanName(clean(nameCell.find('a').first().text()) || cellAt(cells, index.name) || clean(nameCell.text()));
    if (looksBadName(fullName)) fullName = nameFromProfileUrl(profileUrl);
    if (looksBadName(fullName)) return;

    const photo = bestImage($, row, pageUrl, fullName);
    const parsed = parseFreeText(rowText);

    let hometown = cellAt(cells, index.hometown);
    let highSchool = cellAt(cells, index.highSchool);
    let previousSchool = cellAt(cells, index.previousSchool);
    if (combinedHometown && hometown.includes(' / ')) {
      if (index.previousSchool === index.hometown) previousSchool = '';
      if (index.highSchool === index.hometown) highSchool = '';
      const [town, ...rest] = hometown.split(' / ');
      hometown = clean(town);
      let school = clean(rest.join(' / '));
      const prev = school.match(/\(([^)]+)\)\s*$/);
      if (prev) { previousSchool = previousSchool || clean(prev[1]); school = clean(school.replace(/\([^)]+\)\s*$/, '')); }
      highSchool = highSchool || school;
    }

    out.push({
      team_name: teamName,
      season,
      player_profile_url: profileUrl,
      headshot_url: photo.url,
      headshot_confidence: photo.confidence,
      full_name: fullName,
      jersey_number: cellAt(cells, index.jersey) || parsed.jersey_number,
      position: cellAt(cells, index.position) || parsed.position,
      height: cellAt(cells, index.height) || parsed.height,
      weight: cellAt(cells, index.weight) || parsed.weight,
      class_year: cellAt(cells, index.classYear) || parsed.class_year,
      hometown,
      high_school: highSchool,
      previous_school: previousSchool,
      extraction_method: 'header_table',
    });
  });

  return out;
}

function extractHeuristicRows({ $, table, pageUrl, teamName, season, input }) {
  const out = [];

  table.find('tbody tr, tr').each((_, rowEl) => {
    const row = $(rowEl);
    const cells = row.find('td,th').map((__, td) => clean($(td).text())).get();
    if (cells.length < 3) return;

    const raw = cells.join(' ');
    const profileHref = getProfileHref($, row, pageUrl, input.sport || 'football');
    const profileUrl = absUrl(profileHref, pageUrl);

    let fullName = cleanName(clean(row.find('a[href*="/roster/"]').first().text())) || nameFromProfileUrl(profileUrl);
    if (!fullName) {
      fullName = cells.find((cell) =>
        /[A-Za-z]/.test(cell)
        && !extractHeight(cell)
        && !extractWeight(cell)
        && !extractClass(cell)
        && !findPosition(cell)
        && !/^#?\d{1,3}$/.test(cell)
      ) || '';
    }

    if (looksBadName(fullName)) return;
    const parsed = parseFreeText(raw);
    const photo = bestImage($, row, pageUrl, fullName);

    out.push({
      team_name: teamName,
      season,
      player_profile_url: profileUrl,
      headshot_url: photo.url,
      headshot_confidence: photo.confidence,
      full_name: fullName,
      jersey_number: cells.find((cell) => /^#?\d{1,2}$/.test(cell)) || parsed.jersey_number,
      position: cells.find(findPosition) || parsed.position,
      height: cells.find(extractHeight) || parsed.height,
      weight: cells.find(extractWeight) || parsed.weight,
      class_year: cells.find(extractClass) || parsed.class_year,
      hometown: '',
      high_school: '',
      previous_school: '',
      extraction_method: 'heuristic_table',
    });
  });

  return out;
}
