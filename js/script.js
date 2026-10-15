// CMSC471 Assignment 1 — D3 interactive visualization
// Table 1: pooled national estimates; Table 2: annual national estimates.
// Store the current dropdown selections.
const state = { gender: "M", year: "pooled", metric: "le_raceadj", low: 10, high: 90 };
const LOW_COLOR = "rgb(223, 118, 81)";
const HIGH_COLOR = "rgb(19, 127, 132)";
const BLUE_COLOR = "rgb(59, 103, 173)";
const fmtYears = d3.format(".1f");
const fmtMoney = d3.format("$,.0f");

// Keep the CSV rows in arrays, like allData in lab 4–5.
let pooledData = [];
let annualData = [];
let ready = false;

function parseRow(row) {
  let year = null;
  if (row.year !== undefined) {
    year = +row.year;
  }
  return {
    gnd: row.gnd,
    pctile: +row.pctile,
    year: year,
    hh_inc: +row.hh_inc,
    le_agg: +row.le_agg,
    le_raceadj: +row.le_raceadj
  };
}
// Filter the rows to match the selected gender, percentile, and year.
function getPoint(percentile, year) {
  if (year === undefined) {
    year = state.year;
  }
  let matches;
  if (year === "pooled") {
    matches = pooledData.filter(d => d.gnd === state.gender && d.pctile === percentile);
  } else {
    matches = annualData.filter(d => d.gnd === state.gender && d.pctile === percentile && d.year === +year);
  }
  return matches[0];
}
function life(point) {
  return point[state.metric];
}
function percentileName(percentile) {
  let suffix = "th";
  const lastDigit = percentile % 10;
  const lastTwoDigits = percentile % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    suffix = "th";
  } else if (lastDigit === 1) {
    suffix = "st";
  } else if (lastDigit === 2) {
    suffix = "nd";
  } else if (lastDigit === 3) {
    suffix = "rd";
  }
  return percentile + suffix;
}
function yearName() {
  if (state.year === "pooled") {
    return "2001–2014 pooled";
  }
  return String(state.year);
}
// Bind the available percentiles to dropdown options, like setupSelector in lab 4–5.
function setOptions(selector, values, value) {
  d3.select(selector).selectAll("option")
    .data(values)
    .join("option")
    .attr("value", d => d)
    .text(d => percentileName(d) + " percentile");
  d3.select(selector).property("value", value);
}
function syncPercentileControls() {
  setOptions("#low-select", d3.range(1, state.high), state.low);
  setOptions("#high-select", d3.range(state.low + 1, 101), state.high);
}
function updateEverything() {
  if (!ready) return;
  d3.select("#gender-select").property("value", state.gender);
  d3.select("#year-select").property("value", String(state.year));
  d3.select("#metric-select").property("value", state.metric);
  syncPercentileControls();
  updateText();
  renderIncomeChart();
  renderTrendChart();
}
function updateText() {
  const low = life(getPoint(state.low));
  const high = life(getPoint(state.high));
  const gap = high - low;
  let gender = "women";
  if (state.gender === "M") {
    gender = "men";
  }
  let metricLabel = "unadjusted";
  if (state.metric === "le_raceadj") {
    metricLabel = "race-adjusted";
  }

  d3.select("#low-stat").text(`${fmtYears(low)} years`);
  d3.select("#high-stat").text(`${fmtYears(high)} years`);
  d3.select("#gap-stat").text(`${fmtYears(gap)} years`);
  d3.select("#low-stat-note").text(`${percentileName(state.low)} percentile · ${yearName()}`);
  d3.select("#high-stat-note").text(`${percentileName(state.high)} percentile · ${yearName()}`);
  d3.select("#gap-stat-note").text(`Higher minus lower percentile · ${gender}`);
  d3.select("#low-legend").text(`${percentileName(state.low)} percentile`);
  d3.select("#high-legend").text(`${percentileName(state.high)} percentile`);
  d3.select("#income-chart-subtitle").text(`Expected age at death for ${gender} · ${yearName()} · ${metricLabel}`);

  d3.select("#current-insight").text(`For ${gender} (${yearName()}), the ${percentileName(state.high)} income percentile has an estimated ` +
    `age at death of ${fmtYears(high)}, compared with ${fmtYears(low)} at the ${percentileName(state.low)} percentile ` +
    `— a difference of ${fmtYears(gap)} years.`);

  const startGap = life(getPoint(state.high, 2001)) - life(getPoint(state.low, 2001));
  const endGap = life(getPoint(state.high, 2014)) - life(getPoint(state.low, 2014));
  const change = endGap - startGap;
  let direction = "changed very little";
  if (Math.abs(change) >= 0.05) {
    if (change > 0) {
      direction = "widened";
    } else {
      direction = "narrowed";
    }
  }
  d3.select("#trend-insight").text(`In the annual estimates, this higher-minus-lower gap was ${fmtYears(startGap)} years in 2001 and ` +
    `${fmtYears(endGap)} years in 2014; it ${direction} by ${fmtYears(Math.abs(change))} years over this period.`);
}

