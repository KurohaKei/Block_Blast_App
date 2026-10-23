  const DEFAULT_THEME = {
    id: "default", name: "Default", harmony: "Original palette",
    base: "#3b578e",
    pieces: ["#ff5a36", "#ffbd32", "#a445ff", "#14c8c2", "#a0d92a", "#ee3f8c"],
    accent: "#ffbd32"
  };
  const THEME_DEFINITIONS = [
    DEFAULT_THEME,
    { id: "ocean", name: "Ocean", harmony: "Monochromatic", base: "#1f4e8c", pieces: ["#8fd3ff", "#4fb0ff", "#2b7de9", "#1f56c4", "#5a6cff", "#00c2d1"], accent: "#9fe3ff" },
    { id: "crimson", name: "Crimson", harmony: "Monochromatic", base: "#6b1f2e", pieces: ["#ffab91", "#ff8a80", "#ff5252", "#d50000", "#f50057", "#ff80ab"], accent: "#ffd0c8" },
    { id: "tangerine", name: "Tangerine", harmony: "Monochromatic", base: "#7a3d12", pieces: ["#ffe0b2", "#ffd180", "#ffb74d", "#ff9800", "#f57c00", "#e65100"], accent: "#ffe0b2" },
    { id: "emerald", name: "Emerald", harmony: "Monochromatic", base: "#14513a", pieces: ["#b9f6ca", "#69f0ae", "#00e676", "#00bfa5", "#2e9e57", "#76ff03"], accent: "#d4ffe6" },
    { id: "amethyst", name: "Amethyst", harmony: "Monochromatic", base: "#3d2a7a", pieces: ["#e1bee7", "#ce93d8", "#ab47bc", "#7e57c2", "#9575cd", "#b388ff"], accent: "#f0d9ff" },
    { id: "sunset", name: "Sunset", harmony: "Analogous", base: "#5a2150", pieces: ["#ff5e5b", "#ff8a3d", "#ffb703", "#ffd54a", "#e8467c", "#ff7a59"], accent: "#ffd166" },
    { id: "lagoon", name: "Lagoon", harmony: "Analogous", base: "#0f4c5c", pieces: ["#2ec4b6", "#5eead4", "#38bdf8", "#3b82f6", "#34d399", "#a7f3d0"], accent: "#b8fff0" },
    { id: "blue-orange", name: "Blue & Orange", harmony: "Complementary", base: "#1b3a6b", pieces: ["#ff8c1a", "#ffb04d", "#4da3ff", "#1e6fdc", "#ffd9a8", "#8cc8ff"], accent: "#ffb04d" },
    { id: "purple-gold", name: "Purple & Gold", harmony: "Complementary", base: "#3a1f6e", pieces: ["#ffc400", "#ffe082", "#b388ff", "#7c4dff", "#ffab00", "#d1b3ff"], accent: "#ffd54f" },
    { id: "primary-pop", name: "Primary Pop", harmony: "Triadic", base: "#1d2b53", pieces: ["#ef4444", "#fbbf24", "#3b82f6", "#fca5a5", "#fde68a", "#93c5fd"], accent: "#fbbf24" },
    { id: "teal-coral", name: "Teal & Coral", harmony: "Split-complementary", base: "#0e4d4f", pieces: ["#ff6f61", "#ffb347", "#2ec4b6", "#1a9aa0", "#ff8e72", "#ffd27d"], accent: "#ffb347" },
    { id: "gold", name: "Gold", harmony: "Special", base: "#3a2a10", pieces: ["#fff3b0", "#ffe066", "#ffc300", "#e65100", "#b8860b", "#ff8f00"], accent: "#ffd700" },
    { id: "neon", name: "Neon", harmony: "Special", base: "#0b0b1f", pieces: ["#ff2bd6", "#00f5ff", "#39ff14", "#fff01f", "#ff3131", "#9d4dff"], accent: "#00f5ff" },
    { id: "greyscale", name: "Greyscale", harmony: "Special", base: "#2b2f36", pieces: ["#fafafa", "#d0d3d8", "#a8adb5", "#848a93", "#5f6874", "#b4c7c9"], accent: "#e6e6e6" },
    { id: "candy", name: "Candy", harmony: "Special", base: "#5b4b8a", pieces: ["#ffb3d1", "#b5ead7", "#c7ceea", "#ffdac1", "#e2f0cb", "#ff9aa2"], accent: "#ffdac1" },
    { id: "lava", name: "Lava", harmony: "Special", base: "#1a0b0b", pieces: ["#ff3d00", "#ff9100", "#ffc400", "#d50000", "#ff6e40", "#ffea00"], accent: "#ff9100" }
  ];
  const DEFAULT_OVERRIDES = {
    center: "#4a69a8", edge: "#2a3f6b", vignette: "rgba(15, 27, 55, 0.22)",
    boardBg: "#18254f", emptyCell: "#202d59", emptyStroke: "rgba(140,165,215,.12)",
    frame: "#7286b3", dialogBg: "#3b578e", buttonBg: "#273e70", buttonHoverBg: "#324e86",
    dangerBg: "#8d3543", modalBackdrop: "rgba(10, 18, 43, 0.82)",
    startOverlayBg: "rgba(24, 37, 79, 0.98)", gameOverBg: "rgba(24, 37, 79, 0.96)",
    gem: "#29d6cf", gemShadow: "rgba(255, 189, 50, 0.75)", accentSoft: "#ffdc7b",
    buttonBright: "#ffbd32", buttonText: "#18254f", glow: "#ffc440",
    sweepA: "#ff3dc8", sweepB: "#40fff0", glint: "#fffbe0", gameOverWave: "#232834",
    frameCombo: "#8499c7", frameTier1: "#9ab0dc", frameTier2: "#b0c3e9", frameTier3: "#ffdc7b",
    buttonHoverBright: "#ffd166", gear: "#a9d9f6", scoreLabel: "#c9d6f2", infoText: "#ffe067",
    fallPieces: ["#ffbd32", "#56dfd3", "#ff7199", "#a879ff", "#79c9ff", "#ffbd32", "#76edaa"]
  };
  const hexRgb = hex => {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const rgbHex = ([r, g, b]) => "#" + [r, g, b].map(value => Math.round(value).toString(16).padStart(2, "0")).join("");
  const mixHex = (a, b, amount) => rgbHex(hexRgb(a).map((value, i) => value + (hexRgb(b)[i] - value) * amount));
  const rgbString = hex => hexRgb(hex).join(", ");
  const shadeHex = (hex, amount) => mixHex(hex, amount >= 0 ? "#ffffff" : "#000000", Math.min(1, Math.abs(amount) / 255));
  function deriveTheme(definition) {
    const base = definition.base;
    const derived = {
      ...definition,
      center: mixHex(base, "#ffffff", 0.16),
      edge: mixHex(base, "#000000", 0.3),
      vignette: `rgba(${rgbString(shadeHex(base, -50))}, 0.22)`,
      boardBg: mixHex(base, "#000000", 0.7),
      emptyCell: mixHex(base, "#000000", 0.58),
      emptyStroke: `rgba(${rgbString(mixHex(base, "#ffffff", 0.55))},.12)`,
      frame: mixHex(base, "#ffffff", 0.55),
      dialogBg: base,
      buttonBg: mixHex(base, "#000000", 0.3),
      buttonHoverBg: mixHex(mixHex(base, "#000000", 0.3), "#ffffff", 0.12),
      dangerBg: mixHex(base, "#8d3543", 0.7),
      modalBackdrop: `rgba(${rgbString(mixHex(base, "#000000", 0.84))}, 0.82)`,
      startOverlayBg: `rgba(${rgbString(mixHex(base, "#18254f", 0.82))}, 0.98)`,
      gameOverBg: `rgba(${rgbString(mixHex(base, "#18254f", 0.82))}, 0.96)`,
      gem: definition.accent,
      gemShadow: `rgba(${rgbString(definition.accent)}, 0.75)`,
      accentSoft: mixHex(definition.accent, "#ffffff", 0.28),
      infoText: mixHex(definition.accent, "#ffffff", 0.4),
      buttonBright: definition.accent,
      buttonText: hexRgb(definition.accent).reduce((sum, value) => sum + value, 0) > 440 ? "#18254f" : "#ffffff",
      glow: definition.accent,
      sweepA: mixHex(definition.accent, "#ff3dc8", 0.45),
      sweepB: mixHex(definition.accent, "#40fff0", 0.45),
      glint: mixHex(definition.accent, "#ffffff", 0.55),
      gameOverWave: mixHex(base, "#000000", 0.82),
      frameCombo: mixHex(mixHex(base, "#ffffff", 0.55), "#ffffff", 0.08),
      frameTier1: mixHex(mixHex(base, "#ffffff", 0.55), "#ffffff", 0.18),
      frameTier2: mixHex(mixHex(base, "#ffffff", 0.55), "#ffffff", 0.28),
      frameTier3: mixHex(mixHex(base, "#ffffff", 0.55), definition.accent, 0.45),
      buttonHoverBright: mixHex(definition.accent, "#ffffff", 0.15),
      gear: mixHex(definition.accent, "#ffffff", 0.4),
      scoreLabel: mixHex(definition.accent, "#ffffff", 0.58),
      fallPieces: definition.id === DEFAULT_THEME.id
        ? DEFAULT_OVERRIDES.fallPieces
        : Array.from({ length: 7 }, (_, index) => definition.pieces[index % definition.pieces.length])
    };
    return definition.id === DEFAULT_THEME.id ? { ...derived, ...DEFAULT_OVERRIDES, ...definition } : derived;
  }
  const THEMES = THEME_DEFINITIONS.map(deriveTheme);
  const THEME_KEY = "bb_theme";
  const storedThemeId = (() => {
    try { return localStorage.getItem(THEME_KEY); } catch (error) { return null; }
  })();
  let activeTheme = THEMES.find(theme => theme.id === storedThemeId) || THEMES[0];
  let transitionFrom = null, transitionStart = 0, transitionCache = null, transitionCacheFrame = -1;
  let themeBag = [];
  const clamp = value => Math.max(0, Math.min(1, value));
  function blendColor(from, to, progress) {
    if (from.startsWith("#") && to.startsWith("#")) {
      return rgbHex(hexRgb(from).map((value, i) => value + (hexRgb(to)[i] - value) * progress));
    }
    const rgba = value => value.match(/[\d.]+/g).map(Number);
    const start = rgba(from), end = rgba(to);
    return `rgba(${start.slice(0, 3).map((value, i) => Math.round(value + (end[i] - value) * progress)).join(", ")}, ${start[3] + (end[3] - start[3]) * progress})`;
  }
  function getTheme() {
    if (transitionFrom && typeof settings !== "undefined" && settings.reducedMotion) transitionFrom = null;
    if (!transitionFrom) return activeTheme;
    const frame = Math.floor(performance.now() / 16);
    if (frame === transitionCacheFrame) return transitionCache;
    const progress = clamp((performance.now() - transitionStart) / 500);
    if (progress >= 1) { transitionFrom = null; transitionCache = activeTheme; transitionCacheFrame = frame; return activeTheme; }
    const blended = { ...activeTheme };
    for (const key of ["base", "center", "edge", "vignette", "boardBg", "emptyCell", "emptyStroke", "frame", "dialogBg", "buttonBg", "buttonHoverBg", "dangerBg", "modalBackdrop", "startOverlayBg", "gameOverBg", "gem", "gemShadow", "accent", "accentSoft", "infoText", "buttonBright", "buttonText", "glow", "sweepA", "sweepB", "glint", "gameOverWave", "frameCombo", "frameTier1", "frameTier2", "frameTier3", "buttonHoverBright", "gear", "scoreLabel"]) {
      blended[key] = blendColor(transitionFrom[key], activeTheme[key], progress);
    }
    blended.pieces = activeTheme.pieces.map((color, index) => blendColor(transitionFrom.pieces[index], color, progress));
    blended.fallPieces = activeTheme.fallPieces.map((color, index) => blendColor(transitionFrom.fallPieces[index], color, progress));
    transitionCache = blended;
    transitionCacheFrame = frame;
    return blended;
  }
  function themeTransitioning() {
    getTheme();
    return !!transitionFrom;
  }
  function applyThemeVariables(theme = getTheme()) {
    const root = document.documentElement;
    const set = (name, value) => {
      if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
    };
    set("--bg-base", theme.base);
    set("--bg-center", theme.center);
    set("--bg-edge", theme.edge);
    set("--vignette", theme.vignette);
    set("--page-background", `radial-gradient(ellipse at center, transparent 52%, ${theme.vignette} 100%), radial-gradient(ellipse at center, ${theme.center} 0%, ${theme.base} 62%, ${theme.edge} 100%)`);
    set("--board-bg", theme.boardBg);
    set("--empty-cell", theme.emptyCell);
    set("--empty-stroke", theme.emptyStroke);
    set("--frame", theme.frame);
    set("--accent", theme.accent);
    set("--accent-rgb", rgbString(theme.accent));
    set("--accent-soft", theme.accentSoft);
    set("--button-bright", theme.buttonBright);
    set("--button-text", theme.buttonText);
    set("--glow", theme.glow);
    set("--glow-rgb", rgbString(theme.glow));
    set("--sweep-a", theme.sweepA);
    set("--sweep-b", theme.sweepB);
    set("--sweep-a-rgb", rgbString(theme.sweepA));
    set("--frame-combo", theme.frameCombo);
    set("--frame-tier-1", theme.frameTier1);
    set("--frame-tier-2", theme.frameTier2);
    set("--frame-tier-3", theme.frameTier3);
    set("--button-hover-bright", theme.buttonHoverBright);
    set("--gear", theme.gear);
    set("--score-label", theme.scoreLabel);
    set("--info-text", theme.infoText);
    theme.pieces.forEach((color, index) => set(`--piece-${index + 1}`, color));
    theme.fallPieces.forEach((color, index) => set(`--fall-piece-${index + 1}`, color));
    set("--dialog-bg", theme.dialogBg);
    set("--button-bg", theme.buttonBg);
    set("--button-hover-bg", theme.buttonHoverBg);
    set("--danger-bg", theme.dangerBg);
    set("--modal-backdrop", theme.modalBackdrop);
    set("--start-overlay-bg", theme.startOverlayBg);
    set("--game-over-bg", theme.gameOverBg);
    set("--gem", theme.gem);
    set("--gem-shadow", theme.gemShadow);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.content !== theme.base) meta.content = theme.base;
  }
  function persistTheme() {
    try { localStorage.setItem(THEME_KEY, activeTheme.id); } catch (error) { console.warn("Unable to save theme preference:", error); }
  }
  function setTheme(id, { animate = true } = {}) {
    const target = THEMES.find(theme => theme.id === id);
    if (!target) throw new RangeError(`Unknown theme: ${id}`);
    if (target.id === activeTheme.id) return false;
    animate = animate && !(typeof settings !== "undefined" && settings.reducedMotion);
    const current = getTheme();
    transitionFrom = animate ? current : null;
    transitionStart = performance.now();
    activeTheme = target;
    transitionCache = null;
    transitionCacheFrame = -1;
    persistTheme();
    if (typeof setShapePalette === "function") setShapePalette(target.pieces);
    applyThemeVariables(animate ? current : target);
    return true;
  }
  function refillThemeBag() {
    themeBag = THEMES.map(theme => theme.id).filter(id => id !== activeTheme.id);
    for (let i = themeBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [themeBag[i], themeBag[j]] = [themeBag[j], themeBag[i]];
    }
  }
  function nextTheme() {
    themeBag = themeBag.filter(id => id !== activeTheme.id);
    if (!themeBag.length) refillThemeBag();
    if (!themeBag.length) return activeTheme;
    const id = themeBag.pop();
    setTheme(id, { animate: typeof settings === "undefined" || !settings.reducedMotion });
    return activeTheme;
  }
  function resetTheme() {
    return setTheme(DEFAULT_THEME.id, { animate: typeof settings === "undefined" || !settings.reducedMotion });
  }
  function paletteIndexForColor(color) {
    const olderPalettes = [
      ["#ff351f", "#ff8e2b", "#ffce08", "#37ff8a", "#20ffd2", "#22a7ff", "#c635ff", "#ff3596"],
      ["#ff5a36", "#ffbd32", "#a445ff", "#14c8c2", "#a0d92a", "#ee3f8c"]
    ];
    for (const palette of olderPalettes) {
      const index = palette.indexOf(color);
      if (index >= 0) return index % DEFAULT_THEME.pieces.length;
    }
    for (const theme of THEMES) {
      const index = theme.pieces.indexOf(color);
      if (index >= 0) return index;
    }
    return -1;
  }
