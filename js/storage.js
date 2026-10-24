  const SAVE_KEY = "bb_save", SETTINGS_KEY = "bb_settings";
  const FINGER_SENSITIVITIES = [1, 1.15, 1.25, 1.35, 1.5];
  const validCell = value => value === null ||
    Number.isInteger(value) && value >= 1 && value <= DEFAULT_THEME.pieces.length ||
    typeof value === "string" && paletteIndexForColor(value) >= 0;
  const normalizeCell = value => typeof value === "number" ? value :
    value === null ? null : paletteIndexForColor(value) + 1;
  function localGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function localSet(key, value) {
    try { localStorage.setItem(key, value); }
    catch (error) { console.warn("Unable to save browser data for " + key + ":", error); }
  }
  function localRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  function loadSettings() {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const defaults = { sound: true, vibration: true, reducedMotion: !!reduced, fingerSensitivity: 1.25 };
    try {
      const stored = JSON.parse(localGet(SETTINGS_KEY));
      if (stored && stored.version === 1) return {
        sound: typeof stored.sound === "boolean" ? stored.sound : defaults.sound,
        vibration: typeof stored.vibration === "boolean" ? stored.vibration : defaults.vibration,
        reducedMotion: typeof stored.reducedMotion === "boolean" ? stored.reducedMotion : defaults.reducedMotion,
        fingerSensitivity: FINGER_SENSITIVITIES.includes(stored.fingerSensitivity) ? stored.fingerSensitivity : defaults.fingerSensitivity
      };
    } catch (e) {}
    return defaults;
  }
  let settings = loadSettings();
  function saveSettings() {
    localSet(SETTINGS_KEY, JSON.stringify({
      version: 1, sound: settings.sound, vibration: settings.vibration,
      reducedMotion: settings.reducedMotion, fingerSensitivity: settings.fingerSensitivity
    }));
  }
  const shapeIdentity = shape => shape ? {
    cells: shape.cells.map(cell => cell.slice()), color: DEFAULT_THEME.pieces[shape.paletteIndex]
  } : null;
  function matchShape(value) {
    if (value === null) return null;
    if (!value || typeof value !== "object" || typeof value.color !== "string" || paletteIndexForColor(value.color) < 0 || !Array.isArray(value.cells)) return undefined;
    if (!value.cells.every(cell => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger))) return undefined;
    const key = cellsKey(value.cells);
    return SHAPES.find(shape => cellsKey(shape.cells) === key);
  }
  function serializeState(state) {
    return {
      board: state.board.map(row => row.map(normalizeCell)), pieces: state.pieces.map(shapeIdentity), score: state.score,
      streak: state.streak, popped: state.popped, sets: state.sets,
      stash: state.stash && state.stash.map(shapeIdentity), over: state.over,
      best: state.best, bestAtStart: state.bestAtStart
    };
  }
  function validState(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.board) || value.board.length !== N ||
        !value.board.every(row => Array.isArray(row) && row.length === N && row.every(validCell)) ||
        !Array.isArray(value.pieces) || value.pieces.length !== 3 ||
        !Number.isSafeInteger(value.score) || value.score < 0 ||
        !Number.isSafeInteger(value.streak) || value.streak < 0 ||
        typeof value.popped !== "boolean" ||
        !Number.isSafeInteger(value.sets) || value.sets < 0 || typeof value.over !== "boolean" ||
        !Number.isSafeInteger(value.bestAtStart) || value.bestAtStart < 0) return null;
    const pieces = value.pieces.map(matchShape);
    if (pieces.some((shape, i) => shape === undefined || (value.pieces[i] !== null && !shape))) return null;
    let stash = null;
    if (value.stash !== null) {
      if (!Array.isArray(value.stash) || value.stash.length !== 3 || value.stash.some(shape => !shape || !matchShape(shape))) return null;
      stash = value.stash.map(matchShape);
    }
    return {
      board: value.board.map(row => row.map(normalizeCell)), pieces, score: value.score, streak: value.streak,
      popped: value.popped, sets: value.sets, stash, over: value.over,
      best: Number.isSafeInteger(value.best) && value.best >= 0 ? value.best : best,
      bestAtStart: value.bestAtStart
    };
  }
  function saveGame() {
    const data = { version: 1, state: serializeState({ board, pieces, score, streak, popped, sets, stash, over, best, bestAtStart }) };
    localSet(SAVE_KEY, JSON.stringify(data));
  }
  function clearSave() { localRemove(SAVE_KEY); }
  function restoreGame() {
    try {
      const data = JSON.parse(localGet(SAVE_KEY));
      if (!data || data.version !== 1) return false;
      const restored = validState(data.state);
      if (!restored) return false;
      board = restored.board; pieces = restored.pieces; score = restored.score;
      streak = restored.streak; popped = restored.popped; sets = restored.sets;
      stash = restored.stash; over = restored.over; best = Math.max(best, restored.best); bestAtStart = restored.bestAtStart;
      saveGame();
      return true;
    } catch (e) { return false; }
  }
