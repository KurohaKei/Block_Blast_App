  const emptyBoard = () => Array.from({ length: N }, () => Array(N).fill(null));
  const clone = b => b.map(r => r.slice());
  const filledCells = b => b.reduce((count, row) => count + row.filter(Boolean).length, 0);
  const isEmpty = b => b.every(row => row.every(cell => !cell));

  function canPlace(b, s, r, c) {
    return s.cells.every(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      return rr >= 0 && rr < N && cc >= 0 && cc < N && !b[rr][cc];
    });
  }
  function fits(b, s) {
    for (let r = 0; r <= N - s.h; r++) {
      for (let c = 0; c <= N - s.w; c++) {
        if (canPlace(b, s, r, c)) return true;
      }
    }
    return false;
  }
  function applyMove(b, s, r, c) {
    const nb = clone(b);
    s.cells.forEach(([dr, dc]) => (nb[r + dr][c + dc] = s.paletteIndex + 1));
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) {
      if (nb[i].every(Boolean)) rows.push(i);
      if (nb.every(row => row[i])) cols.push(i);
    }
    const before = rows.length + cols.length ? clone(nb) : null;
    rows.forEach(i => { for (let k = 0; k < N; k++) nb[i][k] = null; });
    cols.forEach(i => { for (let k = 0; k < N; k++) nb[k][i] = null; });
    return { board: nb, lines: rows.length + cols.length, rows, cols, before };
  }
 
