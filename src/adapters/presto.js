import { tableAdapter } from './tables.js';
import {
  absUrl,
  bestImage,
  clean,
  cleanName,
  firstValue,
  getProfileHref,
  looksBadName,
  nameFromProfileUrl,
  parseFreeText,
  textFromSelectors,
  valueAfterLabels,
} from '../lib/utils.js';

export const prestoAdapter = {
  name: 'presto',
  detect({ $, pageUrl }) {
    const html = $('html').html() || '';
    return /prestosports|psbin|PrestoSports|roster-list|roster-bio/i.test(html) || /prestosports/i.test(pageUrl);
  },
  extract(context) {
    const { $, pageUrl, teamName, season, input } = context;
    const out = [];

    const selectors = [
      '.roster-list li',
      '.roster-list .roster-player',
      '.roster_bio',
      '.player-bio',
      '.bio-wrap',
      '.mod-roster .card',
      '[class*="roster"] [class*="bio"]',
    ].join(',');

    $(selectors).each((_, element) => {
      const card = $(element);
      const text = clean(card.text());
      if (!text) return;

      const profileHref = getProfileHref($, card, pageUrl, input.sport || 'football');
      const profileUrl = absUrl(profileHref, pageUrl);
      let fullName = cleanName(firstValue([
        textFromSelectors($, card, ['.name a', '.name', '[class*="name"] a', '[class*="name"]', 'h3 a', 'h3', 'a[href*="/roster/"]']),
        nameFromProfileUrl(profileUrl),
      ]));
      if (looksBadName(fullName)) return;

      const parsed = parseFreeText(text);
      const photo = bestImage($, card, pageUrl, fullName);

      out.push({
        team_name: teamName,
        season,
        player_profile_url: profileUrl,
        headshot_url: photo.url,
        headshot_confidence: photo.confidence,
        full_name: fullName,
        jersey_number: firstValue([valueAfterLabels($, card, ['No.', 'No', '#', 'Number', 'Jersey']), parsed.jersey_number]),
        position: firstValue([valueAfterLabels($, card, ['Position', 'Pos.', 'Pos']), parsed.position]),
        height: firstValue([valueAfterLabels($, card, ['Height', 'Ht.', 'Ht']), parsed.height]),
        weight: firstValue([valueAfterLabels($, card, ['Weight', 'Wt.', 'Wt']), parsed.weight]),
        class_year: firstValue([valueAfterLabels($, card, ['Class', 'Cl.', 'Year', 'Yr.']), parsed.class_year]),
        hometown: valueAfterLabels($, card, ['Hometown', 'Home Town']),
        high_school: valueAfterLabels($, card, ['High School', 'Highschool', 'HS']),
        previous_school: valueAfterLabels($, card, ['Previous School', 'Previous College', 'Last School']),
        extraction_method: 'presto_card',
      });
    });

    return [...out, ...tableAdapter.extract(context).map((row) => ({ ...row, extraction_method: `presto_${row.extraction_method}` }))];
  },
};
