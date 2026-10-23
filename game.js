  function loadBest() {
    const saved = Number(localGet("bb_best"));
    return Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
  }
  let board, pieces, score, best = loadBest(), bestAtStart = best, shownBest = best, streak, popped, over, drag = null, ghost = null, stash = null, sets = 0;
  let raf = 0, generationTimer = 0, generationPending = false;

  const loop = () => { render(); raf = (drag || fx.length || txts.length) ? requestAnimationFrame(loop) : 0; };
  function resizeGhost() {
    if (!ghost || !drag || drag.keyboard) return;
    const s = pieces[drag.i], sc = scale(), w = s.w * CELL * sc, h = s.h * CELL * sc;
    resizeCanvas(ghost, s.w * CELL, s.h * CELL);
    ghost.style.width = w + "px"; ghost.style.height = h + "px";
    ghost.style.left = drag.x - w / 2 + "px"; ghost.style.top = drag.y - LIFT * sc - h / 2 + "px";
    drawPiece(ghost.getContext("2d"), s, 0, 0, CELL);
  }
  const moveGhost = () => resizeGhost();
  function endDrag(drop) {
    if (!drag || drag.keyboard) return;
    const { r, c } = target(), i = drag.i;
    drag = null; ghost.remove(); ghost = null;
    if (drop && !settingsOpen && canPlace(board, pieces[i], r, c)) place(i, r, c);
    render(); if (!raf) loop();
  }
  function finishGame() {
    if (over) return;
    over = true; generationPending = false; shownBest = best; clearSave();
    audioGameOver(); vibrate([60, 40, 60, 40, 120]);
    showGameOver(); render();
  }
  function checkGameOver() {
    if (!generationPending && pieces.every(piece => !piece || !fits(board, piece))) finishGame();
  }
  function generateNextSet() {
    generationPending = true;
    generationTimer = setTimeout(() => {
      generationTimer = 0;
      if (!generationPending || over) return;
      pieces = generatePieces(board);
      generationPending = false;
      checkGameOver();
      if (!over) saveGame();
      render(); if (!raf) loop();
    }, 0);
  }
  function reset() {
    clearTimeout(generationTimer); generationTimer = 0; generationPending = false;
    hideGameOver(); clearSave();
    board = emptyBoard(); score = 0; bestAtStart = best; shownBest = best; streak = 0; popped = false; over = false;
    drag = null; fx = []; txts = []; helpStreak = 0; stash = null; sets = 0;
    if (ghost) { ghost.remove(); ghost = null; }
    pieces = generatePieces(board);
    render();
  }
  function place(i, r, c) {
    if (over || generationPending || !pieces[i] || !canPlace(board, pieces[i], r, c)) return;
    const s = pieces[i], mult = 1 + streak;
    const res = applyMove(board, s, r, c);
    board = res.board;
    if (res.lines > 0) startFx(res);
    const linePoints = (10 + 5 * Math.floor(mult / 5)) * mult;
    const clear = isEmpty(board);
    const popPoints = res.lines * linePoints * (clear ? 2 : 1);
    score += s.cells.length + popPoints;
    if (res.lines > 0) { streak++; popped = true; }
    if (res.lines > 0) startText(res, popPoints, mult >= 2 ? streak : 0, clear);
    feedbackPlace(res.lines);
    pieces[i] = null;
    if (score > best) { best = score; localSet("bb_best", best); }
    if (pieces.every(piece => !piece)) {
      if (!popped) streak = 0;
      popped = false;
      generationPending = true;
      saveGame(); render(); if (!raf) loop();
      generateNextSet();
      return;
    }
    checkGameOver();
    if (!over) saveGame();
    render(); if (!raf) loop();
  }
  trayCv.onpointerdown = e => {
    if (over || settingsOpen || !startOverlay.hidden || generationPending) return;
    const sc = trayCv.getBoundingClientRect().width / SIZE, i = Math.min(2, Math.floor(((e.clientX - trayCv.getBoundingClientRect().left) / sc) / (SIZE / 3)));
    if (!pieces[i]) return;
    unlockAudio(); audioPick();
    if (ghost) ghost.remove();
    drag = { i, x: e.clientX, y: e.clientY };
    ghost = make("canvas", "position:fixed;pointer-events:none;filter:drop-shadow(0 5px 7px rgba(0,0,0,.45));transform:scale(1.05);transform-origin:center;max-width:none;");
    document.body.appendChild(ghost); resizeGhost();
    trayCv.setPointerCapture(e.pointerId); cancelAnimationFrame(raf); loop();
  };
  trayCv.onpointermove = e => { if (!drag || drag.keyboard) return; drag.x = e.clientX; drag.y = e.clientY; moveGhost(); };
  trayCv.onpointerup = () => endDrag(true);
  trayCv.onpointercancel = () => endDrag(false);
  gear.setAttribute("aria-haspopup", "dialog");

  document.addEventListener("keydown", e => {
    if (settingsOpen || over || !startOverlay.hidden) return;
    if (generationPending) return;
    if (["1", "2", "3"].includes(e.key)) {
      const i = Number(e.key) - 1;
      if (!pieces[i]) return;
      e.preventDefault(); unlockAudio(); audioPick();
      if (ghost) { ghost.remove(); ghost = null; }
      const s = pieces[i];
      drag = { i, keyboard: true, r: Math.floor((N - s.h) / 2), c: Math.floor((N - s.w) / 2) };
      render(); if (!raf) loop(); return;
    }
    if (drag && drag.keyboard && e.key.startsWith("Arrow")) {
      e.preventDefault();
      if (e.key === "ArrowUp") drag.r--;
      if (e.key === "ArrowDown") drag.r++;
      if (e.key === "ArrowLeft") drag.c--;
      if (e.key === "ArrowRight") drag.c++;
      render(); if (!raf) loop(); return;
    }
    if (drag && drag.keyboard && (e.key === " " || e.key === "Enter")) {
      e.preventDefault(); const { r, c } = target(), i = drag.i;
      if (canPlace(board, pieces[i], r, c)) { drag = null; place(i, r, c); }
      return;
    }
    if (drag && drag.keyboard && e.key === "Escape") { e.preventDefault(); drag = null; render(); return; }
  });
  function restorePendingSet() {
    if (!pieces.every(piece => !piece) || over) return;
    generationPending = true;
    generateNextSet();
  }
  window.addEventListener("resize", resizeCanvases);
  window.addEventListener("orientationchange", resizeCanvases);
  const savedGameAvailable = restoreGame();
  shownBest = best;
  if (savedGameAvailable) restorePendingSet();
  else {
    board = emptyBoard(); score = 0; bestAtStart = best; streak = 0; popped = false; over = false;
    pieces = []; stash = null; sets = 0;
  }
  render();
  showStartScreen(savedGameAvailable);
  if (location.protocol === "http:" || location.protocol === "https:") {
    try {
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(error => console.error("Service worker registration failed:", error));
    } catch (error) { console.error("Service worker registration failed:", error); }
  }
