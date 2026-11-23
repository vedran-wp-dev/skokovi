(function initSkokoviCharts(globalScope) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function createSvgElement(tag, attrs, textContent) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      const keys = Object.keys(attrs);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (attrs[key] !== undefined && attrs[key] !== null) {
          el.setAttribute(key, String(attrs[key]));
        }
      }
    }
    if (textContent !== undefined && textContent !== null) {
      el.textContent = String(textContent);
    }
    return el;
  }

  function formatSignedDelta(value) {
    if (value === null || value === undefined) {
      return "—";
    }
    return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  }

  function bindInspectTarget(el, summaryText, inspectorEl) {
    const titleEl = createSvgElement("title", null, summaryText);
    el.appendChild(titleEl);
    if (inspectorEl) {
      el.addEventListener("mouseenter", () => {
        inspectorEl.textContent = summaryText;
      });
    }
  }

  /**
   * Hill View Chart 1: Form trajectory per season (Prev 3 -> Selected Hill -> After 3) + Year Avg dashed tick
   * Inverted Rank Y-axis (Rank 1 at top, Rank 50 at bottom).
   */
  function renderHillTrajectorySvg(rows, heldSeasons, inspectorEl) {
    const width = 720;
    const height = 310;
    const padLeft = 44;
    const padRight = 18;
    const padTop = 26;
    const padBottom = 46;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const svg = createSvgElement("svg", {
      class: "svg-chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Form trajectory comparing Prev 3, Hill Avg, After 3, and Season Avg",
    });

    if (!rows.length || !heldSeasons.length) {
      svg.appendChild(
        createSvgElement(
          "text",
          { x: width / 2, y: height / 2, "text-anchor": "middle", class: "svg-chart__label" },
          "No starts available to plot for the current selection."
        )
      );
      return svg;
    }

    const maxRank = 50;
    const rankToY = (r) => padTop + ((Math.min(maxRank, Math.max(1, r)) - 1) / (maxRank - 1)) * plotH;

    // Season zones background
    const zoneW = plotW / heldSeasons.length;
    heldSeasons.forEach((season, sIdx) => {
      const zx = padLeft + sIdx * zoneW;
      svg.appendChild(
        createSvgElement("rect", {
          x: zx,
          y: padTop,
          width: zoneW,
          height: plotH,
          class: sIdx % 2 === 0 ? "svg-chart__zone-bg--even" : "svg-chart__zone-bg--odd",
        })
      );
    });

    // Podium & Top-10 highlight bands
    svg.appendChild(
      createSvgElement("rect", {
        x: padLeft,
        y: rankToY(1),
        width: plotW,
        height: rankToY(3) - rankToY(1),
        class: "svg-chart__band--podium",
      })
    );
    svg.appendChild(
      createSvgElement("rect", {
        x: padLeft,
        y: rankToY(3),
        width: plotW,
        height: rankToY(10) - rankToY(3),
        class: "svg-chart__band--top10",
      })
    );

    // Y gridlines
    const yTicks = [1, 3, 10, 20, 30, 40, 50];
    yTicks.forEach((tick) => {
      const y = rankToY(tick);
      svg.appendChild(
        createSvgElement("line", {
          x1: padLeft,
          y1: y,
          x2: padLeft + plotW,
          y2: y,
          class: "svg-chart__grid",
        })
      );
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: padLeft - 8,
            y: y + 3.5,
            "text-anchor": "end",
            class: "svg-chart__label svg-chart__label--mono",
          },
          tick
        )
      );
    });

    // Zone headers + Prev3 / Hill / After3 x-guides
    heldSeasons.forEach((season, sIdx) => {
      const zx = padLeft + sIdx * zoneW;
      const xPrev = zx + zoneW * 0.2;
      const xHill = zx + zoneW * 0.5;
      const xAfter = zx + zoneW * 0.8;

      if (sIdx > 0) {
        svg.appendChild(
          createSvgElement("line", {
            x1: zx,
            y1: padTop,
            x2: zx,
            y2: padTop + plotH,
            class: "svg-chart__axis",
          })
        );
      }

      svg.appendChild(
        createSvgElement("line", {
          x1: xHill,
          y1: padTop,
          x2: xHill,
          y2: padTop + plotH,
          class: "svg-chart__hill-guide",
        })
      );

      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: xHill,
            y: padTop - 9,
            "text-anchor": "middle",
            class: "svg-chart__label svg-chart__label--strong",
          },
          season
        )
      );

      const subLabels = [
        [xPrev, "Prev 3", false],
        [xHill, "Hill", true],
        [xAfter, "After 3", false],
      ];
      subLabels.forEach(([lx, txt, isBold]) => {
        svg.appendChild(
          createSvgElement(
            "text",
            {
              x: lx,
              y: padTop + plotH + 18,
              "text-anchor": "middle",
              class: isBold ? "svg-chart__label svg-chart__label--strong" : "svg-chart__label",
            },
            txt
          )
        );
      });
    });

    // Plot each jumper row across season zones
    rows.forEach((row, rIdx) => {
      const colorIdx = rIdx % 8;
      heldSeasons.forEach((season, sIdx) => {
        const se = row.bySeason[season];
        if (!se || !se.participated) {
          return;
        }
        const zx = padLeft + sIdx * zoneW;
        const xPrev = zx + zoneW * 0.2;
        const xHill = zx + zoneW * 0.5;
        const xAfter = zx + zoneW * 0.8;

        // Dashed Season Avg horizontal marker across the zone
        if (se.seasonAvg !== null) {
          const ySeason = rankToY(se.seasonAvg);
          const seasonLine = createSvgElement("line", {
            x1: zx + zoneW * 0.12,
            y1: ySeason,
            x2: zx + zoneW * 0.88,
            y2: ySeason,
            class: `svg-chart__year-tick svg-chart__year-tick--${colorIdx}`,
          });
          bindInspectTarget(
            seasonLine,
            `${row.name} (${season}) — Whole Season Avg: ${se.seasonAvg.toFixed(1)}`,
            inspectorEl
          );
          svg.appendChild(seasonLine);
        }

        const pts = [];
        if (se.prev3Avg !== null) {
          pts.push({ x: xPrev, y: rankToY(se.prev3Avg), kind: "Prev 3 Avg", val: se.prev3Avg, radius: 4 });
        }
        pts.push({ x: xHill, y: rankToY(se.hillAvg), kind: "Hill Avg", val: se.hillAvg, radius: 6 });
        if (se.after3Avg !== null) {
          pts.push({ x: xAfter, y: rankToY(se.after3Avg), kind: "After 3 Avg", val: se.after3Avg, radius: 4 });
        }

        if (pts.length >= 2) {
          const dPath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          svg.appendChild(
            createSvgElement("path", {
              d: dPath,
              class: `svg-chart__line svg-chart__line--${colorIdx}`,
            })
          );
        }

        pts.forEach((pt) => {
          const dot = createSvgElement("circle", {
            cx: pt.x.toFixed(1),
            cy: pt.y.toFixed(1),
            r: pt.radius,
            class: `svg-chart__dot svg-chart__dot--${colorIdx}`,
          });
          const placesTxt = se.ranks.join(", ");
          bindInspectTarget(
            dot,
            `${row.name} (${season}) | ${pt.kind}: ${pt.val.toFixed(1)} | Hill Places: [${placesTxt}] | Δ Year: ${formatSignedDelta(se.diffYear)} | Δ Prev3: ${formatSignedDelta(se.diffPrev3)} | Δ After3: ${formatSignedDelta(se.diffAfter3)}`,
            inspectorEl
          );
          svg.appendChild(dot);
        });
      });
    });

    svg.appendChild(
      createSvgElement("line", {
        x1: padLeft,
        y1: padTop + plotH,
        x2: padLeft + plotW,
        y2: padTop + plotH,
        class: "svg-chart__axis",
      })
    );

    return svg;
  }

  /**
   * Hill View Chart 2: Over/Underperformance Delta Bar Chart (+ = overperformed, - = underperformed)
   * Shows Δ vs Whole Year, Δ vs Prev 3, and Δ vs After 3 for the active scope (3-Year or single season).
   */
  function renderHillDeltaSvg(rows, scopeKey, inspectorEl) {
    const width = 720;
    const height = 310;
    const padLeft = 46;
    const padRight = 16;
    const padTop = 24;
    const padBottom = 56;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const svg = createSvgElement("svg", {
      class: "svg-chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Over and underperformance delta bars vs Whole Year, Prev 3, and After 3",
    });

    const activeRows = rows.filter((r) =>
      scopeKey === "overall" ? r.starts > 0 : Boolean(r.bySeason[scopeKey]?.participated)
    );

    if (!activeRows.length) {
      svg.appendChild(
        createSvgElement(
          "text",
          { x: width / 2, y: height / 2, "text-anchor": "middle", class: "svg-chart__label" },
          "No delta values available for the selected scope."
        )
      );
      return svg;
    }

    let maxAbs = 8;
    activeRows.forEach((r) => {
      const metrics = scopeKey === "overall" ? r.overall : r.bySeason[scopeKey];
      [metrics.diffYear, metrics.diffPrev3, metrics.diffAfter3].forEach((v) => {
        if (v !== null && Math.abs(v) > maxAbs) {
          maxAbs = Math.ceil(Math.abs(v) / 5) * 5;
        }
      });
    });

    const valToY = (v) => padTop + ((maxAbs - v) / (2 * maxAbs)) * plotH;
    const zeroY = valToY(0);

    // Positive / Negative tint bands
    svg.appendChild(
      createSvgElement("rect", {
        x: padLeft,
        y: padTop,
        width: plotW,
        height: zeroY - padTop,
        class: "svg-chart__band--pos",
      })
    );
    svg.appendChild(
      createSvgElement("rect", {
        x: padLeft,
        y: zeroY,
        width: plotW,
        height: padTop + plotH - zeroY,
        class: "svg-chart__band--neg",
      })
    );

    const step = maxAbs <= 10 ? 5 : 10;
    for (let v = -maxAbs; v <= maxAbs; v += step) {
      const y = valToY(v);
      svg.appendChild(
        createSvgElement("line", {
          x1: padLeft,
          y1: y,
          x2: padLeft + plotW,
          y2: y,
          class: v === 0 ? "svg-chart__zero-line" : "svg-chart__grid",
        })
      );
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: padLeft - 8,
            y: y + 3.5,
            "text-anchor": "end",
            class: "svg-chart__label svg-chart__label--mono",
          },
          v > 0 ? `+${v}` : String(v)
        )
      );
    }

    const groupW = plotW / activeRows.length;
    const barW = Math.min(20, Math.max(7, (groupW * 0.68) / 3));

    activeRows.forEach((r, idx) => {
      const gx = padLeft + idx * groupW;
      const centerX = gx + groupW / 2;
      const m = scopeKey === "overall" ? r.overall : r.bySeason[scopeKey];

      const bars = [
        { key: "year", label: "Δ vs Year", val: m.diffYear, posCls: "svg-chart__bar--year-pos", negCls: "svg-chart__bar--year-neg" },
        { key: "prev", label: "Δ vs Prev 3", val: m.diffPrev3, posCls: "svg-chart__bar--prev-pos", negCls: "svg-chart__bar--prev-neg" },
        { key: "after", label: "Δ vs After 3", val: m.diffAfter3, posCls: "svg-chart__bar--after-pos", negCls: "svg-chart__bar--after-neg" },
      ];

      bars.forEach((b, bIdx) => {
        if (b.val === null) {
          return;
        }
        const bx = centerX + (bIdx - 1.5) * (barW + 2);
        const targetY = valToY(b.val);
        const rectY = Math.min(zeroY, targetY);
        const rectH = Math.max(2, Math.abs(targetY - zeroY));
        const rect = createSvgElement("rect", {
          x: bx.toFixed(1),
          y: rectY.toFixed(1),
          width: barW.toFixed(1),
          height: rectH.toFixed(1),
          rx: 2,
          class: `svg-chart__bar ${b.val >= 0 ? b.posCls : b.negCls}`,
        });
        const scopeLabel = scopeKey === "overall" ? "3-Year" : scopeKey;
        bindInspectTarget(
          rect,
          `${r.name} (${scopeLabel}) — ${b.label}: ${formatSignedDelta(b.val)} (Hill Avg ${m.hillAvg.toFixed(1)})`,
          inspectorEl
        );
        svg.appendChild(rect);
      });

      const surname = r.name.split(" ").slice(-1)[0];
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: centerX.toFixed(1),
            y: padTop + plotH + 18,
            "text-anchor": "middle",
            class: "svg-chart__label svg-chart__label--strong",
          },
          activeRows.length > 7 ? surname.slice(0, 8) : surname
        )
      );
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: centerX.toFixed(1),
            y: padTop + plotH + 33,
            "text-anchor": "middle",
            class: "svg-chart__label svg-chart__label--mono",
          },
          `Avg ${m.hillAvg.toFixed(1)}`
        )
      );
    });

    return svg;
  }

  /**
   * Jumper View (View 2): Full-season chronological stop & competition progression SVG chart.
   */
  function renderSeasonProgressionSvg(timeline, inspectorEl) {
    const width = 1140;
    const height = 290;
    const padLeft = 44;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 68;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const svg = createSvgElement("svg", {
      class: "svg-chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `${timeline.season} full-season progression chart`,
    });

    if (!timeline.seasonSummary) {
      svg.appendChild(
        createSvgElement(
          "text",
          { x: width / 2, y: height / 2, "text-anchor": "middle", class: "svg-chart__label" },
          `No World Cup main-competition finishes recorded in ${timeline.season}.`
        )
      );
      return svg;
    }

    const maxRank = 50;
    const rankToY = (r) => padTop + ((Math.min(maxRank, Math.max(1, r)) - 1) / (maxRank - 1)) * plotH;
    const stopCount = timeline.stops.length;
    const stopToX = (idx) =>
      stopCount <= 1 ? padLeft + plotW / 2 : padLeft + (idx / (stopCount - 1)) * plotW;

    // Podium & Top-10 highlight bands
    svg.appendChild(
      createSvgElement("rect", {
        x: padLeft,
        y: rankToY(1),
        width: plotW,
        height: rankToY(3) - rankToY(1),
        class: "svg-chart__band--podium",
      })
    );
    svg.appendChild(
      createSvgElement("rect", {
        x: padLeft,
        y: rankToY(3),
        width: plotW,
        height: rankToY(10) - rankToY(3),
        class: "svg-chart__band--top10",
      })
    );

    [1, 3, 10, 20, 30, 40, 50].forEach((tick) => {
      const y = rankToY(tick);
      svg.appendChild(
        createSvgElement("line", {
          x1: padLeft,
          y1: y,
          x2: padLeft + plotW,
          y2: y,
          class: "svg-chart__grid",
        })
      );
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: padLeft - 8,
            y: y + 3.5,
            "text-anchor": "end",
            class: "svg-chart__label svg-chart__label--mono",
          },
          tick
        )
      );
    });

    // Season Average dashed reference line
    if (timeline.seasonAvg !== null) {
      const yAvg = rankToY(timeline.seasonAvg);
      svg.appendChild(
        createSvgElement("line", {
          x1: padLeft,
          y1: yAvg,
          x2: padLeft + plotW,
          y2: yAvg,
          class: "svg-chart__season-ref",
        })
      );
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: padLeft + plotW - 4,
            y: Math.max(padTop + 10, yAvg - 5),
            "text-anchor": "end",
            class: "svg-chart__label svg-chart__label--strong",
          },
          `Season Avg: ${timeline.seasonAvg.toFixed(1)}`
        )
      );
    }

    // Build contiguous line segments (breaking across skipped stops)
    let currentSegment = [];
    const flushSegment = () => {
      if (currentSegment.length >= 2) {
        const dPath = currentSegment
          .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
          .join(" ");
        svg.appendChild(
          createSvgElement("path", {
            d: dPath,
            class: "svg-chart__line svg-chart__line--0",
          })
        );
      }
      currentSegment = [];
    };

    timeline.stops.forEach((item, idx) => {
      const x = stopToX(idx);
      svg.appendChild(
        createSvgElement("line", {
          x1: x.toFixed(1),
          y1: padTop,
          x2: x.toFixed(1),
          y2: padTop + plotH,
          class: "svg-chart__hill-guide",
        })
      );

      // Angled stop label on X-axis
      const shortVenue = item.stop.venue_label
        .replace("Garmisch-Partenkirchen", "Garmisch")
        .replace("Titisee-Neustadt", "Titisee");
      const xLabelText = `${shortVenue} ${item.stop.hs_num}`;
      const labelY = padTop + plotH + 14;
      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: x.toFixed(1),
            y: labelY,
            transform: `rotate(32 ${x.toFixed(1)} ${labelY})`,
            "text-anchor": "start",
            class: item.participated
              ? "svg-chart__label svg-chart__label--strong"
              : "svg-chart__label",
          },
          xLabelText
        )
      );

      if (item.participated) {
        currentSegment.push({ x, y: rankToY(item.hillAvg) });
      } else {
        flushSegment();
      }
    });
    flushSegment();

    // Individual competition rank dots at each stop
    timeline.stops.forEach((item, idx) => {
      if (!item.participated) {
        return;
      }
      const baseX = stopToX(idx);
      const count = item.ranks.length;
      item.ranks.forEach((rk, rIdx) => {
        const offset = count > 1 ? (rIdx - (count - 1) / 2) * 7 : 0;
        const cx = baseX + offset;
        const cy = rankToY(rk);
        let dotMod = "svg-chart__dot--standard";
        if (rk <= 3) {
          dotMod = "svg-chart__dot--podium";
        } else if (rk <= 10) {
          dotMod = "svg-chart__dot--top10";
        } else if (rk > 30) {
          dotMod = "svg-chart__dot--outside30";
        }

        const dot = createSvgElement("circle", {
          cx: cx.toFixed(1),
          cy: cy.toFixed(1),
          r: 5.2,
          class: `svg-chart__dot ${dotMod}`,
        });
        bindInspectTarget(
          dot,
          `${item.stop.venue_label} ${item.stop.hs.toUpperCase()} (${item.stop.date_label}) | Race ${rIdx + 1}: #${rk} | Stop Avg: ${item.hillAvg.toFixed(1)} | Δ Year: ${formatSignedDelta(item.diffYear)} | Δ Nearby: ${formatSignedDelta(item.diffNearby)}`,
          inspectorEl
        );
        svg.appendChild(dot);
      });
    });

    svg.appendChild(
      createSvgElement("line", {
        x1: padLeft,
        y1: padTop + plotH,
        x2: padLeft + plotW,
        y2: padTop + plotH,
        class: "svg-chart__axis",
      })
    );

    return svg;
  }

  globalScope.SkokoviCharts = {
    formatSignedDelta,
    renderHillTrajectorySvg,
    renderHillDeltaSvg,
    renderSeasonProgressionSvg,
  };
})(typeof window !== "undefined" ? window : globalThis);
