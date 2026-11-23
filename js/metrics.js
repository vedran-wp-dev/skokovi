(function initSkokoviMetrics(globalScope) {
  "use strict";

  function roundToTenths(value) {
    const rounded = Math.round(value * 10) / 10;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function calculateMeanRank(ranks) {
    if (!Array.isArray(ranks) || ranks.length === 0) {
      return null;
    }
    let total = 0;
    for (let i = 0; i < ranks.length; i += 1) {
      total += ranks[i];
    }
    return roundToTenths(total / ranks.length);
  }

  /**
   * Positive (+) means overperformed baseline (finished in a lower/better rank number).
   * Negative (-) means underperformed baseline.
   */
  function calculateOverperformanceDelta(baselineAvg, hillAvg) {
    if (baselineAvg === null || hillAvg === null) {
      return null;
    }
    return roundToTenths(baselineAvg - hillAvg);
  }

  function findSurroundingSimilarStops(seasonStops, targetStopIndex, windowSize) {
    const limit = typeof windowSize === "number" ? windowSize : 3;
    const targetStop = seasonStops[targetStopIndex];
    if (!targetStop) {
      return { prevStops: [], afterStops: [] };
    }
    const targetCategory = targetStop.category;
    const prevStops = [];
    for (let i = targetStopIndex - 1; i >= 0 && prevStops.length < limit; i -= 1) {
      if (seasonStops[i].category === targetCategory) {
        prevStops.push(seasonStops[i]);
      }
    }
    prevStops.reverse();

    const afterStops = [];
    for (let i = targetStopIndex + 1; i < seasonStops.length && afterStops.length < limit; i += 1) {
      if (seasonStops[i].category === targetCategory) {
        afterStops.push(seasonStops[i]);
      }
    }

    return { prevStops, afterStops };
  }

  function buildHillSeasonWindows(venue, hs, calendar, seasons) {
    const windows = {};
    for (let i = 0; i < seasons.length; i += 1) {
      const season = seasons[i];
      const seasonStops = calendar[season] || [];
      const targetIndex = seasonStops.findIndex(
        (st) => st.venue === venue && st.hs === hs
      );
      if (targetIndex === -1) {
        windows[season] = {
          season,
          held: false,
          targetStop: null,
          prevStops: [],
          afterStops: [],
        };
      } else {
        const surrounding = findSurroundingSimilarStops(seasonStops, targetIndex, 3);
        windows[season] = {
          season,
          held: true,
          targetStop: seasonStops[targetIndex],
          prevStops: surrounding.prevStops,
          afterStops: surrounding.afterStops,
        };
      }
    }
    return windows;
  }

  function collectJumperRanksAcrossStops(jumper, stops, season) {
    const collected = [];
    if (!jumper || !jumper.hills || !Array.isArray(stops)) {
      return collected;
    }
    for (let i = 0; i < stops.length; i += 1) {
      const st = stops[i];
      const entry = jumper.hills[st.venue]?.[st.hs]?.seasons?.[season];
      if (entry && Array.isArray(entry.ranks)) {
        for (let r = 0; r < entry.ranks.length; r += 1) {
          collected.push(entry.ranks[r]);
        }
      }
    }
    return collected;
  }

  function calculateWeightedBaselineComparison(seasonEntries, baselineField) {
    let weightedBaselineSum = 0;
    let hillRankSum = 0;
    let totalRaces = 0;

    for (let i = 0; i < seasonEntries.length; i += 1) {
      const se = seasonEntries[i];
      if (!se.participated || se[baselineField] === null) {
        continue;
      }
      const n = se.ranks.length;
      weightedBaselineSum += se[baselineField] * n;
      for (let r = 0; r < n; r += 1) {
        hillRankSum += se.ranks[r];
      }
      totalRaces += n;
    }

    if (totalRaces === 0) {
      return { baselineAvg: null, delta: null };
    }

    const baselineAvg = roundToTenths(weightedBaselineSum / totalRaces);
    const matchedHillAvg = roundToTenths(hillRankSum / totalRaces);
    return {
      baselineAvg,
      delta: calculateOverperformanceDelta(baselineAvg, matchedHillAvg),
    };
  }

  function calculateJumperHillAnalysis(jumper, venue, hs, seasonWindows, seasons) {
    const bySeason = {};
    const seasonEntries = [];
    const allHillRanks = [];

    for (let i = 0; i < seasons.length; i += 1) {
      const season = seasons[i];
      const win = seasonWindows[season];
      const seasonInfo = jumper.seasons?.[season] || null;
      const seasonAvg = seasonInfo ? seasonInfo.avg_rank : null;

      if (!win || !win.held) {
        bySeason[season] = {
          season,
          held: false,
          participated: false,
          ranks: [],
          hillAvg: null,
          seasonAvg,
          diffYear: null,
          prev3Avg: null,
          diffPrev3: null,
          after3Avg: null,
          diffAfter3: null,
          nearbyAvg: null,
          diffNearby: null,
        };
        continue;
      }

      const prev3Ranks = collectJumperRanksAcrossStops(jumper, win.prevStops, season);
      const after3Ranks = collectJumperRanksAcrossStops(jumper, win.afterStops, season);
      const nearbyRanks = prev3Ranks.concat(after3Ranks);

      const prev3Avg = calculateMeanRank(prev3Ranks);
      const after3Avg = calculateMeanRank(after3Ranks);
      const nearbyAvg = calculateMeanRank(nearbyRanks);

      const hillSeasonObj = jumper.hills?.[venue]?.[hs]?.seasons?.[season] || null;
      if (!hillSeasonObj) {
        bySeason[season] = {
          season,
          held: true,
          participated: false,
          ranks: [],
          hillAvg: null,
          seasonAvg,
          diffYear: null,
          prev3Avg,
          diffPrev3: null,
          after3Avg,
          diffAfter3: null,
          nearbyAvg,
          diffNearby: null,
        };
        continue;
      }

      const ranks = hillSeasonObj.ranks.slice();
      for (let r = 0; r < ranks.length; r += 1) {
        allHillRanks.push(ranks[r]);
      }
      const hillAvg = hillSeasonObj.avg_rank;
      const entry = {
        season,
        held: true,
        participated: true,
        ranks,
        hillAvg,
        seasonAvg,
        diffYear: calculateOverperformanceDelta(seasonAvg, hillAvg),
        prev3Avg,
        diffPrev3: calculateOverperformanceDelta(prev3Avg, hillAvg),
        after3Avg,
        diffAfter3: calculateOverperformanceDelta(after3Avg, hillAvg),
        nearbyAvg,
        diffNearby: calculateOverperformanceDelta(nearbyAvg, hillAvg),
      };
      bySeason[season] = entry;
      seasonEntries.push(entry);
    }

    const overallHillAvg = calculateMeanRank(allHillRanks);
    const yearComp = calculateWeightedBaselineComparison(seasonEntries, "seasonAvg");
    const prevComp = calculateWeightedBaselineComparison(seasonEntries, "prev3Avg");
    const afterComp = calculateWeightedBaselineComparison(seasonEntries, "after3Avg");
    const nearbyComp = calculateWeightedBaselineComparison(seasonEntries, "nearbyAvg");

    return {
      jumper,
      slug: jumper.slug,
      name: jumper.name,
      country: jumper.country,
      active2027: Boolean(jumper.active_2027),
      starts: allHillRanks.length,
      seasonsCount: seasonEntries.length,
      overall: {
        hillAvg: overallHillAvg,
        seasonAvg: yearComp.baselineAvg,
        diffYear: yearComp.delta,
        prev3Avg: prevComp.baselineAvg,
        diffPrev3: prevComp.delta,
        after3Avg: afterComp.baselineAvg,
        diffAfter3: afterComp.delta,
        nearbyAvg: nearbyComp.baselineAvg,
        diffNearby: nearbyComp.delta,
      },
      bySeason,
    };
  }

  function buildJumperSeasonTimeline(jumper, season, calendar) {
    const seasonStops = calendar[season] || [];
    const seasonSummary = jumper.seasons?.[season] || null;
    const seasonAvg = seasonSummary ? seasonSummary.avg_rank : null;

    const stops = seasonStops.map((stop, idx) => {
      const surrounding = findSurroundingSimilarStops(seasonStops, idx, 3);
      const prev3Ranks = collectJumperRanksAcrossStops(jumper, surrounding.prevStops, season);
      const after3Ranks = collectJumperRanksAcrossStops(jumper, surrounding.afterStops, season);
      const nearbyRanks = prev3Ranks.concat(after3Ranks);

      const prev3Avg = calculateMeanRank(prev3Ranks);
      const after3Avg = calculateMeanRank(after3Ranks);
      const nearbyAvg = calculateMeanRank(nearbyRanks);

      const entry = jumper.hills?.[stop.venue]?.[stop.hs]?.seasons?.[season] || null;
      const participated = Boolean(entry && entry.ranks && entry.ranks.length > 0);
      const ranks = participated ? entry.ranks.slice() : [];
      const hillAvg = participated ? entry.avg_rank : null;

      return {
        stopIndex: idx + 1,
        stop,
        prevStops: surrounding.prevStops,
        afterStops: surrounding.afterStops,
        participated,
        ranks,
        hillAvg,
        seasonAvg,
        diffYear: participated ? calculateOverperformanceDelta(seasonAvg, hillAvg) : null,
        prev3Avg,
        diffPrev3: participated ? calculateOverperformanceDelta(prev3Avg, hillAvg) : null,
        after3Avg,
        diffAfter3: participated ? calculateOverperformanceDelta(after3Avg, hillAvg) : null,
        nearbyAvg,
        diffNearby: participated ? calculateOverperformanceDelta(nearbyAvg, hillAvg) : null,
      };
    });

    return {
      season,
      seasonSummary,
      seasonAvg,
      stops,
    };
  }

  globalScope.SkokoviMetrics = {
    roundToTenths,
    calculateMeanRank,
    calculateOverperformanceDelta,
    findSurroundingSimilarStops,
    buildHillSeasonWindows,
    collectJumperRanksAcrossStops,
    calculateJumperHillAnalysis,
    buildJumperSeasonTimeline,
  };
})(typeof window !== "undefined" ? window : globalThis);
