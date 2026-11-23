# Skokovi — Agent Context & Data Pipeline Guide

## 1. Project Overview & Structure

- **Workspace Root**: `/home/vedran/Local Sites/skokovi`
- **Master Dataset**: `everything.json` — canonical JSON database of ski jumping athletes, aliases, events, and session results.
- **Source Files (`files/`)**: Raw FIS HTML, Swiss Timing PDF, and sportsbook HTML files named `YYYY-MM-DD-<event>-<session>.<ext>`:
  - `files/2026-11-20-lillehammer-t1.pdf` — Lillehammer HS140 Official Training 1 (`2026-11-20`)
  - `files/2026-11-20-lillehammer-q.html` — Lillehammer HS140 Qualifying (`2026-11-20`)
  - `files/2026-11-21-ponuda-duel.html` — Sportsbook H2H odds for Competition 1 filtered down to the **37** `"Utrka duel"` `<section>` blocks
  - `files/2026-11-21-lillehammer-c1.html` — Lillehammer HS140 Competition 1 (`2026-11-21`, FIS DB 2-round results, 50 starters)
  - `files/2026-11-22-ponuda-duel.html` — Sportsbook H2H odds for Competition 2 filtered down to the **51** `"Utrka duel"` `<section>` blocks
- **Google Sheets Integration**:
  - Spreadsheet: **Skokovi** (`13uAw1ACHzSVtv_5ij35WBpWRcaXEzx0MKZ-pbdvAz9A`)
  - URL: `https://docs.google.com/spreadsheets/d/13uAw1ACHzSVtv_5ij35WBpWRcaXEzx0MKZ-pbdvAz9A/edit?gid=0#gid=0`
  - CLI: `gsheets` (`gsheets readonly ...` / `gsheets mutate ...`) via the installed Antigravity **Google Sheets** plugin (`vedranlutring@gmail.com`).
  - **Tabs**:
    - `Main` (`gid=0`) — Master athlete rank overview ordered by `bib` (`1..70`) with per-venue `avg`, weighted `avg calculated`, and session ranks (`t1`, `q1`, `c1`, `c2`).
    - `lillehammer - training_1 - hs140 - 2026-11-20` (`gid=657431624`) — Full Training 1 table ranked `1..66` + `4` `DNS` rows
    - `lillehammer - qualifying - hs140 - 2026-11-20` (`gid=589070901`) — Full Qualifying table ranked `1..70` (`Q` for top 50)

---

## 2. `everything.json` Schema & Conventions

Top-level JSON object keyed by athlete name in **`"First Name Surname"`** format (given name(s) first, surname in Title Case, e.g. `"Isak Andreas Langmo"`).

```json
{
  "Isak Andreas Langmo": {
    "aliases": [
      "LANGMO Isak Andreas",
      "Langmo I.A."
    ],
    "country": "NOR",
    "fis_code": "219702",
    "events": {
      "lillehammer": {
        "type": "hs140",
        "competitions": {
          "training_1": {
            "date": "2026-11-20",
            "rank": 10,
            "bib": 26,
            "speed": 86.9,
            "wind": 0.8,
            "wind_comp": -7.9,
            "gate": 4,
            "gate_comp": 0.0,
            "distance": 125.0,
            "total_points": 55.7
          },
          "qualifying": {
            "date": "2026-11-20",
            "rank": 1,
            "qualified": true,
            "bib": 26,
            "speed": 86.8,
            "wind": 1.69,
            "wind_comp": -16.7,
            "gate": 4,
            "gate_comp": 0.0,
            "judge_points": 54.0,
            "distance_points": 82.5,
            "distance": 135.5,
            "total_points": 119.8,
            "diff": null
          },
          "competition_1": {
            "date": "2026-11-21",
            "rank": 9,
            "bib": 1,
            "total_points": 235.1,
            "diff": -42.9
          }
        }
      }
    }
  }
}
```

### Key Rules
1. **Athlete Identification & `aliases`**:
   - Normalize source names (`SURNAME GivenName`) to `"GivenName Surname"` (Title Case surname) to match existing top-level keys.
   - Whenever the raw name string in a source file (e.g. `"LANGMO Isak Andreas"` in a PDF, `"Langmo I.A."` in sportsbook HTML, or variant spellings) is not identical to the top-level key, append the raw string to `aliases` (deduplicated).
   - Keep `country` (3-letter FIS NSA code) and `fis_code` at the athlete root level.
