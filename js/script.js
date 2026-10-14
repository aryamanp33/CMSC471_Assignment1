// CMSC471 Assignment 1 — D3 interactive visualization
// Table 1: pooled national estimates; Table 2: annual national estimates.
const initial = { gender: "M", year: "pooled", metric: "le_raceadj", low: 10, high: 90 };
const state = { ...initial };
const LOW_COLOR = "#df7651";
const HIGH_COLOR = "#137f84";
const BLUE_COLOR = "#3b67ad";
const fmtYears = d3.format(".1f");
const fmtMoney = d3.format("$,.0f");

let pooledLookup = new Map();
let annualLookup = new Map();
let ready = false;

function pooledKey(gender, percentile) {
  return `${gender}-${percentile}`;
}
function annualKey(gender, percentile, year) {
  return `${gender}-${percentile}-${year}`;
}
function parseRow(row) {
  return {
    gnd: row.gnd,
    pctile: +row.pctile,
    year: row.year === undefined ? null : +row.year,
    hh_inc: +row.hh_inc,
    le_agg: +row.le_agg,
    le_raceadj: +row.le_raceadj
  };
}
function getPoint(percentile, year = state.year) {
  return year === "pooled"
    ? pooledLookup.get(pooledKey(state.gender, percentile))
    : annualLookup.get(annualKey(state.gender, percentile, +year));
}
function life(point) {
  return point[state.metric];
}
function percentileName(percentile) {
  return `${percentile}${percentile % 100 >= 11 && percentile % 100 <= 13 ? "th" :
    percentile % 10 === 1 ? "st" : percentile % 10 === 2 ? "nd" : percentile % 10 === 3 ? "rd" : "th"}`;
}
function yearName() {
  return state.year === "pooled" ? "2001–2014 pooled" : String(state.year);
}
function setOptions(select, values, value) {
  select.replaceChildren(...values.map(number => {
    const option = document.createElement("option");
    option.value = String(number);
    option.textContent = `${percentileName(number)} percentile`;
    return option;
  }));
  select.value = String(value);
}
function syncPercentileControls() {
  setOptions(document.querySelector("#low-select"), d3.range(1, state.high), state.low);
  setOptions(document.querySelector("#high-select"), d3.range(state.low + 1, 101), state.high);
}
function updateEverything() {
  if (!ready) return;
  document.querySelector("#gender-select").value = state.gender;
  document.querySelector("#year-select").value = String(state.year);
  document.querySelector("#metric-select").value = state.metric;
  syncPercentileControls();
  updateText();
  renderIncomeChart();
  renderTrendChart();
}
function updateText() {
  const low = life(getPoint(state.low));
  const high = life(getPoint(state.high));
  const gap = high - low;
  const gender = state.gender === "M" ? "men" : "women";

  document.querySelector("#low-stat").textContent = `${fmtYears(low)} years`;
  document.querySelector("#high-stat").textContent = `${fmtYears(high)} years`;
  document.querySelector("#gap-stat").textContent = `${fmtYears(gap)} years`;
  document.querySelector("#low-stat-note").textContent = `${percentileName(state.low)} percentile · ${yearName()}`;
  document.querySelector("#high-stat-note").textContent = `${percentileName(state.high)} percentile · ${yearName()}`;
  document.querySelector("#gap-stat-note").textContent = `Higher minus lower percentile · ${gender}`;
  document.querySelector("#low-legend").textContent = `${percentileName(state.low)} percentile`;
  document.querySelector("#high-legend").textContent = `${percentileName(state.high)} percentile`;
  document.querySelector("#income-chart-subtitle").textContent =
    `Expected age at death for ${gender} · ${yearName()} · ${state.metric === "le_raceadj" ? "race-adjusted" : "unadjusted"}`;

  document.querySelector("#current-insight").textContent =
    `For ${gender} (${yearName()}), the ${percentileName(state.high)} income percentile has an estimated ` +
    `age at death of ${fmtYears(high)}, compared with ${fmtYears(low)} at the ${percentileName(state.low)} percentile ` +
    `— a difference of ${fmtYears(gap)} years.`;

  const startGap = life(getPoint(state.high, 2001)) - life(getPoint(state.low, 2001));
  const endGap = life(getPoint(state.high, 2014)) - life(getPoint(state.low, 2014));
  const change = endGap - startGap;
  const direction = Math.abs(change) < 0.05 ? "changed very little" : change > 0 ? "widened" : "narrowed";
  document.querySelector("#trend-insight").textContent =
    `In the annual estimates, this higher-minus-lower gap was ${fmtYears(startGap)} years in 2001 and ` +
    `${fmtYears(endGap)} years in 2014; it ${direction} by ${fmtYears(Math.abs(change))} years over this period.`;
}

