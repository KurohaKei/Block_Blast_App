// ---------- Tuning ----------
  const DEBUG_GEN = false;            // set to false to silence the console logs
  const SET_TRIES = 15;              // attempts to build a valid set before moving to the next path

  // Duplicate penalties (multiplied onto a piece's weight when building slots)
  const DUP_SAME_SHAPE = 0.1;        // same orientation already in this set
  const DUP_SAME_BASE = 0.4;         // same base shape, other rotation, already in this set

  // Solvability guarantee: on a busy board the set must clear at least one line in the simulation.
  // If slot 1 clears nothing, slot 2 must clear or set up a clear, and slot 3 must clear.
  const GUARANTEE_CLEAR = true;
  const GUARANTEE_MIN_CELLS = 30;    // guarantee applies when the real board has at least this many filled cells

  // Line-perfect checker (runs before the normal builder)
  const PERFECT_LINE_CHANCE = 0.9;     // chance a found line-perfect is used (0.9 = 90%)
  const PERFECT_MAX_SPAN = 2;        // a 1-line perfect may span at most this many lines across the cleared line
  const PERFECT_PAIR_CHANCE = 0.9;     // chance a found 2-block perfect is used (0.9 = 90%); checked before the 1-block perfects
  const PERFECT_PAIR_MAX_CELLS = 12; // a 2-block perfect only looks at two-line strips with at most this many empty cells
  const PERFECT_LINEPAIR_CHANCE = 0.9;    // chance a found 1-line pair is used; checked after the line-perfect
  const PERFECT_LINEPAIR_MAX_CELLS = 7;   // a 1-line pair only looks at lines with at most this many empty cells
  const PERFECT_LINE_THEN_2BLOCK_CHANCE = 0.8;   // after a line-perfect in slot 1, chance slots 2-3 become a 2-block perfect (checked before the slot 2 line-perfect chain)
  const PERFECT_CHAIN_CHANCE = 0.9;    // chance slot 2 also gets a line-perfect, checked on the board after slot 1 pops (0.9 = 90%)
  const PERFECT_CHAIN3_CHANCE = 0.9; // chance slot 3 also gets a line-perfect, checked on the board after slot 2 pops (only if slot 2 was perfect)(0.9 = 90%)

  // Zigzag -> matching L4 pair (boosts those L4s in later slots of the same set)
  const ZIG_L_BOOST = 1.5;                    // modest multiplier on the L4's base weight
  const ZIG_PAIR_PENALTY = DUP_SAME_SHAPE;    // if one L of a linked pair is in the set, the other gets this
  const ZIG_L = {
    "zigzag4-0":         ["L4-90", "L4-270"],
    "zigzag4-90":        ["L4-180", "L4-0"],
    "zigzag4-0-mirror":  ["L4-270-mirror", "L4-90-mirror"],
    "zigzag4-90-mirror": ["L4-0-mirror", "L4-180-mirror"]
  };

  SHAPES.forEach(s => { s.m = Array(s.h).fill(0); s.cells.forEach(([r, c]) => (s.m[r] |= 1 << c)); });
  const POP = Array.from({ length: 256 }, (_, v) => v.toString(2).replace(/0/g, "").length);

  // ---------- Helpers ----------
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const weightedPick = (options, getWeight = option => option.baseWeight) => {
    if (!options.length) return null;
    const weights = options.map(option => {
      const weight = getWeight(option);
      return Number.isFinite(weight) ? Math.max(0, weight) : 0;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!total) return options[Math.floor(Math.random() * options.length)];
    let value = Math.random() * total;
    for (let i = 0; i < options.length; i++) {
      if ((value -= weights[i]) < 0) return options[i];
    }
    return options[options.length - 1];
  };
  const easyOpening = set => sets > 2 || set.every(s => s.cells.length <= 6) && set.filter(s => s.cells.length <= 4).length >= 2;
  const toMask = b => Uint8Array.from(b, row => row.reduce((m, v, c) => m | (v ? 1 << c : 0), 0));

  // Console logging: shows which code path produced each set and what happened per slot.
  const logPath = (path, b, set, trace, tries) => {
    if (DEBUG_GEN) {
      const ids = set.map(s => s.id);
      const dup = new Set(ids).size < ids.length;
      const head = `[gen] ${path} | set #${sets} | filled ${filledCells(b)} | tries ${tries ?? "-"} | ${ids.join(", ")}`;
      if (dup) console.warn("DUPLICATE " + head);
      else console.log(head);
      if (trace && (dup || trace.length)) trace.forEach(line => console.log("   " + line));
    }
    return set;
  };

  // ---------- Bitmask simulation ----------
  function simFits(g, s, r, c) {
    for (let i = 0; i < s.h; i++) if (g[r + i] & (s.m[i] << c)) return false;
    return true;
  }
  function simDrop(g, s, r, c) {
    const ng = g.slice();
    for (let i = 0; i < s.h; i++) ng[r + i] |= s.m[i] << c;
    let cols = 255, left = 0;
    for (let i = 0; i < N; i++) cols &= ng[i];
    let lines = POP[cols];
    for (let i = 0; i < N; i++) {
      if (ng[i] === 255) { lines++; ng[i] = 0; }
      else ng[i] &= ~cols;
      left += POP[ng[i]];
    }
    return { g: ng, lines, left };
  }
  function rough(g) {
    let n = 0;
    for (let i = 0; i < N; i++) n += POP[(g[i] ^ (g[i] >> 1)) & 127] + (i < N - 1 ? POP[g[i] ^ g[i + 1]] : 0);
    return n;
  }

  // ---------- Line-perfect checker ----------
  // Looks at every placement of every piece on the real board and keeps the ones that clear lines:
  //   - clears 2+ lines: always allowed (the piece may stick out into a third line)
  //   - clears 1 line: the piece may span at most PERFECT_MAX_SPAN lines across the cleared line,
  //     so it never reaches a third line
  // Ranking: more lines cleared first; then big pieces (4+ cells, not a diagonal) before small ones;
  // then the fewest cells dropped into a completely empty line; then the fewest cells left on the board.
  // If only small pieces work, the largest one is used. Ties are picked at random.
  // avoid: shape ids already in the set (used when checking slot 2 so it doesn't repeat slot 1).
  const isSmallShape = s => s.cells.length < MIN_CELLS || s.base.startsWith("diagonal");

  // allowSmall: used for the chained slots 2 and 3. Small pieces (1x2, 1x3, small L, ...) compete on equal
  // terms with big ones instead of being a last resort. Only the 1x1 stays excluded.
  function findLinePerfect(b, avoid = [], allowSmall = false) {
    const g = toMask(b);
    let colsUsed = 0;
    for (let i = 0; i < N; i++) colsUsed |= g[i];
    const cands = [];
    for (const s of SHAPES) {
      if (s.baseWeight <= 0 || (sets <= 2 && s.cells.length > 6)) continue;
      if (avoid.includes(s.id)) continue;   // don't repeat a piece already in this set
      if (allowSmall && s.cells.length < 2) continue;   // never the 1x1
      for (let r = 0; r <= N - s.h; r++) for (let c = 0; c <= N - s.w; c++) {
        if (!simFits(g, s, r, c)) continue;
        const ng = g.slice();
        for (let i = 0; i < s.h; i++) ng[r + i] |= s.m[i] << c;
        let cols = 255, rows = 0;
        for (let i = 0; i < N; i++) { cols &= ng[i]; if (ng[i] === 255) rows |= 1 << i; }
        const lines = POP[cols] + POP[rows];
        if (!lines) continue;
        if (lines === 1 && (rows ? s.h : s.w) > PERFECT_MAX_SPAN) continue;   // would reach a third line
        let left = 0, empty = 0;
        for (const [i, j] of s.cells) {
          const wr = r + i, wc = c + j;
          if (((rows >> wr) & 1) || ((cols >> wc) & 1)) continue;   // this cell clears with the line
          left++;
          if ((rows && !g[wr]) || (cols && !((colsUsed >> wc) & 1))) empty++;   // lands in an empty line
        }
        cands.push({ s, r, c, lines, left, empty, small: isSmallShape(s) });
      }
    }
    if (!cands.length) return null;
    const key = o => allowSmall
      ? [-o.lines, 0, 0, o.empty, o.left]   // no size preference: big and small compete equally
      : [-o.lines, o.small ? 1 : 0, o.small ? -o.s.cells.length : 0, o.empty, o.left];
    const cmp = (a, z) => {
      const ka = key(a), kz = key(z);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kz[i]) return ka[i] - kz[i];
      return 0;
    };
    cands.sort(cmp);
    const top = cands.filter(o => cmp(o, cands[0]) === 0);
    const shape = weightedPick([...new Set(top.map(o => o.s))]);
    const spots = top.filter(o => o.s === shape);
    return spots[Math.floor(Math.random() * spots.length)];
  }

  // ---------- 2-block perfect ----------
  // Two pieces that together clear 2 consecutive lines (2 rows or 2 columns) with no stick outs:
  // every cell of both pieces lies inside the two lines, so nothing is left behind after the pop.
  // For every pair of consecutive lines, the empty cells of the strip must be covered exactly by two pieces.
  // The pair is checked in the simulation (slot 1 then slot 2). After both pieces are placed and popped,
  // the strip itself must be completely empty. This catches fake pairs, e.g. slot 1 clearing a row AND a
  // crossing column, which would punch a new hole into the strip so slot 2 no longer finishes it.
  // 1x1 pieces are not used.
  // Ranking: no duplicate shape first, then fewest small pieces (cells < MIN_CELLS or diagonal). Ties are random.
  // Returns [first, second], each {s, r, c, lines, pair: true}, or null.
  // avoid: shape ids already in the set (used when it is checked after slot 1, so it doesn't repeat slot 1).
  function findTwoBlockPerfect(b, avoid = []) {
    const g = toMask(b);
    const empty = (r, c) => !((g[r] >> c) & 1);
    const shapes = SHAPES.filter(s => s.baseWeight > 0 && s.cells.length >= 2 && !avoid.includes(s.id) && !(sets <= 2 && s.cells.length > 6));
    const cands = [];

    // isRow: the strip is rows i and i+1; otherwise columns i and i+1
    const tryStrip = (E, isRow, i) => {
      if (E.length < 4 || E.length > PERFECT_PAIR_MAX_CELLS) return;
      const inE = new Set(E.map(([r, c]) => r * N + c));
      for (const s1 of shapes) {
        if (s1.cells.length >= E.length) continue;
        for (let r = 0; r <= N - s1.h; r++) for (let c = 0; c <= N - s1.w; c++) {
          if (!s1.cells.every(([di, dj]) => inE.has((r + di) * N + (c + dj)))) continue;
          const used = new Set(s1.cells.map(([di, dj]) => (r + di) * N + (c + dj)));
          const rest = E.filter(([rr, cc]) => !used.has(rr * N + cc));
          const mr = Math.min(...rest.map(x => x[0])), mc = Math.min(...rest.map(x => x[1]));
          const norm = rest.map(([rr, cc]) => [rr - mr, cc - mc]).sort((a, z) => a[0] - z[0] || a[1] - z[1]);
          const seconds = (BY_KEY.get(cellsKey(norm)) || []).filter(s => shapes.includes(s));
          for (const s2 of seconds) {
            if (!simFits(g, s1, r, c)) continue;
            const o1 = simDrop(g, s1, r, c);
            if (!simFits(o1.g, s2, mr, mc)) continue;
            const o2 = simDrop(o1.g, s2, mr, mc);
            // the strip must be fully cleared after both pieces
            const clean = isRow
              ? o2.g[i] === 0 && o2.g[i + 1] === 0
              : o2.g.every(row => (row & (3 << i)) === 0);
            if (!clean) continue;
            cands.push({
              first: { s: s1, r, c, lines: o1.lines, pair: true },
              second: { s: s2, r: mr, c: mc, lines: o2.lines, pair: true },
              smalls: isSmallShape(s1) + isSmallShape(s2),
              dup: s1.id === s2.id ? 1 : 0
            });
          }
        }
      }
    };

    for (let i = 0; i < N - 1; i++) {   // two consecutive rows
      const E = [];
      for (const r of [i, i + 1]) for (let c = 0; c < N; c++) if (empty(r, c)) E.push([r, c]);
      tryStrip(E, true, i);
    }
    for (let j = 0; j < N - 1; j++) {   // two consecutive columns
      const E = [];
      for (const c of [j, j + 1]) for (let r = 0; r < N; r++) if (empty(r, c)) E.push([r, c]);
      tryStrip(E, false, j);
    }
    if (!cands.length) return null;
    const key = o => [o.dup, o.smalls];
    const cmp = (a, z) => { const ka = key(a), kz = key(z); return ka[0] - kz[0] || ka[1] - kz[1]; };
    cands.sort(cmp);
    const top = cands.filter(o => cmp(o, cands[0]) === 0);
    const pick = top[Math.floor(Math.random() * top.length)];
    return [pick.first, pick.second];
  }

  // ---------- 1-line pair ----------
  // Two pieces that together clear ONE line (a row or a column) when neither piece can clear it alone.
  // This covers boards where no single piece clears a line, so the line-perfect checker finds nothing.
  // For every line with 2..PERFECT_LINEPAIR_MAX_CELLS empty cells, the first piece must fill some of them
  // (without clearing anything by itself), and the second piece must fill the rest. Each piece may span at
  // most PERFECT_MAX_SPAN lines across the target line, so nothing reaches a third line.
  // The pair is checked in the simulation (slot 1 then slot 2) and the target line must be cleared after both.
  // 1x1 pieces are not used.
  // Ranking: no duplicate shape first, then pairs that stick out of the line (at least 1 cell) before clean
  // pairs, then fewest small pieces. A clean pair is still used if nothing else exists.
  // Ties are random, so the amount sticking out is not pushed to the maximum. Returns [first, second], each {s, r, c, lines, pair: true}, or null.
  function findOneLinePair(b) {
    const g = toMask(b);
    const empty = (r, c) => !((g[r] >> c) & 1);
    const shapes = SHAPES.filter(s => s.baseWeight > 0 && s.cells.length >= 2 && !(sets <= 2 && s.cells.length > 6));
    const cands = [];

    // isRow: the target line is row i; otherwise column i
    const tryLine = (E, isRow, i) => {
      if (E.length < 2 || E.length > PERFECT_LINEPAIR_MAX_CELLS) return;
      const inE = new Set(E.map(([r, c]) => r * N + c));
      const span = s => (isRow ? s.h : s.w);
      for (const s1 of shapes) {
        if (span(s1) > PERFECT_MAX_SPAN) continue;
        for (let r = 0; r <= N - s1.h; r++) for (let c = 0; c <= N - s1.w; c++) {
          if (!simFits(g, s1, r, c)) continue;
          const inside = s1.cells.filter(([di, dj]) => inE.has((r + di) * N + (c + dj)));
          if (!inside.length) continue;   // must help fill the line
          const o1 = simDrop(g, s1, r, c);
          if (o1.lines > 0) continue;     // clears on its own: that is the line-perfect's job
          const used = new Set(inside.map(([di, dj]) => (r + di) * N + (c + dj)));
          const rest = E.filter(([rr, cc]) => !used.has(rr * N + cc));
          const [r0, c0] = rest[0];
          for (const s2 of shapes) {
            if (span(s2) > PERFECT_MAX_SPAN) continue;
            for (const [di, dj] of s2.cells) {   // s2 must cover the first remaining empty cell
              const r2 = r0 - di, c2 = c0 - dj;
              if (r2 < 0 || c2 < 0 || r2 > N - s2.h || c2 > N - s2.w) continue;
              if (!simFits(o1.g, s2, r2, c2)) continue;
              const o2 = simDrop(o1.g, s2, r2, c2);
              const cleared = isRow ? o2.g[i] === 0 : o2.g.every(row => !((row >> i) & 1));
              if (!cleared) continue;
              cands.push({
                first: { s: s1, r, c, lines: o1.lines, pair: true },
                second: { s: s2, r: r2, c: c2, lines: o2.lines, pair: true },
                smalls: isSmallShape(s1) + isSmallShape(s2),
                dup: s1.id === s2.id ? 1 : 0,
                outside: s1.cells.length + s2.cells.length - E.length   // cells that stick out of the line
              });
            }
          }
        }
      }
    };

    for (let i = 0; i < N; i++) {   // every row
      const E = [];
      for (let c = 0; c < N; c++) if (empty(i, c)) E.push([i, c]);
      tryLine(E, true, i);
    }
    for (let j = 0; j < N; j++) {   // every column
      const E = [];
      for (let r = 0; r < N; r++) if (empty(r, j)) E.push([r, j]);
      tryLine(E, false, j);
    }
    if (!cands.length) return null;
    // no duplicate first, then pairs that stick out before clean pairs (clean ones are only a fallback),
    // then fewest small pieces. Among the rest the pick is random, so the amount sticking out varies
    const key = o => [o.dup, o.outside > 0 ? 0 : 1, o.smalls];
    const cmp = (a, z) => {
      const ka = key(a), kz = key(z);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kz[i]) return ka[i] - kz[i];
      return 0;
    };
    cands.sort(cmp);
    const top = cands.filter(o => cmp(o, cands[0]) === 0);
    const pick = top[Math.floor(Math.random() * top.length)];
    return [pick.first, pick.second];
  }

  // Fallback builder: random pieces placed one after another on a copy of the board.
  // (Knows nothing about line clears; only guarantees all three can be placed in sequence.)
  function buildSet(b, bigOnly) {
    for (let t = 0; t < 30; t++) {
      let cur = b; const set = [];
      for (let k = 0; k < 3; k++) {
        const opts = SHAPES.filter(s =>
          (!bigOnly || s.cells.length >= MIN_CELLS) &&
          (sets > 2 || s.cells.length <= 6 && (k >= 2 || s.cells.length <= 4)) &&
          fits(cur, s));
        if (!opts.length) break;
        const s = weightedPick(opts);
        const spots = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (canPlace(cur, s, r, c)) spots.push([r, c]);
        const [r, c] = spots[Math.floor(Math.random() * spots.length)];
        cur = applyMove(cur, s, r, c).board; set.push(s);
      }
      if (set.length === 3 && easyOpening(set)) return shuffle(set);
    }
    return null;
  }

  // ---------- Sequential set builder ----------
  // Best spot for a piece: most lines, then least net growth, then smoothest board.
  function bestPlacement(g, s) {
    let before = 0;
    for (let i = 0; i < N; i++) before += POP[g[i]];
    let best = null;
    for (let r = 0; r <= N - s.h; r++) for (let c = 0; c <= N - s.w; c++) {
      if (!simFits(g, s, r, c)) continue;
      const o = simDrop(g, s, r, c);
      o.net = o.left - before; o.rough = rough(o.g); o.r = r; o.c = c;
      if (!best || o.lines > best.lines ||
          (o.lines === best.lines && (o.net < best.net || (o.net === best.net && o.rough < best.rough)))) best = o;
    }
    return best;
  }

  // links = array of target pairs from zigzags already picked in this set.
  // A linked L pair penalty replaces (does not stack with) the same-base penalty.
  const dupPenalty = (s, set, links = []) => set.reduce((m, x) => {
    let f = 1;
    if (x.id === s.id) f = DUP_SAME_SHAPE;
    else if (links.some(t => t.includes(s.id) && t.includes(x.id))) f = ZIG_PAIR_PENALTY;
    else if (x.base === s.base) f = DUP_SAME_BASE;
    return m * f;
  }, 1);

  // Big pieces first: keep only pieces of MIN_CELLS+ cells if there are any, otherwise keep everything.
  // Small pieces are a last resort, used only when no big piece qualifies.
  const preferBig = (arr, shapeOf = x => x) => {
    const big = arr.filter(x => shapeOf(x).cells.length >= MIN_CELLS);
    return big.length ? big : arr;
  };

  // Can this piece clear at least one line somewhere on grid g?
  function clearsAny(g, s) {
    for (let r = 0; r <= N - s.h; r++) for (let c = 0; c <= N - s.w; c++) {
      if (simFits(g, s, r, c) && simDrop(g, s, r, c).lines > 0) return true;
    }
    return false;
  }

  // One piece at a time. Each slot sees the board as if the earlier pieces were already placed.
  // Slot 1 always fits the real board, so at least one piece is always placeable.
  // A zigzag in slot 1 or 2 boosts its matching L4 pair in the later slots of the same set.
  // mustClear: the set has to clear a line in the simulation. If nothing has cleared before slot 2,
  // slot 2 is limited to pieces that clear or leave a clear for some slot-3 piece; if nothing has
  // cleared before slot 3, slot 3 is limited to pieces that clear.
  // forced: a line-perfect {s, r, c, lines} that takes slot 1 at a fixed spot, or an array of two
  // (a 2-block perfect or a 1-line pair) that takes slots 1 and 2 at fixed spots.
  // Chain: when slot 1 is forced, slot 2 re-runs the line-perfect checker on the simulated board
  // after slot 1 popped (PERFECT_CHAIN_CHANCE). If slot 2 was perfect too, slot 3 does the same on the
  // board after slot 2 popped (PERFECT_CHAIN3_CHANCE). A slot that is not perfect ends the chain.
  // After a 2-block perfect or a 1-line pair (slots 1-2 forced), slot 3 may still chain a line-perfect
  // the same way.
  // Line-perfect then 2-block: when slot 1 is a line-perfect, slot 2 first rolls PERFECT_LINE_THEN_2BLOCK_CHANCE
  // to look for a 2-block perfect on the board after slot 1 popped. If found, it takes slots 2 and 3.
  // If not found (or the roll misses), slot 2 falls back to the normal line-perfect chain.
  function sequentialSet(b, mustClear, forced) {
    const live = SHAPES.filter(s => s.baseWeight > 0 && fits(b, s) && (sets > 2 || s.cells.length <= 6));
    let W = b, g = toMask(b);
    const set = [], trace = [];
    let totalLines = 0;   // lines cleared so far in the simulation
    let zigLinks = [];    // target L4 pairs activated by zigzags picked in slots 1-2
    const presets = !forced ? [] : Array.isArray(forced) ? forced : [forced];   // fixed pieces for slot 1 (or slots 1-2)
    let chainOn = presets.length > 0;   // true while the previous slot was a line-perfect
    let perfectCount = 0;               // how many slots of this set were line-perfect (for the console name)
    let pending = [];                   // second piece of a 2-block perfect found mid-set (fixed for the next slot)
    let pairAfterLine = false;          // true when slots 2-3 became a 2-block perfect after a line-perfect in slot 1

    for (let k = 0; k < 3; k++) {
      const needClear = mustClear && totalLines === 0;   // nothing has cleared yet in the simulation

      let pool = [];
      let forcedHere = k < presets.length ? presets[k] : null;
      if (!forcedHere && pending.length) forcedHere = pending.shift();   // second piece of a mid-set 2-block perfect
      if (!forcedHere && k === 1 && chainOn && presets.length === 1 && Math.random() < PERFECT_LINE_THEN_2BLOCK_CHANCE) {
        // slot 1 was a line-perfect: look for a 2-block perfect on the board after it popped (slots 2 and 3)
        const pr = findTwoBlockPerfect(W, set.map(x => x.id));
        if (pr) { forcedHere = pr[0]; pending = [pr[1]]; pairAfterLine = true; }
      }
      if (!forcedHere && k > 0 && chainOn && Math.random() < (k === 1 ? PERFECT_CHAIN_CHANCE : PERFECT_CHAIN3_CHANCE)) {
        // W is the board after the previous slot was placed and popped in the simulation
        forcedHere = findLinePerfect(W, set.map(x => x.id), true) || null;
      }
      chainOn = !!forcedHere;   // the chain only continues while each slot was line-perfect
      if (forcedHere && !simFits(g, forcedHere.s, forcedHere.r, forcedHere.c)) return null;   // safety: preset must fit the simulated board
      if (forcedHere) {
        // line-perfect piece: fixed shape and fixed spot
        pool.push({ s: forcedHere.s, p: { r: forcedHere.r, c: forcedHere.c }, pen: 1, zig: 1, w: 1 });
      }
      for (const s of forcedHere ? [] : live) {
        const p = bestPlacement(g, s);
        if (!p) continue; // does not fit the simulated board
        const pen = dupPenalty(s, set, zigLinks);
        const zig = zigLinks.some(t => t.includes(s.id)) ? ZIG_L_BOOST : 1;
        pool.push({ s, p, pen, zig, w: s.baseWeight * pen * zig });
      }

      if (!pool.length) {
        // Nothing fits the simulated board: use a filler that fits the REAL board (slots 2-3 only).
        if (k === 0) return null;
        if (needClear && k === 2) return null;   // slot 3 had to clear and cannot
        const filler = weightedPick(preferBig(live), s => s.baseWeight * dupPenalty(s, set, zigLinks));
        if (!filler) return null;
        set.push(filler);
        trace.push(`slot${k + 1}: FILLER (nothing fit simulated board) -> ${filler.id}`);
        continue;
      }

      // Solvability guarantee
      if (needClear && k === 1) {
        // Slot 2: clear now, or leave the board so that some slot-3 piece can clear.
        pool = pool.filter(o => o.p.lines > 0 || live.some(s => clearsAny(o.p.g, s)));
        if (!pool.length) return null;
        pool = preferBig(pool, o => o.s);   // big pieces first, small only if no big one qualifies
      } else if (needClear && k === 2) {
        // Slot 3: the last chance, it has to clear.
        pool = pool.filter(o => o.p.lines > 0);
        if (!pool.length) return null;
        pool = preferBig(pool, o => o.s);   // big pieces first, small only if no big one qualifies
      }

      const pick = weightedPick(pool, o => o.w);
      if (forcedHere) perfectCount++;
      set.push(pick.s);
      if (k < 2 && ZIG_L[pick.s.id]) zigLinks.push(ZIG_L[pick.s.id]);
      const res = applyMove(W, pick.s, pick.p.r, pick.p.c); // simulated, includes line clears
      W = res.board;
      g = toMask(W);
      totalLines += res.lines;
      trace.push(
        `slot${k + 1}: pool=${pool.length} -> ${pick.s.id}` +
        ` dupPenalty=${pick.pen} zigBoost=${pick.zig} simLines=${res.lines}` +
        (needClear ? " rescue=true" : "") +
        (forcedHere ? ` PERFECT${forcedHere.pair ? "-PAIR" : ""} lines=${forcedHere.lines}` : "")
      );
    }
    if (mustClear && totalLines === 0) return null;
    return { set, trace, perfectCount, pairAfterLine };
  }

  // ---------- Entry point ----------
  function generatePieces(b) {
    sets++;
    const filled = filledCells(b);

    // 2-block perfect (highest priority): slots 1 and 2 are two pieces that together clear
    // 2 consecutive lines with no stick outs. Slot 3 may still chain a line-perfect (PERFECT_CHAIN3_CHANCE).
    const pair = findTwoBlockPerfect(b);
    if (pair && Math.random() < PERFECT_PAIR_CHANCE) {
      for (let t = 0; t < SET_TRIES; t++) {
        const r = sequentialSet(b, false, pair);
        if (r && easyOpening(r.set)) {
          const name = "line-perfect-2BLOCK" + (r.perfectCount > 2 ? "-CHAIN3" : "");
          return logPath(name, b, shuffle(r.set), r.trace, t + 1);
        }
      }
    }

    // Line-perfect: the checker runs before the normal builder. Slot 1 gets a piece that clears 2 lines
    // (or 1 line without reaching a third line). Slot 2 is checked again on the board after slot 1 pops
    // (PERFECT_CHAIN_CHANCE), and slot 3 on the board after slot 2 pops (PERFECT_CHAIN3_CHANCE, only if
    // slot 2 was perfect). Any slot that is not perfect is built normally.
    const perfect = findLinePerfect(b);
    if (perfect && Math.random() < PERFECT_LINE_CHANCE) {
      for (let t = 0; t < SET_TRIES; t++) {
        const r = sequentialSet(b, false, perfect);
        if (r && easyOpening(r.set)) {
          // console name: line-perfect-<lines cleared by slot 1>, plus -CHAIN2 / -CHAIN3 when more slots were perfect
          const name = `line-perfect-${perfect.lines}` + (r.pairAfterLine ? "-THEN2BLOCK" : r.perfectCount > 1 ? `-CHAIN${r.perfectCount}` : "");
          return logPath(name, b, shuffle(r.set), r.trace, t + 1);
        }
      }
    }

    // 1-line pair (lowest priority of the perfects): two pieces that together clear one line when no
    // single piece can. Slots 1 and 2 are fixed to the pair; slot 3 may still chain a line-perfect
    // (PERFECT_CHAIN3_CHANCE). Used PERFECT_LINEPAIR_CHANCE of the time when one exists.
    const linePair = findOneLinePair(b);
    if (linePair && Math.random() < PERFECT_LINEPAIR_CHANCE) {
      for (let t = 0; t < SET_TRIES; t++) {
        const r = sequentialSet(b, false, linePair);
        if (r && easyOpening(r.set)) {
          const name = "line-perfect-LINEPAIR" + (r.perfectCount > 2 ? "-CHAIN3" : "");
          return logPath(name, b, shuffle(r.set), r.trace, t + 1);
        }
      }
    }

    // Main path: sequential builder.
    // On a busy board the first pass requires the set to clear a line in the simulation (solvable).
    // If that cannot be built in SET_TRIES attempts, a second pass runs without the requirement.
    const mustClear = GUARANTEE_CLEAR && filled >= GUARANTEE_MIN_CELLS;
    for (const guard of mustClear ? [true, false] : [false]) {
      for (let t = 0; t < SET_TRIES; t++) {
        const r = sequentialSet(b, guard);
        if (r && easyOpening(r.set)) {
          const path = mustClear && !guard ? "sequential-NO-GUARANTEE" : "sequential";
          return logPath(path, b, shuffle(r.set), r.trace, t + 1);
        }
      }
    }

    // Fallbacks
    const built = buildSet(b, true) || buildSet(b, false);
    if (built) return logPath("buildSet-fallback", b, built);
    const any = SHAPES.filter(s => fits(b, s));
    return logPath("last-resort", b, [0, 1, 2].map(() => any.length ? any[Math.floor(Math.random() * any.length)] : SHAPES[0]));
  }