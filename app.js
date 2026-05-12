const data = window.BVC_DATA;
const formatter = new Intl.NumberFormat("en-US");
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
  notation: "compact"
});

const colors = [
  "#0f766e", "#1d4ed8", "#9a3412", "#7c3aed", "#047857", "#be123c", "#0369a1", "#a16207",
  "#4338ca", "#15803d", "#c2410c", "#0e7490", "#6d28d9", "#b91c1c", "#166534", "#334155"
];

const colorByKey = new Map(data.instruments.map((instrument, index) => [instrument.key, colors[index % colors.length]]));
const tooltip = document.getElementById("tooltip");

function moneyK(valueK) {
  return usdFormatter.format(valueK * 1000);
}

function pct(value, digits = 1) {
  return value === null || value === undefined || Number.isNaN(value) ? "N/A" : `${value.toFixed(digits)}%`;
}

function shares(value) {
  return value === null || value === undefined ? "N/A" : formatter.format(Math.round(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setupSummary() {
  document.getElementById("latest-quarter").textContent = `${data.summary.latestQuarter} as of ${data.summary.latestAsOf}`;
  document.getElementById("last-built").textContent = `生成 ${new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false })}`;
  document.getElementById("metric-aum").textContent = moneyK(data.summary.latestTotalValueK);
  document.getElementById("metric-count").textContent = `${data.summary.latestHoldingCount} 个`;
  document.getElementById("metric-top5").textContent = pct(data.summary.latestTop5Weight);
  document.getElementById("metric-options").textContent = pct(data.summary.latestOptionWeight);
  document.getElementById("coverage-note").textContent =
    `${data.coverage.requestedWindow}；当前可用披露覆盖 ${data.coverage.availableFrom} 到 ${data.coverage.availableTo}，共 ${data.summary.quarterCount} 个季度。`;
  document.getElementById("history-copy").textContent = data.coverage.note;
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("is-active", panel.id === tab));
    });
  });
}

function metricValue(position, metric) {
  if (!position) return 0;
  if (metric === "value") return position.valueK;
  if (metric === "ownership") return position.ownershipPct || 0;
  return position.weightPct;
}

function metricLabel(position, metric) {
  if (metric === "value") return moneyK(position.valueK);
  if (metric === "ownership") return position.optionType ? `${pct(position.ownershipPct, 3)} 名义` : pct(position.ownershipPct, 3);
  return pct(position.weightPct, 1);
}

function metricMax(metric) {
  if (metric === "weight") return 100;
  let max = 0;
  for (const quarter of data.quarters) {
    for (const position of quarter.positions) max = Math.max(max, metricValue(position, metric));
  }
  return max || 1;
}