2. **Event & Session Ordering**:
   - Event keys under `events` are lowercase venue slugs (e.g. `"lillehammer"`), with `"type"` set to the lowercase hill size (e.g. `"hs140"`).
   - Session keys under `competitions` use `snake_case` (e.g. `"training_1"`, `"qualifying"`, `"competition_1"`, `"competition_2"`) and are ordered chronologically, each stored as a single object.
3. **Session Attributes & Types**:
   - Reuse exact `snake_case` attribute names across sessions (`date`, `rank`, `qualified`, `bib`, `speed`, `wind`, `wind_comp`, `gate`, `gate_comp`, `judge_points`, `distance_points`, `distance`, `total_points`, `diff`).
   - Omit attributes that do not exist or are not tracked in a session type:
     - **Official Training**: `date, rank, bib, speed, wind, wind_comp, gate, gate_comp, distance, total_points`.
     - **Qualifying**: adds `qualified, judge_points, distance_points, diff`.
     - **Main Competitions (`competition_1`, `competition_2`)**: store overall summary fields only (`date, rank, bib, total_points, diff`), omitting per-round jump breakdowns and root `birth_year` so athlete objects keep a uniform schema.
   - All numbers are stored as JSON `int` / `float` (never strings). `qualified` is `bool`. `diff` is `null` for 1st place. `gate_comp` is `0.0` when athletes jump from the base gate (blank gate points cell in PDF).
4. **Non-Starters (`DNS`) & Non-Qualifiers (`DNQ`)**:
   - Keep the session object with `"date"`, `"status": "DNS"`, `"bib"`, and set all jump measurement fields (`rank`, `speed`, `wind`, `wind_comp`, `gate`, `gate_comp`, `distance`, `total_points`) to `null`.
   - Do not include `"status"` on normal completed jumps.
   - For athletes who did not qualify (`qualified: false` in `qualifying`), omit the corresponding `competition_*` key in `everything.json` (and write `"DNQ"` in the `Main` Google Sheet column).

---

## 3. Parsing & Verification Workflow

### FIS Live Qualifying HTML Tables (`files/*-q.html`)
- Parse `<ul class="jp">` -> athlete `<li>` rows (skipping `<li class="tableheader">`).
- Extract the 15 child `<div>` columns in order: `col_rank`, `col_quali` (`"Q"` -> `true`, `""` -> `false`), `col_bib`, `col_name[data-fiscode]` (`<span class="bold">SURNAME</span>` + given name), `col_nsa` (`.flag-label`), `speed`, `wind`, `wind_comp`, `gate`, `gate_comp`, `judge_points`, `distance_points`, `distance`, `total_points`, `diff`.

### FIS DB Two-Round Competition HTML (`files/*-c1.html`, `*-c2.html`)
- Parse `<a class="table-row">` rows under `#events-info-results` and match athletes to `everything.json` via `fis_code` (cross-checking `country` and appending raw name to `aliases` if new).
- Extract overall `rank`, `bib`, `total_points` (`.blue.bold.hidden-sm`), and `diff` — **strip mobile-only `<span class="hidden-md-up ...">` elements first** because FIS embeds a duplicate of the winner's `total_points` inside 1st place's `Diff. Points` cell (`diff` for 1st must be `null`). Verify `round(total_points - winner_points, 1) == diff` across ranks `2..50`.
- When analyzing form/duels, also read `.split-row__item` blocks from the raw HTML to inspect individual Round 1 and Round 2 `distance`, `points`, and `round_rank`.

### FIS Swiss Timing PDFs (`files/*.pdf`)
- Extract word bounding boxes via `pdftotext -bbox <file.pdf> -` (avoid plain text line-splitting because club names and birthdates wrap differently across rows).
- Anchor each athlete row on the `BIB` word (`xMin` `30..45`, font height `> 9.5`), read athlete name (`xMin` `47..168`, font height `> 9.5`) and `NSA` (`xMin` `168..190`, font height `> 9.5`), and split metric words (`xMin >= 190`) into:
  - **Upper row**: `speed`, `distance`, `gate`, `wind`, `total_points`
  - **Lower row**: `[speed_rank, dist_rank, (optional gate_comp), wind_comp, rank]` (strip `=` and `.` from `rank`, e.g. `=46.` -> `46`)
  - Detect `DNS` in `REMARKS` / metric words.
