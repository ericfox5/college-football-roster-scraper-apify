# College Football Roster Scraper for Apify

A production-oriented Apify Actor that scrapes public college football roster pages into normalized, player-only rows.

This upgraded version uses adapter-based extraction instead of a single generic selector pass. It is designed for the exact roster issues that came up during the FCS roster build: Sidearm card pages, Presto-style pages, header-table pages, outlier card layouts, duplicate mobile/desktop player cards, `View Bio` name noise, player names recoverable only from `/roster/name/id` URLs, and pages that should report diagnostics instead of silently returning zero rows.

## What it extracts

Each player row is pushed to the default Apify dataset with fields like:

```json
{
  "scraped_at": "2026-06-22T00:00:00.000Z",
  "sport": "football",
  "season": "2025",
  "team_name": "North Dakota State",
  "roster_url": "https://gobison.com/sports/football/roster/2025",
  "source_url": "https://gobison.com/sports/football/roster/2025",
  "source_platform": "sidearm+table+generic-card",
  "player_profile_url": "https://gobison.com/sports/football/roster/example-player/12345",
  "headshot_url": "https://...jpg",
  "headshot_confidence": "high",
  "first_name": "Example",
  "last_name": "Player",
  "full_name": "Example Player",
  "jersey_number": "12",
  "position": "QB",
  "height": "6'2",
  "height_inches": 74,
  "weight": "205",
  "class_year": "JR",
  "hometown": "Lewes, Del.",
  "high_school": "Cape Henlopen",
  "previous_school": "",
  "extraction_method": "sidearm_card"
}
```

## Included adapters

The Actor runs these adapters in `auto` mode. The platform adapters (Sidearm nextgen, Sidearm, Presto) run first; the heuristic adapters (JSON state, tables, generic cards) only run when the platform adapters found fewer than 15 players on the page, so they cannot add duplicate or partial rows to a page that was already read correctly (`alwaysRunFallbacks: true` in the input forces them on). Presto header tables with a combined `Hometown/Last School` column are split into hometown, high school and previous school.

1. **Sidearm nextgen adapter** (added 2026-11)
   - Targets the Nuxt-rendered Sidearm roster pages (`.s-person-card` with `data-test-id` fields) that about a third of FCS sites moved to in 2025-26. The classic adapter finds nothing on them.
   - Reads name, jersey, position, class, height, weight, hometown, last school and the full-size headshot (the `images.sidearmdev.com/crop?url=...` thumbnail is decoded to the original image URL).

2. **Sidearm adapter**
   - Targets `.sidearm-roster-player` and related roster-card classes.
   - Handles duplicate card layouts and `View Bio`/`Full Bio` noise.
   - Recovers names from profile URL slugs when the visible link text is useless.

3. **Presto-style adapter**
   - Targets common Presto roster/card wrappers and falls back to the table parser.
   - Useful for smaller-school athletics sites with less consistent markup.

4. **JSON-state adapter**
   - Scans valid JSON data in `application/ld+json`, `__NEXT_DATA__`, and state-like script blobs.
   - Extracts player records only when the object has roster-like evidence such as position, jersey, class, height, or weight.

5. **Header table adapter**
   - Uses header names rather than fixed cell indexes.
   - This avoids the earlier failure mode where `cells[0]`, `cells[1]`, etc. misassigned jersey, height, class, and weight on outlier tables.

5. **Heuristic table/card fallback**
   - Attempts a final extraction pass for pages with no obvious platform markers.
   - Uses profile links, position/height/weight/class patterns, and player-only filtering.

## Player-only behavior

The extractor attempts to avoid coaches/staff by:

- preferring `/sports/football/roster/` or `/roster/` profile links
- excluding `/coach/` and `/coaches/` links
- excluding cards/rows with staff terms such as coach, coordinator, assistant, trainer, operations, analyst, recruiting, staff, etc.
- requiring roster-like evidence such as position, height, weight, class year, jersey number, or a roster profile URL

This is a data-cleaning filter, not a legal/compliance filter.

## Included default/demo dataset

The bundled default list lives here:

```text
src/default-fcs-roster-urls.js
```

The input option `useDefaultFcsUrls` is `true` by default. To avoid accidentally crawling the full list during testing, `maxRosterUrls` defaults to `10`. Set `maxRosterUrls` to `0` to crawl every bundled URL.

## Run locally

Install Apify CLI first if you have not already:

```bash
npm install -g apify-cli
apify login
```

Then run:

```bash
npm install
npm run check
npm run test:fixtures
apify run -p sample-input.json
```

Local dataset output will appear under:

```text
storage/datasets/default/
```

Run summaries are saved to the default key-value store:

```text
RUN_SUMMARY
ZERO_PLAYER_PAGES
```

## Deploy to Apify

From the project folder:

```bash
apify push
```

Then open the Actor in Apify Console and run it with the default input.

## Suggested first tests

Start with 3 to 5 pages:

```json
{
  "useDefaultFcsUrls": true,
  "season": "2025",
  "maxRosterUrls": 5,
  "maxConcurrency": 3,
  "startUrls": []
}
```

Then test one custom roster URL:

```json
{
  "useDefaultFcsUrls": false,
  "season": "2025",
  "maxRosterUrls": 0,
  "startUrls": [
    {
      "url": "https://gobison.com/sports/football/roster/2025",
      "userData": {
        "team_name": "North Dakota State"
      }
    }
  ]
}
```

## Debugging outlier pages

If a roster URL returns no players, check the key-value store record:

```text
ZERO_PLAYER_PAGES
```

It includes:

- page URL
- team name
- detected source platform
- page title and `h1`
- table count
- image count
- roster link count
- Sidearm card count
- per-adapter row counts/errors
- a short body-text sample

You can also enable `emitDiagnosticRows` in input to push a visible diagnostic row into the dataset, but keep it disabled for clean production exports.

## Commercial / Apify Store notes

For a public Apify Store listing, position it as a normalized public roster data extractor, not as a copyrighted media downloader. The Actor returns image URLs only; it does not download or rehost headshot images.

Recommended store copy:

> Scrape public college football roster pages into clean CSV/JSON player rows, including names, jersey numbers, positions, height, weight, class year, hometown, profile URLs, and headshot URLs. Built for FCS and college athletics roster workflows.

## Practical limits

College athletics sites are not perfectly standardized. This Actor now has a real adapter layer, but a handful of domains may still need school/domain-specific micro-adapters after you see live failure diagnostics. The intended workflow is:

1. Run a small sample.
2. Inspect `ZERO_PLAYER_PAGES`.
3. Add a domain adapter only for the pages that still fail.
4. Re-run the full default FCS list.
