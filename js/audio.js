  let audioContext = null;
  function unlockAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") {
        const resumed = audioContext.resume();
        if (resumed && resumed.catch) resumed.catch(() => {});
      }
    } catch (e) {}
  }
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("keydown", unlockAudio, { once: true });
  function toneAt(frequency, start, duration, type = "sine", volume = 0.045) {
    if (!settings.sound || !audioContext) return;
    try {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + duration);
    } catch (e) {}
  }
  function beep(frequency, duration, type = "sine", volume = 0.045) {
    if (!audioContext) return;
    toneAt(frequency, audioContext.currentTime, duration, type, volume);
  }
  function audioPick() { beep(720, 0.035, "sine", 0.025); }
  function audioPlace() { beep(145, 0.11, "triangle", 0.07); }
  function audioClear(combo, lines) {
    const now = audioContext && audioContext.currentTime;
    if (now === null || now === undefined || !settings.sound || !audioContext) return;
    const steps = Math.min(9, Math.max(0, combo - 1));
    toneAt(520 * Math.pow(2, steps / 12), now, 0.16, "sine", 0.06);
    if (lines >= 3) toneAt(260, now, 0.2, "triangle", 0.045);
  }
  function audioPerfect() {
    if (!audioContext || !settings.sound) return;
    [784, 988, 1175, 1568].forEach((frequency, i) =>
      toneAt(frequency, audioContext.currentTime + i * 0.075, 0.22, "sine", 0.05));
  }
  function audioGameOver() { beep(240, 0.32, "triangle", 0.06); }
  function vibrate(pattern) {
    if (!settings.vibration || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) {}
  }
  function feedbackPlace(lines, combo, perfect) {
    audioPlace();
    vibrate(perfect ? [45, 40, 45, 40, 120] : lines >= 3 ? 35 : 10);
    if (lines) audioClear(combo, lines);
    if (perfect) audioPerfect();
  }
