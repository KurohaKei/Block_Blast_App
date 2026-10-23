  function loadBest() {
    const saved = Number(localGet("bb_best"));
    return Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
  }
  let board, pieces, score, best = loadBest(), bestAtStart = best, shownBest = best, streak, popped, over, drag = null, ghost = null, stash = null, sets = 0;
  let raf = 0, generationTimer = 0, generationPending = false, trayDealAt = 0;
  let updateStatusTimer = 0, updateReloadPending = false, updateReloadStarted = false, updateInProgress = false;
  const UPDATE_RELOAD_KEY = "bb_update_reload";

  try { sessionStorage.removeItem(UPDATE_RELOAD_KEY); } catch (error) {}
  function showUpdateStatus(message, persistent = false) {
    clearTimeout(updateStatusTimer);
    updateStatus.textContent = message;
    updateStatus.hidden = false;
    if (settings.reducedMotion) updateStatus.classList.add("visible");
    else requestAnimationFrame(() => updateStatus.classList.add("visible"));
    if (!persistent) updateStatusTimer = setTimeout(() => {
      updateStatus.classList.remove("visible");
      setTimeout(() => { updateStatus.hidden = true; }, settings.reducedMotion ? 0 : 180);
    }, 2500);
  }
  function finishDeferredUpdateReload() {
    if (!updateReloadPending || drag || updateReloadStarted) return;
    updateReloadPending = false;
    updateInProgress = false;
    updateReloadStarted = true;
    saveGame();
    try { sessionStorage.setItem(UPDATE_RELOAD_KEY, "true"); } catch (error) {}
    location.reload();
  }
  function waitForInstalledWorker(registration) {
    let cancelWait;
    const promise = new Promise(resolve => {
      let finished = false;
      const monitored = new Map();
      const timeout = setTimeout(() => finish(registration.waiting || null), 20000);
      const finish = worker => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        registration.removeEventListener("updatefound", onUpdateFound);
        monitored.forEach((check, observed) => observed.removeEventListener("statechange", check));
        resolve(worker);
      };
      const observe = worker => {
        if (!worker || monitored.has(worker)) return;
        const check = () => {
          if (worker.state === "installed" && worker !== registration.active) finish(registration.waiting || worker);
          else if (worker.state === "redundant") finish(registration.waiting || null);
        };
        monitored.set(worker, check);
        worker.addEventListener("statechange", check);
        check();
      };
      const onUpdateFound = () => observe(registration.installing);
      registration.addEventListener("updatefound", onUpdateFound);
      observe(registration.installing);
      if (registration.waiting) finish(registration.waiting);
      cancelWait = () => finish(null);
    });
    return { promise, cancel: () => cancelWait && cancelWait() };
  }
  async function checkForUpdates() {
    if (updateButton.disabled) return;
    updateButton.disabled = true;
    updateButton.classList.add("checking");
    showUpdateStatus("Checking\u2026");
    try {
      if (location.protocol === "file:" || !isSecureContext || !("serviceWorker" in navigator)) {
        showUpdateStatus("Updates aren\u2019t available here");
        return;
      }
      if (navigator.onLine === false) {
        showUpdateStatus("No internet connection");
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      let response;
      try {
        const checkUrl = new URL("sw.js", location.href);
        checkUrl.searchParams.set("update-check", String(Date.now()));
        response = await fetch(checkUrl, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      } catch (error) {
        showUpdateStatus("No internet connection");
        return;
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        showUpdateStatus("No internet connection");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        showUpdateStatus("Updates aren\u2019t available here");
        return;
      }
      let worker = registration.waiting;
      if (!worker) {
        const installedWorker = waitForInstalledWorker(registration);
        try {
          await registration.update();
          await Promise.resolve();
          worker = registration.waiting || (registration.installing ? await installedWorker.promise : null);
        } finally {
          if (!worker) installedWorker.cancel();
        }
      }
      if (!worker) {
        showUpdateStatus("You\u2019re up to date");
        return;
      }

      showUpdateStatus("Updating\u2026", true);
      saveGame();
      updateReloadPending = false;
      updateReloadStarted = false;
      updateInProgress = true;
      let controllerChangeReceived = false;
      const onControllerChange = () => {
        controllerChangeReceived = true;
        updateReloadPending = true;
        finishDeferredUpdateReload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
      worker.postMessage({ type: "SKIP_WAITING" });
      setTimeout(() => {
        if (updateReloadStarted || controllerChangeReceived) return;
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        updateInProgress = false;
        updateButton.disabled = false;
        updateButton.classList.remove("checking");
        showUpdateStatus("Updates aren\u2019t available here");
      }, 15000);
      return;
    } catch (error) {
      console.warn("Unable to check for app updates:", error);
      updateInProgress = false;
      showUpdateStatus("Updates aren\u2019t available here");
    } finally {
      updateButton.classList.remove("checking");
      if (!updateInProgress) updateButton.disabled = false;
    }
  }
  updateButton.addEventListener("click", checkForUpdates);

  const loop = () => {
    render();
    const dealActive = !settings.reducedMotion && trayDealAt && performance.now() - trayDealAt < 370;
    raf = (drag || fx.length || txts.length || dealActive || themeTransitioning()) ? requestAnimationFrame(loop) : 0;
  };
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
    finishDeferredUpdateReload();
  }
  function finishGame() {
    if (over) return;
    over = true; generationPending = false; shownBest = best; clearSave();
    audioGameOver(); vibrate([60, 40, 60, 40, 120]);
    startGameOverWave();
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
      trayDealAt = performance.now();
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
    drag = null; fx = []; txts = []; helpStreak = 0; stash = null; sets = 0; trayDealAt = 0;
    if (ghost) { ghost.remove(); ghost = null; }
    pieces = generatePieces(board);
    trayDealAt = performance.now();
    render();
    if (!raf) loop();
  }
  function place(i, r, c) {
    if (over || generationPending || !pieces[i] || !canPlace(board, pieces[i], r, c)) return;
    const s = pieces[i], mult = 1 + streak;
    const res = applyMove(board, s, r, c);
    board = res.board;
    startPlacementFx(s, r, c, res);
    const clear = isEmpty(board);
    const linePoints = (10 + 5 * Math.floor(mult / 5)) * mult;
    const popPoints = res.lines * linePoints * (clear ? 2 : 1);
    score += s.cells.length + popPoints;
    if (res.lines > 0) { streak++; popped = true; startFx(res, comboTierFor(streak), streak, clear); }
    if (clear) { startPerfectFx(); nextTheme(); }
    if (res.lines > 0) startText(res, popPoints, mult >= 2 ? streak : 0, clear, res.lines);
    feedbackPlace(res.lines, streak, clear);
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
    if (e.isPrimary === false || e.button !== 0 || over || settingsOpen || !startOverlay.hidden || generationPending) return;
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
  trayCv.onlostpointercapture = () => endDrag(false);
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
      finishDeferredUpdateReload();
      return;
    }
    if (drag && drag.keyboard && e.key === "Escape") { e.preventDefault(); drag = null; render(); finishDeferredUpdateReload(); return; }
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
