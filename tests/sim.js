const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CONFIG = {
  games: Math.max(1, Number(process.argv[2]) || 300),
  seed: Number(process.argv[3]) || 20261022,
  beamWidth: 64,
  maxSetsPerGame: 100
};

const root = path.resolve(__dirname, "..");

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGame(random) {
  const seededMath = Object.create(Math);
  seededMath.random = random;
  const context = vm.createContext({
    Math: seededMath,
    sets: 0,
    stash: null,
    streak: 0,
    score: 0,
    popped: false,
    helpStreak: 0
  });
  for (const file of ["js/shapes.js", "js/board.js", "js/generator.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  context.api = vm.runInContext("({ N, emptyBoard, fits, applyMove, isEmpty, generatePieces })", context);
  return context;
}

function rowMasks(board) {
  return board.map(row => row.reduce((mask, cell, col) => mask | (cell ? 1 << col : 0), 0));
}

function bitCount(value) {
  value -= (value >>> 1) & 0x55;
  value = (value & 0x33) + ((value >>> 2) & 0x33);
  return (value + (value >>> 4)) & 0x0f;
}

function boardRoughness(rows, size) {
  let roughness = 0;
  for (let row = 0; row < size; row++) {
    roughness += bitCount((rows[row] ^ (rows[row] >> 1)) & ((1 << (size - 1)) - 1));
    if (row < size - 1) roughness += bitCount(rows[row] ^ rows[row + 1]);
  }
  return roughness;
}

function drop(rows, piece, row, col, size) {
  const next = rows.slice();
  for (const [dr, dc] of piece.cells) next[row + dr] |= 1 << (col + dc);
  let fullColumns = (1 << size) - 1, lines = 0;
  for (const value of next) fullColumns &= value;
  lines += bitCount(fullColumns);
  for (let index = 0; index < size; index++) {
    if (next[index] === (1 << size) - 1) { lines++; next[index] = 0; }
    else next[index] &= ~fullColumns;
  }
  return { rows: next, lines };
}

function canSolve(rows, pieces, size) {
  const memo = new Set();
  function search(current, remaining) {
    if (!remaining.length) return true;
    const key = `${remaining.join("")}:${current.join(",")}`;
    if (memo.has(key)) return false;
    for (const index of remaining) {
      const piece = pieces[index];
      for (let row = 0; row <= size - piece.h; row++) for (let col = 0; col <= size - piece.w; col++) {
        let fits = true;
        for (const [dr, dc] of piece.cells) {
          if (current[row + dr] & (1 << (col + dc))) { fits = false; break; }
        }
        if (!fits) continue;
        const next = drop(current, piece, row, col, size);
        if (search(next.rows, remaining.filter(i => i !== index))) return true;
      }
    }
    memo.add(key);
    return false;
  }
  return search(rows, pieces.map((_, i) => i));
}

function bestSetOrder(board, pieces, size) {
  const initial = { rows: rowMasks(board), remaining: pieces.map((_, i) => i), moves: [], lines: 0 };
  let frontier = [initial], bestPartial = initial, bestComplete = null, hasClearingMove = false;

  for (let depth = 0; depth < pieces.length && frontier.length; depth++) {
    const next = new Map();
    for (const state of frontier) for (const index of state.remaining) {
      const piece = pieces[index];
      for (let row = 0; row <= size - piece.h; row++) for (let col = 0; col <= size - piece.w; col++) {
        let fits = true;
        for (const [dr, dc] of piece.cells) {
          if (state.rows[row + dr] & (1 << (col + dc))) { fits = false; break; }
        }
        if (!fits) continue;
        const move = drop(state.rows, piece, row, col, size);
        if (move.lines) hasClearingMove = true;
        const candidate = {
          rows: move.rows,
          remaining: state.remaining.filter(i => i !== index),
          moves: [...state.moves, { piece, row, col }],
          lines: state.lines + move.lines
        };
        const candidateRoughness = boardRoughness(candidate.rows, size);
        const bestRoughness = boardRoughness(bestPartial.rows, size);
        if (candidate.moves.length > bestPartial.moves.length ||
            candidate.moves.length === bestPartial.moves.length &&
            (candidate.lines > bestPartial.lines ||
            candidate.lines === bestPartial.lines && candidateRoughness < bestRoughness)) bestPartial = candidate;
        if (candidate.moves.length === pieces.length &&
            (!bestComplete || candidate.lines > bestComplete.lines ||
            candidate.lines === bestComplete.lines &&
            candidateRoughness < boardRoughness(bestComplete.rows, size))) bestComplete = candidate;

        const key = `${candidate.remaining.join("")}:${candidate.rows.join(",")}`;
        const prior = next.get(key);
        if (!prior || candidate.lines > prior.lines ||
            candidate.lines === prior.lines &&
            candidateRoughness < boardRoughness(prior.rows, size)) next.set(key, candidate);
      }
    }
    frontier = [...next.values()]
      .sort((a, b) => b.lines - a.lines || boardRoughness(a.rows, size) - boardRoughness(b.rows, size))
      .slice(0, CONFIG.beamWidth);
  }

  return {
    plan: bestComplete || bestPartial,
    solvable: canSolve(initial.rows, pieces, size),
    hasClearingMove
  };
}

function simulateOne(random) {
  const context = makeGame(random);
  let board = context.api.emptyBoard(), piecesPlaced = 0, setsPlayed = 0, setsWithClear = 0, openingViolations = 0;
  let score = 0, streak = 0, longestStreak = 0, unsolvableSets = 0, capped = false;
  let streakThreeSets = 0, streakThreeSetsWithClear = 0;
  const generationTimes = [];

  function generate() {
    const start = process.hrtime.bigint();
    const result = context.api.generatePieces(board);
    generationTimes.push(Number(process.hrtime.bigint() - start) / 1e6);
    if (context.sets <= 2 &&
        (!result.every(piece => piece.cells.length <= 6) ||
        result.filter(piece => piece.cells.length <= 4).length < 2)) openingViolations++;
    return result;
  }

  context.streak = streak;
  let pieces = generate();
  while (true) {
    const canPlaceAny = pieces.some(piece => piece && context.api.fits(board, piece));
    if (!canPlaceAny) break;
    const result = bestSetOrder(board, pieces.filter(Boolean), context.api.N);
    const setHadClear = result.hasClearingMove;
    setsPlayed++;
    if (setHadClear) setsWithClear++;
    if (streak >= 3) {
      streakThreeSets++;
      if (setHadClear) streakThreeSetsWithClear++;
    }
    if (!result.solvable) unsolvableSets++;
    if (!result.plan.moves.length) break;

    let setPopped = false;
    for (const move of result.plan.moves) {
      const mult = 1 + streak;
      const applied = context.api.applyMove(board, move.piece, move.row, move.col);
      board = applied.board;
      const clear = context.api.isEmpty(board);
      score += move.piece.cells.length + applied.lines * (10 + 5 * Math.floor(mult / 5)) * mult * (clear ? 2 : 1);
      piecesPlaced++;
      if (applied.lines > 0) { streak++; setPopped = true; }
      longestStreak = Math.max(longestStreak, streak);
      context.streak = streak;
      context.popped = setPopped;
    }

    if (!setPopped) streak = 0;
    context.streak = streak;
    context.popped = false;
    if (!result.solvable) break;
    if (setsPlayed >= CONFIG.maxSetsPerGame) { capped = true; break; }
    pieces = generate();
  }

  return {
    piecesPlaced, score, setsPlayed, setsWithClear, longestStreak,
    streakThreeSets, streakThreeSetsWithClear, unsolvableSets, openingViolations, generationTimes, capped
  };
}

const random = randomFrom(CONFIG.seed);
const results = [];
for (let i = 0; i < CONFIG.games; i++) results.push(simulateOne(random));

const pieceCounts = results.map(result => result.piecesPlaced).sort((a, b) => a - b);
const median = pieceCounts.length % 2
  ? pieceCounts[(pieceCounts.length - 1) / 2]
  : (pieceCounts[pieceCounts.length / 2 - 1] + pieceCounts[pieceCounts.length / 2]) / 2;
const total = (key) => results.reduce((sum, result) => sum + result[key], 0);
const setsPlayed = total("setsPlayed");
const generationTimes = results.flatMap(result => result.generationTimes);
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const longestStreaks = results.map(result => result.longestStreak);
const streakThreeSets = total("streakThreeSets");

console.log(`Configuration: ${JSON.stringify(CONFIG)}`);
console.log(`Games: ${CONFIG.games} (seed ${CONFIG.seed})`);
console.log(`Games reaching set cap: ${total("capped")}`);
console.log(`Average pieces placed per game: ${average(pieceCounts).toFixed(2)}`);
console.log(`Median pieces placed per game: ${median}`);
console.log(`Average score: ${(total("score") / CONFIG.games).toFixed(2)}`);
console.log(`Sets with at least one clearing move: ${setsPlayed ? (100 * total("setsWithClear") / setsPlayed).toFixed(2) : "0.00"}%`);
console.log(`Average generatePieces time: ${average(generationTimes).toFixed(3)} ms`);
console.log(`Maximum generatePieces time: ${Math.max(0, ...generationTimes).toFixed(3)} ms`);
console.log(`Unsolvable sets: ${total("unsolvableSets")}`);
console.log(`Easy-opening violations: ${total("openingViolations")}`);
console.log(`Average longest streak per game: ${average(longestStreaks).toFixed(2)}`);
console.log(`Games reaching streak >= 7: ${(100 * results.filter(result => result.longestStreak >= 7).length / CONFIG.games).toFixed(2)}%`);
console.log(`Streak >= 3 sets with a clearing move: ${streakThreeSets ? (100 * total("streakThreeSetsWithClear") / streakThreeSets).toFixed(2) : "0.00"}%`);
