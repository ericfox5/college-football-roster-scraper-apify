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

export const genericCardAdapter = {
  name: 'generic-card',
  detect({ $ }) {
    return $('[class*="player-card"], [class*="roster-card"], [class*="athlete-card"], [class*="person-card"], [class*="s-person-card"], .card').length > 0;
  },
  extract({ $, pageUrl, teamName, season, input }) {
    const selectors = [
      '[class*="player-card"]',
      '[class*="roster-card"]',
      '[class*="athlete-card"]',
      '[class*="person-card"]',
      '[class*="s-person-card"]',
      '[class*="member-card"]',
      'li:has(a[href*="/roster/"])',
      'article:has(a[href*="/roster/"])',
    ].join(',');

    const out = [];

    $(selectors).each((_, element) => {
      const card = $(element);
      if (card.parents(selectors).length) return;
      const text = clean(card.text());
      if (!text) return;

      const profileHref = getProfileHref($, card, pageUrl, input.sport || 'football');
      const profileUrl = absUrl(profileHref, pageUrl);

      let fullName = cleanName(firstValue([
        textFromSelectors($, card, ['[class*="name"] a', '[class*="name"]', 'h3 a', 'h3', 'h2 a', 'h2', 'a[href*="/roster/"]']),
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
        class_year: firstValue([valueAfterLabels($, card, ['Academic Year', 'Class', 'Cl.', 'Yr.', 'Year']), parsed.class_year]),
        hometown: valueAfterLabels($, card, ['Hometown', 'Home Town']),
        high_school: valueAfterLabels($, card, ['High School', 'Highschool', 'HS']),
        previous_school: valueAfterLabels($, card, ['Previous School', 'Prev School', 'Previous College', 'Last School']),
        extraction_method: 'generic_card',
      });
    });

    return out;
  },
};
