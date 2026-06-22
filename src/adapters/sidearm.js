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

export const sidearmAdapter = {
  name: 'sidearm',
  detect({ $, pageUrl }) {
    const html = $('html').html() || '';
    return /sidearm/i.test(html) || $('.sidearm-roster-player, [class*="sidearm-roster"]').length > 0 || /sidearmsports/i.test(pageUrl);
  },
  extract({ $, pageUrl, teamName, season, input }) {
    const selectors = [
      '.sidearm-roster-player',
      '[class*="sidearm-roster-player"]',
      '.roster_player',
      '.roster-player',
      '[class*="roster-player"]',
    ].join(',');

    const out = [];

    $(selectors).each((_, element) => {
      const card = $(element);
      if (card.parents(selectors).length) return;

      const cardText = clean(card.text());
      const profileHref = getProfileHref($, card, pageUrl, input.sport || 'football');
      const profileUrl = absUrl(profileHref, pageUrl);

      let fullName = cleanName(firstValue([
        textFromSelectors($, card, [
          '.sidearm-roster-player-name a',
          '.sidearm-roster-player-name',
          '[class*="roster-player-name"] a',
          '[class*="roster-player-name"]',
          '[class*="player-name"] a',
          '[class*="player-name"]',
          'h3 a',
          'h2 a',
          'a[href*="/sports/football/roster/"]',
          'a[href*="/roster/"]',
        ]),
        nameFromProfileUrl(profileUrl),
      ]));

      if (looksBadName(fullName)) return;

      const photo = bestImage($, card, pageUrl, fullName);
      const parsed = parseFreeText(cardText);

      out.push({
        team_name: teamName,
        season,
        player_profile_url: profileUrl,
        headshot_url: photo.url,
        headshot_confidence: photo.confidence,
        full_name: fullName,
        jersey_number: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-jersey-number', '[class*="jersey-number"]', '[class*="number"]']),
          valueAfterLabels($, card, ['No.', 'No', '#', 'Number', 'Jersey']),
          parsed.jersey_number,
        ]),
        position: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-position-short', '.sidearm-roster-player-position-long', '.sidearm-roster-player-position', '[class*="position-short"]', '[class*="position-long"]', '[class*="position"]']),
          valueAfterLabels($, card, ['Position', 'Pos.', 'Pos']),
          parsed.position,
        ]),
        height: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-height', '[class*="height"]', '[class*="ht"]']),
          valueAfterLabels($, card, ['Height', 'Ht.', 'Ht']),
          parsed.height,
        ]),
        weight: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-weight', '[class*="weight"]', '[class*="wt"]']),
          valueAfterLabels($, card, ['Weight', 'Wt.', 'Wt']),
          parsed.weight,
        ]),
        class_year: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-academic-year', '.sidearm-roster-player-class', '.sidearm-roster-player-year', '[class*="academic-year"]', '[class*="class"]', '[class*="year"]']),
          valueAfterLabels($, card, ['Academic Year', 'Class', 'Cl.', 'Yr.', 'Year']),
          parsed.class_year,
        ]),
        hometown: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-hometown', '[class*="hometown"]']),
          valueAfterLabels($, card, ['Hometown', 'Home Town']),
        ]),
        high_school: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-highschool', '.sidearm-roster-player-high-school', '[class*="highschool"]', '[class*="high-school"]']),
          valueAfterLabels($, card, ['High School', 'Highschool', 'HS']),
        ]),
        previous_school: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-previous-school', '[class*="previous-school"]', '[class*="previous"]']),
          valueAfterLabels($, card, ['Previous School', 'Prev School', 'Previous College', 'Last School']),
        ]),
        extraction_method: 'sidearm_card',
      });
    });

    return out;
  },
};
