const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
let now = 0;
const draws = [];
const context2d = {
  font: "900 20px sans-serif",
  lineWidth: 1,
  shadowBlur: 0,
  save() {},
  restore() {},
  measureText(text) {
    const size = Number(this.font.match(/(\d+)px/)[1]);
    return { width: [...text].length * size * 0.62, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.25 };
  },
  strokeText(text, x, y) { draws.push({ text, x, y, width: this.measureText(text).width, font: this.font, stroke: this.lineWidth, shadow: this.shadowBlur }); },
  fillText(text, x, y) { draws.push({ text, x, y, width: this.measureText(text).width, font: this.font, stroke: this.lineWidth, shadow: this.shadowBlur }); },
  createLinearGradient() { return { addColorStop() {} }; }
};
const theme = { accent: "#ffbd32", accentSoft: "#ffdc7b", glow: "#ffc440", glint: "#fffbe0" };
const sandbox = vm.createContext({
  N: 8, CELL: 40, SIZE: 320, settings: { reducedMotion: false }, bx: context2d,
  getTheme: () => theme, performance: { now: () => now },
  comboColor: () => theme.accent
});
vm.runInContext(fs.readFileSync(path.join(root, "js", "effects.js"), "utf8"), sandbox);

const cases = [
  { name: "top row", rows: [0], cols: [], combo: 1, lines: 1, clear: false },
  { name: "bottom row", rows: [7], cols: [], combo: 2, lines: 1, clear: false },
  { name: "left column", rows: [], cols: [0], combo: 3, lines: 1, clear: false },
  { name: "right column", rows: [], cols: [7], combo: 4, lines: 1, clear: false },
  { name: "five-line high combo perfect", rows: [0, 1, 2], cols: [0, 1], combo: 20, lines: 5, clear: true }
];
const timestamps = [0, 180, 270, 450, 800, 1200, 1490];

for (const testCase of cases) {
  now = 0;
  draws.length = 0;
  vm.runInContext("txts.length = 0", sandbox);
  sandbox.startText({ rows: testCase.rows, cols: testCase.cols }, 987654, testCase.combo, testCase.clear, testCase.lines);
  const layout = vm.runInContext(`txts.map(event => {
    const grow = event.kind === "combo" ? 1.23 : 1;
    const dimensions = textDimensions(event, Math.round(event.size * grow));
    return { kind: event.kind, y: event.y, height: dimensions.height, floatDistance: event.floatDistance || 0 };
  })`, sandbox);
  for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
    const a = layout[i], b = layout[j];
    assert(a.y + a.height / 2 <= b.y - b.height / 2 || b.y + b.height / 2 <= a.y - a.height / 2,
      `${testCase.name}: ${a.kind} overlaps ${b.kind}`);
  }
  for (const timestamp of timestamps) {
    now = timestamp;
    vm.runInContext("drawTxt()", sandbox);
    for (const draw of draws.splice(0)) {
      const size = Number(draw.font.match(/(\d+)px/)[1]);
      const height = size * 1.05;
      const padding = draw.stroke / 2 + draw.shadow + 2;
      assert(draw.x - draw.width / 2 - padding >= 0, `${testCase.name}: ${draw.text} clipped on left`);
      assert(draw.x + draw.width / 2 + padding <= 320, `${testCase.name}: ${draw.text} clipped on right`);
      assert(draw.y - height / 2 - padding >= 0, `${testCase.name}: ${draw.text} clipped at top`);
      assert(draw.y + height / 2 + padding <= 320, `${testCase.name}: ${draw.text} clipped at bottom`);
    }
  }
}

console.log(`Text layout bounds passed for ${cases.length} edge, combo, praise, and Perfect cases.`);
