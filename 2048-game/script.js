(() => {
  const SIZE = 4;
  const CELL = 75;
  const GAP = 12;
  const STEP = CELL + GAP;
  const MOVE_MS = 300;

  let NEXT_ID = 1;

  class Tile {
    constructor(value, row, col, opts = {}) {
      this.id = NEXT_ID++;
      this.value = value;
      this.row = row;
      this.col = col;
      this.special = !!opts.special;
      this.kind = opts.kind || null;
      this.used = false;
    }
  }

  class Game2048 {
    constructor() {
      this.size = SIZE;
      this.grid = this.empty();
      this.tiles = [];
      this.tileEls = Object.create(null);
      this.score = 0;
      this.best = Number(localStorage.getItem("best-score") || 0);
      this.moves = 0;
      this.mode = "classic";
      this.specialCount = 0;
      this.isAnimating = false;
      this.won = false;
      this.over = false;
      this.startTs = Date.now();
      this.timer = null;
      this.history = [];

      this.$board = document.getElementById("game-board");
      this.$score = document.getElementById("score");
      this.$best = document.getElementById("best-score");
      this.$moves = document.getElementById("moves");
      this.$time = document.getElementById("time");
      this.$gameOver = document.getElementById("game-over");
      this.$finalScore = document.getElementById("final-score");
      this.$finalBest = document.getElementById("final-best-score");
      this.$win = document.getElementById("win-message");
      this.$winScore = document.getElementById("win-score");

      this.init();
    }

    empty() {
      return Array.from({ length: this.size }, () => Array(this.size).fill(null));
    }

    init() {
      this.drawStaticGrid();
      this.addRandomTile(true);
      this.addRandomTile(true);
      this.saveState();
      this.updateHUD();
      this.setupControls();
      this.startTimer();
      this.renderAll();
    }

    drawStaticGrid() {
      this.$board.innerHTML = "";
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const cell = document.createElement("div");
          cell.className = "cell";
          cell.style.transform = `translate(${c * STEP}px, ${r * STEP}px)`;
          this.$board.appendChild(cell);
        }
      }
    }

    startTimer() {
      this.timer && clearInterval(this.timer);
      this.startTs = Date.now();
      this.timer = setInterval(() => {
        if (this.over || this.won) return;
        const s = Math.floor((Date.now() - this.startTs) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        if (this.$time) this.$time.textContent = `${mm}:${ss}`;
      }, 1000);
    }

    setupControls() {
      document.addEventListener("keydown", (e) => {
        const k = e.key;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(k)) {
          e.preventDefault();
          const map = {
            ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
            w: "up", a: "left", s: "down", d: "right", W: "up", A: "left", S: "down", D: "right"
          };
          this.move(map[k]);
        }
      });

      const area = this.$board;
      let sx = 0, sy = 0, start = 0, swiping = false;
      area.addEventListener("touchstart", (e) => {
        if (this.isAnimating || this.over || this.won) return;
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        start = Date.now();
        swiping = true;
      }, { passive: true });

      area.addEventListener("touchend", (e) => {
        if (!swiping || this.isAnimating || this.over || this.won) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        const dur = Date.now() - start;
        swiping = false;
        if (dur < 50 || (Math.abs(dx) < 20 && Math.abs(dy) < 20)) return;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        this.move(dir);
      }, { passive: true });
    }

    updateHUD() {
      if (this.$score) this.$score.textContent = this.score;
      if (this.$best) this.$best.textContent = this.best;
      if (this.$moves) this.$moves.textContent = this.moves;
    }

    saveState() {
      const state = {
        grid: this.grid.map(row => row.map(t => t ? { ...t } : null)),
        tiles: this.tiles.map(t => ({ ...t })),
        tileEls: { ...this.tileEls },
        score: this.score,
        moves: this.moves,
        specialCount: this.specialCount,
        won: this.won,
        over: this.over
      };
      this.history.push(state);
      if (this.history.length > 10) this.history.shift();
    }

    undoMove() {
      if (this.history.length < 2 || this.isAnimating || this.over || this.won) return;
      this.history.pop();
      const prevState = this.history[this.history.length - 1];
      this.grid = prevState.grid.map(row => row.map(t => t ? new Tile(t.value, t.row, t.col, { special: t.special, kind: t.kind }) : null));
      this.tiles = prevState.tiles.map(t => new Tile(t.value, t.row, t.col, { special: t.special, kind: t.kind }));
      this.tileEls = Object.create(null);
      this.score = prevState.score;
      this.moves = prevState.moves;
      this.specialCount = prevState.specialCount;
      this.won = prevState.won;
      this.over = prevState.over;

      this.$board.innerHTML = "";
      this.drawStaticGrid();
      this.renderAll();
      this.updateHUD();
    }

    getHint() {
      if (this.isAnimating || this.over || this.won) return;
      const directions = ["up", "down", "left", "right"];
      let bestDir = null;
      let maxScore = -1;

      for (const dir of directions) {
        const { score } = this.simulateMove(dir);
        if (score > maxScore) {
          maxScore = score;
          bestDir = dir;
        }
      }

      if (bestDir) {
        this.showHintArrow(bestDir);
      }
    }

    simulateMove(dir) {
      const tempGrid = this.grid.map(row => row.map(t => t ? { ...t } : null));
      const tempTiles = this.tiles.map(t => ({ ...t }));
      let tempScore = this.score;
      const lines = this.buildLines(dir);
      const moveOps = [];
      const mergeOps = [];

      for (const line of lines) {
        const arr = [];
        for (const p of line) {
          const t = tempGrid[p.r][p.c];
          if (t) arr.push(t);
        }
        if (!arr.length) continue;

        let write = 0;
        for (let i = 0; i < arr.length; i++) {
          const cur = arr[i];
          if (i + 1 < arr.length) {
            const next = arr[i + 1];
            if (cur.value === next.value) {
              const dst = line[write++];
              moveOps.push({ tile: cur, to: { r: dst.r, c: dst.c } });
              moveOps.push({ tile: next, to: { r: dst.r, c: dst.c } });
              mergeOps.push({ a: cur, b: next, to: { r: dst.r, c: dst.c }, newValue: cur.value * 2 });
              tempScore += cur.value * 2;
              i++;
              continue;
            }
          }
          const dst = line[write++];
          moveOps.push({ tile: cur, to: { r: dst.r, c: dst.c } });
        }
      }

      return { score: tempScore, moved: moveOps.length > 0 || mergeOps.length > 0 };
    }

    showHintArrow(dir) {
      const existingArrow = document.querySelector(".hint-arrow");
      if (existingArrow) existingArrow.remove();

      const arrow = document.createElement("div");
      arrow.className = "hint-arrow";
      const symbols = { up: "↑", down: "↓", left: "←", right: "→" };
      arrow.textContent = symbols[dir];
      const boardRect = this.$board.getBoundingClientRect();
      const centerX = boardRect.width / 2;
      const centerY = boardRect.height / 2;
      arrow.style.left = `${centerX - 20}px`;
      arrow.style.top = `${centerY - 20}px`;
      this.$board.appendChild(arrow);

      setTimeout(() => {
        arrow.style.opacity = "0";
        setTimeout(() => arrow.remove(), 300);
      }, 1000);
    }

    addRandomTile(initial = false) {
      const empty = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!this.grid[r][c]) empty.push({ r, c });
        }
      }
      if (!empty.length) return;

      const { r, c } = empty[Math.floor(Math.random() * empty.length)];
      const t = new Tile(Math.random() < 0.9 ? 2 : 4, r, c);

      this.grid[r][c] = t;
      this.tiles.push(t);
      this.ensureTileEl(t, true);
    }

    ensureTileEl(t, isNew = false) {
      if (this.tileEls[t.id]) {
        this.positionEl(this.tileEls[t.id], t);
        this.refreshLabel(this.tileEls[t.id], t);
        return;
      }
      const el = document.createElement("div");
      el.className = "tile";
      el.dataset.value = t.value;
      el.textContent = t.value;
      this.positionEl(el, t, true);
      this.$board.appendChild(el);
      this.tileEls[t.id] = el;
      if (isNew) {
        requestAnimationFrame(() => {
          el.classList.add("new");
          setTimeout(() => el.classList.remove("new"), 350);
        });
      }
    }

    positionEl(el, t, instant = false) {
      el.style.setProperty("--x", `${t.col * STEP}px`);
      el.style.setProperty("--y", `${t.row * STEP}px`);
      if (instant) {
        el.style.transition = "none";
        void el.offsetWidth;
        el.style.transition = "";
      }
    }

    refreshLabel(el, t) {
      el.dataset.value = t.value;
      el.textContent = t.value;
    }

    renderAll() {
      for (const t of this.tiles) this.ensureTileEl(t);
    }

    buildLines(dir) {
      const L = [];
      if (dir === "left" || dir === "right") {
        for (let r = 0; r < this.size; r++) {
          const line = [];
          if (dir === "left") for (let c = 0; c < this.size; c++) line.push({ r, c });
          else for (let c = this.size - 1; c >= 0; c--) line.push({ r, c });
          L.push(line);
        }
      } else {
        for (let c = 0; c < this.size; c++) {
          const line = [];
          if (dir === "up") for (let r = 0; r < this.size; r++) line.push({ r, c });
          else for (let r = this.size - 1; r >= 0; r--) line.push({ r, c });
          L.push(line);
        }
      }
      return L;
    }

    move(dir) {
      if (this.isAnimating || this.over || this.won) return;

      this.saveState();

      const lines = this.buildLines(dir);
      const moveOps = [];
      const mergeOps = [];

      for (const line of lines) {
        const arr = [];
        for (const p of line) {
          const t = this.grid[p.r][p.c];
          if (t) arr.push(t);
        }
        if (!arr.length) continue;

        let write = 0;
        for (let i = 0; i < arr.length; i++) {
          const cur = arr[i];
          if (i + 1 < arr.length) {
            const next = arr[i + 1];
            if (cur.value === next.value) {
              const dst = line[write++];
              moveOps.push({ tile: cur, to: { r: dst.r, c: dst.c } });
              moveOps.push({ tile: next, to: { r: dst.r, c: dst.c } });
              mergeOps.push({ a: cur, b: next, to: { r: dst.r, c: dst.c }, newValue: cur.value * 2 });
              i++;
              continue;
            }
          }
          const dst = line[write++];
          moveOps.push({ tile: cur, to: { r: dst.r, c: dst.c } });
        }
      }

      const anyMove = moveOps.some(op => op.tile.row !== op.to.r || op.tile.col !== op.to.c) || mergeOps.length > 0;
      if (!anyMove) {
        this.history.pop();
        return;
      }

      for (const op of moveOps) {
        op.tile.row = op.to.r;
        op.tile.col = op.to.c;
      }
      this.isAnimating = true;

      for (const t of this.tiles) {
        const el = this.tileEls[t.id];
        if (el) {
          el.classList.add("sliding");
          this.positionEl(el, t);
        }
      }

      setTimeout(() => {
        for (const m of mergeOps) {
          for (const old of [m.a, m.b]) {
            const el = this.tileEls[old.id];
            if (el) {
              el.style.opacity = "0";
              el.style.transform = "scale(0.9)";
              setTimeout(() => el.remove(), 120);
            }
            delete this.tileEls[old.id];
            this.tiles = this.tiles.filter(x => x !== old);
          }
          const nt = new Tile(m.newValue, m.to.r, m.to.c);
          this.tiles.push(nt);
          this.grid[m.to.r][m.to.c] = nt;
          this.score += m.newValue;

          const el = document.createElement("div");
          el.className = "tile merged";
          el.dataset.value = nt.value;
          el.textContent = nt.value;
          this.positionEl(el, nt, true);
          this.$board.appendChild(el);
          this.tileEls[nt.id] = el;
          requestAnimationFrame(() => {
            el.classList.remove("merged");
          });
        }

        this.grid = this.empty();
        for (const t of this.tiles) this.grid[t.row][t.col] = t;

        this.addRandomTile();
        this.moves++;
        if (this.score > this.best) {
          this.best = this.score;
          localStorage.setItem("best-score", String(this.best));
        }

        for (const t of this.tiles) {
          const el = this.tileEls[t.id];
          el && el.classList.remove("sliding");
        }

        this.updateHUD();
        this.isAnimating = false;
        this.checkEndStates();
      }, MOVE_MS);
    }

    checkEndStates() {
      if (this.tiles.some(t => t.value >= 2048)) {
        this.won = true;
        if (this.$win) {
          this.$winScore && (this.$winScore.textContent = this.score);
          this.$win.style.display = "flex";
        }
      }
      if (!this.anyMovesLeft()) {
        this.over = true;
        if (this.$gameOver) {
          this.$finalScore && (this.$finalScore.textContent = this.score);
          this.$finalBest && (this.$finalBest.textContent = this.best);
          this.$gameOver.style.display = "flex";
        }
      }
    }

    anyMovesLeft() {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!this.grid[r][c]) return true;
        }
      }
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const t = this.grid[r][c];
          if (t) {
            for (const [dr, dc] of dirs) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                const u = this.grid[nr][nc];
                if (!u || u.value === t.value) return true;
              }
            }
          }
        }
      }
      return false;
    }
  }

  function resetGame() {
    const game = new Game2048();
    return game;
  }

  window.addEventListener("DOMContentLoaded", () => {
    const game = resetGame();
    // Сохраняем ссылку на game для использования в глобальном контексте
    window.game = game;
  });
})();
