(function initSkokoviApp() {
  "use strict";

  const DATA = window.SKOKOVI_HISTORY_DATA;
  const Metrics = window.SkokoviMetrics;
  const Charts = window.SkokoviCharts;

  if (!DATA || !Metrics || !Charts) {
    return;
  }

  const jumperBySlug = new Map();
  DATA.jumpers.forEach((j) => jumperBySlug.set(j.slug, j));

  const hillById = new Map();
  DATA.hills.forEach((h) => hillById.set(h.id, h));

  const state = {
    activeView: "hill", // "hill" | "jumper"
    selectedHillId: hillById.has("lillehammer__hs140") ? "lillehammer__hs140" : DATA.hills[0].id,
    selectedJumperSlugs: [], // optional multi-select for Hill View
    rosterMode: "active", // "active" (2026/27 roster) | "all" (all 133)
    hillScope: "overall", // "overall" | "2025/2026" | "2024/2025" | "2023/2024"
    hillSortKey: "hillAvg",
    hillSortDir: "asc",
    profileJumperSlug: jumperBySlug.has("domen-prevc") ? "domen-prevc" : DATA.jumpers[0].slug,
  };

  // DOM Elements
  const els = {
    tabHill: document.getElementById("tab-hill"),
    tabJumper: document.getElementById("tab-jumper"),
    viewHill: document.getElementById("view-hill"),
    viewJumper: document.getElementById("view-jumper"),

    hillSelect: document.getElementById("hill-select"),
    rosterButtons: document.querySelectorAll("[data-roster-mode]"),
    scopeButtons: document.querySelectorAll("[data-hill-scope]"),
    jumperSearchInput: document.getElementById("hill-jumper-search"),
    jumperDropdown: document.getElementById("hill-jumper-dropdown"),
    clearJumpersBtn: document.getElementById("clear-jumpers-btn"),
    selectedChipsBar: document.getElementById("selected-jumpers-chips"),
    windowStripSeasons: document.getElementById("window-strip-seasons"),

    trajChartBody: document.getElementById("hill-traj-chart"),
    trajLegend: document.getElementById("hill-traj-legend"),
    trajInspector: document.getElementById("hill-traj-inspector"),
    deltaChartBody: document.getElementById("hill-delta-chart"),
    deltaScopeLabel: document.getElementById("hill-delta-scope-label"),
    deltaInspector: document.getElementById("hill-delta-inspector"),

    hillTableTitle: document.getElementById("hill-table-title"),
    hillTableSubtitle: document.getElementById("hill-table-subtitle"),
    hillTableHead: document.getElementById("hill-table-head"),
    hillTableBody: document.getElementById("hill-table-body"),

    profileJumperSelect: document.getElementById("profile-jumper-select"),
    profileSearchInput: document.getElementById("profile-jumper-search"),
    profileBanner: document.getElementById("profile-banner"),
    seasonsStack: document.getElementById("jumper-seasons-stack"),
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCategoryLabel(cat) {
    if (cat === "normal") return "Normal Hill";
    if (cat === "flying") return "Flying Hill";
    return "Large Hill";
  }

  function formatCategoryShort(cat) {
    if (cat === "normal") return "NH";
    if (cat === "flying") return "FH";
    return "LH";
  }

  function renderCategoryBadge(cat, hsText) {
    const label = hsText ? `${hsText.toUpperCase()} · ${formatCategoryShort(cat)}` : formatCategoryShort(cat);
    return `<span class="badge badge--cat-${escapeHtml(cat)}">${escapeHtml(label)}</span>`;
  }

  function renderDeltaBadge(val) {
    if (val === null || val === undefined) {
      return `<span class="muted-dash">—</span>`;
    }
    if (val > 0) {
      return `<span class="badge badge--pos">+${val.toFixed(1)}</span>`;
    }
    if (val < 0) {
      return `<span class="badge badge--neg">${val.toFixed(1)}</span>`;
    }
    return `<span class="badge badge--neutral">0.0</span>`;
  }

  function renderAvgCell(val) {
    if (val === null || val === undefined) {
      return `<span class="muted-dash">—</span>`;
    }
    if (val <= 3.0) {
      return `<span class="badge badge--podium">${val.toFixed(1)}</span>`;
    }
    if (val <= 10.0) {
      return `<span class="badge badge--top10">${val.toFixed(1)}</span>`;
    }
    return val.toFixed(1);
  }

  function renderRanksBadges(ranks) {
    if (!ranks || !ranks.length) {
      return `<span class="muted-dash">—</span>`;
    }
    const items = ranks.map((r) => {
      if (r <= 3) {
        return `<span class="badge badge--podium">${r}</span>`;
      }
      if (r <= 10) {
        return `<span class="badge badge--top10">${r}</span>`;
      }
      return `<span>${r}</span>`;
    });
    return `<span class="ranks-list">${items.join(", ")}</span>`;
  }

  function populateHillSelect() {
    els.hillSelect.innerHTML = DATA.hills
      .map((h) => {
        const label = `${h.venue_label} (${h.country}) — ${h.hs.toUpperCase()} [${formatCategoryLabel(h.category)}]`;
        return `<option value="${escapeHtml(h.id)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    els.hillSelect.value = state.selectedHillId;
  }

  function populateProfileJumperSelect(filterQuery) {
    const q = (filterQuery || "").trim().toLowerCase();
    const filtered = DATA.jumpers.filter(
      (j) =>
        !q ||
        j.name.toLowerCase().includes(q) ||
        j.country.toLowerCase().includes(q)
    );
    els.profileJumperSelect.innerHTML = filtered
      .map((j) => {
        const tag = j.active_2027 ? "★ " : "";
        return `<option value="${escapeHtml(j.slug)}">${escapeHtml(`${tag}${j.name} (${j.country})`)}</option>`;
      })
      .join("");
    if (filtered.some((j) => j.slug === state.profileJumperSlug)) {
      els.profileJumperSelect.value = state.profileJumperSlug;
    } else if (filtered.length > 0) {
      state.profileJumperSlug = filtered[0].slug;
      els.profileJumperSelect.value = state.profileJumperSlug;
      renderJumperView();
    }
  }

  function switchView(targetView) {
    state.activeView = targetView;
    const isHill = targetView === "hill";
    els.tabHill.classList.toggle("nav-tabs__btn--active", isHill);
    els.tabJumper.classList.toggle("nav-tabs__btn--active", !isHill);
    els.viewHill.classList.toggle("view-section--hidden", !isHill);
    els.viewJumper.classList.toggle("view-section--hidden", isHill);

    if (isHill) {
      renderHillView();
    } else {
      renderJumperView();
    }
  }

  function toggleSelectedJumper(slug) {
    const idx = state.selectedJumperSlugs.indexOf(slug);
    if (idx >= 0) {
      state.selectedJumperSlugs.splice(idx, 1);
    } else {
      state.selectedJumperSlugs.push(slug);
    }
    renderJumperDropdown(els.jumperSearchInput.value);
    renderHillView();
  }

  function renderJumperDropdown(query) {
    const q = (query || "").trim().toLowerCase();
    const matches = DATA.jumpers
      .filter((j) => {
        if (state.rosterMode === "active" && !j.active_2027 && !state.selectedJumperSlugs.includes(j.slug)) {
          return false;
        }
        return !q || j.name.toLowerCase().includes(q) || j.country.toLowerCase().includes(q);
      })
      .slice(0, 35);

    if (!matches.length) {
      els.jumperDropdown.innerHTML = `<div class="empty-state">No matching jumpers</div>`;
      return;
    }

    els.jumperDropdown.innerHTML = matches
      .map((j) => {
        const isSelected = state.selectedJumperSlugs.includes(j.slug);
        const cls = isSelected
          ? "jumper-picker__option jumper-picker__option--selected"
          : "jumper-picker__option";
        return `<button type="button" class="${cls}" data-pick-slug="${escapeHtml(j.slug)}">
          <span>${escapeHtml(j.name)} (${escapeHtml(j.country)})</span>
          <span>${isSelected ? "Selected ✓" : "+ Compare"}</span>
        </button>`;
      })
      .join("");
  }

  function renderWindowStrip(hill, seasonWindows) {
    els.windowStripSeasons.innerHTML = DATA.seasons
      .map((season) => {
        const win = seasonWindows[season];
        if (!win.held) {
          return `<div class="window-strip__item">
            <div class="window-strip__season-head">
              <span>${escapeHtml(season)}</span>
              <span class="muted-dash">Not on WC calendar</span>
            </div>
          </div>`;
        }
        const prevTxt = win.prevStops.length
          ? win.prevStops.map((s) => `${s.venue_label} (${s.hs.toUpperCase()})`).join(" → ")
          : "None (season start)";
        const afterTxt = win.afterStops.length
          ? win.afterStops.map((s) => `${s.venue_label} (${s.hs.toUpperCase()})`).join(" → ")
          : "None (season end)";

        return `<div class="window-strip__item">
          <div class="window-strip__season-head">
            <span>${escapeHtml(season)}</span>
            <span>${escapeHtml(win.targetStop.date_label)} · ${win.targetStop.race_count} race${win.targetStop.race_count > 1 ? "s" : ""}</span>
          </div>
          <div class="window-strip__line"><span class="window-strip__line-label">Prev 3 ${escapeHtml(formatCategoryShort(hill.category))}:</span> ${escapeHtml(prevTxt)}</div>
          <div class="window-strip__line"><span class="window-strip__line-label">After 3 ${escapeHtml(formatCategoryShort(hill.category))}:</span> ${escapeHtml(afterTxt)}</div>
        </div>`;
      })
      .join("");
  }

  function extractSortMetric(row, scopeKey, metricKey) {
    if (metricKey === "name") {
      return row.name;
    }
    if (metricKey === "starts") {
      return scopeKey === "overall"
        ? row.starts
        : row.bySeason[scopeKey]?.ranks.length || 0;
    }
    const bucket = scopeKey === "overall" ? row.overall : row.bySeason[scopeKey];
    return bucket ? bucket[metricKey] : null;
  }

  function sortHillRows(rows) {
    const key = state.hillSortKey;
    const dir = state.hillSortDir === "asc" ? 1 : -1;
    const scope = state.hillScope;

    return rows.slice().sort((a, b) => {
      const va = extractSortMetric(a, scope, key);
      const vb = extractSortMetric(b, scope, key);

      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1;
      if (vb === null) return -1;

      if (typeof va === "string") {
        return va.localeCompare(vb) * dir;
      }
      if (va !== vb) {
        return (va - vb) * dir;
      }
      return a.name.localeCompare(b.name);
    });
  }

  function renderSelectedChips(chartRows) {
    const hasCustom = state.selectedJumperSlugs.length > 0;
    els.selectedChipsBar.classList.toggle("chip-bar--empty", !hasCustom);
    els.clearJumpersBtn.hidden = !hasCustom;

    if (!hasCustom) {
      els.selectedChipsBar.innerHTML = "";
      return;
    }

    const colorMap = new Map();
    chartRows.forEach((r, i) => colorMap.set(r.slug, i % 8));

    els.selectedChipsBar.innerHTML = state.selectedJumperSlugs
      .map((slug) => {
        const j = jumperBySlug.get(slug);
        if (!j) return "";
        const cIdx = colorMap.has(slug) ? colorMap.get(slug) : 0;
        return `<span class="chip">
          <span class="chip__dot chip__dot--${cIdx}"></span>
          <span>${escapeHtml(j.name)} (${escapeHtml(j.country)})</span>
          <button type="button" class="chip__remove" data-remove-slug="${escapeHtml(slug)}" aria-label="Remove ${escapeHtml(j.name)}">×</button>
        </span>`;
      })
      .join("");
  }

  function renderHillTableHeader(heldSeasons) {
    const sortArrow = (k) => {
      if (state.hillSortKey !== k) return "";
      return state.hillSortDir === "asc" ? " ▲" : " ▼";
    };
    const thSortCls = (k, extra) => {
      const base = `data-table__th data-table__th--sub data-table__th--sortable ${extra || ""}`;
      return state.hillSortKey === k ? `${base} data-table__th--sorted` : base;
    };

    const scopeLabel = state.hillScope === "overall" ? "3-Year Combined" : `${state.hillScope} Focus`;
    const seasonGroupCols = heldSeasons
      .map((s) => `<th class="data-table__th" colspan="5">${escapeHtml(s)}</th>`)
      .join("");

    const seasonSubCols = heldSeasons
      .map(
        () => `
          <th class="data-table__th data-table__th--sub">Places</th>
          <th class="data-table__th data-table__th--sub">Hill</th>
          <th class="data-table__th data-table__th--sub">Δ Yr</th>
          <th class="data-table__th data-table__th--sub">Δ Prv3</th>
          <th class="data-table__th data-table__th--sub">Δ Aft3</th>
        `
      )
      .join("");

    els.hillTableHead.innerHTML = `
      <tr>
        <th class="data-table__th data-table__th--left" rowspan="2">Jumper</th>
        <th class="data-table__th" colspan="9">${escapeHtml(scopeLabel)} Metrics (Click column to sort)</th>
        ${seasonGroupCols}
      </tr>
      <tr>
        <th class="${thSortCls("starts")}" data-sort-key="starts" data-default-dir="desc">Races${sortArrow("starts")}</th>
        <th class="${thSortCls("hillAvg")}" data-sort-key="hillAvg" data-default-dir="asc">Hill Avg${sortArrow("hillAvg")}</th>
        <th class="${thSortCls("seasonAvg")}" data-sort-key="seasonAvg" data-default-dir="asc">Year Avg${sortArrow("seasonAvg")}</th>
        <th class="${thSortCls("diffYear")}" data-sort-key="diffYear" data-default-dir="desc">Δ Year${sortArrow("diffYear")}</th>
        <th class="${thSortCls("prev3Avg")}" data-sort-key="prev3Avg" data-default-dir="asc">Prev 3${sortArrow("prev3Avg")}</th>
        <th class="${thSortCls("diffPrev3")}" data-sort-key="diffPrev3" data-default-dir="desc">Δ Prev 3${sortArrow("diffPrev3")}</th>
        <th class="${thSortCls("after3Avg")}" data-sort-key="after3Avg" data-default-dir="asc">After 3${sortArrow("after3Avg")}</th>
        <th class="${thSortCls("diffAfter3")}" data-sort-key="diffAfter3" data-default-dir="desc">Δ After 3${sortArrow("diffAfter3")}</th>
        <th class="${thSortCls("diffNearby")}" data-sort-key="diffNearby" data-default-dir="desc">Δ Prev+Aft${sortArrow("diffNearby")}</th>
        ${seasonSubCols}
      </tr>
    `;
  }

  function renderHillView() {
    const hill = hillById.get(state.selectedHillId) || DATA.hills[0];
    const seasonWindows = Metrics.buildHillSeasonWindows(
      hill.venue,
      hill.hs,
      DATA.calendar,
      DATA.seasons
    );
    const heldSeasons = DATA.seasons.filter((s) => seasonWindows[s].held);

    renderWindowStrip(hill, seasonWindows);

    // Build rows
    const hasCustomSelection = state.selectedJumperSlugs.length > 0;
    const candidateJumpers = hasCustomSelection
      ? state.selectedJumperSlugs.map((slug) => jumperBySlug.get(slug)).filter(Boolean)
      : DATA.jumpers.filter((j) => (state.rosterMode === "active" ? j.active_2027 : true));

    const analyzed = candidateJumpers
      .map((j) =>
        Metrics.calculateJumperHillAnalysis(j, hill.venue, hill.hs, seasonWindows, DATA.seasons)
      )
      .filter((row) => {
        if (hasCustomSelection) {
          return true;
        }
        if (state.hillScope === "overall") {
          return row.starts > 0;
        }
        return Boolean(row.bySeason[state.hillScope]?.participated);
      });

    const sortedRows = sortHillRows(analyzed);

    // Choose rows for SVG charts: user-selected jumpers (up to 8) or top 5 sorted rows
    const chartRows = hasCustomSelection
      ? sortedRows.slice(0, 8)
      : sortedRows.slice(0, 5);

    renderSelectedChips(chartRows);

    // Legend for Trajectory Chart
    els.trajLegend.innerHTML = chartRows
      .map(
        (r, idx) => `<span class="chart-legend__item">
          <span class="chip__dot chip__dot--${idx % 8}"></span>
          <span>${escapeHtml(r.name)}</span>
        </span>`
      )
      .join("");

    els.trajInspector.textContent = "Hover any point or dashed season line to inspect values";
    els.trajChartBody.innerHTML = "";
    els.trajChartBody.appendChild(
      Charts.renderHillTrajectorySvg(chartRows, heldSeasons, els.trajInspector)
    );

    const scopeLabel = state.hillScope === "overall" ? "3-Year Combined" : state.hillScope;
    els.deltaScopeLabel.textContent = `${scopeLabel} (+ = overperformed, − = underperformed)`;
    els.deltaInspector.textContent = "Hover any bar to inspect exact delta";
    els.deltaChartBody.innerHTML = "";
    els.deltaChartBody.appendChild(
      Charts.renderHillDeltaSvg(chartRows, state.hillScope, els.deltaInspector)
    );

    // Table header & body
    els.hillTableTitle.innerHTML = `${escapeHtml(hill.venue_label)} (${escapeHtml(hill.country)}) ${renderCategoryBadge(hill.category, hill.hs)}`;
    els.hillTableSubtitle.textContent = hasCustomSelection
      ? `Comparing ${sortedRows.length} selected jumper${sortedRows.length === 1 ? "" : "s"}`
      : `${sortedRows.length} jumpers with WC finishes (${state.rosterMode === "active" ? "Active 2026/27 roster" : "All 133 jumpers"}) — click 📌 to pin to charts or click name for full 3-season view`;

    renderHillTableHeader(heldSeasons);

    if (!sortedRows.length) {
      els.hillTableBody.innerHTML = `<tr><td class="empty-state" colspan="${10 + heldSeasons.length * 5}">No jumpers match the current filter on this hill.</td></tr>`;
      return;
    }

    els.hillTableBody.innerHTML = sortedRows
      .map((row) => {
        const isPinned = state.selectedJumperSlugs.includes(row.slug);
        const rowCls = isPinned
          ? "data-table__row data-table__row--selected"
          : "data-table__row";
        const pinCls = isPinned ? "row-pin row-pin--active" : "row-pin";

        const scopeMetrics =
          state.hillScope === "overall" ? row.overall : row.bySeason[state.hillScope];
        const scopeStarts =
          state.hillScope === "overall"
            ? row.starts
            : row.bySeason[state.hillScope]?.ranks.length || 0;

        const seasonColsHtml = heldSeasons
          .map((s) => {
            const se = row.bySeason[s];
            if (!se || !se.participated) {
              return `
                <td class="data-table__td"><span class="muted-dash">—</span></td>
                <td class="data-table__td"><span class="muted-dash">—</span></td>
                <td class="data-table__td"><span class="muted-dash">—</span></td>
                <td class="data-table__td"><span class="muted-dash">—</span></td>
                <td class="data-table__td data-table__td--divider"><span class="muted-dash">—</span></td>
              `;
            }
            return `
              <td class="data-table__td">${renderRanksBadges(se.ranks)}</td>
              <td class="data-table__td data-table__td--bold">${renderAvgCell(se.hillAvg)}</td>
              <td class="data-table__td">${renderDeltaBadge(se.diffYear)}</td>
              <td class="data-table__td">${renderDeltaBadge(se.diffPrev3)}</td>
              <td class="data-table__td data-table__td--divider">${renderDeltaBadge(se.diffAfter3)}</td>
            `;
          })
          .join("");

        return `<tr class="${rowCls}">
          <td class="data-table__td data-table__td--left data-table__td--divider">
            <button type="button" class="${pinCls}" data-pin-slug="${escapeHtml(row.slug)}" title="Pin/unpin jumper on comparison charts">📌</button>
            <button type="button" class="table-link" data-open-jumper="${escapeHtml(row.slug)}">${escapeHtml(row.name)}</button>
            <span class="muted-dash">(${escapeHtml(row.country)})</span>
          </td>
          <td class="data-table__td">${scopeStarts}</td>
          <td class="data-table__td data-table__td--bold">${renderAvgCell(scopeMetrics?.hillAvg ?? null)}</td>
          <td class="data-table__td">${scopeMetrics?.seasonAvg !== null && scopeMetrics?.seasonAvg !== undefined ? scopeMetrics.seasonAvg.toFixed(1) : '<span class="muted-dash">—</span>'}</td>
          <td class="data-table__td">${renderDeltaBadge(scopeMetrics?.diffYear ?? null)}</td>
          <td class="data-table__td">${scopeMetrics?.prev3Avg !== null && scopeMetrics?.prev3Avg !== undefined ? scopeMetrics.prev3Avg.toFixed(1) : '<span class="muted-dash">—</span>'}</td>
          <td class="data-table__td">${renderDeltaBadge(scopeMetrics?.diffPrev3 ?? null)}</td>
          <td class="data-table__td">${scopeMetrics?.after3Avg !== null && scopeMetrics?.after3Avg !== undefined ? scopeMetrics.after3Avg.toFixed(1) : '<span class="muted-dash">—</span>'}</td>
          <td class="data-table__td">${renderDeltaBadge(scopeMetrics?.diffAfter3 ?? null)}</td>
          <td class="data-table__td data-table__td--divider">${renderDeltaBadge(scopeMetrics?.diffNearby ?? null)}</td>
          ${seasonColsHtml}
        </tr>`;
      })
      .join("");
  }

  function renderJumperView() {
    const jumper = jumperBySlug.get(state.profileJumperSlug) || DATA.jumpers[0];
    if (!jumper) {
      return;
    }

    // Render Profile Banner
    const statPillsHtml = DATA.seasons
      .slice()
      .reverse()
      .map((season) => {
        const sInfo = jumper.seasons[season];
        const valTxt = sInfo
          ? `Avg ${sInfo.avg_rank.toFixed(1)} (${sInfo.starts} starts)`
          : "No WC finishes";
        return `<div class="stat-pill">
          <span class="stat-pill__label">${escapeHtml(season)} Season</span>
          <span class="stat-pill__value">${escapeHtml(valTxt)}</span>
        </div>`;
      })
      .join("");

    const wc27Txt =
      jumper.active_2027 && jumper.wc_points_2027 !== null
        ? `2026/27 WC: ${jumper.wc_points_2027} pts (${jumper.wc_position_2027 ? `#${jumper.wc_position_2027}` : "unranked"})`
        : "Not in 2026/27 Lillehammer start list";

    els.profileBanner.innerHTML = `
      <div class="profile-banner__identity">
        <h2 class="profile-banner__name">${escapeHtml(jumper.name)}</h2>
        <div class="profile-banner__meta">
          <span class="badge badge--neutral">${escapeHtml(jumper.country)}</span>
          <span>FIS Code: ${escapeHtml(jumper.fis_code || "—")}</span>
          <span>·</span>
          <span>${escapeHtml(wc27Txt)}</span>
        </div>
      </div>
      <div class="profile-banner__stats">${statPillsHtml}</div>
    `;

    // Render 3 Season Panels (2025/2026, 2024/2025, 2023/2024)
    els.seasonsStack.innerHTML = "";
    const seasonsDesc = DATA.seasons.slice().reverse();

    seasonsDesc.forEach((season) => {
      const timeline = Metrics.buildJumperSeasonTimeline(jumper, season, DATA.calendar);
      const panel = document.createElement("section");
      panel.className = "season-panel";

      const metaTxt = timeline.seasonSummary
        ? `${timeline.seasonSummary.starts} WC competition finishes · Season Avg Rank: ${timeline.seasonSummary.avg_rank.toFixed(1)}`
        : "0 WC main-competition finishes";

      const header = document.createElement("div");
      header.className = "season-panel__header";
      header.innerHTML = `
        <h3 class="season-panel__title">${escapeHtml(season)} World Cup Season — ${escapeHtml(jumper.name)}</h3>
        <div class="season-panel__meta">
          <span>${escapeHtml(metaTxt)}</span>
        </div>
      `;
      panel.appendChild(header);

      const body = document.createElement("div");
      body.className = "season-panel__body";

      // Chart wrapper
      const chartCard = document.createElement("div");
      chartCard.className = "chart-card__body";

      const inspector = document.createElement("div");
      inspector.className = "chart-card__inspector";
      inspector.textContent = "Hover any competition dot on the chart to inspect exact places & deltas";

      const svgEl = Charts.renderSeasonProgressionSvg(timeline, inspector);
      chartCard.appendChild(inspector);
      chartCard.appendChild(svgEl);
      body.appendChild(chartCard);

      // Season Chronological Table
      const tableWrap = document.createElement("div");
      tableWrap.className = "table-scroll";

      const rowsHtml = timeline.stops
        .map((item) => {
          const hillId = `${item.stop.venue}__${item.stop.hs}`;
          const rowCls = item.participated
            ? "data-table__row"
            : "data-table__row data-table__row--skipped";

          return `<tr class="${rowCls}">
            <td class="data-table__td">${item.stopIndex}</td>
            <td class="data-table__td data-table__td--left">${escapeHtml(item.stop.date_label)}</td>
            <td class="data-table__td data-table__td--left">
              <button type="button" class="table-link" data-open-hill="${escapeHtml(hillId)}" data-with-jumper="${escapeHtml(jumper.slug)}">
                ${escapeHtml(item.stop.venue_label)} (${escapeHtml(item.stop.country)})
              </button>
            </td>
            <td class="data-table__td data-table__td--divider">${renderCategoryBadge(item.stop.category, item.stop.hs)}</td>
            <td class="data-table__td">${item.participated ? renderRanksBadges(item.ranks) : '<span class="muted-dash">Skipped / DNQ</span>'}</td>
            <td class="data-table__td data-table__td--bold">${renderAvgCell(item.hillAvg)}</td>
            <td class="data-table__td">${item.seasonAvg !== null ? item.seasonAvg.toFixed(1) : '<span class="muted-dash">—</span>'}</td>
            <td class="data-table__td data-table__td--divider">${renderDeltaBadge(item.diffYear)}</td>
            <td class="data-table__td">${item.prev3Avg !== null ? item.prev3Avg.toFixed(1) : '<span class="muted-dash">—</span>'}</td>
            <td class="data-table__td">${renderDeltaBadge(item.diffPrev3)}</td>
            <td class="data-table__td">${item.after3Avg !== null ? item.after3Avg.toFixed(1) : '<span class="muted-dash">—</span>'}</td>
            <td class="data-table__td">${renderDeltaBadge(item.diffAfter3)}</td>
            <td class="data-table__td">${renderDeltaBadge(item.diffNearby)}</td>
          </tr>`;
        })
        .join("");

      tableWrap.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th class="data-table__th data-table__th--sub">#</th>
              <th class="data-table__th data-table__th--sub data-table__th--left">Dates</th>
              <th class="data-table__th data-table__th--sub data-table__th--left">Venue</th>
              <th class="data-table__th data-table__th--sub">Hill</th>
              <th class="data-table__th data-table__th--sub">Places</th>
              <th class="data-table__th data-table__th--sub">Hill Avg</th>
              <th class="data-table__th data-table__th--sub">Year Avg</th>
              <th class="data-table__th data-table__th--sub">Δ vs Year</th>
              <th class="data-table__th data-table__th--sub">Prev 3 Avg</th>
              <th class="data-table__th data-table__th--sub">Δ Prev 3</th>
              <th class="data-table__th data-table__th--sub">After 3 Avg</th>
              <th class="data-table__th data-table__th--sub">Δ After 3</th>
              <th class="data-table__th data-table__th--sub">Δ Prev+Aft</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;

      body.appendChild(tableWrap);
      panel.appendChild(body);
      els.seasonsStack.appendChild(panel);
    });
  }

  function attachEventListeners() {
    els.tabHill.addEventListener("click", () => switchView("hill"));
    els.tabJumper.addEventListener("click", () => switchView("jumper"));

    els.hillSelect.addEventListener("change", (e) => {
      state.selectedHillId = e.target.value;
      renderHillView();
    });

    els.rosterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.rosterMode = btn.getAttribute("data-roster-mode");
        els.rosterButtons.forEach((b) =>
          b.classList.toggle("segmented__btn--active", b === btn)
        );
        renderJumperDropdown(els.jumperSearchInput.value);
        renderHillView();
      });
    });

    els.scopeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hillScope = btn.getAttribute("data-hill-scope");
        els.scopeButtons.forEach((b) =>
          b.classList.toggle("segmented__btn--active", b === btn)
        );
        renderHillView();
      });
    });

    els.jumperSearchInput.addEventListener("focus", () => {
      renderJumperDropdown(els.jumperSearchInput.value);
      els.jumperDropdown.classList.remove("jumper-picker__dropdown--hidden");
    });

    els.jumperSearchInput.addEventListener("input", (e) => {
      renderJumperDropdown(e.target.value);
      els.jumperDropdown.classList.remove("jumper-picker__dropdown--hidden");
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#hill-jumper-picker")) {
        els.jumperDropdown.classList.add("jumper-picker__dropdown--hidden");
      }
    });

    els.jumperDropdown.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick-slug]");
      if (!btn) return;
      toggleSelectedJumper(btn.getAttribute("data-pick-slug"));
    });

    els.selectedChipsBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-slug]");
      if (!btn) return;
      toggleSelectedJumper(btn.getAttribute("data-remove-slug"));
    });

    els.clearJumpersBtn.addEventListener("click", () => {
      state.selectedJumperSlugs = [];
      renderHillView();
    });

    els.hillTableHead.addEventListener("click", (e) => {
      const th = e.target.closest("[data-sort-key]");
      if (!th) return;
      const key = th.getAttribute("data-sort-key");
      const defaultDir = th.getAttribute("data-default-dir") || "asc";
      if (state.hillSortKey === key) {
        state.hillSortDir = state.hillSortDir === "asc" ? "desc" : "asc";
      } else {
        state.hillSortKey = key;
        state.hillSortDir = defaultDir;
      }
      renderHillView();
    });

    els.hillTableBody.addEventListener("click", (e) => {
      const pinBtn = e.target.closest("[data-pin-slug]");
      if (pinBtn) {
        toggleSelectedJumper(pinBtn.getAttribute("data-pin-slug"));
        return;
      }
      const openJumperBtn = e.target.closest("[data-open-jumper]");
      if (openJumperBtn) {
        state.profileJumperSlug = openJumperBtn.getAttribute("data-open-jumper");
        populateProfileJumperSelect(els.profileSearchInput.value);
        els.profileJumperSelect.value = state.profileJumperSlug;
        switchView("jumper");
      }
    });

    els.profileJumperSelect.addEventListener("change", (e) => {
      state.profileJumperSlug = e.target.value;
      renderJumperView();
    });

    els.profileSearchInput.addEventListener("input", (e) => {
      populateProfileJumperSelect(e.target.value);
    });

    els.seasonsStack.addEventListener("click", (e) => {
      const openHillBtn = e.target.closest("[data-open-hill]");
      if (!openHillBtn) return;
      const hillId = openHillBtn.getAttribute("data-open-hill");
      const withSlug = openHillBtn.getAttribute("data-with-jumper");
      if (hillById.has(hillId)) {
        state.selectedHillId = hillId;
        els.hillSelect.value = hillId;
      }
      if (withSlug && !state.selectedJumperSlugs.includes(withSlug)) {
        state.selectedJumperSlugs = [withSlug];
      }
      switchView("hill");
    });
  }

  populateHillSelect();
  populateProfileJumperSelect("");
  attachEventListeners();
  renderHillView();
})();
