/**
 * AeroTwin-X High-Performance Lightweight Aerospace Charting Engine
 * Canvas & SVG rendering for real-time telemetry, residual trends, cylinder balance, and time filters.
 */

class AeroChartEngine {
  constructor() {
    this.sparklines = new Map();
  }

  /**
   * Render or update a high-DPI smooth sparkline canvas
   */
  renderSparkline(canvas, dataPoints, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.width || 120;
    const height = rect.height || canvas.height || 36;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!dataPoints || dataPoints.length < 2) {
      ctx.restore();
      return;
    }

    const color = options.color || "#0284c7"; // Cyan/sky
    const fillColor = options.fillColor || "rgba(2, 132, 199, 0.12)";
    const minVal = options.min !== undefined ? options.min : Math.min(...dataPoints);
    const maxVal = options.max !== undefined ? options.max : Math.max(...dataPoints);
    const range = (maxVal - minVal) || 1;

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(0, height);
    dataPoints.forEach((val, i) => {
      const x = (i / (dataPoints.length - 1)) * width;
      const normalized = (val - minVal) / range;
      const y = height - (normalized * (height - 6) + 3);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw stroke line
    ctx.beginPath();
    dataPoints.forEach((val, i) => {
      const x = (i / (dataPoints.length - 1)) * width;
      const normalized = (val - minVal) / range;
      const y = height - (normalized * (height - 6) + 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = options.lineWidth || 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Draw last point dot
    const lastX = width;
    const lastVal = dataPoints[dataPoints.length - 1];
    const lastY = height - (((lastVal - minVal) / range) * (height - 6) + 3);
    ctx.beginPath();
    ctx.arc(lastX - 2, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render a full interactive historical telemetry trend chart with gridlines, time labels, and thresholds
   */
  renderTrendChart(containerId, dataSeries, config = {}) {
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = config.height || 220;
    const title = config.title || "TELEMETRIC HISTORICAL TREND";
    const unit = config.unit || "";
    const color = config.color || "#0284c7";
    const warningThreshold = config.warning;
    const criticalThreshold = config.critical;

    let canvas = container.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "w-full rounded";
      container.innerHTML = "";
      container.appendChild(canvas);
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Background
    ctx.fillStyle = "#0c1524";
    ctx.fillRect(0, 0, width, height);

    if (!dataSeries || dataSeries.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText("NO TELEMETRIC DATA POINTS AVAILABLE", width / 2, height / 2);
      return;
    }

    const values = dataSeries.map(d => typeof d === "object" ? d.value : d);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (criticalThreshold) maxV = Math.max(maxV, criticalThreshold);
    if (minV === maxV) { minV -= 5; maxV += 5; }
    const range = maxV - minV;

    // Gridlines & Y-Axis ticks
    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "10px JetBrains Mono";
    ctx.textAlign = "right";

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const yVal = minV + (range * (i / yTicks));
      const y = padTop + plotH - (i / yTicks) * plotH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(`${yVal.toFixed(1)}${unit}`, padLeft - 6, y + 3);
    }

    // Threshold lines
    if (criticalThreshold && criticalThreshold <= maxV && criticalThreshold >= minV) {
      const critY = padTop + plotH - ((criticalThreshold - minV) / range) * plotH;
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, critY);
      ctx.lineTo(width - padRight, critY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ef4444";
      ctx.fillText("CRIT", width - padRight - 5, critY - 4);
    }

    // Area Gradient Fill
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    gradient.addColorStop(0, color.startsWith("#") ? color + "40" : "rgba(14, 165, 233, 0.25)");
    gradient.addColorStop(1, "rgba(14, 165, 233, 0.0)");

    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + plotH);
    values.forEach((v, idx) => {
      const x = padLeft + (idx / (values.length - 1)) * plotW;
      const y = padTop + plotH - ((v - minV) / range) * plotH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line Path
    ctx.beginPath();
    values.forEach((v, idx) => {
      const x = padLeft + (idx / (values.length - 1)) * plotW;
      const y = padTop + plotH - ((v - minV) / range) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Store chart parameters for mouse interaction
    canvas._chartMeta = {
      dataSeries, config, values, minV, range, padLeft, padRight, padTop, padBottom,
      plotW, plotH, width, height, title, unit, color, criticalThreshold
    };

    // Draw active hover/selected point if present
    const activeIdx = canvas._hoveredIndex !== undefined ? canvas._hoveredIndex : null;
    if (activeIdx !== null && activeIdx >= 0 && activeIdx < values.length) {
      const activeX = padLeft + (activeIdx / (values.length - 1)) * plotW;
      const activeVal = values[activeIdx];
      const activeY = padTop + plotH - ((activeVal - minV) / range) * plotH;
      const item = typeof dataSeries[activeIdx] === "object" ? dataSeries[activeIdx] : { value: activeVal };

      // Vertical crosshair guideline
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(activeX, padTop);
      ctx.lineTo(activeX, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point circle
      ctx.beginPath();
      ctx.arc(activeX, activeY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Floating Aerospace HUD Details Box
      const boxW = 160;
      const boxH = 70;
      let boxX = activeX + 10;
      if (boxX + boxW > width - 10) boxX = activeX - boxW - 10;
      let boxY = activeY - 35;
      if (boxY < padTop) boxY = padTop + 5;
      if (boxY + boxH > height - 10) boxY = height - boxH - 10;

      ctx.fillStyle = "rgba(10, 19, 32, 0.94)";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 4) : ctx.rect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      // Tooltip Contents
      const ts = item.timestamp ? (item.timestamp.includes("T") ? item.timestamp.split("T")[1].slice(0, 8) + "Z" : item.timestamp) : `Frame #${activeIdx}`;
      const exp = item.expected !== undefined ? `${Number(item.expected).toFixed(1)} ${unit}` : "MODEL LOCKED";
      const res = item.residual !== undefined ? `${Number(item.residual) > 0 ? "+" : ""}${Number(item.residual).toFixed(1)} ${unit}` : "0.0";
      const src = item.source || "CAN BUS 50Hz";
      const stat = item.status || (criticalThreshold && activeVal > criticalThreshold ? "EXCURSION" : "NOMINAL");

      ctx.textAlign = "left";
      ctx.font = "bold 9px JetBrains Mono";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`TIME: ${ts} | [${src}]`, boxX + 6, boxY + 13);

      ctx.font = "bold 11px JetBrains Mono";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`VAL: ${activeVal.toFixed(1)} ${unit}`, boxX + 6, boxY + 28);

      ctx.font = "9px JetBrains Mono";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`EXP: ${exp}`, boxX + 6, boxY + 42);
      ctx.fillText(`RESIDUAL: ${res}`, boxX + 6, boxY + 54);

      ctx.fillStyle = stat.includes("EXCURSION") || stat.includes("ANOMALY") ? "#ef4444" : "#10b981";
      ctx.fillText(`STATE: ${stat}`, boxX + 6, boxY + 65);
    }

    // Attach mouse interaction events once
    if (!canvas._hasListeners) {
      canvas._hasListeners = true;
      const getMouseIndex = (e) => {
        const meta = canvas._chartMeta;
        if (!meta) return null;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        if (mx < meta.padLeft || mx > meta.width - meta.padRight) return null;
        const fraction = (mx - meta.padLeft) / meta.plotW;
        const idx = Math.round(fraction * (meta.values.length - 1));
        return Math.max(0, Math.min(meta.values.length - 1, idx));
      };

      canvas.addEventListener("mousemove", (e) => {
        const idx = getMouseIndex(e);
        if (idx !== null && canvas._hoveredIndex !== idx) {
          canvas._hoveredIndex = idx;
          const meta = canvas._chartMeta;
          this.renderTrendChart(containerId, meta.dataSeries, meta.config);
        }
      });

      canvas.addEventListener("mouseleave", () => {
        if (canvas._hoveredIndex !== null) {
          canvas._hoveredIndex = null;
          const meta = canvas._chartMeta;
          if (meta) this.renderTrendChart(containerId, meta.dataSeries, meta.config);
        }
      });

      canvas.addEventListener("click", (e) => {
        const idx = getMouseIndex(e);
        if (idx !== null) {
          const meta = canvas._chartMeta;
          const pt = meta.dataSeries[idx];
          if (meta.config && typeof meta.config.onPointClick === "function") {
            meta.config.onPointClick(pt, idx);
          }
        }
      });
    }
}

window.aeroCharts = new AeroChartEngine();
