  const FX_STEP = 25, FX_DUR = 380;
  let fx = [];
  let shakeTimer = 0;
  function startFx(res) {
    if (settings.reducedMotion) return;
    const cells = [], particles = [];
    let particleSlots = Math.max(0, 120 - fx.reduce((count, event) => count + event.particles.length, 0));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const inRow = res.rows.includes(r), inCol = res.cols.includes(c);
      if (!inRow && !inCol) continue;
      const delay = Math.min(inRow ? c * FX_STEP : Infinity, inCol ? r * FX_STEP : Infinity);
      cells.push({ r, c, color: res.before[r][c], delay });
      for (let i = 0; i < 5 && particleSlots > 0; i++, particleSlots--) particles.push({
        x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, vx: (Math.random() - 0.5) * 210,
        vy: -50 - Math.random() * 150, size: 2 + Math.random() * 5,
        color: res.before[r][c], sparkle: Math.random() < 0.25
      });
    }
    fx.push({ t0: performance.now(), cells, particles, rows: res.rows.slice(), cols: res.cols.slice() });
    if (res.lines >= 3) {
      boardCv.classList.remove("shake"); void boardCv.offsetWidth; boardCv.classList.add("shake");
      clearTimeout(shakeTimer); shakeTimer = setTimeout(() => boardCv.classList.remove("shake"), 160);
    }
  }
  function drawFx() {
    if (settings.reducedMotion) { fx = []; return; }
    const now = performance.now();
    fx = fx.filter(e => {
      let alive = false;
      e.cells.forEach(k => {
        const p = (now - e.t0 - k.delay) / FX_DUR;
        if (p >= 1) return;
        alive = true;
        const x = k.c * CELL, y = k.r * CELL;
        if (p < 0) { cell(bx, x, y, CELL, k.color); return; }
        const fill = Math.min(1, p / 0.3), fade = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
        cell(bx, x, y, CELL, k.color, fade);
        bx.globalCompositeOperation = "screen";
        bx.fillStyle = `rgba(${GLOW}, ${0.85 * fill * fade})`; bx.shadowColor = `rgb(${GLOW})`; bx.shadowBlur = 14 * fade;
        bx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        bx.shadowBlur = 0; bx.globalCompositeOperation = "source-over";
      });
      const t = Math.max(0, (now - e.t0) / 1000);
      const sweep = (index, horizontal) => {
        const p = Math.min(1, Math.max(0, (now - e.t0) / 360));
        const pos = p * SIZE;
        bx.save(); bx.globalAlpha = 0.9 * (1 - p); bx.lineWidth = 4; bx.shadowBlur = 18;
        bx.shadowColor = "#fff";
        const gradient = horizontal ? bx.createLinearGradient(pos - 28, 0, pos + 28, 0) : bx.createLinearGradient(0, pos - 28, 0, pos + 28);
        gradient.addColorStop(0, "rgba(255,60,180,0)"); gradient.addColorStop(0.25, "#ff3dc8");
        gradient.addColorStop(0.5, "#fff"); gradient.addColorStop(0.75, "#40fff0"); gradient.addColorStop(1, "rgba(80,120,255,0)");
        bx.strokeStyle = gradient; bx.beginPath();
        if (horizontal) { bx.moveTo(0, (index + 0.5) * CELL); bx.lineTo(SIZE, (index + 0.5) * CELL); }
        else { bx.moveTo((index + 0.5) * CELL, 0); bx.lineTo((index + 0.5) * CELL, SIZE); }
        bx.stroke(); bx.restore();
      };
      e.rows.forEach(row => sweep(row, true)); e.cols.forEach(col => sweep(col, false));
      e.particles.forEach(k => {
        const x = k.x + k.vx * t, y = k.y + k.vy * t + 90 * t * t, alpha = Math.max(0, 1 - t / 1.15);
        if (!alpha) return;
        bx.save(); bx.globalAlpha = alpha; bx.fillStyle = k.sparkle ? "#fff" : k.color;
        bx.shadowColor = k.color; bx.shadowBlur = k.sparkle ? 9 : 3;
        if (k.sparkle) { bx.translate(x, y); bx.rotate(t * 4); bx.fillRect(-k.size / 2, -k.size / 2, k.size, k.size); bx.fillRect(-k.size, -1, k.size * 2, 2); }
        else bx.fillRect(x, y, k.size, k.size);
        bx.restore();
      });
      return alive || t < 1.15 || now - e.t0 < 360;
    });
  }

 
  const TXT_DUR = 900;
  let txts = [];
  function startText(res, gained, combo, clear) {
    let sx = 0, sy = 0, n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (res.rows.includes(r) || res.cols.includes(c)) { sx += (c + 0.5) * CELL; sy += (r + 0.5) * CELL; n++; }
    const x = Math.max(75, Math.min(SIZE - 75, sx / n)), y = Math.max(70, Math.min(SIZE - 30, sy / n));
    const t0 = performance.now(), dur = settings.reducedMotion ? 300 : TXT_DUR;
    txts.push({ t0, dur, text: "+" + gained, x, y, size: 23, color: clear ? `rgb(${GLOW})` : "#ffffff", glint: clear ? "#fffbe0" : `rgb(${GLOW})`, kind: "points" });
    if (combo > 0) txts.push({ t0, dur: settings.reducedMotion ? 300 : 1250, text: String(combo), x, y: y - 30, size: Math.min(42, 30 + combo * 2), color: `rgb(${GLOW})`, glint: null, kind: "combo" });
  }
  function drawTxt() {
    const now = performance.now();
    txts = txts.filter(e => {
      const p = Math.min(1, (now - e.t0) / (settings.reducedMotion ? Math.min(e.dur, 300) : e.dur));
      if (p >= 1) return false;
      const grow = e.kind === "combo" ? p < 0.22 ? 0.55 + 0.6 * (1 - Math.pow(1 - p / 0.22, 3)) + 0.08 * Math.sin(p * 30) : 1.12 : p < 0.15 ? 0.6 + 0.4 * (p / 0.15) : 1;
      const fadeStart = e.kind === "combo" ? 0.78 : 0.7, alpha = p < fadeStart ? 1 : 1 - (p - fadeStart) / (1 - fadeStart);
      bx.save(); bx.globalAlpha = alpha; bx.textAlign = "center"; bx.textBaseline = "middle";
      bx.font = e.kind === "combo" ? `italic 900 ${Math.round(e.size * grow)}px sans-serif` : `bold ${Math.round(e.size * grow)}px sans-serif`;
      bx.lineJoin = "round"; bx.lineWidth = e.kind === "combo" ? 7 : Math.max(3, e.size * 0.2);
      const y = e.y - (settings.reducedMotion ? 0 : (e.kind === "combo" ? 36 : 20) * p), w = bx.measureText(e.text).width;
      if (e.kind === "combo") {
        const label = "COMBO", number = e.text, gap = 8, labelW = bx.measureText(label).width, numberW = bx.measureText(number).width;
        const total = labelW + gap + numberW, start = e.x - total / 2;
        bx.shadowColor = "#ff45cf"; bx.shadowBlur = 16; bx.strokeStyle = "#fff"; bx.strokeText(label, start + labelW / 2, y); bx.fillStyle = "#ff55ca"; bx.fillText(label, start + labelW / 2, y);
        bx.shadowColor = "#36f6ff"; bx.strokeStyle = "#fff"; bx.strokeText(number, start + labelW + gap + numberW / 2, y); bx.fillStyle = "#47f6ff"; bx.fillText(number, start + labelW + gap + numberW / 2, y);
        bx.restore(); return true;
      }
      let fill = e.color;
      if (e.glint && p < 0.5) {
        const s = -0.2 + 1.4 * (p / 0.5), cl = v => Math.max(0, Math.min(1, v));
        const g = bx.createLinearGradient(e.x - w / 2, 0, e.x + w / 2, 0);
        g.addColorStop(0, e.color); g.addColorStop(cl(s - 0.2), e.color); g.addColorStop(cl(s), e.glint); g.addColorStop(cl(s + 0.2), e.color); g.addColorStop(1, e.color);
        fill = g;
      }
      bx.strokeStyle = "rgba(10, 16, 40, 0.85)"; bx.strokeText(e.text, e.x, y);
      bx.shadowColor = e.color; bx.shadowBlur = 10; bx.fillStyle = fill; bx.fillText(e.text, e.x, y);
      bx.restore();
      return true;
    });
  }
