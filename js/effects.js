  const FX_STEP = 25, FX_DUR = 380;
  let fx = [];
  let shakeTimer = 0;
  function startShake(perfect) {
    boardCv.classList.remove("shake", "perfect-shake");
    if (settings.reducedMotion) return;
    void boardCv.offsetWidth;
    boardCv.classList.add(perfect ? "perfect-shake" : "shake");
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => boardCv.classList.remove("shake", "perfect-shake"), perfect ? 420 : 160);
  }
  function startPlacementFx(shape, row, col, res) {
    if (settings.reducedMotion) return;
    const cells = shape.cells
      .map(([dr, dc]) => ({ r: row + dr, c: col + dc }))
      .filter(({ r, c }) => !res.rows.includes(r) && !res.cols.includes(c));
    if (cells.length) fx.push({ type: "placement", t0: performance.now(), cells, color: shape.color });
  }
  function comboTierFor(combo) {
    return combo >= 8 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1 : 0;
  }
  function startFx(res, tier, combo) {
    if (settings.reducedMotion) return;
    const cells = [], particles = [];
    let particleSlots = Math.max(0, 120 - fx.reduce((count, event) => count + (event.type === "clear" ? event.particles.length : 0), 0));
    const speed = [1, 1.2, 1.4, 1.7][tier];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const inRow = res.rows.includes(r), inCol = res.cols.includes(c);
      if (!inRow && !inCol) continue;
      const delay = Math.min(inRow ? c * FX_STEP : Infinity, inCol ? r * FX_STEP : Infinity);
      cells.push({ r, c, color: res.before[r][c], delay });
      for (let i = 0; i < 5 && particleSlots > 0; i++, particleSlots--) particles.push({
        x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, vx: (Math.random() - 0.5) * 210 * speed,
        vy: (-50 - Math.random() * 150) * speed, size: 2 + Math.random() * 5,
        color: res.before[r][c], sparkle: Math.random() < 0.25
      });
    }
    fx.push({
      type: "clear", t0: performance.now(), cells, particles, rows: res.rows.slice(), cols: res.cols.slice(),
      sweepWidth: [4, 6, 8, 10][tier]
    });
    if (res.lines >= 3) startShake(false);
    if ([3, 5, 8].includes(combo)) fx.push({ type: "pulse", t0: performance.now(), tier });
  }
  function startPerfectFx() {
    if (!settings.reducedMotion) {
      const particles = Array.from({ length: 144 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 240 + Math.random() * 300;
        return {
          x: SIZE / 2, y: SIZE / 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5, color: Math.random() < 0.28 ? "#fff" : "#ffbd32",
          sparkle: i % 7 === 0
        };
      });
      fx.push({ type: "perfect", t0: performance.now(), particles });
    }
    startShake(true);
  }
  function startGameOverWave() {
    if (!settings.reducedMotion) fx.push({ type: "game-over-wave", t0: performance.now() });
  }
  function drawFx() {
    if (settings.reducedMotion) { fx = []; return; }
    const now = performance.now();
    fx = fx.filter(e => {
      const elapsed = now - e.t0;
      if (e.type === "placement") {
        const p = Math.min(1, elapsed / 120);
        if (p >= 1) return false;
        const scale = 1.15 - 0.15 * p;
        e.cells.forEach(({ r, c }) => {
          const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
          bx.save(); bx.translate(x, y); bx.scale(scale, scale);
          cell(bx, -CELL / 2, -CELL / 2, CELL, e.color);
          bx.globalAlpha = 0.55 * (1 - p);
          bx.fillStyle = "#fff"; bx.fillRect(-CELL / 2 + 1, -CELL / 2 + 1, CELL - 2, CELL - 2);
          bx.restore();
        });
        return true;
      }
      if (e.type === "pulse") {
        const p = Math.min(1, elapsed / 400);
        if (p >= 1) return false;
        const radius = SIZE * (0.2 + 0.8 * p);
        const gradient = bx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.08, SIZE / 2, SIZE / 2, radius);
        const strength = [0, 0.12, 0.16, 0.2][e.tier];
        gradient.addColorStop(0, `rgba(255, 220, 123, ${(1 - p) * strength})`);
        gradient.addColorStop(0.72, `rgba(255, 189, 50, ${(1 - p) * strength * 0.7})`);
        gradient.addColorStop(1, "rgba(255, 189, 50, 0)");
        bx.save(); bx.globalCompositeOperation = "screen"; bx.fillStyle = gradient; bx.fillRect(0, 0, SIZE, SIZE); bx.restore();
        return true;
      }
      if (e.type === "game-over-wave") {
        if (elapsed >= 500) return false;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          if (board[r][c]) continue;
          const delay = (r + c) / (2 * (N - 1)) * 380;
          const p = Math.max(0, Math.min(1, (elapsed - delay) / 120));
          if (!p) continue;
          bx.fillStyle = `rgba(35, 40, 52, ${0.55 * p})`;
          bx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        }
        return true;
      }
      if (e.type === "perfect") {
        const flash = Math.max(0, 1 - elapsed / 300);
        if (flash) {
          bx.save(); bx.globalAlpha = 0.58 * flash; bx.fillStyle = "#fff";
          bx.fillRect(0, 0, SIZE, SIZE); bx.restore();
          bx.save(); bx.globalAlpha = 0.22 * flash; bx.fillStyle = "#ffbd32";
          bx.fillRect(0, 0, SIZE, SIZE); bx.restore();
        }
        const t = elapsed / 1000;
        e.particles.forEach(k => {
          const x = k.x + k.vx * t, y = k.y + k.vy * t + 55 * t * t;
          const alpha = Math.max(0, 1 - t / 1.1);
          if (!alpha) return;
          bx.save(); bx.globalAlpha = alpha; bx.fillStyle = k.color;
          if (k.sparkle) { bx.shadowColor = "#ffdc7b"; bx.shadowBlur = 6; }
          if (k.sparkle) {
            bx.translate(x, y); bx.rotate(t * 4);
            bx.fillRect(-k.size / 2, -k.size / 2, k.size, k.size);
            bx.fillRect(-k.size, -1, k.size * 2, 2);
          } else bx.fillRect(x, y, k.size, k.size);
          bx.restore();
        });
        return elapsed < 1100;
      }

      let alive = false;
      e.cells.forEach(k => {
        const p = (elapsed - k.delay) / FX_DUR;
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
      const t = Math.max(0, elapsed / 1000);
      const sweep = (index, horizontal) => {
        const p = Math.min(1, Math.max(0, elapsed / 360));
        const pos = p * SIZE;
        bx.save(); bx.globalAlpha = 0.9 * (1 - p); bx.lineWidth = e.sweepWidth; bx.shadowBlur = 8;
        bx.shadowColor = "#fff";
        const gradient = horizontal ? bx.createLinearGradient(pos - 28, 0, pos + 28, 0) : bx.createLinearGradient(0, pos - 28, 0, pos + 28);
        gradient.addColorStop(0, "rgba(255,189,50,0)"); gradient.addColorStop(0.25, "#ffbd32");
        gradient.addColorStop(0.5, "#fff"); gradient.addColorStop(0.75, "#ffdc7b"); gradient.addColorStop(1, "rgba(255,189,50,0)");
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
        bx.shadowColor = k.color; bx.shadowBlur = k.sparkle ? 5 : 1;
        if (k.sparkle) { bx.translate(x, y); bx.rotate(t * 4); bx.fillRect(-k.size / 2, -k.size / 2, k.size, k.size); bx.fillRect(-k.size, -1, k.size * 2, 2); }
        else bx.fillRect(x, y, k.size, k.size);
        bx.restore();
      });
      return alive || t < 1.15 || elapsed < 360;
    });
  }

  const TXT_DUR = 900;
  let txts = [];
  function startText(res, gained, combo, clear, lines) {
    let sx = 0, sy = 0, n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (res.rows.includes(r) || res.cols.includes(c)) { sx += (c + 0.5) * CELL; sy += (r + 0.5) * CELL; n++; }
    const x = n ? Math.max(75, Math.min(SIZE - 75, sx / n)) : SIZE / 2;
    const baseY = n ? Math.max(70, Math.min(SIZE - 30, sy / n)) : SIZE / 2;
    const t0 = performance.now(), dur = settings.reducedMotion ? 300 : TXT_DUR;
    const pointsY = clear ? SIZE - 42 : baseY + 18;
    txts.push({ t0, dur, text: "+" + gained, x, y: pointsY, size: 23, color: clear ? `rgb(${GLOW})` : "#ffffff", glint: clear ? "#fffbe0" : `rgb(${GLOW})`, kind: "points" });
    const praise = lines >= 5 ? "Amazing" : lines === 4 ? "Excellent" : lines === 3 ? "Great" : lines === 2 ? "Good" : null;
    if (praise) txts.push({
      t0, dur: settings.reducedMotion ? 300 : 1100, text: praise, x: SIZE / 2,
      y: clear ? 44 : Math.max(45, baseY - (combo > 0 ? 65 : 35)),
      size: lines >= 5 ? 38 : lines === 4 ? 34 : lines === 3 ? 30 : 26,
      color: "#ffdc7b", glint: "#fffbe0", kind: "praise"
    });
    if (combo > 0) txts.push({
      t0, dur: settings.reducedMotion ? 300 : 1250, text: String(combo), x,
      y: clear ? 92 : Math.max(38, baseY - (praise ? 34 : 30)),
      size: Math.min(42, 30 + combo * 2), color: "#ffbd32", glint: null, kind: "combo"
    });
    if (clear) txts.push({ t0, dur: settings.reducedMotion ? 450 : 1500, text: "PERFECT", x: SIZE / 2, y: SIZE / 2, size: 48, color: "#ffdc7b", glint: null, kind: "perfect" });
  }
  function drawTxt() {
    const now = performance.now();
    txts = txts.filter(e => {
      const p = Math.min(1, (now - e.t0) / (settings.reducedMotion ? Math.min(e.dur, 500) : e.dur));
      if (p >= 1) return false;
      const grow = settings.reducedMotion ? 1 :
        e.kind === "combo" ? (p < 0.22 ? 0.55 + 0.6 * (1 - Math.pow(1 - p / 0.22, 3)) + 0.08 * Math.sin(p * 30) : 1.12) :
        e.kind === "perfect" ? 0.75 + 0.25 * Math.min(1, p / 0.18) :
        p < 0.15 ? 0.6 + 0.4 * (p / 0.15) : 1;
      const fadeStart = e.kind === "perfect" ? 0.78 : e.kind === "combo" ? 0.78 : 0.7;
      const alpha = p < fadeStart ? 1 : 1 - (p - fadeStart) / (1 - fadeStart);
      bx.save(); bx.globalAlpha = alpha; bx.textAlign = "center"; bx.textBaseline = "middle";
      bx.font = e.kind === "combo" ? `italic 900 ${Math.round(e.size * grow)}px sans-serif` : `900 ${Math.round(e.size * grow)}px sans-serif`;
      bx.lineJoin = "round"; bx.lineWidth = e.kind === "combo" || e.kind === "perfect" ? 6 : Math.max(3, e.size * 0.2);
      const float = settings.reducedMotion ? 0 : (e.kind === "perfect" ? 8 : e.kind === "combo" ? 36 : 20) * p;
      const y = e.y - float, w = bx.measureText(e.text).width;
      if (e.kind === "combo") {
        const label = "COMBO", number = e.text, gap = 8, labelW = bx.measureText(label).width, numberW = bx.measureText(number).width;
        const total = labelW + gap + numberW, start = e.x - total / 2;
        bx.shadowColor = "#ffbd32"; bx.shadowBlur = 12; bx.strokeStyle = "#fff";
        bx.strokeText(label, start + labelW / 2, y); bx.fillStyle = "#ffdc7b"; bx.fillText(label, start + labelW / 2, y);
        bx.strokeText(number, start + labelW + gap + numberW / 2, y); bx.fillStyle = comboColor(Number(e.text)); bx.fillText(number, start + labelW + gap + numberW / 2, y);
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
      bx.shadowColor = e.color; bx.shadowBlur = e.kind === "perfect" ? 20 : e.kind === "praise" ? 8 : 10;
      bx.fillStyle = fill; bx.fillText(e.text, e.x, y);
      bx.restore();
      return true;
    });
  }
  function comboColor(combo) {
    return combo >= 8 ? "#fff0b3" : combo >= 5 ? "#ffe39a" : "#ffbd32";
  }
