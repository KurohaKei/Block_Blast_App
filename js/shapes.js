// Block Blast - offline, single-file JS. Usage: <script src="blockblast.js"></script> in any HTML page.
  const N = 8, CELL = 40, SIZE = N * CELL, TRAY_H = 120, LIFT = 60;
  const GLOW = "255, 196, 64";
  const COLORS = ["#ff5a36", "#ffbd32", "#a445ff", "#14c8c2", "#a0d92a", "#ee3f8c"];
  const MIN_CELLS = 4;

  // Relative spawn weight per orientation (only ratios matter). 0 disables an orientation;
  // if every fitting option is disabled, selection falls back to a fitting shape.
  // Tuning: single, bar2, bar3, L3, diagonals = 0.3, S/Z and T = 0.8, L4 (8 orientations) = 0.55 each,
  // bar4 = 0.7, square2 = 2.1, rect2x3 = 1.05, square3 = 1.5, everything else = 1.
  const SPAWN_WEIGHTS = {
    "single-0": 0.3,
    "bar2-0": 0.3, "bar2-90": 0.3,
    "bar3-0": 0.3, "bar3-90": 0.3,
    "bar4-0": 0.7, "bar4-90": 0.7,
    "bar5-0": 1, "bar5-90": 1,
    "square2-0": 2.1,
    "rect2x3-0": 1.05, "rect2x3-90": 1.05,
    "square3-0": 1.5,
    "diagonal2-0": 0.3, "diagonal2-90": 0.3,
    "diagonal3-0": 0.3, "diagonal3-90": 0.3,
    "zigzag4-0": 0.8, "zigzag4-90": 0.8, "zigzag4-0-mirror": 0.8, "zigzag4-90-mirror": 0.8,
    "T4-0": 0.8, "T4-90": 0.8, "T4-180": 0.8, "T4-270": 0.8,
    "L3-0": 0.3, "L3-90": 0.3, "L3-180": 0.3, "L3-270": 0.3,
    "L4-0": 0.55, "L4-90": 0.55, "L4-180": 0.55, "L4-270": 0.55,
    "L4-0-mirror": 0.55, "L4-90-mirror": 0.55, "L4-180-mirror": 0.55, "L4-270-mirror": 0.55,
    "L7-0": 1, "L7-90": 1, "L7-180": 1, "L7-270": 1
  };

  const BASE = [
    { name: "single", rows: ["#"] },
    { name: "bar2", rows: ["##"] },
    { name: "bar3", rows: ["###"] },
    { name: "bar4", rows: ["####"] },
    { name: "bar5", rows: ["#####"] },
    { name: "square2", rows: ["##", "##"] },
    { name: "rect2x3", rows: ["###", "###"] },
    { name: "square3", rows: ["###", "###", "###"] },
    { name: "diagonal2", rows: ["#.", ".#"] },
    { name: "diagonal3", rows: ["#..", ".#.", "..#"] },
    { name: "zigzag4", rows: [".##", "##."] },
    { name: "T4", rows: [".#.", "###"] },
    { name: "L3", rows: ["##", "#."] },
    { name: "L4", rows: ["#.", "#.", "##"] },
    { name: "L7", rows: ["#..", "#..", "###"] }
  ];
  const turn = cells => { const h = Math.max(...cells.map(c => c[0])) + 1; return cells.map(([r, c]) => [c, h - 1 - r]); };
  const flip = cells => { const w = Math.max(...cells.map(c => c[1])) + 1; return cells.map(([r, c]) => [r, w - 1 - c]); };
  const cellsKey = cells => cells.map(c => c.join()).sort().join("|");
  const SHAPES = [];
  const BY_KEY = new Map();
  BASE.forEach(({ name, rows }, i) => {
    let cells = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => ch === "#" && cells.push([r, c])));
    const seen = new Set();
    for (let k = 0; k < 8; k++) {
      const key = cellsKey(cells);
      if (!seen.has(key)) {
        seen.add(key);
        const id = `${name}-${(k % 4) * 90}${k >= 4 ? "-mirror" : ""}`;
        const s = {
          id, base: name, baseWeight: SPAWN_WEIGHTS[id] ?? 1, cells, color: COLORS[i % COLORS.length],
          h: Math.max(...cells.map(c => c[0])) + 1, w: Math.max(...cells.map(c => c[1])) + 1
        };
        SHAPES.push(s);
        if (!BY_KEY.has(key)) BY_KEY.set(key, []);
        BY_KEY.get(key).push(s);
      }
      if (k === 3) {
        cells = turn(cells);
        cells = flip(cells);
      } else {
        cells = turn(cells);
      }
    }
  });