- **Mandatory Math & Stats Verification**:
  - Verify every completed jump against the hill scoring formula (e.g. for Lillehammer HS140, `K=123m`, `1.8 pts/m`: `max(0.0, round(60 + (distance - 123) * 1.8 + gate_comp + wind_comp, 1)) == total_points` for unjudged training, plus `judge_points` for judged rounds).
  - Verify parsed ranks match competition ranking of `total_points` descending.
  - Cross-check athlete count, `DNS` count, and `min`/`max` speed and distance against the PDF's Statistics summary table.

### Sportsbook Duel HTML (`files/*-ponuda-duel.html`) & `Listić` Analysis
- **Filtering**: Keep only `<section class="bg-surface-primary">` blocks whose `<h2>` header contains `"utrka duel"` (case-insensitive, normalizing `&nbsp;`), stripping outright (`Pobjednik utrke`), top-N (`Utrka top 3/6/10/15`), and 1st-round (`1. vožnja duel`) markets.
- **Extraction & Alias Mapping**:
  - Each section contains two `<button class="odds-button">` outcomes with `.odds-button__name` (e.g. `"Langmo I.A."`, `"Sundal K.E."`) and `.odds-button__value-current` (decimal odds, e.g. `1.44`).
  - Match `"Surname I."` / `"Surname I.A."` against the athlete's surname + given-name initials in `everything.json` and append the short string to `aliases` (deduplicated).
- **Duel Evaluation & Betting Slip (`Listić`) Rules**:
  - **Minimum Odds Threshold**: Every selected pick must have decimal odds **`>= 1.40`** (skip heavy favorites `< 1.40`).
  - **Strict Non-Overlap Constraint (Disjoint Matching)**: No athlete may appear in more than one pair on the same `listić` (e.g. if `Zajc vs Prevc` is picked, `Prevc vs Embacher` cannot be on the same slip). Build slips of `3`–`7` disjoint pairs.
  - **Multi-Metric Ranking & Wind-Outlier Protection**:
    1. **`avg calculated` (`Main` Col C)**: Primary sheet metric (`40%` `t1`/`q1` average + `60%` `c1`/`c2` average), prioritizing real competition performance over training/qualifying.
    2. **Jump-Level Recency Rank (`WJrk`)**: Weight individual jumps (`10% T1 + 20% Q1 + 35% C1-R1 + 35% C1-R2`) using `.split-row__item` round ranks from `*-c1.html` to capture Round-2 momentum (surging vs. fading jumpers).
    3. **Outlier-Trimmed Jump Rank (`Trim` — Best `N-1` Jumps)**: Drop each athlete's single worst jump to detect Round-1 wind-gust casualties (e.g. an elite top-6 jumper like `Domen Prevc` or `Kacper Tomasiak` eliminated in `37th`–`50th` due to bad wind). **Do not blindly fade elite jumpers whose `avg calculated` is inflated by a single wind-ruined jump** — prioritize duels where `avg calculated`, `WJrk`, `Trim`, and jump-by-jump H2H all align.

---

## 4. Google Sheets Conventions & Formatting

### Session Tabs (`<event> - <session> - <type> - <date>`)
- Ordered by session `rank` ascending (`1st` to last), with `DNS` rows placed at the bottom (`Rank` = `"DNS"`, jump columns blank).
- Columns:
  - **Training**: `Rank, Bib, Name, Country, Speed, Distance, Gate, Gate Comp, Wind, Wind Comp, Total Points`
  - **Qualifying**: `Rank, Qualified, Bib, Name, Country, Speed, Distance, Distance Points, Judge Points, Gate, Gate Comp, Wind, Wind Comp, Total Points, Diff` (`"Q"` for qualified, blank `Diff` for 1st).
- Style: Bold + frozen row 1, auto-sized columns.