function buildTimeline() {
  const metric = document.getElementById("metric-select").value;
  const instruments = data.instruments.filter((instrument) => {
    const latestOrBig = instrument.maxValueK >= 1000 || instrument.count >= 2;
    return latestOrBig;
  });
  const left = 178;
  const top = 64;
  const rowH = 34;
  const colW = 132;
  const gap = 5;
  const chartW = data.quarters.length * colW;
  const width = left + chartW + 38;
  const height = top + instruments.length * rowH + 86;
  const max = metricMax(metric);

  const positionByQuarter = new Map();
  for (const quarter of data.quarters) {
    const map = new Map(quarter.positions.map((position) => [position.key, position]));
    positionByQuarter.set(quarter.quarter, map);
  }

  const cells = [];
  const lines = [];
  instruments.forEach((instrument, rowIndex) => {
    const y = top + rowIndex * rowH;
    const color = colorByKey.get(instrument.key);
    lines.push(`
      <text x="14" y="${y + 21}" class="axis-label" font-size="13" font-weight="700" fill="#18211f">${escapeHtml(instrument.display)}</text>
      <text x="96" y="${y + 21}" class="svg-small" font-size="11" fill="#6b746f">${escapeHtml(instrument.optionType ? "option" : "equity")}</text>
      <line x1="${left - 9}" y1="${y + rowH - 2}" x2="${width - 24}" y2="${y + rowH - 2}" stroke="#eee4d7" />
    `);

    data.quarters.forEach((quarter, quarterIndex) => {
      const position = positionByQuarter.get(quarter.quarter).get(instrument.key);
      const value = metricValue(position, metric);
      const x = left + quarterIndex * colW + gap;
      const maxBarW = colW - gap * 2;
      const barW = position ? Math.max(2, Math.min(maxBarW, (value / max) * maxBarW)) : 0;
      const opacity = position ? 0.9 : 0.09;
      const fill = position ? color : "#d8d1c6";
      const stripe = position?.optionType ? `stroke="${color}" stroke-width="2" stroke-dasharray="4 3"` : "";
      const label = position && (metric === "weight" ? position.weightPct >= 4 : barW > 35)
        ? `<text x="${x + Math.min(barW + 6, maxBarW - 35)}" y="${y + 21}" font-size="10" fill="#263330">${escapeHtml(metricLabel(position, metric))}</text>`
        : "";
      cells.push(`
        <rect class="timeline-cell" x="${x}" y="${y + 6}" width="${Math.max(barW, position ? 2 : maxBarW)}" height="21" rx="5"
          fill="${fill}" opacity="${opacity}" ${stripe}
          data-quarter="${escapeHtml(quarter.quarter)}"
          data-display="${escapeHtml(instrument.display)}"
          data-value="${position ? escapeHtml(moneyK(position.valueK)) : "无持仓"}"
          data-weight="${position ? escapeHtml(pct(position.weightPct, 2)) : "0%"}"
          data-shares="${position ? escapeHtml(shares(position.shares)) : "0"}"
          data-own="${position ? escapeHtml(metricLabel(position, "ownership")) : "N/A"}"
          data-action="${position ? escapeHtml(position.action) : "none"}"
        />
        ${label}
      `);
    });
  });

  const quarterLabels = data.quarters.map((quarter, index) => {
    const x = left + index * colW + colW / 2;
    return `
      <text x="${x}" y="24" text-anchor="middle" class="svg-quarter" font-size="13" font-weight="800" fill="#18211f">${escapeHtml(quarter.quarter)}</text>
      <text x="${x}" y="42" text-anchor="middle" class="svg-small" font-size="11" fill="#66706b">${moneyK(quarter.totalValueK)}</text>
      <line x1="${x}" y1="54" x2="${x}" y2="${height - 40}" stroke="#e6ddd0" />
    `;
  }).join("");

  const axis = metric === "weight" ? "每行横条长度按组合占比缩放" :
    metric === "value" ? "每行横条长度按投资金额缩放" : "每行横条长度按占公司股本比例缩放";

  document.getElementById("timeline-svg").innerHTML = `
    <svg id="portfolio-map" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#fffdf8" />
      <text x="14" y="28" font-size="14" font-weight="800" fill="#18211f">${escapeHtml(axis)}</text>
      <text x="14" y="${height - 20}" font-size="12" fill="#66706b">提示：按住横向拖动；期权仓位使用虚线边框；灰色短条表示该期无持仓。</text>
      ${quarterLabels}
      ${lines.join("")}
      ${cells.join("")}
    </svg>
  `;

  setupTooltips();
}

