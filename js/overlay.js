  let settingsOpen = false;
  let gameOverTimer = 0, gameOverButtonTimer = 0, scoreCountFrame = 0;
  const settingsOverlay = make("div", "", "");
  settingsOverlay.className = "modal-backdrop";
  settingsOverlay.hidden = true;
  const settingsDialog = make("section", "", "");
  settingsDialog.className = "dialog settings-dialog";
  settingsDialog.setAttribute("role", "dialog"); settingsDialog.setAttribute("aria-modal", "true"); settingsDialog.setAttribute("aria-labelledby", "settings-title");
  const settingsTitle = make("h2", "", "Settings"); settingsTitle.id = "settings-title";
  const settingsBody = make("div", "", "");
  const soundToggle = make("input", "", ""); soundToggle.type = "checkbox"; soundToggle.id = "sound-toggle";
  const vibrationToggle = make("input", "", ""); vibrationToggle.type = "checkbox"; vibrationToggle.id = "vibration-toggle";
  const motionToggle = make("input", "", ""); motionToggle.type = "checkbox"; motionToggle.id = "motion-toggle";
  const fingerSensitivitySelect = make("select", "", "");
  fingerSensitivitySelect.id = "finger-sensitivity";
  [[1, "Normal (1.0x)"], [1.25, "Faster (1.25x)"], [1.5, "Fast (1.5x)"], [1.75, "Fastest (1.75x)"]].forEach(([value, label]) => {
    const option = make("option", "", label); option.value = String(value); fingerSensitivitySelect.appendChild(option);
  });
  const fingerSensitivityLabel = make("label", "", "Finger drag sensitivity"); fingerSensitivityLabel.className = "setting-select-row"; fingerSensitivityLabel.htmlFor = fingerSensitivitySelect.id; fingerSensitivityLabel.appendChild(fingerSensitivitySelect);
  const settingRow = (input, text) => { const label = make("label", "", text); label.className = "setting-row"; label.htmlFor = input.id; label.prepend(input); return label; };
  const resetThemeButton = make("button", "", "Reset to Default Theme"); resetThemeButton.className = "dialog-button";
  const restartButton = make("button", "", "Restart Game"); restartButton.className = "dialog-button";
  const restartConfirm = make("div", "", ""); restartConfirm.className = "restart-confirm"; restartConfirm.hidden = true;
  const restartQuestion = make("p", "", "Restart this game? Your current progress will be lost.");
  const restartYes = make("button", "", "Restart"); restartYes.className = "dialog-button danger-button";
  const restartNo = make("button", "", "Cancel"); restartNo.className = "dialog-button";
  const settingsClose = make("button", "", "Close"); settingsClose.className = "dialog-button";
  restartConfirm.append(restartQuestion, restartYes, restartNo);
  settingsBody.append(settingRow(soundToggle, "Sound"), settingRow(vibrationToggle, "Vibration"), settingRow(motionToggle, "Reduced motion"), fingerSensitivityLabel, resetThemeButton, restartButton, restartConfirm, settingsClose);
  settingsDialog.append(settingsTitle, settingsBody); settingsOverlay.appendChild(settingsDialog); document.body.appendChild(settingsOverlay);

  const startOverlay = make("div", "", "");
  startOverlay.className = "start-screen";
  startOverlay.hidden = true;
  startOverlay.setAttribute("role", "dialog"); startOverlay.setAttribute("aria-modal", "true"); startOverlay.setAttribute("aria-labelledby", "start-title");
  const fallingPieces = make("div", "", ""); fallingPieces.className = "falling-pieces"; fallingPieces.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 7; i++) {
    const piece = make("span", "", "");
    piece.className = `fall-piece fall-piece-${i + 1}`;
    piece.innerHTML = "<i></i><i></i><i></i>";
    fallingPieces.appendChild(piece);
  }
  const startContent = make("div", "", ""); startContent.className = "start-content";
  const startTitle = make("h1", "", "BLOCK BLAST"); startTitle.id = "start-title";
  const startButtons = make("div", "", ""); startButtons.className = "start-buttons";
  const playButton = make("button", "", "Play"); playButton.className = "dialog-button start-button";
  const continueButton = make("button", "", "Continue"); continueButton.className = "dialog-button start-button";
  const newGameButton = make("button", "", "New Game"); newGameButton.className = "dialog-button start-button";
  startButtons.append(playButton, continueButton, newGameButton);
  startContent.append(startTitle, startButtons);
  startOverlay.append(fallingPieces, startContent); document.body.appendChild(startOverlay);

  const gameOverOverlay = make("div", "", "");
  gameOverOverlay.className = "game-over-screen"; gameOverOverlay.hidden = true;
  gameOverOverlay.setAttribute("role", "dialog"); gameOverOverlay.setAttribute("aria-modal", "true"); gameOverOverlay.setAttribute("aria-labelledby", "game-over-title");
  const gameOverContent = make("section", "", ""); gameOverContent.className = "game-over-content";
  const gameOverTitle = make("h1", "", "GAME OVER"); gameOverTitle.id = "game-over-title";
  const scoreLabel = make("div", "", "SCORE"); scoreLabel.className = "score-label";
  const finalScore = make("div", "", "0"); finalScore.className = "final-score";
  const bestLabel = make("div", "", ""); bestLabel.className = "final-best";
  const newHighScore = make("div", "", "NEW HIGH SCORE!"); newHighScore.className = "new-high-score"; newHighScore.hidden = true;
  const sparkleField = make("div", "", ""); sparkleField.className = "sparkle-field"; sparkleField.setAttribute("aria-hidden", "true");
  const playAgain = make("button", "", "Play Again"); playAgain.className = "dialog-button play-again";
  gameOverContent.append(gameOverTitle, scoreLabel, finalScore, bestLabel, newHighScore, sparkleField, playAgain);
  gameOverOverlay.appendChild(gameOverContent); document.body.appendChild(gameOverOverlay);

  function syncSettings() {
    soundToggle.checked = settings.sound; vibrationToggle.checked = settings.vibration; motionToggle.checked = settings.reducedMotion;
    fingerSensitivitySelect.value = String(settings.fingerSensitivity);
    document.body.classList.toggle("reduced-motion", settings.reducedMotion);
    resetThemeButton.disabled = getTheme().id === DEFAULT_THEME.id;
  }
  function openSettings() {
    if (over || startOverlay.hidden === false) return;
    settingsOpen = true; syncSettings(); restartConfirm.hidden = true;
    settingsOverlay.hidden = false; settingsClose.focus();
  }
  function closeSettings() {
    settingsOpen = false; settingsOverlay.hidden = true; gear.focus();
  }
  gear.onclick = openSettings;
  settingsClose.onclick = closeSettings;
  settingsOverlay.addEventListener("click", e => { if (e.target === settingsOverlay) closeSettings(); });
  [soundToggle, vibrationToggle, motionToggle].forEach(input => input.addEventListener("change", () => {
    settings.sound = soundToggle.checked; settings.vibration = vibrationToggle.checked; settings.reducedMotion = motionToggle.checked;
    saveSettings(); syncSettings(); render();
  }));
  fingerSensitivitySelect.addEventListener("change", () => {
    settings.fingerSensitivity = Number(fingerSensitivitySelect.value);
    saveSettings();
  });
  resetThemeButton.onclick = () => {
    resetTheme();
    render();
    if (!raf) loop();
  };
  restartButton.onclick = () => { restartConfirm.hidden = false; restartYes.focus(); };
  restartNo.onclick = () => { restartConfirm.hidden = true; restartButton.focus(); };
  restartYes.onclick = () => { closeSettings(); reset(); };
  function hideGameOver() {
    clearTimeout(gameOverTimer); clearTimeout(gameOverButtonTimer); cancelAnimationFrame(scoreCountFrame);
    gameOverTimer = 0; gameOverButtonTimer = 0; scoreCountFrame = 0; gameOverOverlay.hidden = true;
    sparkleField.replaceChildren();
  }
  function countFinalScore() {
    if (settings.reducedMotion) { finalScore.textContent = String(score); return; }
    const from = 0, to = score, started = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - started) / 1000);
      finalScore.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) scoreCountFrame = requestAnimationFrame(tick);
      else scoreCountFrame = 0;
    };
    scoreCountFrame = requestAnimationFrame(tick);
  }
  function showGameOver() {
    clearTimeout(gameOverTimer); clearTimeout(gameOverButtonTimer);
    gameOverTimer = setTimeout(() => {
      scoreLabel.textContent = "SCORE";
      finalScore.textContent = settings.reducedMotion ? String(score) : "0";
      bestLabel.textContent = "\uD83D\uDC51  BEST  " + best;
      newHighScore.hidden = score <= bestAtStart;
      sparkleField.replaceChildren();
      if (!newHighScore.hidden && !settings.reducedMotion) {
        for (let i = 0; i < 18; i++) {
          const spark = make("i", "", "");
          spark.className = "score-sparkle";
          spark.style.setProperty("--x", `${Math.random() * 100}%`);
          spark.style.setProperty("--y", `${Math.random() * 100}%`);
          spark.style.setProperty("--delay", `${Math.random() * 0.8}s`);
          sparkleField.appendChild(spark);
        }
      }
      playAgain.disabled = true;
      gameOverOverlay.hidden = false;
      if (!settings.reducedMotion) countFinalScore();
      gameOverButtonTimer = setTimeout(() => { playAgain.disabled = false; playAgain.focus(); }, 600);
    }, settings.reducedMotion ? 100 : 700);
  }
  function hideStartScreen() {
    startOverlay.hidden = true;
  }
  function beginGame(newGame) {
    unlockAudio();
    hideStartScreen();
    if (newGame) reset();
    else {
      if (!pieces || !pieces.length) reset();
      else { render(); if (over) showGameOver(); }
    }
  }
  function showStartScreen(hasSave) {
    playButton.hidden = hasSave; continueButton.hidden = !hasSave; newGameButton.hidden = !hasSave;
    startOverlay.hidden = false; (hasSave ? continueButton : playButton).focus();
  }
  playButton.onclick = () => beginGame(true);
  continueButton.onclick = () => beginGame(false);
  newGameButton.onclick = () => beginGame(true);
  playAgain.onclick = () => {
    if (playAgain.disabled) return;
    clearSave(); hideGameOver(); reset();
  };
  document.addEventListener("keydown", e => {
    if (settingsOpen && e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeSettings(); }
  });
  syncSettings();
