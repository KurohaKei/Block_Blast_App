  const SAVE_KEY = "bb_save", SETTINGS_KEY = "bb_settings";
  function localGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function localSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function localRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  function loadSettings() {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const defaults = { sound: true, vibration: true, reducedMotion: !!reduced };
    try {
      const stored = JSON.parse(localGet(SETTINGS_KEY));
      if (stored && stored.version === 1) return {
        sound: typeof stored.sound === "boolean" ? stored.sound : defaults.sound,
        vibration: typeof stored.vibration === "boolean" ? stored.vibration : defaults.vibration,
        reducedMotion: typeof stored.reducedMotion === "boolean" ? stored.reducedMotion : defaults.reducedMotion
      };
    } catch (e) {}
    return defaults;
  }
  let settings = loadSettings();
  function saveSettings() {
    localSet(SETTINGS_KEY, JSON.stringify({ version: 1, sound: settings.sound, vibration: settings.vibration, reducedMotion: settings.reducedMotion }));
  }
  const shapeIdentity = shape => shape ? { cells: shape.cells.map(cell => cell.slice()), color: shape.color } : null;
  function matchShape(value) {
    if (value === null) return null;
    if (!value || typeof value !== "object" || typeof value.color !== "string" || !Array.isArray(value.cells)) return undefined;
    if (!value.cells.every(cell => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger))) return undefined;
    const key = cellsKey(value.cells);
    return SHAPES.find(shape => shape.color === value.color && cellsKey(shape.cells) === key);
  }
  function serializeState(state) {
    return {
      board: state.board.map(row => row.slice()), pieces: state.pieces.map(shapeIdentity), score: state.score,
      streak: state.streak, popped: state.popped, sets: state.sets,
      stash: state.stash && state.stash.map(shapeIdentity), over: state.over,
      best: state.best, bestAtStart: state.bestAtStart
    };
  }
  function validState(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.board) || value.board.length !== N ||
        !value.board.every(row => Array.isArray(row) && row.length === N && row.every(cell => cell === null || COLORS.includes(cell))) ||
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
      board: value.board.map(row => row.slice()), pieces, score: value.score, streak: value.streak,
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
      return true;
    } catch (e) { return false; }
  }