function setupTooltips() {
  document.querySelectorAll(".timeline-cell").forEach((cell) => {
    cell.addEventListener("mouseenter", () => {
      tooltip.style.display = "block";
      tooltip.innerHTML = `
        <strong>${cell.dataset.display} · ${cell.dataset.quarter}</strong>
        投资金额：${cell.dataset.value}<br>
        组合占比：${cell.dataset.weight}<br>
        持仓/名义股数：${cell.dataset.shares}<br>
        占公司股本：${cell.dataset.own}<br>
        行为：${actionLabel(cell.dataset.action)}
      `;
    });
    cell.addEventListener("mousemove", (event) => {
      tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 340)}px`;
      tooltip.style.top = `${event.clientY + 14}px`;
    });
    cell.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

function actionLabel(action) {
  return {
    new: "新增/重建",
    increase: "加仓",
    decrease: "减仓",
    hold: "基本持平",
    exit: "退出",
    none: "无持仓"
  }[action] || action;
}

function renderLatest(filter = "") {
  const needle = filter.trim().toLowerCase();
  const rows = data.latestPositions
    .filter((position) => {
      if (!needle) return true;
      return `${position.display} ${position.issuerName} ${position.baseTicker}`.toLowerCase().includes(needle);
    })
    .map((position) => {
      const actionClass = position.action === "hold" ? "" : position.action;
      const changeText = position.previousShares
        ? `${position.shareChange >= 0 ? "+" : ""}${shares(position.shareChange)} 股`
        : "本期新增";
      const ownership = position.ownershipPct === null
        ? "N/A"
        : `${pct(position.ownershipPct, position.ownershipPct < 1 ? 3 : 2)}${position.optionType ? " 名义" : ""}`;
      return `
        <tr>
          <td><span class="ticker">${escapeHtml(position.display)}</span></td>
          <td class="issuer">${escapeHtml(position.issuerName)}</td>
          <td><span class="badge ${position.optionType ? "option" : ""}">${position.optionType ? position.optionType.toUpperCase() : "股票/ADS"}</span></td>
          <td class="num">${moneyK(position.valueK)}</td>
          <td class="num">${pct(position.weightPct, 2)}</td>
          <td class="num">${shares(position.shares)}</td>
          <td class="num" title="${escapeHtml(position.shareBaseSource)}">${ownership}</td>
          <td class="num">${changeText}</td>
          <td><span class="badge ${actionClass}">${actionLabel(position.action)}</span></td>
        </tr>
      `;
    })
    .join("");
  document.getElementById("latest-body").innerHTML = rows;
}

function renderChanges() {
  const latest = data.latestPositions;
  const buckets = {
    new: latest.filter((position) => position.action === "new").sort((a, b) => b.valueK - a.valueK),
    increase: latest.filter((position) => position.action === "increase").sort((a, b) => b.valueChangeK - a.valueChangeK),
    decrease: latest.filter((position) => position.action === "decrease").sort((a, b) => a.valueChangeK - b.valueChangeK),
    exit: data.latestExits.sort((a, b) => b.valueK - a.valueK)
  };

  fillChangeList("new-list", buckets.new, (position) => `${moneyK(position.valueK)} · ${pct(position.weightPct, 1)}`);
  fillChangeList("increase-list", buckets.increase, (position) => `股数 ${position.shareChange >= 0 ? "+" : ""}${shares(position.shareChange)} · ${moneyK(position.valueChangeK)}`);
  fillChangeList("decrease-list", buckets.decrease, (position) => `股数 ${shares(position.shareChange)} · ${moneyK(position.valueChangeK)}`);
  fillChangeList("exit-list", buckets.exit, (position) => `上期 ${moneyK(position.valueK)} · ${shares(position.shares)} 股`);
}

function fillChangeList(id, items, detail) {
  const list = document.getElementById(id);
  list.innerHTML = (items.length ? items.slice(0, 6) : [{ display: "暂无", issuerName: "", valueK: 0 }])
    .map((position) => `
      <li>
        <span class="change-main">${escapeHtml(position.display)}</span>
        <span class="change-sub">${escapeHtml(position.issuerName || "")}${position.issuerName ? " · " : ""}${escapeHtml(detail(position))}</span>
      </li>
    `)
    .join("");
}

function setupDrag() {
  const shell = document.getElementById("timeline-shell");
  let startX = 0;
  let startScroll = 0;
  let dragging = false;

  shell.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    startScroll = shell.scrollLeft;
    shell.classList.add("is-dragging");
    shell.setPointerCapture(event.pointerId);
  });

  shell.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    shell.scrollLeft = startScroll - (event.clientX - startX);
  });

  shell.addEventListener("pointerup", () => {
    dragging = false;
    shell.classList.remove("is-dragging");
  });

  shell.addEventListener("pointercancel", () => {
    dragging = false;
    shell.classList.remove("is-dragging");
  });
}

function setupDownload() {
  document.getElementById("download-svg").addEventListener("click", () => {
    const svg = document.getElementById("portfolio-map");
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bright-valley-portfolio-${data.summary.latestQuarter.replace(" ", "-")}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

setupSummary();
setupTabs();
buildTimeline();
setupDrag();
setupDownload();
renderLatest();
renderChanges();

document.getElementById("metric-select").addEventListener("change", buildTimeline);
document.getElementById("latest-search").addEventListener("input", (event) => renderLatest(event.target.value));