function makeChart(hostId, height = 350) {
  const host = document.querySelector(hostId);
  host.replaceChildren();
  const width = Math.max(300, host.clientWidth);
  const margin = { top: 32, right: 18, bottom: 51, left: 55 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const svg = d3.select(host).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("width", "100%");
  const tooltip = d3.select(host).append("div").attr("class", "tooltip").attr("role", "status");
  return { host, svg, tooltip, width, height, margin, plotWidth, plotHeight };
}
function axes(chart, x, y, xTicks, xLabel) {
  const { svg, margin, plotWidth, plotHeight, width } = chart;
  svg.append("g").attr("class", "grid-lines")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-plotWidth).tickFormat(""));
  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));
  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${margin.top + plotHeight})`)
    .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.format("d")).tickSizeOuter(0));
  svg.append("text").attr("class", "chart-axis-label")
    .attr("x", margin.left).attr("y", 16).text("Expected age at death (years)");
  svg.append("text").attr("class", "chart-axis-label")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", margin.top + plotHeight + 43).attr("text-anchor", "middle").text(xLabel);
}
function showTooltip(chart, event, html) {
  const { tooltip, host } = chart;
  tooltip.html(html).style("opacity", 1);
  const [mx, my] = d3.pointer(event, host);
  const box = tooltip.node().getBoundingClientRect();
  const left = Math.max(4, Math.min(mx + 14, host.clientWidth - box.width - 4));
  const top = Math.max(4, my - box.height - 12);
  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}
function hideTooltip(chart) {
  chart.tooltip.style("opacity", 0);
}
function setNearestPercentile(percentile) {
  if (percentile <= state.low) state.low = Math.min(percentile, state.high - 1);
  else if (percentile >= state.high) state.high = Math.max(percentile, state.low + 1);
  else if (percentile - state.low <= state.high - percentile) state.low = percentile;
  else state.high = percentile;
  updateEverything();
}

function renderIncomeChart() {
  const chart = makeChart("#income-chart");
  const { svg, margin, plotWidth, plotHeight } = chart;
  const data = d3.range(1, 101).map(percentile => getPoint(percentile));
  const bounds = d3.extent(data, life);
  const x = d3.scaleLinear().domain([1, 100]).range([margin.left, margin.left + plotWidth]);
  const y = d3.scaleLinear().domain([Math.floor(bounds[0] - 1.5), Math.ceil(bounds[1] + 1.5)])
    .range([margin.top + plotHeight, margin.top]);

  svg.append("rect").attr("x", x(state.low)).attr("y", margin.top)
    .attr("width", x(state.high) - x(state.low)).attr("height", plotHeight)
    .attr("fill", "#edf5f9");
  axes(chart, x, y, chart.width < 440 ? [1, 25, 50, 75, 100] : [1, 10, 25, 50, 75, 90, 100], "Household income percentile");

  const line = d3.line().x(d => x(d.pctile)).y(d => y(life(d))).curve(d3.curveMonotoneX);
  svg.append("path").datum(data).attr("d", line)
    .attr("fill", "none").attr("stroke", BLUE_COLOR)
    .attr("stroke-width", 3).attr("stroke-linejoin", "round");

  [{ p: state.low, color: LOW_COLOR }, { p: state.high, color: HIGH_COLOR }].forEach(({ p, color }) => {
    const point = getPoint(p);
    svg.append("line").attr("x1", x(p)).attr("x2", x(p))
      .attr("y1", y(life(point))).attr("y2", margin.top + plotHeight)
      .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4");
    svg.append("circle").attr("cx", x(p)).attr("cy", y(life(point))).attr("r", 6)
      .attr("fill", color).attr("stroke", "white").attr("stroke-width", 2);
  });

  const guide = svg.append("line").attr("stroke", "#94a3b8").attr("stroke-dasharray", "3 4").style("display", "none");
  const dot = svg.append("circle").attr("r", 5).attr("fill", BLUE_COLOR)
    .attr("stroke", "white").attr("stroke-width", 2).style("display", "none");
  function hover(event) {
    const px = d3.pointer(event, svg.node())[0];
    const percentile = Math.round(Math.max(1, Math.min(100, x.invert(px))));
    const point = getPoint(percentile);
    guide.attr("x1", x(percentile)).attr("x2", x(percentile))
      .attr("y1", margin.top).attr("y2", margin.top + plotHeight).style("display", null);
    dot.attr("cx", x(percentile)).attr("cy", y(life(point))).style("display", null);
    showTooltip(chart, event,
      `<strong>${percentileName(percentile)} income percentile</strong><br>` +
      `Life expectancy: <strong>${fmtYears(life(point))} years</strong><br>` +
      `<span class="muted">Mean household income: ${fmtMoney(point.hh_inc)}</span>`);
  }
  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", plotWidth).attr("height", plotHeight)
    .attr("fill", "transparent").style("cursor", "crosshair")
    .on("pointermove", hover)
    .on("pointerleave", () => { hideTooltip(chart); guide.style("display", "none"); dot.style("display", "none"); })
    .on("click", event => {
      const px = d3.pointer(event, svg.node())[0];
      const percentile = Math.round(Math.max(1, Math.min(100, x.invert(px))));
      setNearestPercentile(percentile);
    });
}

function renderTrendChart() {
  const chart = makeChart("#trend-chart");
  const { svg, margin, plotWidth, plotHeight } = chart;
  const years = d3.range(2001, 2015);
  const lowSeries = years.map(year => ({ year, value: life(getPoint(state.low, year)) }));
  const highSeries = years.map(year => ({ year, value: life(getPoint(state.high, year)) }));
  const allValues = [...lowSeries, ...highSeries].map(d => d.value);
  const bounds = d3.extent(allValues);
  const x = d3.scaleLinear().domain([2001, 2014]).range([margin.left, margin.left + plotWidth]);
  const y = d3.scaleLinear().domain([Math.floor(bounds[0] - 1.5), Math.ceil(bounds[1] + 1.5)])
    .range([margin.top + plotHeight, margin.top]);
  axes(chart, x, y, [2001, 2004, 2007, 2010, 2014], "Year");

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  [{ data: lowSeries, color: LOW_COLOR }, { data: highSeries, color: HIGH_COLOR }].forEach(({ data, color }) => {
    svg.append("path").datum(data).attr("d", line)
      .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.8)
      .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    const last = data.at(-1);
    svg.append("circle").attr("cx", x(last.year)).attr("cy", y(last.value))
      .attr("r", 4).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5);
  });

  if (state.year !== "pooled") {
    const year = +state.year;
    svg.append("line").attr("x1", x(year)).attr("x2", x(year))
      .attr("y1", margin.top).attr("y2", margin.top + plotHeight)
      .attr("stroke", "#788ca4").attr("stroke-dasharray", "4 4");
    [
      { percentile: state.low, color: LOW_COLOR },
      { percentile: state.high, color: HIGH_COLOR }
    ].forEach(({ percentile, color }) => {
      svg.append("circle").attr("cx", x(year)).attr("cy", y(life(getPoint(percentile, year))))
        .attr("r", 6).attr("fill", color).attr("stroke", "white").attr("stroke-width", 2);
    });
  }

  const guide = svg.append("line").attr("stroke", "#94a3b8").attr("stroke-dasharray", "3 4").style("display", "none");
  const hoverDots = [LOW_COLOR, HIGH_COLOR].map(color => svg.append("circle")
    .attr("r", 5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5).style("display", "none"));
  function hover(event) {
    const px = d3.pointer(event, svg.node())[0];
    const year = Math.round(Math.max(2001, Math.min(2014, x.invert(px))));
    const low = life(getPoint(state.low, year));
    const high = life(getPoint(state.high, year));
    guide.attr("x1", x(year)).attr("x2", x(year))
      .attr("y1", margin.top).attr("y2", margin.top + plotHeight).style("display", null);
    hoverDots[0].attr("cx", x(year)).attr("cy", y(low)).style("display", null);
    hoverDots[1].attr("cx", x(year)).attr("cy", y(high)).style("display", null);
    showTooltip(chart, event,
      `<strong>Year ${year}</strong><br>` +
      `<span class="tooltip-low">${percentileName(state.low)}:</span> ${fmtYears(low)} years<br>` +
      `<span class="tooltip-high">${percentileName(state.high)}:</span> ${fmtYears(high)} years<br>` +
      `<span class="muted">Difference: ${fmtYears(high - low)} years</span>`);
  }
  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", plotWidth).attr("height", plotHeight)
    .attr("fill", "transparent").style("cursor", "crosshair")
    .on("pointermove", hover)
    .on("pointerleave", () => {
      hideTooltip(chart);
      guide.style("display", "none");
      hoverDots.forEach(dot => dot.style("display", "none"));
    })
    .on("click", event => {
      const px = d3.pointer(event, svg.node())[0];
      state.year = Math.round(Math.max(2001, Math.min(2014, x.invert(px))));
      updateEverything();
    });
}

function attachControls() {
  document.querySelector("#gender-select").addEventListener("change", event => {
    state.gender = event.target.value;
    updateEverything();
  });
  document.querySelector("#year-select").addEventListener("change", event => {
    state.year = event.target.value;
    updateEverything();
  });
  document.querySelector("#metric-select").addEventListener("change", event => {
    state.metric = event.target.value;
    updateEverything();
  });
  document.querySelector("#low-select").addEventListener("change", event => {
    state.low = +event.target.value;
    updateEverything();
  });
  document.querySelector("#high-select").addEventListener("change", event => {
    state.high = +event.target.value;
    updateEverything();
  });
  document.querySelector("#reset-button").addEventListener("click", () => {
    Object.assign(state, initial);
    updateEverything();
  });
}

async function initialize() {
  try {
    const [pooled, annual] = await Promise.all([
      d3.csv("data/table1.csv", parseRow),
      d3.csv("data/table2.csv", parseRow)
    ]);
    pooledLookup = new Map(pooled.map(row => [pooledKey(row.gnd, row.pctile), row]));
    annualLookup = new Map(annual.map(row => [annualKey(row.gnd, row.pctile, row.year), row]));
    if (pooledLookup.size !== 200 || annualLookup.size !== 2800) {
      throw new Error("The CSVs have unexpected row counts. Check that the correct files were saved.");
    }
    const yearSelect = document.querySelector("#year-select");
    d3.range(2001, 2015).forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
    attachControls();
    ready = true;
    updateEverything();
    let previousWidth = 0;
    const observer = new ResizeObserver(() => {
      const width = document.querySelector("#income-chart").clientWidth;
      if (ready && Math.abs(width - previousWidth) > 2) {
        previousWidth = width;
        renderIncomeChart();
        renderTrendChart();
      }
    });
    observer.observe(document.querySelector("#income-chart"));
  } catch (error) {
    console.error("Data loading failed:", error);
    const element = document.querySelector("#error-message");
    element.hidden = false;
    element.textContent = "Unable to load the two CSV files. Check that data/table1.csv and data/table2.csv exist, and open this project using VS Code Live Server rather than file://. " + error.message;
  }
}

initialize();
