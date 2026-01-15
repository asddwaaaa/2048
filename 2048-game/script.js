let board = [];
let score = 0;
let best = localStorage.getItem('2048-best') || 0;
let gameOver = false;

const gridEl = document.getElementById('grid');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const retryBtn = document.getElementById('retry-button');

// Telegram
if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

function initGame() {
  board = Array(4).fill().map(() => Array(4).fill(0));
  score = 0;
  gameOver = false;
  updateScore();
  addRandomTile();
  addRandomTile();
  render();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0) empty.push({ r, c });
    }
  }
  if (empty.length > 0) {
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
}

function render() {
  gridEl.innerHTML = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r][c];
      const tile = document.createElement('div');
      tile.className = 'tile';
      if (val) {
        tile.classList.add(`tile-${val}`);
        tile.textContent = val;
      }
      gridEl.appendChild(tile);
    }
  }
}

// Управление
document.addEventListener('keydown', e => {
  if (gameOver) return;
  let moved = false;
  switch (e.key) {
    case 'ArrowLeft': moved = moveLeft(); break;
    case 'ArrowRight': moved = moveRight(); break;
    case 'ArrowUp': moved = moveUp(); break;
    case 'ArrowDown': moved = moveDown(); break;
    default: return;
  }
  if (moved) {
    addRandomTile();
    render();
    checkGameOver();
    updateScore();
  }
});

// Простая логика движения (без анимации перемещения, только слияние)
function moveLeft() {
  let moved = false;
  for (let r = 0; r < 4; r++) {
    let row = board[r].filter(n => n);
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i] === row[i + 1]) {
        row[i] *= 2;
        score += row[i];
        row[i + 1] = 0;
        moved = true;
      }
    }
    row = row.filter(n => n);
    while (row.length < 4) row.push(0);
    if (board[r].some((v, i) => v !== row[i])) moved = true;
    board[r] = row;
  }
  return moved;
}

function rotate() {
  const newBoard = Array(4).fill().map(() => Array(4).fill(0));
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      newBoard[c][3 - r] = board[r][c];
  board = newBoard;
}

function moveUp() { rotate(); const m = moveLeft(); rotate(); rotate(); rotate(); return m; }
function moveRight() { rotate(); rotate(); const m = moveLeft(); rotate(); rotate(); return m; }
function moveDown() { rotate(); rotate(); rotate(); const m = moveLeft(); rotate(); return m; }

function checkGameOver() {
  // Есть ли пустые?
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (board[r][c] === 0) return;

  // Можно ли слить?
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++)
      if (board[r][c] === board[r][c + 1] || board[c][r] === board[c + 1][r])
        return;

  gameOver = true;
  alert('Игра окончена!');
}

function updateScore() {
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('2048-best', best);
  }
  bestEl.textContent = best;
}

// Свайпы (упрощённо)
let startX = 0, startY = 0;
document.addEventListener('touchstart', e => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (gameOver) return;
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);

  if (absDx > 30 || absDy > 30) {
    let moved = false;
    if (absDx > absDy) {
      if (dx > 0) moved = moveLeft();
      else moved = moveRight();
    } else {
      if (dy > 0) moved = moveDown();
      else moved = moveUp();
    }
    if (moved) {
      addRandomTile();
      render();
      checkGameOver();
      updateScore();
    }
  }
}, { passive: true });

retryBtn.addEventListener('click', initGame);
initGame();
