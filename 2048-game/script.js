// 2048 — стабильные сдвиги/слияния по линиям + плавная анимация + спавн рядом с кубами

(() => {
  const SIZE = 4;
  const CELL = 75;
  const GAP = 12;
  const STEP = CELL + GAP;            // 87px
  const MOVE_MS = 200;                // длительность анимации перемещения/слияния

  let NEXT_ID = 1;

  class Tile {
    constructor(value, row, col) {
      this.id = NEXT_ID++;
      this.value = value;
      this.row = row;
      this.col = col;
    }
  }

  class Game2048 {
    constructor() {
      this.size = SIZE;
      this.grid = this.emptyGrid();
      this.tiles = [];
      this.tileEls = {};    // id -> DOM
      this.score = 0;
      this.bestScore = Number(localStorage.getItem('2048-best-score') || 0);
      this.moves = 0;
      this.isAnimating = false;
      this.gameOver = false;
      this.gameWon = false;

      this.startTime = Date.now();
      this.timer = setInterval(() => this.updateTimer(), 1000);

      this.init();
    }

    emptyGrid() {
      return Array.from({ length: this.size }, () => Array(this.size).fill(null));
    }

    init() {
      this.drawStaticGrid();
      this.addRandomTile(true);
      this.addRandomTile(true);
      this.updateDisplay();
      this.setupControls();
    }

    drawStaticGrid() {
      const board = document.getElementById('game-board');
      board.innerHTML = '';
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.style.transform = `translate(${c * STEP}px, ${r * STEP}px)`;
          board.appendChild(cell);
        }
      }
    }

    updateTimer() {
      if (this.gameOver || this.gameWon) return;
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      const t = document.getElementById('time');
      if (t) t.textContent = `${mm}:${ss}`;
    }

    // Спавн в пустой клетке с приоритетом соседних к занятым
    addRandomTile(initial = false) {
      const empty = [];
      const neighbor = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (!this.grid[r][c]) {
            empty.push({ r, c });
            const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            for (const [dr, dc] of dirs) {
              const nr = r + dr, nc = c + dc;
              if (nr>=0 && nr<this.size && nc>=0 && nc<this.size) {
                if (this.grid[nr][nc]) { neighbor.push({ r, c }); break; }
              }
            }
          }
        }
      }
      if (!empty.length) return;

      const pool = neighbor.length ? neighbor : empty;
      const { r, c } = pool[Math.floor(Math.random() * pool.length)];
      const val = Math.random() < 0.9 ? 2 : 4;
      const t = new Tile(val, r, c);
      this.grid[r][c] = t;
      this.tiles.push(t);

      // Плавное появление (кроме стартовых можно чуть «попнуть»)
      this.ensureTileEl(t);
      const el = this.tileEls[t.id];
      if (!initial) {
        el.style.opacity = '0';
        el.style.transform = `translate(${t.col * STEP}px, ${t.row * STEP}px) scale(0.85)`;
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = `translate(${t.col * STEP}px, ${t.row * STEP}px) scale(1)`;
        });
      } else {
        el.style.transform = `translate(${t.col * STEP}px, ${t.row * STEP}px)`;
      }
    }

    // Построить линии в порядке «сжатия»
    buildLines(dir) {
      const lines = [];
      if (dir === 'left' || dir === 'right') {
        for (let r = 0; r < this.size; r++) {
          const line = [];
          if (dir === 'left')  for (let c = 0; c < this.size; c++) line.push({ r, c });
          else                 for (let c = this.size - 1; c >= 0; c--) line.push({ r, c });
          lines.push(line);
        }
      } else {
        for (let c = 0; c < this.size; c++) {
          const line = [];
          if (dir === 'up')    for (let r = 0; r < this.size; r++) line.push({ r, c });
          else                 for (let r = this.size - 1; r >= 0; r--) line.push({ r, c });
          lines.push(line);
        }
      }
      return lines;
    }

    move(dir) {
      if (this.isAnimating || this.gameOver || this.gameWon) return false;

      const lines = this.buildLines(dir);
      let moved = false;

      // Операции текущего хода
      const moveOps = [];   // { tile, to:{r,c} }
      const mergeOps = [];  // { a, b, to:{r,c}, newValue }

      // 1) Рассчитываем целевые позиции по каждой линии (линейная логика)
      for (const line of lines) {
        const existing = [];
        for (const pos of line) {
          const t = this.grid[pos.r][pos.c];
          if (t) existing.push(t);
        }
        if (!existing.length) continue;

        let writeIndex = 0;
        for (let i = 0; i < existing.length; ) {
          const cur = existing[i];
          if (i + 1 < existing.length && existing[i + 1].value === cur.value) {
            // слияние cur + next
            const next = existing[i + 1];
            const dest = line[writeIndex];               // куда приезжает пара
            moveOps.push({ tile: cur,  to: { r: dest.r, c: dest.c } });
            moveOps.push({ tile: next, to: { r: dest.r, c: dest.c } });
            mergeOps.push({ a: cur, b: next, to: { r: dest.r, c: dest.c }, newValue: cur.value * 2 });
            writeIndex++;
            i += 2;
          } else {
            // просто переезд cur
            const dest = line[writeIndex];
            moveOps.push({ tile: cur, to: { r: dest.r, c: dest.c } });
            writeIndex++;
            i += 1;
          }
        }
      }

      // 2) Если нет ни перемещений, ни слияний — выходим
      moved = moveOps.some(op => op.tile.row !== op.to.r || op.tile.col !== op.to.c) || mergeOps.length > 0;
      if (!moved) return false;

      // 3) Обновляем координаты тайлов для анимации (grid пока не трогаем)
      for (const op of moveOps) {
        op.tile.row = op.to.r;
        op.tile.col = op.to.c;
      }

      // 4) Анимируем перемещения
      this.isAnimating = true;
      this.updateDisplay();

      // 5) По завершении анимации применяем слияния и полностью пересобираем grid
      setTimeout(() => {
        // применить слияния: удалить a/b, создать новый nt
        const board = document.getElementById('game-board');
        for (const m of mergeOps) {
          // убрать a и b из списка
          this.tiles = this.tiles.filter(t => t !== m.a && t !== m.b);

          // мягко убрать DOM старых
          for (const old of [m.a, m.b]) {
            const el = this.tileEls[old.id];
            if (el) {
              el.style.opacity = '0';
              el.style.transform = `translate(${old.col * STEP}px, ${old.row * STEP}px) scale(0.85)`;
              setTimeout(() => el.parentNode && el.parentNode.removeChild(el), MOVE_MS * 0.6);
            }
            delete this.tileEls[old.id];
          }

          // создать новый
          const nt = new Tile(m.newValue, m.to.r, m.to.c);
          this.tiles.push(nt);
          this.score += m.newValue;

          // DOM нового тайла с «попом»
          const el = document.createElement('div');
          el.className = 'tile';
          el.dataset.value = nt.value;
          el.textContent = nt.value;
          el.style.position = 'absolute';
          el.style.transition = `transform ${MOVE_MS}ms ease, opacity ${MOVE_MS}ms ease`;
          el.style.transform = `translate(${nt.col * STEP}px, ${nt.row * STEP}px) scale(1.12)`;
          el.style.opacity = '0';
          board.appendChild(el);
          this.tileEls[nt.id] = el;

          requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = `translate(${nt.col * STEP}px, ${nt.row * STEP}px) scale(1)`;
          });
        }

        // Полностью пересобираем grid из актуальных tiles (это убирает «залипания»)
        this.grid = this.emptyGrid();
        for (const t of this.tiles) {
          this.grid[t.row][t.col] = t;
        }

        // Добавляем новую плитку после всех слияний
        this.addRandomTile();

        // Финальный апдейт и проверки
        this.updateDisplay();
        this.isAnimating = false;
        this.moves++;
        this.checkGameState();
      }, MOVE_MS + 10);

      return true;
    }

    // Рендер/обновление DOM
    ensureTileEl(t) {
      let el = this.tileEls[t.id];
      if (!el) {
        const board = document.getElementById('game-board');
        el = document.createElement('div');
        el.className = 'tile';
        el.dataset.value = t.value;
        el.textContent = t.value;
        el.style.position = 'absolute';
        el.style.transition = `transform ${MOVE_MS}ms ease, opacity ${MOVE_MS}ms ease`;
        board.appendChild(el);
        this.tileEls[t.id] = el;
      }
      return el;
    }

    updateDisplay() {
      // удалить DOM тех, кого уже нет
      for (const id in this.tileEls) {
        if (!this.tiles.find(t => String(t.id) === String(id))) {
          const el = this.tileEls[id];
          if (el && el.parentNode) el.parentNode.removeChild(el);
          delete this.tileEls[id];
        }
      }

      // обновить/создать DOM существующих
      for (const t of this.tiles) {
        const el = this.ensureTileEl(t);
        // обновить визуальное значение, не трогая дизайн
        if (el.dataset.value !== String(t.value)) {
          el.dataset.value = t.value;
          el.textContent = t.value;
        }
        const target = `translate(${t.col * STEP}px, ${t.row * STEP}px)`;
        requestAnimationFrame(() => { el.style.transform = target; el.style.opacity = '1'; });
      }

      // счётчики
      const s = document.getElementById('score');
      const bs = document.getElementById('best-score');
      const mv = document.getElementById('moves');
      if (s) s.textContent = this.score;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        localStorage.setItem('2048-best-score', this.bestScore);
      }
      if (bs) bs.textContent = this.bestScore;
      if (mv) mv.textContent = this.moves;
    }

    hasMoves() {
      // пустые клетки
      for (let r = 0; r < this.size; r++)
        for (let c = 0; c < this.size; c++)
          if (!this.grid[r][c]) return true;

      // соседние равны?
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const t = this.grid[r][c];
          if (!t) continue;
          for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr>=0 && nr<this.size && nc>=0 && nc<this.size) {
              const n = this.grid[nr][nc];
              if (n && n.value === t.value) return true;
            }
          }
        }
      }
      return false;
    }

    checkGameState() {
      if (!this.gameWon && this.tiles.some(t => t.value === 2048)) {
        this.gameWon = true;
        const ws = document.getElementById('win-score');
        const wm = document.getElementById('win-message');
        if (ws) ws.textContent = this.score;
        if (wm) wm.style.display = 'flex';
        return;
      }
      if (!this.hasMoves()) {
        this.gameOver = true;
        clearInterval(this.timer);
        const fs = document.getElementById('final-score');
        const fbs = document.getElementById('final-best-score');
        const go = document.getElementById('game-over');
        if (fs) fs.textContent = this.score;
        if (fbs) fbs.textContent = this.bestScore;
        if (go) go.style.display = 'flex';
      }
    }

    newGame() {
      clearInterval(this.timer);
      NEXT_ID = 1;
      this.grid = this.emptyGrid();
      this.tiles = [];
      this.tileEls = {};
      this.score = 0;
      this.moves = 0;
      this.isAnimating = false;
      this.gameOver = false;
      this.gameWon = false;

      this.drawStaticGrid();
      this.addRandomTile(true);
      this.addRandomTile(true);
      this.updateDisplay();

      this.startTime = Date.now();
      this.timer = setInterval(() => this.updateTimer(), 1000);

      const go = document.getElementById('game-over');
      const wm = document.getElementById('win-message');
      if (go) go.style.display = 'none';
      if (wm) wm.style.display = 'none';
    }

    setupControls() {
      // клавиатура
      window.addEventListener('keydown', (e) => {
        const key = e.key;
        let dir = null;
        if (['ArrowLeft','a','A'].includes(key))  dir = 'left';
        if (['ArrowRight','d','D'].includes(key)) dir = 'right';
        if (['ArrowUp','w','W'].includes(key))    dir = 'up';
        if (['ArrowDown','s','S'].includes(key))  dir = 'down';
        if (!dir) return;
        e.preventDefault();
        this.move(dir);
      });

      // тач
      let sx=0, sy=0, isSwiping=false, st=0;
      document.addEventListener('touchstart', (e) => {
        if (this.isAnimating || this.gameOver) return;
        const t = e.touches[0];
        sx = t.clientX; sy = t.clientY; st = Date.now(); isSwiping = true;
      }, { passive: true });

      document.addEventListener('touchend', (e) => {
        if (!isSwiping || this.isAnimating || this.gameOver) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        const dur = Date.now() - st;
        if (dur < 60) { isSwiping = false; return; }
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) { isSwiping = false; return; }
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        this.move(dir);
        isSwiping = false;
      }, { passive: true });

      // кнопки
      const ng = document.getElementById('new-game-btn');
      if (ng) ng.onclick = () => this.newGame();
      const rb = document.getElementById('restart-btn');
      if (rb) rb.onclick = () => this.newGame();
      const cont = document.getElementById('continue-btn');
      if (cont) cont.onclick = () => { const wm = document.getElementById('win-message'); if (wm) wm.style.display = 'none'; };
      const ngw = document.getElementById('new-game-win-btn');
      if (ngw) ngw.onclick = () => this.newGame();
    }
  }

  // Запуск
  document.addEventListener('DOMContentLoaded', () => {
    new Game2048();
  });
})();