### `Main` Tab (`gid=0`)
- **Header (`Rows 1–2`)**: 2-tier merged header (`A1:A2` `"Name"`, venue group header `B1:G1` `"lillehammer"`, summary subheaders `B2:C2` `"avg"`, `"avg calculated"` in `#CBD5E1`, session subheaders `D2:G2` `"t1"`, `"q1"`, `"c1"`, `"c2"` in `#E2E8F0`), dark slate `#1E293B` top header, frozen `2` rows + `1` column.
- **Formulas & Data (`Rows 3–72`)**:
  - Ordered by World Cup `bib` ascending (`1..70`).
  - **Col B (`avg`)**: `=AVERAGE(D<r>:G<r>)` (`0.0` bold).
  - **Col C (`avg calculated`)**: `=IF(COUNT(F<r>:G<r>)=0, AVERAGE(D<r>:E<r>), 0.4*AVERAGE(D<r>:E<r>)+0.6*AVERAGE(F<r>:G<r>))` (`0.0` bold; 40% `t1`/`q1` + 60% `c1`/`c2`, falling back to `D:E` when `F:G` has no numeric rank so `"DNQ"`/empty cells never evaluate as `0`).
  - **Cols D–G (`t1`, `q1`, `c1`, `c2`)**: Centered integer ranks, `"DNS"` for non-starters, `"DNQ"` for non-qualifiers.
- **Borders & Highlights**: Zebra row shading (`#FFFFFF` / `#F8FAFC`), medium `#64748B` vertical borders after `Name` (`A`) and at the right edge of each venue block (`G` / `c2`), subtle `#94A3B8` divider after `avg calculated` (`C`), light `#E2E8F0` inner session borders, and conditional highlights across `B3:G72`:
  - **Podium (`1`–`3`)**: Gold `#FEF3C7` / `#92400E`
  - **Top 10 (`4`–`10`)**: Green `#DCFCE7` / `#166534`
  - **`DNS` / `DNQ`**: Muted italic `#F1F5F9` / `#64748B`

---

## 5. Completed Work Log

1. **Qualifying (`2026-11-20-lillehammer-q.html`)**: Parsed all **70** athletes (`50` qualified, `20` not qualified) into `everything.json` under `events.lillehammer.competitions.qualifying` (`date: "2026-11-20"`).
2. **Official Training 1 (`2026-11-20-lillehammer-t1.pdf`)**: Parsed all **70** rows (`66` completed jumps + `4` `DNS`: Raffael Zimmermann, Naoki Nakamura, Jan Hoerl, Stephan Embacher), inserted `training_1` (`date: "2026-11-20"`) before `qualifying`, verified all jump totals and summary stats, and added PDF name strings (`"SURNAME GivenName"`) to `aliases`.
3. **Google Sheets Tabs & `Main` Formatting**: Populated `lillehammer - training_1 - hs140 - 2026-11-20` and `lillehammer - qualifying - hs140 - 2026-11-20`, populated `Main!A3:D72` by `bib` (`1..70`) with live `=AVERAGE` formulas, and styled `Main` via `raw-batch`.
4. **Sportsbook Duels (`2026-11-21-ponuda-duel.html`) & Analysis**: Filtered the HTML down to the **37** `"Utrka duel"` markets, appended all **15** sportsbook short-name strings (e.g. `"Langmo I.A."`) to `aliases` in `everything.json`, and analyzed H2H odds vs. Lillehammer standings to build non-overlapping `3`–`7` pair slips (`listići`).
5. **Competition 1 (`2026-11-21-lillehammer-c1.html`) & `Main` `avg calculated` Update**: Parsed all **50** starters into `everything.json` under `competition_1`, populated `Main!F3:F72` (`1..50` + `20` `"DNQ"`), added the `40% / 60%` weighted `avg calculated` formula in `Main!C3:C72`, updated `avg` to `D:G`, and restyled `B1:G72` borders and highlights.
6. **Competition 2 Duels (`2026-11-22-ponuda-duel.html`) & Jump-Level Analysis**: Filtered the HTML down to the **51** `"Utrka duel"` markets and built `>= 1.40` disjoint `listići` combining `avg calculated`, per-jump recency rank (`WJrk`), and outlier-trimmed jump rank (`Trim`) while excluding Round-1 wind casualties (`Domen Prevc`).
