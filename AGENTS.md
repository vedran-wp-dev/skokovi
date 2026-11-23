# Skokovi — Agent Context & Data Pipeline Guide

## 1. Project Overview & Structure

- **Workspace Root**: `/home/vedran/Local Sites/skokovi` (local Git repo initialized)
- **Master Dataset & Architecture**: `everything.json` — single canonical JSON database of ski jumping athletes, aliases, World Cup overall standings, events, sessions, and per-round competition jumps (designed to power a client-side JS app directly without a PHP/SQLite sync layer).
- **Source Files (`files/`)**: Raw FIS HTML, Swiss Timing PDF, and sportsbook HTML files:
  - `files/0000-wc-standings.html` — Overall FIS World Cup Standings (`36` ranked athletes after 2 competitions; update/overwrite as season progresses)
  - `files/2026-11-20-lillehammer-t1.pdf` — Lillehammer HS140 Official Training 1 (`2026-11-20`, `66` jumps + `4` `DNS`)
  - `files/2026-11-20-lillehammer-q.html` — Lillehammer HS140 Qualifying 1 (`2026-11-20`, FIS live ticker HTML, `70` jumpers)
  - `files/2026-11-21-ponuda-duel.html` — Sportsbook H2H odds for Competition 1 filtered down to the **37** `"Utrka duel"` `<section>` blocks
  - `files/2026-11-21-lillehammer-c1.html` — Lillehammer HS140 Competition 1 (`2026-11-21`, FIS DB 2-round results, `50` starters / `30` in Round 2)
  - `files/2026-11-22-ponuda-duel.html` — Sportsbook H2H odds for Competition 2 filtered down to the **51** `"Utrka duel"` `<section>` blocks
  - `files/2026-11-22-lillehammer-q2.html` — Lillehammer HS140 Qualifying 2 (`2026-11-22`, FIS DB single-round HTML, `65` ranked + `1` `DSQ`; `4` host-quota Norwegians unentered)
  - `files/2026-11-22-lillehammer-c2.html` — Lillehammer HS140 Competition 2 (`2026-11-22`, FIS DB 2-round results, `50` starters / `31` in Round 2)
