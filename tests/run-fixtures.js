import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractRosterPage } from '../src/extractors.js';

const fixtures = [
  {
    name: 'sidearm card roster',
    url: 'https://example.edu/sports/football/roster/2025',
    team: 'Example State',
    html: `
      <html><head><title>2025 Football Roster - Example State Athletics</title></head><body>
        <div class="sidearm-roster-player">
          <div class="sidearm-roster-player-name"><a href="/sports/football/roster/jalen-doe/123">Jalen Doe</a></div>
          <div class="sidearm-roster-player-jersey-number">#12</div>
          <div class="sidearm-roster-player-position-short">QB</div>
          <div class="sidearm-roster-player-height">6'2</div>
          <div class="sidearm-roster-player-weight">205</div>
          <div class="sidearm-roster-player-academic-year">Jr.</div>
          <div class="sidearm-roster-player-hometown">Lewes, Del.</div>
          <img class="sidearm-roster-player-image" src="/images/2025/jalen-doe.jpg" alt="Jalen Doe headshot">
        </div>
        <div class="sidearm-roster-player">
          <div class="sidearm-roster-player-name"><a href="/sports/football/coaches/jane-coach/9">Jane Coach</a></div>
          <div>Head Coach</div>
        </div>
      </body></html>`,
    expect: { count: 1, first: { full_name: 'Jalen Doe', jersey_number: '12', position: 'QB', height_inches: 74, class_year: 'JR' } },
  },
  {
    name: 'sidearm nextgen card roster',
    url: 'https://example.edu/sports/football/roster/2026',
    team: 'Example Nextgen',
    html: `
      <html><head><title>2026 Football Roster - Example Nextgen Athletics</title></head><body>
      <ul data-test-id="roster-view-type-list__list">
      <li data-test-id="roster-view-type-list__list-item"><div data-test-id="s-person-card-list__root" class="s-person-card s-person-card--list">
        <div data-test-id="s-person-details__root" class="s-person-details">
          <a href="/sports/football/roster/ike-odimegwu/23748" aria-label="Ike Odimegwu jersey number 0 full bio" data-test-id="s-person-details__thumbnail-link">
            <picture data-test-id="s-image-resized__root"><img data-test-id="s-image-resized__img" src="https://images.sidearmdev.com/crop?url=https%3A%2F%2Fdxbhsrqyrr690.cloudfront.net%2Fsidearm.nextgen.sites%2Fexample.sidearmsports.com%2Fimages%2F2026%2F8%2F26%2F0-Odimegwu-headshot-2026-cropped.jpg&amp;width=100&amp;height=100&amp;type=webp" alt></picture>
            <div class="s-stamp"><span class="s-stamp__text"><span class="sr-only">Jersey Number</span> 0</span></div>
          </a>
          <div class="s-person-details__personal"><a href="/sports/football/roster/ike-odimegwu/23748" aria-label="Ike Odimegwu jersey number 0 full bio" data-test-id="s-person-details__personal-single-line-person-link"><h3>Ike Odimegwu</h3></a></div>
          <div><span data-test-id="s-person-details__bio-stats-person-position-short"><span>Position</span> DL <b><span>Is Captain</span> (C) </b></span><span data-test-id="s-person-details__bio-stats-person-title"><span>Academic Year</span> Sr.</span><span data-test-id="s-person-details__bio-stats-person-season"><span>Height</span> 6&#39; 3&#39;&#39; </span><span data-test-id="s-person-details__bio-stats-person-weight"><span>Weight</span> 240 lbs </span></div>
        </div>
        <div><span data-test-id="s-person-card-list__content-location-person-hometown"><svg></svg><span>Hometown</span> Coppell, Texas</span><span data-test-id="s-person-card-list__content-location-person-high-school"><span>Last School</span> Coppell</span></div>
      </div></li>
      <li data-test-id="roster-view-type-list__list-item"><div data-test-id="s-person-card-list__root" class="s-person-card s-person-card--list">
        <div data-test-id="s-person-details__root" class="s-person-details">
          <a href="/sports/football/coaches/james-perry/1172" aria-label="James Perry full bio" data-test-id="s-person-details__thumbnail-link"><img data-test-id="s-image-resized__img" src="https://images.sidearmdev.com/crop?url=https%3A%2F%2Fcdn.example.edu%2Fimages%2Fperry.jpg&amp;width=100" alt></a>
          <div class="s-person-details__personal"><a href="/sports/football/coaches/james-perry/1172" data-test-id="s-person-details__personal-single-line-person-link"><h3>James Perry</h3></a></div>
          <div><span data-test-id="s-person-details__bio-stats-person-title"><span>Title</span> Head Coach</span></div>
        </div>
      </div></li>
      </ul></body></html>`,
    expect: { count: 1, first: { full_name: 'Ike Odimegwu', jersey_number: '0', position: 'DL', height: "6'3", height_inches: 75, weight: '240', class_year: 'SR', hometown: 'Coppell, Texas', high_school: 'Coppell', headshot_url: 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/example.sidearmsports.com/images/2026/8/26/0-Odimegwu-headshot-2026-cropped.jpg', extraction_method: 'sidearm_nextgen_card' } },
  },
  {
    name: 'header table roster',
    url: 'https://example.edu/sports/football/roster/2025',
    team: 'Example Tech',
    html: `
      <html><body><h1>2025 Football Roster</h1>
        <table><thead><tr><th>No.</th><th>Name</th><th>Pos.</th><th>Ht.</th><th>Wt.</th><th>Yr.</th><th>Hometown</th><th>High School</th></tr></thead>
        <tbody>
          <tr><td>7</td><td><a href="/sports/football/roster/marcus-smith/777">Marcus Smith</a></td><td>WR</td><td>5-11</td><td>180</td><td>R-So.</td><td>Dover, Del.</td><td>Dover HS</td></tr>
        </tbody></table>
      </body></html>`,
    expect: { count: 1, first: { full_name: 'Marcus Smith', jersey_number: '7', position: 'WR', height: "5'11", class_year: 'R-SO' } },
  },
  {
    name: 'generic card roster',
    url: 'https://example.edu/sports/football/roster/2025',
    team: 'Example College',
    html: `
      <html><body>
        <article class="athlete-card">
          <h3><a href="/sports/football/roster/devon-lee/88">Devon Lee</a></h3>
          <p>No. 88</p><p>Position: TE</p><p>Height: 6'4</p><p>Weight: 245</p><p>Class: Graduate</p>
          <img src="https://cdn.example.edu/roster/devon-lee-headshot.jpg" alt="Devon Lee">
        </article>
      </body></html>`,
    expect: { count: 1, first: { full_name: 'Devon Lee', jersey_number: '88', position: 'TE', class_year: 'GR' } },
  },
  {
    name: 'json state roster',
    url: 'https://example.edu/sports/football/roster/2025',
    team: 'Example JSON',
    html: `
      <html><body><script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"roster":{"players":[{"fullName":"Chris Green","jerseyNumber":"3","position":"DB","height":"6'0","weight":"190","classYear":"Senior","profileUrl":"/sports/football/roster/chris-green/3","headshotUrl":"/images/chris-green.jpg"}]}}}}
      </script></body></html>`,
    expect: { count: 1, first: { full_name: 'Chris Green', jersey_number: '3', position: 'DB', class_year: 'SR' } },
  },
];

for (const fixture of fixtures) {
  const $ = cheerio.load(fixture.html);
  const result = extractRosterPage({
    $,
    request: { url: fixture.url, userData: { team_name: fixture.team } },
    input: { sport: 'football', season: '2025', adapterMode: 'auto' },
  });

  assert.equal(result.players.length, fixture.expect.count, `${fixture.name}: count`);
  const player = result.players[0];
  for (const [key, value] of Object.entries(fixture.expect.first)) {
    assert.equal(player[key], value, `${fixture.name}: ${key}`);
  }
}

console.log(`Fixture tests passed: ${fixtures.length}`);
