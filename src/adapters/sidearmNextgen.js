// Sidearm "nextgen" roster pages (Nuxt SSR, 2025+): one `.s-person-card` per person with data-test-id'd fields.
// Seen on ~34 FCS sites in 2026 (Abilene Christian, Brown, Montana, NDSU, SDSU, Sacred Heart, Princeton ...).
// The classic Sidearm card classes are absent, so the classic adapter finds nothing on these pages.
import {
  absUrl,
  clean,
  cleanName,
  firstValue,
  looksBadName,
  nameFromProfileUrl,
} from '../lib/utils.js';

const CARD = '[data-test-id="s-person-card-list__root"], [data-test-id="s-person-card-grid__root"], .s-person-card';
const PERSON_LINK = 'a[data-test-id="s-person-details__personal-single-line-person-link"], a[data-test-id="s-person-details__thumbnail-link"], a[data-test-id="s-person-card-list__content-call-to-action-link"], a[href*="/roster/"]';

// Text of a stat element without its label spans / icons, e.g. "<span>Position</span> DL <b><span>Is Captain</span> (C)</b>" -> "DL".
function statText($, card, testId) {
  const el = card.find(`[data-test-id="${testId}"]`).first();
  if (!el.length) return '';
  const copy = el.clone();
  copy.find('svg, b, .sr-only').remove();
  copy.find('span').each((_, s) => { const t = clean($(s).text()); if (/^(position|academic year|height|weight|hometown|last school|high school|previous school|class|year|jersey number)$/i.test(t)) $(s).remove(); });
  return clean(copy.text()).replace(/\(\s*C\s*\)/g, '').trim();
}

// images.sidearmdev.com/crop?url=<encoded original>&width=100... -> the original (full-size) image URL.
export function decodeSidearmCrop(src) {
  if (!src) return '';
  try {
    const u = new URL(src);
    if (/images\.sidearmdev\.com$/i.test(u.hostname) && u.searchParams.get('url')) return u.searchParams.get('url');
  } catch { /* not a URL */ }
  return src;
}

export const sidearmNextgenAdapter = {
  name: 'sidearm-nextgen',
  detect({ $ }) {
    return $('[data-test-id="s-person-details__root"]').length > 0 || $(CARD).length > 0;
  },
  extract({ $, pageUrl, teamName, season }) {
    const out = [];
    $(CARD).each((_, element) => {
      const card = $(element);
      if (card.parents(CARD).length) return;

      const link = card.find(PERSON_LINK).filter((_, a) => !/\/(coaches?|staff)\//i.test($(a).attr('href') || '')).first();
      const href = link.attr('href') || '';
      if (!href) return;
      const profileUrl = absUrl(href, pageUrl);
      if (!/\/roster\//i.test(profileUrl)) return; // coaches/staff cards link elsewhere

      const fullName = cleanName(firstValue([
        card.find('a[data-test-id="s-person-details__personal-single-line-person-link"] h3').first().text(),
        card.find('h3').first().text(),
        nameFromProfileUrl(profileUrl),
      ]));
      if (looksBadName(fullName)) return;

      const aria = clean(link.attr('aria-label') || card.find('a[aria-label*="jersey number"]').first().attr('aria-label') || '');
      const ariaJersey = (aria.match(/jersey number\s*(\d{1,3})/i) || [])[1] || '';
      const stampCopy = card.find('.s-stamp__text').first().clone();
      stampCopy.find('span').remove();
      const stampJersey = clean(stampCopy.text());

      const img = card.find('img[data-test-id="s-image-resized__img"], picture img, img').first();
      const rawSrc = img.attr('src') || (img.attr('srcset') || '').split(',')[0]?.trim().split(/\s+/)[0] || '';
      const headshot = decodeSidearmCrop(absUrl(rawSrc, pageUrl));
      const photoOk = headshot && !/placeholder|default|silhouette|no-image|logo/i.test(headshot);

      const lastSchool = statText($, card, 's-person-card-list__content-location-person-high-school')
        || statText($, card, 's-person-card-grid__content-location-person-high-school');
      const isCollege = /\b(college|university|univ|state|cc|jc|community|tech|a&m|institute)\b/i.test(lastSchool);

      out.push({
        team_name: teamName,
        season,
        player_profile_url: profileUrl,
        headshot_url: photoOk ? headshot : '',
        headshot_confidence: photoOk ? 'high' : '',
        full_name: fullName,
        jersey_number: firstValue([ariaJersey, stampJersey]),
        position: statText($, card, 's-person-details__bio-stats-person-position-short') || statText($, card, 's-person-details__bio-stats-person-position-long'),
        height: statText($, card, 's-person-details__bio-stats-person-season') || statText($, card, 's-person-details__bio-stats-person-height'),
        weight: statText($, card, 's-person-details__bio-stats-person-weight'),
        class_year: statText($, card, 's-person-details__bio-stats-person-title') || statText($, card, 's-person-details__bio-stats-person-academic-year'),
        hometown: statText($, card, 's-person-card-list__content-location-person-hometown') || statText($, card, 's-person-card-grid__content-location-person-hometown'),
        high_school: isCollege ? '' : lastSchool,
        previous_school: isCollege ? lastSchool : '',
        extraction_method: 'sidearm_nextgen_card',
      });
    });
    return out;
  },
};