- **Google Sheets Integration**:
  - Spreadsheet: **Skokovi** (`13uAw1ACHzSVtv_5ij35WBpWRcaXEzx0MKZ-pbdvAz9A`)
  - URL: `https://docs.google.com/spreadsheets/d/13uAw1ACHzSVtv_5ij35WBpWRcaXEzx0MKZ-pbdvAz9A/edit?gid=0#gid=0`
  - CLI: `gsheets` (`gsheets readonly ...` / `gsheets mutate ...`) via the installed Antigravity **Google Sheets** plugin (`vedranlutring@gmail.com`).
  - **Tabs**:
    - `Main` (`gid=0`) — Master athlete overview (`A1:K72`) with `Points WC` (`B`), `Position WC` (`C`), and per-venue blocks (`lillehammer` in `D:K`: `avg`, `avg calc all`, `avg calc (no worst)`, `t1`, `q1`, `q2`, `c1`, `c2`).
    - `lillehammer - training_1 - hs140 - 2026-11-20` (`gid=657431624`) — Full Training 1 table ranked `1..66` + `4` `DNS` rows
    - `lillehammer - qualifying - hs140 - 2026-11-20` (`gid=589070901`) — Full Qualifying 1 table ranked `1..70` (`Q` for top 50)

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
    "wc_points": 89,
    "wc_position": 5,
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
          "qualifying_1": {
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
            "rounds": {
              "round_1": {
                "rank": 10,
                "distance": 127.0,
                "total_points": 120.4
              },
              "round_2": {
                "rank": 11,
                "distance": 130.5,
                "total_points": 114.7
              }
            },
            "total_points": 235.1,
            "diff": -42.9
          },
          "qualifying_2": {
            "date": "2026-11-22",
            "rank": 2,
            "qualified": true,
            "bib": 9,
            "distance": 137.0,
            "total_points": 135.0,
            "diff": -1.8
          },
          "competition_2": {
            "date": "2026-11-22",
            "rank": 3,
            "bib": 9,
            "rounds": {
              "round_1": {
                "rank": 6,
                "distance": 133.0,
                "total_points": 151.0
              },
              "round_2": {
                "rank": 3,
                "distance": 133.5,
                "total_points": 148.2
              }
            },
            "total_points": 299.2,
            "diff": -4.8
          }
        }
      }
    }
  }
}
```

### Key Rules
1. **Athlete Root Fields & `aliases`**:
   - Normalize source names (`SURNAME GivenName`) to `"GivenName Surname"` (Title Case surname) to match existing top-level keys.
   - Whenever the raw name string in a source file (e.g. `"LANGMO Isak Andreas"` in PDF/FIS DB HTML, `"Langmo I.A."` in sportsbook HTML, or variant spellings) is not identical to the top-level key, append the raw string to `aliases` (deduplicated).
   - Root keys on every athlete: `aliases` (`string[]`), `country` (`string`), `fis_code` (`string`), `wc_points` (`int`, `0` if unranked), `wc_position` (`int | null`, `null` if `0` points), and `events` (`object`). Omit `birth_year`.
2. **Event & Session Ordering**:
   - Event keys under `events` are lowercase venue slugs (e.g. `"lillehammer"`), with `"type"` set to the lowercase hill size (e.g. `"hs140"`).
   - Session keys under `competitions` use `snake_case` and strict chronological ordering: `training_1`, `qualifying_1`, `competition_1`, `qualifying_2`, `competition_2`.
3. **Session Attributes & Types**:
   - Reuse exact `snake_case` attribute names across sessions (`date`, `rank`, `qualified`, `bib`, `speed`, `wind`, `wind_comp`, `gate`, `gate_comp`, `judge_points`, `distance_points`, `distance`, `total_points`, `diff`), omitting attributes not present in that source:
     - **Official Training (`*.pdf`)**: `date, rank, bib, speed, wind, wind_comp, gate, gate_comp, distance, total_points`.
     - **Qualifying (`*-q*.html`)**:
       - Live ticker HTML (`*-q.html`): full telemetry + `qualified, judge_points, distance_points, diff`.
       - FIS DB HTML (`*-q2.html`): `date, rank, qualified, bib, distance, total_points, diff`.
     - **Main Competitions (`competition_1`, `competition_2`)**: `date, rank, bib, rounds: { round_1: { rank, distance, total_points }, round_2: { rank, distance, total_points } | null }, total_points, diff`.
   - All numbers are stored as JSON `int` / `float` (never strings). `qualified` is `bool`. `diff` is `null` for 1st place. `gate_comp` is `0.0` when athletes jump from the base gate.
4. **Non-Starters (`DNS`), Disqualifications (`DSQ`), Non-Qualifiers (`DNQ`) & Unentered Quota Jumpers**:
   - **`DNS`** (in training/qualifying): keep session object with `"date"`, `"status": "DNS"`, `"bib"`, and `null` for jump metrics.
   - **`DSQ`** (e.g. `Johann Andre Forfang` in `qualifying_2`): keep session object with `"date"`, `"status": "DSQ"`, `"rank": null`, `"qualified": false`, `"bib"`, and `null` for jump metrics.
   - Do not include `"status"` on normal completed jumps.
   - **`DNQ`**: omit the corresponding `competition_*` key in `everything.json` (and write `"DNQ"` in `Main`).
   - **Unentered jumpers** (e.g. host-nation national-group quota jumpers who only enter day 1): omit both `qualifying_2` and `competition_2` in `everything.json` (and write `"-"` in both `q2` and `c2` in `Main`, never `"DNQ"`).

---

## 3. Parsing & Verification Workflow

### FIS World Cup Standings HTML (`files/0000-wc-standings.html`)
- Parse `<a class="table-row ...">` rows: extract athlete raw name (`.g-md-4.justify-left.bold`), `country` (`.country__name-short`), `wc_position` (`.g-md-5.g-lg-8.justify-right.bold`), and `wc_points` (`.pl-xs-1.g-md-9.g-lg-8.justify-right.bold`).
- Match athletes via `aliases` / normalized name, set `wc_points: 0, wc_position: null` for unranked athletes (`0` and `"-"` in `Main!B:C`), and cross-check `wc_points` against FIS World Cup points (`100, 80, 60, 50, 45, ..., 1` for top 30) across completed competitions.

### FIS Live Qualifying HTML (`files/*-q.html`)
- Parse `<ul class="jp">` -> athlete `<li>` rows (skipping `<li class="tableheader">`), extracting the 15 child `<div>` columns (`col_rank`, `col_quali`, `col_bib`, `col_name[data-fiscode]`, `col_nsa`, `speed`, `wind`, `wind_comp`, `gate`, `gate_comp`, `judge_points`, `distance_points`, `distance`, `total_points`, `diff`).

### FIS DB Competition & Qualifying HTML (`files/*-c1.html`, `*-c2.html`, `*-q2.html`)
- Parse `<a class="table-row">` rows (including any secondary `Disqualified` `<div class="tbody">` table at the bottom of `*-q2.html`, where `rank` text is empty -> `"status": "DSQ"`, `"qualified": false`) and match athletes via `fis_code`.
- **Mobile Span Quirk**: Strip `<span class="hidden-md-up ...">` elements before extracting `diff`, because FIS embeds a duplicate of 1st place's `total_points` inside the winner's `Diff. Points` cell (`diff` for 1st must be `null`). Verify `round(total_points - winner_points, 1) == diff` across all ranked rows.
- Parse `.split-row__item` blocks to populate `rounds.round_1` and `rounds.round_2` (`null` if Round 2 is blank) and verify `round(round_1.total_points + (round_2.total_points or 0), 1) == total_points`.

### FIS Swiss Timing PDFs (`files/*.pdf`)
- Extract word bounding boxes via `pdftotext -bbox <file.pdf> -`.
- Anchor each athlete row on `BIB` (`xMin` `30..45`, font height `> 9.5`), read `NAME` (`xMin` `47..168`, font height `> 9.5`) and `NSA` (`xMin` `168..190`), and split `xMin >= 190` into upper (`speed, distance, gate, wind, total_points`) and lower (`[speed_rank, dist_rank, (optional gate_comp), wind_comp, rank]`) lines; detect `DNS` in remarks/metrics.
- Verify every jump against the hill's `K-POINT` / `METER VALUE` scoring formula from `Hill Data`, rank ordering, and PDF Statistics summary table.

### Sportsbook Duel HTML (`files/*-ponuda-duel.html`) & `Listić` Analysis
- **Filtering**: Keep only `<section class="bg-surface-primary">` blocks whose `<h2>` contains `"utrka duel"` (case-insensitive, normalizing `&nbsp;`).
- **Alias Mapping**: Match `.odds-button__name` (`"Surname I.A."`) to `everything.json` via surname + given-name initials and append to `aliases` (deduplicated).
- **Duel Evaluation & `Listić` Rules**:
  - **Minimum Odds Threshold**: Every selected pick must have decimal odds **`>= 1.40`**.
  - **Strict Non-Overlap Constraint**: No athlete may appear in more than one pair on the same `listić` (`3`–`7` disjoint pairs).
  - **Multi-Metric Ranking & Wind-Outlier Protection**: Combine `avg calc all` (`35% / 65%`), `avg calc (no worst)`, `wc_points`/`wc_position`, and per-round momentum (`round_1` vs `round_2` in `everything.json`). Do not blindly fade elite jumpers whose `avg calc all` is inflated by a single wind-ruined Round-1 jump — prioritize duels where all metrics and jump-by-jump H2H align.

---

## 4. Google Sheets Conventions & Formatting

### Session Tabs (`<event> - <session> - <type> - <date>`)
- Ordered by session `rank` ascending (`1st` to last), with `DNS` rows at the bottom; bold + frozen row 1, auto-sized columns.

### `Main` Tab (`gid=0`, `A1:K72`)
- **Header & Frozen Panes (`Rows 1–2`)**:
  - `A1:A2` merged `"Name"`, `B1` `"Points WC"` / `B2` `"After <N>"`, `C1` `"Position WC"` / `C2` `"After <N>"`, `D1:K1` merged venue header `"lillehammer"`, `D2:F2` summary subheaders (`"avg"`, `"avg calc all"`, `"avg calc (no worst)"`) in `#CBD5E1`, `G2:K2` session subheaders (`"t1"`, `"q1"`, `"q2"`, `"c1"`, `"c2"`) in `#E2E8F0`.
  - **Frozen `2` rows + `3` columns** (`frozenRowCount: 2`, `frozenColumnCount: 3` — pins `Name`, `Points WC`, and `Position WC` when scrolling vertically or horizontally across venues).
- **Columns & Formulas (`Rows 3–72`, ordered by initial `bib` `1..70`)**:
  - **Col B (`Points WC`)**: Bold centered integer (`0` if unranked).
  - **Col C (`Position WC`)**: Bold centered integer (`"-"` if `0` points).
  - **Col D (`avg`)**: `=AVERAGE(G<r>:K<r>)` (`0.0` bold; wrap with `IFERROR(..., "-")` on future rows where an athlete did not enter a venue at all).
  - **Col E (`avg calc all`)** — **`0.35 + 0.65`** weights (`35%` `G:I` + `65%` `J:K`), penalizing each `"DNQ"` in `J:K` as rank **`55`** while ignoring `"DNS"`, `"DSQ"`, `"-"`, and empty cells:
    `=LET(q, G<r>:I<r>, c, J<r>:K<r>, dnq, COUNTIF(c, "DNQ"), qn, COUNT(q), qs, SUM(q), cn, COUNT(c)+dnq, cs, SUM(c)+55*dnq, IF(cn=0, qs/qn, IF(qn=0, cs/cn, 0.35*(qs/qn)+0.65*(cs/cn))))`
  - **Col F (`avg calc (no worst)`)** — **`0.35 + 0.65`** weights (`DNQ = 55`), dropping **one** occurrence of the jumper's worst score (`MAX` across numeric ranks and `DNQ=55`) **only when** `COUNT(J<r>:K<r>) >= 1` **and** total results `>= 4`:
    `=LET(q, G<r>:I<r>, c, J<r>:K<r>, dnq, COUNTIF(c, "DNQ"), qa, COUNT(q), qb, SUM(q), ca, COUNT(c)+dnq, cb, SUM(c)+55*dnq, drop, AND(COUNT(c)>=1, qa+ca>=4), cm, IF(dnq>0, MAX(55, MAX(c)), MAX(c)), m, MAX(MAX(q), cm), dc, AND(drop, OR(COUNTIF(c, m)>0, AND(dnq>0, m=55))), dq, AND(drop, NOT(dc)), qn, qa-IF(dq, 1, 0), qs, qb-IF(dq, m, 0), cn, ca-IF(dc, 1, 0), cs, cb-IF(dc, m, 0), IF(cn=0, qs/qn, IF(qn=0, cs/cn, 0.35*(qs/qn)+0.65*(cs/cn))))`
  - **Google Sheets `LET()` Gotcha**: Always use short, pure alphabetic variable names (`qa`, `qb`, `ca`, `cb`, `cm`) — never underscores (`can_drop`) or letter+digit names (`qn0`), which Google Sheets parses as cell references and rejects with `#ERROR!`.
  - **Cols G–K (`t1, q1, q2, c1, c2`)**: Centered integers, `"DNS"`, `"DSQ"`, `"DNQ"`, and `"-"` (not on start list).
- **Borders & Highlights**: Zebra rows (`#FFFFFF` / `#F8FAFC`), medium `#64748B` borders after `A` (`Name`), `C` (`Position WC`), and `K` (`c2`), `#94A3B8` divider after `F` (`avg calc (no worst)`), Podium (`1`–`3` gold `#FEF3C7`/`#92400E`) & Top 10 (`4`–`10` green `#DCFCE7`/`#166534`) across **`C3:K72` (excluding Col B `Points WC` so low point totals like `1` or `4` pts are never colored as podium/top-10 ranks)**, and muted italic `#F1F5F9`/`#64748B` for `"DNS"`, `"DNQ"`, `"DSQ"`, and `"-"`.

---

## 5. Completed Work Log

1. **Qualifying 1 (`2026-11-20-lillehammer-q.html`)**: Parsed all **70** athletes into `everything.json` (`qualifying_1`).
2. **Official Training 1 (`2026-11-20-lillehammer-t1.pdf`)**: Parsed **66** jumps + **4** `DNS` into `training_1`, verified jump math/stats, and added PDF name aliases.
3. **Google Sheets Session Tabs & Initial `Main`**: Created and populated `training_1` and `qualifying` tabs and styled `Main`.
4. **Competition 1 Duels (`2026-11-21-ponuda-duel.html`)**: Filtered to **37** `"Utrka duel"` blocks, added **15** sportsbook aliases to `everything.json`, and built disjoint `listići`.
5. **Competition 1 (`2026-11-21-lillehammer-c1.html`)**: Parsed all **50** starters (`30` finalists) into `competition_1` (including `rounds.round_1` & `rounds.round_2`) and populated `Main` `c1`.
6. **Competition 2 Duels (`2026-11-22-ponuda-duel.html`)**: Filtered to **51** `"Utrka duel"` blocks and built `>= 1.40` wind-adjusted disjoint `listići`.
7. **Competition 2 (`2026-11-22-lillehammer-c2.html`)**: Parsed all **50** starters (`31` finalists) into `competition_2` (including `rounds`) and populated `Main` `c2`.
8. **Qualifying 2 (`2026-11-22-lillehammer-q2.html`)**: Renamed `qualifying` → `qualifying_1`, added `qualifying_2` (`65` ranked + `1` `DSQ` `Johann Andre Forfang`, `4` unentered host-quota Norwegians), and populated `Main` `q2`.
9. **`Main` Weighted & Outlier-Trimmed Formulas**: Updated `avg calc all` and `avg calc (no worst)` to `0.35 + 0.65` weights with `DNQ = 55`, `"-"` for unentered sessions, and a `>= 4` results & `>= 1` race-start requirement before dropping a jumper's worst score.
10. **World Cup Standings (`0000-wc-standings.html`)**: Parsed all **36** WC point-scorers (`wc_points`, `wc_position`) into `everything.json`, populated `Main!B3:C72` (`Points WC` & `Position WC`), froze `A:C` + `Rows 1–2`, and styled `Main!A1:K72`.