// Use the margin convention from the labs for both charts.
function makeChart(hostId) {
  const height = 350;
  const host = document.querySelector(hostId);
  d3.select(host).selectAll("*").remove();
  const width = Math.max(300, host.clientWidth);
  const margin = { top: 32, right: 18, bottom: 51, left: 55 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const svg = d3.select(host).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("height", height)
    .attr("width", "100%");
  const tooltip = d3.select(host).append("div").attr("class", "tooltip").attr("role", "status");
  return { host: host, svg: svg, tooltip: tooltip, width: width, height: height,
    margin: margin, plotWidth: plotWidth, plotHeight: plotHeight };
}
function axes(chart, x, y, xTicks, xLabel) {
  const svg = chart.svg;
  const margin = chart.margin;
  const plotWidth = chart.plotWidth;
  const plotHeight = chart.plotHeight;
  const width = chart.width;
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
  const tooltip = chart.tooltip;
  const host = chart.host;
  tooltip.html(html).style("opacity", 1);
  // The tooltip lives inside the chart, so use coordinates relative to its container.
  const position = d3.pointer(event, host);
  const mx = position[0];
  const my = position[1];
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
  const svg = chart.svg;
  const margin = chart.margin;
  const plotWidth = chart.plotWidth;
  const plotHeight = chart.plotHeight;
  const data = d3.range(1, 101).map(percentile => getPoint(percentile));
  const bounds = d3.extent(data, life);
  const x = d3.scaleLinear().domain([1, 100]).range([margin.left, margin.left + plotWidth]);
  const y = d3.scaleLinear().domain([Math.floor(bounds[0] - 1.5), Math.ceil(bounds[1] + 1.5)])
    .range([margin.top + plotHeight, margin.top]);

  svg.append("rect").attr("x", x(state.low)).attr("y", margin.top)
    .attr("width", x(state.high) - x(state.low)).attr("height", plotHeight)
    .attr("fill", "rgb(237, 245, 249)");
  axes(chart, x, y, [1, 25, 50, 75, 100], "Household income percentile");

  const line = d3.line().x(d => x(d.pctile)).y(d => y(life(d)));
  svg.append("path").datum(data).attr("d", line)
    .attr("fill", "none").attr("stroke", BLUE_COLOR)
    .attr("stroke-width", 3).attr("stroke-linejoin", "round");

  [{ p: state.low, color: LOW_COLOR }, { p: state.high, color: HIGH_COLOR }].forEach(selection => {
    const p = selection.p;
    const color = selection.color;
    const point = getPoint(p);
    svg.append("line").attr("x1", x(p)).attr("x2", x(p))
      .attr("y1", y(life(point))).attr("y2", margin.top + plotHeight)
      .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4");
    svg.append("circle").attr("cx", x(p)).attr("cy", y(life(point))).attr("r", 6)
      .attr("fill", color).attr("stroke", "white").attr("stroke-width", 2);
  });

  const guide = svg.append("line").attr("stroke", "rgb(148, 163, 184)").attr("stroke-dasharray", "3 4").style("display", "none");
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
  const svg = chart.svg;
  const margin = chart.margin;
  const plotWidth = chart.plotWidth;
  const plotHeight = chart.plotHeight;
  const years = d3.range(2001, 2015);
  const lowSeries = years.map(year => ({ year: year, value: life(getPoint(state.low, year)) }));
  const highSeries = years.map(year => ({ year: year, value: life(getPoint(state.high, year)) }));
  const allValues = lowSeries.concat(highSeries).map(d => d.value);
  const bounds = d3.extent(allValues);
  const x = d3.scaleLinear().domain([2001, 2014]).range([margin.left, margin.left + plotWidth]);
  const y = d3.scaleLinear().domain([Math.floor(bounds[0] - 1.5), Math.ceil(bounds[1] + 1.5)])
    .range([margin.top + plotHeight, margin.top]);
  axes(chart, x, y, [2001, 2004, 2007, 2010, 2014], "Year");

  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  [{ data: lowSeries, color: LOW_COLOR }, { data: highSeries, color: HIGH_COLOR }].forEach(series => {
    const data = series.data;
    const color = series.color;
    svg.append("path").datum(data).attr("d", line)
      .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.8)
      .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    const last = data[data.length - 1];
    svg.append("circle").attr("cx", x(last.year)).attr("cy", y(last.value))
      .attr("r", 4).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5);
  });

  if (state.year !== "pooled") {
    const year = +state.year;
    svg.append("line").attr("x1", x(year)).attr("x2", x(year))
      .attr("y1", margin.top).attr("y2", margin.top + plotHeight)
      .attr("stroke", "rgb(120, 140, 164)").attr("stroke-dasharray", "4 4");
    [
      { percentile: state.low, color: LOW_COLOR },
      { percentile: state.high, color: HIGH_COLOR }
    ].forEach(selection => {
      const percentile = selection.percentile;
      const color = selection.color;
      svg.append("circle").attr("cx", x(year)).attr("cy", y(life(getPoint(percentile, year))))
        .attr("r", 6).attr("fill", color).attr("stroke", "white").attr("stroke-width", 2);
    });
  }

  const guide = svg.append("line").attr("stroke", "rgb(148, 163, 184)").attr("stroke-dasharray", "3 4").style("display", "none");
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
  d3.select("#gender-select").on("change", event => {
    state.gender = event.target.value;
    updateEverything();
  });
  d3.select("#year-select").on("change", event => {
    state.year = event.target.value;
    updateEverything();
  });
  d3.select("#metric-select").on("change", event => {
    state.metric = event.target.value;
    updateEverything();
  });
  d3.select("#low-select").on("change", event => {
    state.low = +event.target.value;
    updateEverything();
  });
  d3.select("#high-select").on("change", event => {
    state.high = +event.target.value;
    updateEverything();
  });
  d3.select("#reset-button").on("click", () => {
    state.gender = "M";
    state.year = "pooled";
    state.metric = "le_raceadj";
    state.low = 10;
    state.high = 90;
    updateEverything();
  });
}

// Load each CSV with the .then() / .catch() pattern used in lab 4–5.
function initialize() {
  d3.csv("data/table1.csv", parseRow)
    .then(data => {
      pooledData = data;
      return d3.csv("data/table2.csv", parseRow);
    })
    .then(data => {
      annualData = data;
      if (pooledData.length !== 200 || annualData.length !== 2800) {
        throw new Error("The CSVs have unexpected row counts.");
      }

      // Keep the pooled option already in the HTML, and add the individual years.
      d3.select("#year-select").selectAll(".year-option")
        .data(d3.range(2001, 2015))
        .join("option")
        .attr("class", "year-option")
        .attr("value", d => d)
        .text(d => d);

      attachControls();
      ready = true;
      updateEverything();
    })
    .catch(error => {
      console.error("Data loading failed:", error);
      d3.select("#error-message")
        .property("hidden", false)
        .text("Unable to load the charts. Check the CSV files and use a local server. " + error.message);
    });
}

// Redraw the charts when the browser window changes size.
window.addEventListener("resize", function() {
  if (ready) {
    renderIncomeChart();
    renderTrendChart();
  }
});

initialize();
