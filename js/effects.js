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
    if (cells.length) fx.push({ type: "placement", t0: performance.now(), cells, paletteIndex: shape.paletteIndex });
  }
  function comboTierFor(combo) {
    return combo >= 8 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1 : 0;
  }
  function startFx(res, tier, combo, perfect = false) {
    if (settings.reducedMotion) return;
    const cells = [], particles = [];
    let particleSlots = perfect ? 0 : Math.max(0, 120 - fx.reduce((count, event) => count + (event.type === "clear" ? event.particles.length : 0), 0));
    const speed = [1, 1.2, 1.4, 1.7][tier];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const inRow = res.rows.includes(r), inCol = res.cols.includes(c);
      if (!inRow && !inCol) continue;
      const delay = Math.min(inRow ? c * FX_STEP : Infinity, inCol ? r * FX_STEP : Infinity);
      cells.push({ r, c, paletteIndex: res.before[r][c] - 1, delay });
      for (let i = 0; i < 5 && particleSlots > 0; i++, particleSlots--) particles.push({
        x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, vx: (Math.random() - 0.5) * 210 * speed,
        vy: (-50 - Math.random() * 150) * speed, size: 2 + Math.random() * 5,
        paletteIndex: res.before[r][c] - 1, sparkle: Math.random() < 0.25
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
          size: 2 + Math.random() * 5, accent: Math.random() >= 0.28,
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
          cell(bx, -CELL / 2, -CELL / 2, CELL, getTheme().pieces[e.paletteIndex]);
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
        const theme = getTheme();
        gradient.addColorStop(0, `rgba(${rgbOf(theme.accentSoft)}, ${(1 - p) * strength})`);
        gradient.addColorStop(0.72, `rgba(${rgbOf(theme.accent)}, ${(1 - p) * strength * 0.7})`);
        gradient.addColorStop(1, `rgba(${rgbOf(theme.accent)}, 0)`);
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
          bx.fillStyle = `rgba(${rgbOf(getTheme().gameOverWave)}, ${0.55 * p})`;
          bx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        }
        return true;
      }
      if (e.type === "perfect") {
        const flash = Math.max(0, 1 - elapsed / 300);
        if (flash) {
          bx.save(); bx.globalAlpha = 0.58 * flash; bx.fillStyle = "#fff";
          bx.fillRect(0, 0, SIZE, SIZE); bx.restore();
          bx.save(); bx.globalAlpha = 0.22 * flash; bx.fillStyle = getTheme().accent;
          bx.fillRect(0, 0, SIZE, SIZE); bx.restore();
        }
        const t = elapsed / 1000;
        e.particles.forEach(k => {
          const x = k.x + k.vx * t, y = k.y + k.vy * t + 55 * t * t;
          const alpha = Math.max(0, 1 - t / 1.1);
          if (!alpha) return;
          bx.save(); bx.globalAlpha = alpha; bx.fillStyle = k.accent ? getTheme().accent : "#fff";
          if (k.sparkle) { bx.shadowColor = getTheme().accentSoft; bx.shadowBlur = 6; }
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
        if (p < 0) { cell(bx, x, y, CELL, getTheme().pieces[k.paletteIndex]); return; }
        const fill = Math.min(1, p / 0.3), fade = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
        cell(bx, x, y, CELL, getTheme().pieces[k.paletteIndex], fade);
        bx.globalCompositeOperation = "screen";
        bx.fillStyle = `rgba(${rgbOf(getTheme().glow)}, ${0.85 * fill * fade})`; bx.shadowColor = getTheme().glow; bx.shadowBlur = 14 * fade;
        bx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        bx.shadowBlur = 0; bx.globalCompositeOperation = "source-over";
      });
      const t = Math.max(0, elapsed / 1000);
      const sweep = (index, horizontal) => {
        const p = Math.min(1, Math.max(0, elapsed / 360));
        const pos = p * SIZE;
        bx.save(); bx.globalAlpha = 0.9 * (1 - p); bx.lineWidth = e.sweepWidth; bx.shadowBlur = 8;
        bx.shadowColor = "#fff";
        const theme = getTheme(), gradient = horizontal ? bx.createLinearGradient(pos - 28, 0, pos + 28, 0) : bx.createLinearGradient(0, pos - 28, 0, pos + 28);
        gradient.addColorStop(0, `rgba(${rgbOf(theme.sweepA)},0)`); gradient.addColorStop(0.25, theme.sweepA);
        gradient.addColorStop(0.5, "#fff"); gradient.addColorStop(0.75, theme.sweepB); gradient.addColorStop(1, `rgba(${rgbOf(theme.sweepB)},0)`);
        bx.strokeStyle = gradient; bx.beginPath();
        if (horizontal) { bx.moveTo(0, (index + 0.5) * CELL); bx.lineTo(SIZE, (index + 0.5) * CELL); }
        else { bx.moveTo((index + 0.5) * CELL, 0); bx.lineTo((index + 0.5) * CELL, SIZE); }
        bx.stroke(); bx.restore();
      };
      e.rows.forEach(row => sweep(row, true)); e.cols.forEach(col => sweep(col, false));
      e.particles.forEach(k => {
        const x = k.x + k.vx * t, y = k.y + k.vy * t + 90 * t * t, alpha = Math.max(0, 1 - t / 1.15);
        if (!alpha) return;
        const color = k.sparkle ? "#fff" : getTheme().pieces[k.paletteIndex];
        bx.save(); bx.globalAlpha = alpha; bx.fillStyle = color;
        bx.shadowColor = color; bx.shadowBlur = k.sparkle ? 5 : 1;
        if (k.sparkle) { bx.translate(x, y); bx.rotate(t * 4); bx.fillRect(-k.size / 2, -k.size / 2, k.size, k.size); bx.fillRect(-k.size, -1, k.size * 2, 2); }
        else bx.fillRect(x, y, k.size, k.size);
        bx.restore();
      });
      return alive || t < 1.15 || elapsed < 360;
    });
  }

  const TXT_DUR = 900;
  let txts = [];
  const TEXT_EDGE_PAD = 24;
  const TEXT_STACK_GAP = 8;
  function textDimensions(event, size) {
    bx.save();
    bx.font = event.kind === "combo" ? `italic 900 ${size}px sans-serif` : `900 ${size}px sans-serif`;
    const width = event.kind === "combo"
      ? bx.measureText("COMBO").width + 8 + bx.measureText(event.text).width
      : bx.measureText(event.text).width;
    const metrics = bx.measureText(event.kind === "combo" ? "COMBO" : event.text);
    const visualPadding = event.kind === "perfect" ? 24 : event.kind === "combo" ? 16 : event.kind === "praise" ? 12 : 14;
    const height = (metrics.actualBoundingBoxAscent || size * 0.8) +
      (metrics.actualBoundingBoxDescent || size * 0.25) + visualPadding * 2;
    bx.restore();
    return { width, height: Math.max(size, height) };
  }
  function layoutTextStack(events) {
    if (!events.length) return;
    const floatDistance = settings.reducedMotion ? 0 : 36;
    const availableWidth = SIZE - TEXT_EDGE_PAD * 2;
    const availableHeight = SIZE - TEXT_EDGE_PAD * 2 - floatDistance;
    const maxScale = event => event.kind === "combo" ? 1.23 : 1;
    for (const event of events) {
      const width = textDimensions(event, Math.round(event.size * maxScale(event))).width;
      if (width > availableWidth) event.size = Math.max(10, event.size * availableWidth / width);
    }
    const stackHeight = () => events.reduce((height, event) =>
      height + textDimensions(event, Math.round(event.size * maxScale(event))).height, 0) +
      TEXT_STACK_GAP * Math.max(0, events.length - 1);
    let height = stackHeight();
    while (height > availableHeight && events.some(event => event.size > 10)) {
      const scale = Math.max(0.5, availableHeight / height);
      events.forEach(event => { event.size = Math.max(10, event.size * scale); });
      height = stackHeight();
    }
    const finalHeight = stackHeight();
    let y = (SIZE - finalHeight) / 2 + floatDistance / 2;
    for (const event of events) {
      const dimensions = textDimensions(event, Math.round(event.size * maxScale(event)));
      event.x = SIZE / 2;
      event.y = y + dimensions.height / 2;
      event.floatDistance = floatDistance;
      y += dimensions.height + TEXT_STACK_GAP;
    }
  }
  function startText(res, gained, combo, clear, lines) {
    const t0 = performance.now(), dur = settings.reducedMotion ? 300 : TXT_DUR, theme = getTheme();
    const praise = lines >= 5 ? "Amazing" : lines === 4 ? "Excellent" : lines === 3 ? "Great" : lines === 2 ? "Good" : null;
    const events = [];
    if (clear) events.push({ t0, dur: settings.reducedMotion ? 450 : 1500, text: "PERFECT", size: 48, color: theme.accentSoft, glint: null, kind: "perfect" });
    if (praise) events.push({
      t0, dur: settings.reducedMotion ? 300 : 1100, text: praise,
      size: lines >= 5 ? 38 : lines === 4 ? 34 : lines === 3 ? 30 : 26,
      color: theme.accentSoft, glint: theme.glint, kind: "praise"
    });
    if (combo > 0) events.push({
      t0, dur: settings.reducedMotion ? 300 : 1250, text: String(combo),
      size: Math.min(42, 30 + combo * 2), color: theme.accent, glint: null, kind: "combo"
    });
    events.push({
      t0, dur, text: "+" + gained, size: 23,
      color: clear ? theme.glow : "#ffffff", glint: clear ? theme.glint : theme.glow,
      clear, kind: "points"
    });
    layoutTextStack(events);
    txts.push(...events);
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
      const float = (settings.reducedMotion ? 0 : e.floatDistance || 0) * p;
      const dimensions = textDimensions(e, Math.round(e.size * grow));
      const halfWidth = Math.min(dimensions.width, SIZE - TEXT_EDGE_PAD * 2) / 2;
      const x = Math.max(TEXT_EDGE_PAD + halfWidth, Math.min(SIZE - TEXT_EDGE_PAD - halfWidth, e.x));
      const halfHeight = dimensions.height / 2;
      const y = Math.max(TEXT_EDGE_PAD + halfHeight, Math.min(SIZE - TEXT_EDGE_PAD - halfHeight, e.y - float));
      const w = dimensions.width;
      if (e.kind === "combo") {
        const label = "COMBO", number = e.text, gap = 8, labelW = bx.measureText(label).width, numberW = bx.measureText(number).width;
        const total = labelW + gap + numberW, start = x - total / 2;
        const theme = getTheme();
        bx.shadowColor = theme.accent; bx.shadowBlur = 12; bx.strokeStyle = "#fff";
        bx.strokeText(label, start + labelW / 2, y); bx.fillStyle = theme.accentSoft; bx.fillText(label, start + labelW / 2, y);
        bx.strokeText(number, start + labelW + gap + numberW / 2, y); bx.fillStyle = comboColor(Number(e.text)); bx.fillText(number, start + labelW + gap + numberW / 2, y);
        bx.restore(); return true;
      }
      const theme = getTheme();
      const textColor = e.kind === "perfect" || e.kind === "praise" ? theme.accentSoft :
        e.kind === "points" && e.clear ? theme.glow : e.color;
      const glintColor = e.kind === "perfect" || e.kind === "praise" || e.kind === "points" ? theme.glint : e.glint;
      let fill = textColor;
      if (glintColor && p < 0.5) {
        const s = -0.2 + 1.4 * (p / 0.5), cl = v => Math.max(0, Math.min(1, v));
        const g = bx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, textColor); g.addColorStop(cl(s - 0.2), textColor); g.addColorStop(cl(s), glintColor); g.addColorStop(cl(s + 0.2), textColor); g.addColorStop(1, textColor);
        fill = g;
      }
      bx.strokeStyle = "rgba(10, 16, 40, 0.85)"; bx.strokeText(e.text, x, y);
      bx.shadowColor = textColor; bx.shadowBlur = e.kind === "perfect" ? 20 : e.kind === "praise" ? 8 : 10;
      bx.fillStyle = fill; bx.fillText(e.text, x, y);
      bx.restore();
      return true;
    });
  }
  function comboColor(combo) {
    return getTheme().accent;
  }
