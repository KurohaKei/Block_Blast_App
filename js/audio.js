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
  function beep(frequency, duration, type = "sine", volume = 0.045) {
    if (!settings.sound || !audioContext) return;
    try {
      const now = audioContext.currentTime, oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now); oscillator.stop(now + duration);
    } catch (e) {}
  }
  function audioPick() { beep(520, 0.07); }
  function audioPlace() { beep(360, 0.08, "triangle"); }
  function audioClear(streak) { beep(560 + Math.min(8, streak) * 55, 0.16, "sine", 0.06); }
  function audioGameOver() { beep(240, 0.32, "triangle", 0.06); }
  function vibrate(pattern) {
    if (!settings.vibration || typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) {}
  }
  function feedbackPlace(lines) {
    audioPlace();
    vibrate(lines ? [20, 30, 20] : 10);
    if (lines) audioClear(streak);
  }
