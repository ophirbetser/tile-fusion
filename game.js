"use strict";

const SIZE = 4;
const WIN_VALUE = 2048;
const SLIDE_MS = 110;
const BEST_KEY = "tile-fusion:best";

const els = {
  tiles: document.getElementById("tiles"),
  board: document.getElementById("board"),
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  keepGoing: document.getElementById("keep-going"),
  tryAgain: document.getElementById("try-again"),
  newGame: document.getElementById("new-game"),
};

let grid;          // grid[r][c] = tile | null
let score = 0;
let best = loadBest();
let nextId = 1;
let won = false;
let keepPlaying = false;
let over = false;
const tileEls = new Map(); // tile id -> element

// ---------- storage ----------
function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage unavailable */ }
}

// ---------- grid helpers ----------
function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function emptyCells() {
  const cells = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) cells.push([r, c]);
  return cells;
}

function spawnTile() {
  const cells = emptyCells();
  if (!cells.length) return;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  grid[r][c] = { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, r, c, kind: "spawn" };
}

function hasMoves() {
  if (emptyCells().length) return true;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c].value;
      if (c + 1 < SIZE && grid[r][c + 1].value === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c].value === v) return true;
    }
  return false;
}

// Positions of line i, ordered from the edge the tiles slide toward.
function linePositions(dir, i) {
  const line = [];
  for (let j = 0; j < SIZE; j++) {
    if (dir === "left") line.push([i, j]);
    else if (dir === "right") line.push([i, SIZE - 1 - j]);
    else if (dir === "up") line.push([j, i]);
    else line.push([SIZE - 1 - j, i]);
  }
  return line;
}

// ---------- game flow ----------
function newGame() {
  for (const el of tileEls.values()) el.remove();
  tileEls.clear();
  grid = emptyGrid();
  score = 0;
  won = false;
  keepPlaying = false;
  over = false;
  hideOverlay();
  spawnTile();
  spawnTile();
  render([]);
}

function move(dir) {
  if (over || (won && !keepPlaying)) return;

  const next = emptyGrid();
  const removed = [];
  let moved = false;
  let gained = 0;

  for (let i = 0; i < SIZE; i++) {
    const line = linePositions(dir, i);
    let target = 0;
    let last = null; // last tile placed in this line

    for (const [r, c] of line) {
      const tile = grid[r][c];
      if (!tile) continue;

      if (last && !last.fused && last.value === tile.value) {
        // Fuse: both old tiles slide into last's spot, a new doubled tile replaces them.
        const [tr, tc] = line[target - 1];
        tile.r = tr; tile.c = tc;
        removed.push(tile, last);
        const fused = { id: nextId++, value: tile.value * 2, r: tr, c: tc, kind: "fuse", fused: true };
        next[tr][tc] = fused;
        gained += fused.value;
        last = fused;
        moved = true;
      } else {
        const [tr, tc] = line[target];
        if (tr !== r || tc !== c) moved = true;
        tile.r = tr; tile.c = tc; tile.kind = null;
        next[tr][tc] = tile;
        last = tile;
        target++;
      }
    }
  }

  if (!moved) return;

  for (const row of next) for (const t of row) if (t) t.fused = false;
  grid = next;
  score += gained;
  if (score > best) { best = score; saveBest(); }
  spawnTile();
  render(removed, gained);

  if (!won && grid.flat().some((t) => t && t.value >= WIN_VALUE)) {
    won = true;
    setTimeout(() => showOverlay("win"), SLIDE_MS + 250);
  } else if (!hasMoves()) {
    over = true;
    setTimeout(() => showOverlay("over"), SLIDE_MS + 250);
  }
}

// ---------- rendering ----------
function placeTile(el, tile) {
  el.style.setProperty("--r", tile.r);
  el.style.setProperty("--c", tile.c);
}

function render(removed, gained = 0) {
  // Tiles that fused away: slide them into place, then drop them.
  for (const tile of removed) {
    const el = tileEls.get(tile.id);
    if (!el) continue;
    tileEls.delete(tile.id);
    el.classList.remove("spawn", "fuse");
    el.classList.add("gone");
    placeTile(el, tile);
    setTimeout(() => el.remove(), SLIDE_MS + 20);
  }

  for (const row of grid) {
    for (const tile of row) {
      if (!tile) continue;
      let el = tileEls.get(tile.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "tile";
        if (tile.kind) el.classList.add(tile.kind);
        el.dataset.v = tile.value;
        if (tile.value > WIN_VALUE) el.classList.add("super");
        el.textContent = tile.value;
        placeTile(el, tile);
        els.tiles.appendChild(el);
        tileEls.set(tile.id, el);
      } else {
        el.classList.remove("spawn", "fuse");
        placeTile(el, tile);
      }
    }
  }

  els.score.textContent = score;
  els.best.textContent = best;
  if (gained > 0) {
    const plus = document.createElement("span");
    plus.className = "plus";
    plus.textContent = `+${gained}`;
    els.score.parentElement.appendChild(plus);
    plus.addEventListener("animationend", () => plus.remove());
  }
}

function showOverlay(type) {
  if (type === "win") {
    els.overlayTitle.textContent = "Fusion achieved!";
    els.overlayText.textContent = `You built the ${WIN_VALUE} tile with ${score} points.`;
    els.keepGoing.hidden = false;
  } else {
    els.overlayTitle.textContent = "No moves left";
    els.overlayText.textContent = `Final score: ${score}`;
    els.keepGoing.hidden = true;
  }
  els.overlay.hidden = false;
  (type === "win" ? els.keepGoing : els.tryAgain).focus();
}

function hideOverlay() {
  els.overlay.hidden = true;
}

// ---------- input ----------
const KEYS = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down",
  A: "left", D: "right", W: "up", S: "down",
};

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const dir = KEYS[e.key];
  if (!dir) return;
  e.preventDefault();
  move(dir);
});

let touchStart = null;
els.board.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

els.board.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
  else move(dy > 0 ? "down" : "up");
});

els.newGame.addEventListener("click", (e) => { e.currentTarget.blur(); newGame(); });
els.tryAgain.addEventListener("click", newGame);
els.keepGoing.addEventListener("click", () => { keepPlaying = true; hideOverlay(); });

newGame();
