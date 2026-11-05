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
    // nextgen (Nuxt) Sidearm pages have none of the classic card classes; sidearmNextgen.js handles them
    if ($('[data-test-id="s-person-details__root"], .s-person-card').length > 0 && $('.sidearm-roster-player').length === 0) return false;
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

    // The card root is the exact `.sidearm-roster-player` element. The broad `[class*="roster-player"]` selectors
    // also match the list container (`sidearm-roster-players-container`) and every inner fragment
    // (`-name-container`, `-height`, ...); with the container counted as the card, the real cards were skipped as
    // its children and the fragments came out as partial rows. Only fall back to the broad selectors when no exact
    // card exists.
    const exact = $('.sidearm-roster-player').toArray();
    const candidates = exact.length
      ? exact
      : $(selectors).toArray().filter((el) => !/roster-players/i.test($(el).attr('class') || '') && !$(el).parents(selectors).length);

    candidates.forEach((element) => {
      const card = $(element);

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
          // some classic templates put the short code in a bare <span class="text-bold"> inside the position block
          textFromSelectors($, card, ['.sidearm-roster-player-position-short', '.sidearm-roster-player-position-long-short', '.sidearm-roster-player-position-long', '.sidearm-roster-player-position .text-bold', '.sidearm-roster-player-position', '[class*="position-short"]', '[class*="position-long"]', '[class*="position"]']),
          valueAfterLabels($, card, ['Position', 'Pos.', 'Pos']),
          parsed.position,
        ]),
        height: firstValue([
          // no '[class*="ht"]': it matches unrelated classes (e.g. "...-right", "light") and returned fragments of names
          textFromSelectors($, card, ['.sidearm-roster-player-height', '[class*="height"]']),
          valueAfterLabels($, card, ['Height', 'Ht.', 'Ht']),
          parsed.height,
        ]),
        weight: firstValue([
          textFromSelectors($, card, ['.sidearm-roster-player-weight', '[class*="weight"]']),
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
