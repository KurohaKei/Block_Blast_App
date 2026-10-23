  const SHOW_STREAK_TEXT = false;
  const make = (tag, style, text) => { const e = document.createElement(tag); e.style.cssText = style; if (text) e.textContent = text; return e; };
  document.body.style.cssText = "margin:0;background:var(--page-background,#3b578e);overscroll-behavior:none;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;";
  const page = make("div", "width:min(calc(94vw - 14px),506px,max(166px,calc(72.73vh - 115px)));width:min(calc(94vw - 14px),506px,max(166px,calc(72.73svh - 115px)));width:min(calc(94vw - 14px),506px,max(166px,calc(72.73dvh - 115px)));height:100vh;height:100svh;height:100dvh;min-height:0;margin:auto;padding:calc(10px + env(safe-area-inset-top)) 0 calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-rows:auto minmax(0,1fr);justify-items:center;align-items:center;font-family:sans-serif;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;");
  document.body.appendChild(page);
  const bar = make("div", "width:100%;flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:22px;");
  const bestEl = make("div", "display:flex;align-items:center;gap:7px;color:var(--accent);");
  const headerControls = make("div", "display:flex;align-items:center;gap:6px;");
  const updateButton = make("button", "", "");
  updateButton.className = "icon-button update-button";
  updateButton.type = "button";
  updateButton.setAttribute("aria-label", "Install or update app");
  updateButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v7"/><path d="M8.5 11.5L12 15l3.5-3.5"/><path d="M8 17.5h8"/></svg>';
  const gear = make("button", "font-size:26px;background:none;border:none;color:var(--gear);cursor:pointer;", "\u2699");
  gear.className = "icon-button settings-button";
  gear.setAttribute("aria-label", "Settings");
  const updateStatus = make("div", "", "");
  updateStatus.className = "update-status";
  updateStatus.setAttribute("role", "status");
  updateStatus.setAttribute("aria-live", "polite");
  updateStatus.hidden = true;
  const scoreWrap = make("div", "position:relative;flex:0 0 auto;min-height:clamp(54px,12vh,78px);display:grid;place-items:center;isolation:isolate;");
  const gemEl = make("div", "position:absolute;z-index:-1;width:62px;height:62px;background:var(--gem);clip-path:polygon(50% 0,94% 28%,78% 88%,50% 100%,22% 88%,6% 28%);opacity:.35;filter:drop-shadow(0 0 14px currentColor);");
  gemEl.className = "score-gem";
  const scoreEl = make("div", "position:relative;font-size:clamp(42px,12vw,62px);line-height:1;font-weight:800;font-variant-numeric:tabular-nums;text-shadow:0 2px 8px rgba(0,0,0,.24);");
  const infoEl = SHOW_STREAK_TEXT ? make("div", "flex:0 0 auto;font-size:14px;color:var(--info-text);height:18px;") : null;
  scoreWrap.append(gemEl, scoreEl);
  headerControls.append(updateButton, gear);
  bar.append(bestEl, headerControls);
  const boardCv = make("canvas", "width:100%;height:auto;aspect-ratio:1;border-radius:14px;background:var(--board-bg);touch-action:none;");
  boardCv.className = "board";
  const trayCv = make("canvas", "width:100%;height:auto;flex:0 0 auto;aspect-ratio:8/3;touch-action:none;");
  const topPanel = make("div", "width:100%;display:flex;flex-direction:column;gap:4px;align-self:start;");
  topPanel.append(bar, updateStatus, scoreWrap);
  if (SHOW_STREAK_TEXT) topPanel.append(infoEl);
  const playArea = make("div", "width:100%;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transform:translateY(-min(12.5vw,63.25px));");
  playArea.append(boardCv, trayCv);
  page.append(topPanel, playArea);
  const bx = boardCv.getContext("2d"), tx = trayCv.getContext("2d");
  function resizeCanvas(canvas, logicalW, logicalH) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(logicalW * dpr); canvas.height = Math.round(logicalH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function resizeCanvases() {
    resizeCanvas(boardCv, SIZE, SIZE); resizeCanvas(trayCv, SIZE, TRAY_H);
    if (ghost) resizeGhost();
    render();
  }
  const scale = () => boardCv.getBoundingClientRect().width / SIZE;
  let displayedScore = 0, scoreTarget = 0, scoreFrom = 0, scoreStart = 0, scoreRaf = 0;
  function animateScore(value) {
    if (settings.reducedMotion) {
      scoreTarget = value; displayedScore = value; scoreEl.textContent = String(value);
      cancelAnimationFrame(scoreRaf); scoreRaf = 0; gemEl.classList.remove("pulse"); return;
    }
    if (scoreTarget === value && scoreEl.textContent) return;
    scoreTarget = value;
    gemEl.classList.remove("pulse");
    void gemEl.offsetWidth;
    gemEl.classList.add("pulse");
    const milestone = Math.floor(value / 1000);
    gemEl.classList.toggle("milestone", milestone % 2 === 1);
    scoreFrom = displayedScore; scoreStart = performance.now();
    cancelAnimationFrame(scoreRaf);
    const tick = now => {
      const p = Math.min(1, (now - scoreStart) / 300);
      displayedScore = Math.round(scoreFrom + (scoreTarget - scoreFrom) * (1 - Math.pow(1 - p, 3)));
      scoreEl.textContent = String(displayedScore);
      if (p < 1) scoreRaf = requestAnimationFrame(tick);
      else { displayedScore = scoreTarget; scoreRaf = 0; }
    };
    scoreRaf = requestAnimationFrame(tick);
  }

 
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`; };
  const glossyTiles = new WeakMap();
  function glossyTile(g, size) {
    let cache = glossyTiles.get(g);
    if (!cache) { cache = new Map(); glossyTiles.set(g, cache); }
    const key = Math.ceil(size);
    if (cache.has(key)) return cache.get(key);
    const tile = document.createElement("canvas");
    tile.width = tile.height = key;
    const ctx = tile.getContext("2d"), gradient = ctx.createLinearGradient(0, 0, key * 0.55, key * 0.55);
    gradient.addColorStop(0, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, key, key);
    cache.set(key, tile);
    return tile;
  }
  function cell(g, x, y, size, color, alpha = 1) {
    const x0 = x + 1, y0 = y + 1, s = size - 2, b = Math.max(2, s * 0.14);
    const face = (c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fill(); };
    g.globalAlpha = alpha;
    face(shade(color, 70), [[x0, y0], [x0 + s, y0], [x0 + s - b, y0 + b], [x0 + b, y0 + b]]);
    face(shade(color, 35), [[x0, y0], [x0 + b, y0 + b], [x0 + b, y0 + s - b], [x0, y0 + s]]);
    face(shade(color, -35), [[x0 + s, y0], [x0 + s, y0 + s], [x0 + s - b, y0 + s - b], [x0 + s - b, y0 + b]]);
    face(shade(color, -70), [[x0, y0 + s], [x0 + b, y0 + s - b], [x0 + s - b, y0 + s - b], [x0 + s, y0 + s]]);
    const faceX = x0 + b, faceY = y0 + b, faceSize = s - 2 * b;
    g.fillStyle = color; g.fillRect(faceX, faceY, faceSize, faceSize);
    g.drawImage(glossyTile(g, size), faceX, faceY, faceSize, faceSize);
    g.globalAlpha = 1;
  }
  function drawPiece(g, s, x, y, size, alpha = 1) {
    s.cells.forEach(([r, c]) => cell(g, x + c * size, y + r * size, size, s.color, alpha));
  }
  const target = () => {
    if (drag.keyboard) return { r: drag.r, c: drag.c };
    const s = pieces[drag.i], b = boardCv.getBoundingClientRect(), sc = scale();
    return { r: Math.round(((drag.y - LIFT * sc - b.top - boardCv.clientTop) / sc - (s.h * CELL) / 2) / CELL), c: Math.round(((drag.x - b.left - boardCv.clientLeft) / sc - (s.w * CELL) / 2) / CELL) };
  };

  const R = [...Array(N).keys()];
  function previewLines(s, r, c) {
    const filled = (y, x) => board[y][x] || s.cells.some(([dr, dc]) => r + dr === y && c + dc === x);
    return { rows: R.filter(y => R.every(x => filled(y, x))), cols: R.filter(x => R.every(y => filled(y, x))) };
  }

  function render() {
    const activeTheme = getTheme();
    applyThemeVariables(activeTheme);
    setShapePalette(activeTheme.pieces);
    resetThemeButton.disabled = activeTheme.id === DEFAULT_THEME.id;
    bestEl.textContent = "\uD83D\uDC51 " + shownBest;
    gemEl.hidden = streak < 1;
    const comboTier = comboTierFor(streak);
    boardCv.classList.toggle("combo-active", streak > 0);
    boardCv.dataset.comboTier = String(comboTier);
    if (SHOW_STREAK_TEXT) infoEl.textContent = streak ? `MULTIPLIER x${1 + streak}  \u00B7  ${popped ? "SET SAFE" : "POP THIS SET"}` : "";
    if (displayedScore !== score || !scoreEl.textContent) animateScore(score);
    bx.clearRect(0, 0, SIZE, SIZE); bx.fillStyle = activeTheme.boardBg; bx.fillRect(0, 0, SIZE, SIZE);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const value = board[r][c];
      if (value) {
        const paletteIndex = typeof value === "number" ? value - 1 : paletteIndexForColor(value);
        if (paletteIndex >= 0 && paletteIndex < activeTheme.pieces.length) {
          if (typeof value === "string") board[r][c] = paletteIndex + 1;
          cell(bx, c * CELL, r * CELL, CELL, activeTheme.pieces[paletteIndex]);
        } else {
          console.warn("Displaying an unsupported saved board color with the fallback palette:", value);
          cell(bx, c * CELL, r * CELL, CELL, activeTheme.pieces[0]);
        }
      } else {
        bx.fillStyle = activeTheme.emptyCell; bx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
        bx.strokeStyle = activeTheme.emptyStroke; bx.lineWidth = 0.7; bx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
    }
    if (drag) {
      const s = pieces[drag.i], { r, c } = target();
      if (canPlace(board, s, r, c)) {
        const pop = previewLines(s, r, c), isPop = (y, x) => pop.rows.includes(y) || pop.cols.includes(x);
        s.cells.forEach(([dr, dc]) => cell(bx, (c + dc) * CELL, (r + dr) * CELL, CELL, s.color, isPop(r + dr, c + dc) ? 1 : 0.7));
        if (pop.rows.length + pop.cols.length) {
          const t = settings.reducedMotion ? 0 : performance.now() / 1000, gc = rgbOf(activeTheme.glow);
          const glow = (y, x, k) => {
            const wave = settings.reducedMotion ? 0.5 : Math.pow(0.5 + 0.5 * Math.sin(k * 0.9 - t * 7), 3);
            bx.fillStyle = `rgba(${gc}, ${0.16 + 0.4 * wave})`; bx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
          };
          bx.globalCompositeOperation = "screen";
          pop.rows.forEach(y => R.forEach(x => glow(y, x, x)));
          pop.cols.forEach(x => R.forEach(y => glow(y, x, y)));
          bx.globalCompositeOperation = "source-over";
          bx.strokeStyle = `rgba(${gc}, ${settings.reducedMotion ? 0.8 : 0.7 + 0.3 * Math.sin(t * 6)})`; bx.lineWidth = 2; bx.shadowColor = `rgb(${gc})`; bx.shadowBlur = 10;
          pop.rows.forEach(y => bx.strokeRect(1, y * CELL + 1, SIZE - 2, CELL - 2));
          pop.cols.forEach(x => bx.strokeRect(x * CELL + 1, 1, CELL - 2, SIZE - 2));
          bx.shadowBlur = 0;
        }
      } else {
        bx.save(); bx.fillStyle = `rgba(${rgbOf(activeTheme.dangerBg)}, 0.18)`; bx.strokeStyle = `rgba(${rgbOf(activeTheme.dangerBg)}, 0.75)`;
        s.cells.forEach(([dr, dc]) => {
          const y = r + dr, x = c + dc;
          if (y < 0 || y >= N || x < 0 || x >= N) return;
          bx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
          bx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        });
        bx.restore();
      }
    }
    drawFx();
    drawTxt();
    tx.clearRect(0, 0, SIZE, TRAY_H);
    const dealElapsed = trayDealAt ? performance.now() - trayDealAt : Infinity;
    pieces.forEach((s, i) => {
      if (!s || (drag && !drag.keyboard && drag.i === i)) return;
      const size = Math.min(28, 96 / Math.max(s.w, s.h));
      const progress = settings.reducedMotion ? 1 : Math.max(0, Math.min(1, (dealElapsed - i * 60) / 250));
      const eased = 1 - Math.pow(1 - progress, 3);
      const fitAlpha = fits(board, s) ? 1 : 0.3;
      tx.save(); tx.translate(0, -20 * (1 - eased));
      drawPiece(tx, s, (i + 0.5) * SIZE / 3 - (s.w * size) / 2, TRAY_H / 2 - (s.h * size) / 2, size, fitAlpha * eased);
      tx.restore();
      if (drag && drag.keyboard && drag.i === i) { tx.strokeStyle = "#fff"; tx.lineWidth = 2; tx.strokeRect(i * SIZE / 3 + 2, 2, SIZE / 3 - 4, TRAY_H - 4); }
    });
  }

  resizeCanvas(boardCv, SIZE, SIZE);
  resizeCanvas(trayCv, SIZE, TRAY_H);
