// ---------- Tuning ----------
  const DEBUG_GEN = true;            // set to false to silence the console logs
  const ASSIST_MAX = 0.90;           // was 0.85
  const MID_SETS = 3;
  const SPARSE_CELLS_1 = 24, SPARSE_ASSIST_1 = 0.45;
  const SPARSE_CELLS_2 = 16, SPARSE_ASSIST_2 = 0.7;
  const BEAM = 4;
  const HOLE_MIN = 4, HOLE_MAX = 9;
  const PERFECT_CELLS = 25;
  const PERFECT_TRIES = 60;
  const PERFECT_CHANCE = 0.35;       // was 0.25
  const CARRY_CHANCE = 0.15;

  // Sequential set builder
  const HELP_SHARE_CAP = 0.5;        // max share of a helped slot's pool going to boosted pieces
  const BOOST_MIN_CELLS = 4;         // smaller pieces get no clear/hole boost (unless crisis)
  const CLEAR_BOOST_1 = 3;           // best placement clears 1 line
  const CLEAR_BOOST_2 = 4.5;         // best placement clears 2+ lines
  const OVERHANG_SOFTEN = 0.15;      // boost shrinks as cells left on the board grow
  const HOLE_FIT_BOOST = 2.5;        // piece exactly fills an enclosed hole (4+ cells)
  const DUP_SAME_SHAPE = 0.1;        // same orientation already in this set
  const DUP_SAME_BASE = 0.4;         // same base shape, other rotation, already in this set
  const HELP_P_MIN = 0.25, HELP_P_SPAN = 0.6;  // per-slot help chance = MIN + SPAN * assist (MIN was 0.2)
  const SET_TRIES = 15;

  // Solvability guarantee: on a busy board the set must clear at least one line in the simulation.
  // If slot 1 clears nothing, slot 2 must clear or set up a clear, and slot 3 must clear.
  const GUARANTEE_CLEAR = true;
  const GUARANTEE_MIN_CELLS = 30;    // guarantee applies when the real board has at least this many filled cells

  // Line-perfect checker (runs before the normal builder)
  const PERFECT_LINE_CHANCE = 1;     // chance a found line-perfect is used (1 = always)
  const PERFECT_MAX_SPAN = 2;        // a 1-line perfect may span at most this many lines across the cleared line
  const PERFECT_CHAIN_CHANCE = 1;    // chance slot 2 also gets a line-perfect, checked on the board after slot 1 pops (1 = always)

  // Zigzag -> matching L4 pair (boosts those L4s in later slots of the same set)
  const ZIG_L_BOOST = 1.5;                    // modest multiplier on the L4's base weight
  const ZIG_PAIR_PENALTY = DUP_SAME_SHAPE;    // if one L of a linked pair is in the set, the other gets this
  const ZIG_L = {
    "zigzag4-0":         ["L4-90", "L4-270"],
    "zigzag4-90":        ["L4-180", "L4-0"],
    "zigzag4-0-mirror":  ["L4-270-mirror", "L4-90-mirror"],
    "zigzag4-90-mirror": ["L4-0-mirror", "L4-180-mirror"]
  };

  // Crowded board: affects the FIRST slot only
  const CROWD_START = 0.55, CROWD_FULL = 0.85; // board fill range mapped to crowd 0..1
  const CRISIS_BOOST = 2;            // clear boost multiplier grows by this * crowd
  const CRISIS_CAP_EXTRA = 0.3;      // share cap grows by this * crowd (0.5 -> 0.8)
  const CRISIS_SMALL_OK = 0.7;       // at this crowd, small pieces can get the clear boost too

  let helpStreak = 0;
  SHAPES.forEach(s => { s.m = Array(s.h).fill(0); s.cells.forEach(([r, c]) => (s.m[r] |= 1 << c)); });
  const POP = Array.from({ length: 256 }, (_, v) => v.toString(2).replace(/0/g, "").length);

  // ---------- Helpers ----------
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rectCells = (h, w) => { const cs = []; for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cs.push([r, c]); return cs; };
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
  const shapeFor = cells => weightedPick((BY_KEY.get(cellsKey(cells)) || []).filter(s => s.baseWeight > 0));
  const smallCount = set => set.filter(s => s.cells.length < MIN_CELLS).length;
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

  function tileRect(h, w) {
    if (h * w < HOLE_MIN) return null;
    const whole = shapeFor(rectCells(h, w));
    if (whole) return [whole];
    const halves = [];
    if (w % 2 === 0) halves.push([h, w / 2]);
    if (h % 2 === 0) halves.push([h / 2, w]);
    for (const [a, e] of shuffle(halves)) {
      const part = tileRect(a, e);
      if (part && part.length * 2 <= 3) return [...part, ...part];
    }
    return null;
  }

  // Enclosed empty regions (4+ cells) and the shapes that would fill them exactly.
  function holeGroups(b) {
    const seen = Array.from({ length: N }, () => Array(N).fill(false)), out = [];
    for (let r0 = 0; r0 < N; r0++) for (let c0 = 0; c0 < N; c0++) {
      if (b[r0][c0] || seen[r0][c0]) continue;
      const hole = [], stack = [[r0, c0]];
      seen[r0][c0] = true;
      while (stack.length) {
        const [r, c] = stack.pop(); hole.push([r, c]);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N && !b[rr][cc] && !seen[rr][cc]) { seen[rr][cc] = true; stack.push([rr, cc]); }
        }
      }
      if (hole.length < HOLE_MIN) continue;
      const mr = Math.min(...hole.map(x => x[0])), mc = Math.min(...hole.map(x => x[1]));
      const bh = Math.max(...hole.map(x => x[0])) - mr + 1, bw = Math.max(...hole.map(x => x[1])) - mc + 1;
      if (hole.length === bh * bw) {
        const t = tileRect(bh, bw);
        if (t) out.push(t);
      } else if (hole.length <= HOLE_MAX) {
        const m = shapeFor(hole.map(([r, c]) => [r - mr, c - mc]));
        if (m) out.push([m]);
      }
    }
    return out;
  }

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

  // Can this set clear the whole board in some order? (used by the perfect-clear paths)
  function evaluate(b, set) {
    let best = null;
    const used = [false, false, false];
    const go = (g, n, lines, perfect) => {
      if (n === set.length) {
        const score = lines * 10 - rough(g) * 0.3 + (perfect ? 100 : 0);
        if (!best || score > best.score) best = { score, perfect };
        return;
      }
      for (let i = 0; i < set.length; i++) {
        if (used[i]) continue;
        const s = set[i], opts = [];
        for (let r = 0; r <= N - s.h; r++) for (let c = 0; c <= N - s.w; c++) {
          if (!simFits(g, s, r, c)) continue;
          const o = simDrop(g, s, r, c); o.rough = rough(o.g); opts.push(o);
        }
        opts.sort((a, z) => (z.left === 0) - (a.left === 0) || z.lines - a.lines || a.rough - z.rough);
        used[i] = true;
        for (let k = 0; k < Math.min(BEAM, opts.length); k++) go(opts[k].g, n + 1, lines + opts[k].lines, perfect || opts[k].left === 0);
        used[i] = false;
      }
    };
    go(toMask(b), 0, 0, false);
    return best;
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

  function findLinePerfect(b, avoid = []) {
    const g = toMask(b);
    let colsUsed = 0;
    for (let i = 0; i < N; i++) colsUsed |= g[i];
    const cands = [];
    for (const s of SHAPES) {
      if (s.baseWeight <= 0 || (sets <= 2 && s.cells.length > 6)) continue;
      if (avoid.includes(s.id)) continue;   // don't repeat a piece already in this set
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
    const key = o => [-o.lines, o.small ? 1 : 0, o.small ? -o.s.cells.length : 0, o.empty, o.left];
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

  function assistLevel(b) {
    const cells = filledCells(b);
    const fill = cells / (N * N);
    const byFill = Math.min(1, Math.max(0, (fill - 0.2) / 0.4));
    const sparse = sets <= MID_SETS ? 0 : cells >= 1 && cells <= SPARSE_CELLS_2 ? SPARSE_ASSIST_2 : cells <= SPARSE_CELLS_1 ? SPARSE_ASSIST_1 : 0;
    return Math.max(ASSIST_MAX * byFill, sparse);
  }

  const crowdLevel = b => {
    const fill = filledCells(b) / (N * N);
    return Math.min(1, Math.max(0, (fill - CROWD_START) / (CROWD_FULL - CROWD_START)));
  };

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

  function helpBoost(s, p, inHole, crowd) {
    if (s.cells.length < BOOST_MIN_CELLS && crowd < CRISIS_SMALL_OK) return 1;
    let boost = 1;
    if (p.lines > 0) {
      const raw = (p.lines >= 2 ? CLEAR_BOOST_2 : CLEAR_BOOST_1) * (1 + CRISIS_BOOST * crowd);
      boost = 1 + (raw - 1) / (1 + OVERHANG_SOFTEN * Math.max(0, p.net));
    }
    if (inHole && s.cells.length >= BOOST_MIN_CELLS) boost *= HOLE_FIT_BOOST;
    return boost;
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

  // Boosted pieces together may not exceed `cap` of the pool (soft: never below their own base weight).
  function capHelpShare(pool, cap) {
    let hot = 0, rest = 0;
    for (const o of pool) { if (o.boosted) hot += o.w; else rest += o.w; }
    if (!hot || !rest) return;
    const max = rest * cap / (1 - cap);
    if (hot <= max) return;
    const f = max / hot;
    for (const o of pool) if (o.boosted) o.w = Math.max(o.base, o.w * f);
  }

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
  // Slots 2 and 3 are only helped if the previous piece actually cleared a line in the simulation (a chain).
  // A zigzag in slot 1 or 2 boosts its matching L4 pair in the later slots of the same set.
  // mustClear: the set has to clear a line in the simulation. If nothing has cleared before slot 2,
  // slot 2 is limited to pieces that clear or leave a clear for some slot-3 piece; if nothing has
  // cleared before slot 3, slot 3 is limited to pieces that clear.
  // forced: a line-perfect {s, r, c, lines} that takes slot 1 at a fixed spot.
  // Chain: when slot 1 is forced, slot 2 re-runs the line-perfect checker on the simulated board
  // after slot 1 popped (PERFECT_CHAIN_CHANCE). Slot 3 is built normally.
  function sequentialSet(b, assist, helpAllowed, crowd, mustClear, forced) {
    const live = SHAPES.filter(s => s.baseWeight > 0 && fits(b, s) && (sets > 2 || s.cells.length <= 6));
    let W = b, g = toMask(b);
    const set = [], trace = [];
    let helped = false;
    let lastLines = 0;
    let totalLines = 0;   // lines cleared so far in the simulation
    let zigLinks = [];   // target L4 pairs activated by zigzags picked in slots 1-2
    const sustain = !popped && streak >= 2 ? Math.min(0.3, 0.1 * streak) : 0;
    const pHelp = Math.min(0.95, HELP_P_MIN + HELP_P_SPAN * assist + sustain);

    for (let k = 0; k < 3; k++) {
      const slotCrowd = k === 0 ? crowd : 0;
      const crisis = slotCrowd > 0;
      const chain = k === 0 || lastLines > 0;
      const chance = crisis ? Math.max(pHelp, slotCrowd) : pHelp;
      const wantHelp = chain && (helpAllowed || crisis) && Math.random() < chance;
      const cap = HELP_SHARE_CAP + CRISIS_CAP_EXTRA * slotCrowd;
      const holes = wantHelp ? new Set(holeGroups(W).flat()) : null;

      const needClear = mustClear && totalLines === 0;   // nothing has cleared yet in the simulation

      let pool = [];
      let forcedHere = k === 0 ? forced : null;
      if (k === 1 && forced && Math.random() < PERFECT_CHAIN_CHANCE) {
        // W is the board after slot 1 was placed and popped in the simulation
        forcedHere = findLinePerfect(W, set.map(x => x.id)) || null;
      }
      if (forcedHere) {
        // line-perfect piece: fixed shape and fixed spot
        pool.push({ s: forcedHere.s, p: { r: forcedHere.r, c: forcedHere.c }, pen: 1, zig: 1, base: 1, w: 1, boosted: false });
      }
      for (const s of forcedHere ? [] : live) {
        const p = bestPlacement(g, s);
        if (!p) continue; // does not fit the simulated board
        const pen = dupPenalty(s, set, zigLinks);
        const zig = zigLinks.some(t => t.includes(s.id)) ? ZIG_L_BOOST : 1;
        const base = s.baseWeight * pen * zig;
        const boost = wantHelp ? helpBoost(s, p, holes.has(s), slotCrowd) : 1;
        pool.push({ s, p, pen, zig, base, w: base * boost, boosted: boost > 1 });
      }

      if (!pool.length) {
        // Nothing fits the simulated board: use a filler that fits the REAL board (slots 2-3 only).
        if (k === 0) return null;
        if (needClear && k === 2) return null;   // slot 3 had to clear and cannot
        const filler = weightedPick(preferBig(live), s => s.baseWeight * dupPenalty(s, set, zigLinks));
        if (!filler) return null;
        set.push(filler);
        lastLines = 0;
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

      if (wantHelp) capHelpShare(pool, cap);
      const pick = weightedPick(pool, o => o.w);
      if (pick.boosted) helped = true;
      set.push(pick.s);
      if (k < 2 && ZIG_L[pick.s.id]) zigLinks.push(ZIG_L[pick.s.id]);
      const res = applyMove(W, pick.s, pick.p.r, pick.p.c); // simulated, includes line clears
      W = res.board;
      g = toMask(W);
      lastLines = res.lines;
      totalLines += res.lines;
      trace.push(
        `slot${k + 1}: chain=${chain} help=${wantHelp} pool=${pool.length} -> ${pick.s.id}` +
        ` boosted=${pick.boosted} dupPenalty=${pick.pen} zigBoost=${pick.zig} simLines=${res.lines}` +
        (needClear ? " rescue=true" : "") +
        (forcedHere ? ` PERFECT lines=${forcedHere.lines}` : "")
      );
    }
    if (mustClear && totalLines === 0) return null;
    return { set, helped, trace };
  }

  // ---------- Entry point ----------
  function generatePieces(b) {
    sets++;
    const carried = stash; stash = null;
    const assist = assistLevel(b);
    const crowd = crowdLevel(b);
    const filled = filledCells(b);
    const helpAllowed = helpStreak < 2 || streak >= 3;

    // Plain no-duplicate picker, used only by the perfect-clear search.
    const plain = SHAPES.filter(s => s.baseWeight > 0 && fits(b, s) && (sets > 2 || s.cells.length <= 6));
    const plainSet = () => {
      const set = [];
      for (let i = 0; i < 3; i++) {
        const s = weightedPick(plain.filter(x => !set.some(y => y.id === x.id)));
        if (!s) return null;
        set.push(s);
      }
      return set;
    };

    // Rare override 1: a previously found perfect-clear set
    if (helpAllowed && carried) {
      const e = evaluate(b, carried);
      if (e && e.perfect && easyOpening(carried) && Math.random() < CARRY_CHANCE) {
        helpStreak++;
        return logPath("carried-perfect", b, carried);
      }
    }

    // Rare override 2: search for a board-clearing set
    if (helpAllowed && filled > 0 && filled <= PERFECT_CELLS) {
      const perfects = [];
      for (let t = 0; t < PERFECT_TRIES; t++) {
        const set = plainSet();
        if (!set) break;
        const e = evaluate(b, set);
        if (e && e.perfect && smallCount(set) === 0 && easyOpening(set)) perfects.push(set);
      }
      if (perfects.length) {
        const set = perfects[Math.floor(Math.random() * perfects.length)];
        if (Math.random() < PERFECT_CHANCE) { helpStreak++; return logPath("perfect-search", b, set); }
        stash = set;
      }
    }

    // Line-perfect: the checker runs before the normal builder. Slot 1 gets a piece that clears 2 lines
    // (or 1 line without reaching a third line). Slot 2 is checked again on the board after slot 1 pops
    // (see PERFECT_CHAIN_CHANCE); slot 3 is built normally on the board after that.
    const perfect = findLinePerfect(b);
    if (perfect && Math.random() < PERFECT_LINE_CHANCE) {
      for (let t = 0; t < SET_TRIES; t++) {
        const r = sequentialSet(b, assist, helpAllowed, crowd, false, perfect);
        if (r && easyOpening(r.set)) {
          helpStreak++;
          return logPath(`line-perfect-${perfect.lines}`, b, shuffle(r.set), r.trace, t + 1);
        }
      }
    }

    // Main path: sequential builder.
    // On a busy board the first pass requires the set to clear a line in the simulation (solvable).
    // If that cannot be built in SET_TRIES attempts, a second pass runs without the requirement.
    const mustClear = GUARANTEE_CLEAR && filled >= GUARANTEE_MIN_CELLS;
    for (const guard of mustClear ? [true, false] : [false]) {
      for (let t = 0; t < SET_TRIES; t++) {
        const r = sequentialSet(b, assist, helpAllowed, crowd, guard);
        if (r && easyOpening(r.set)) {
          helpStreak = r.helped ? helpStreak + 1 : 0;
          const path = mustClear && !guard ? "sequential-NO-GUARANTEE" : "sequential";
          return logPath(path, b, shuffle(r.set), r.trace, t + 1);
        }
      }
    }

    // Fallbacks
    helpStreak = 0;
    const built = buildSet(b, true) || buildSet(b, false);
    if (built) return logPath("buildSet-fallback", b, built);
    const any = SHAPES.filter(s => fits(b, s));
    return logPath("last-resort", b, [0, 1, 2].map(() => any.length ? any[Math.floor(Math.random() * any.length)] : SHAPES[0]));
  }