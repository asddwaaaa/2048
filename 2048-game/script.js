// === Инициализация ===
let board = [];
let score = 0;
let best = localStorage.getItem('2048-best') || 0;
let gameOver = false;
let keepPlaying = false;

const gridEl = document.getElementById('grid');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const retryBtn = document.getElementById('retry-button');
const gameMessageEl = document.getElementById('gameMessage');
const messageTextEl = document.getElementById('messageText');
const keepPlayingBtn = document.getElementById('keepPlayingButton');

// Telegram WebApp
if (window.Telegram?.WebApp) {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
}

// === Константы ===
const SIZE = 4;
const TILE_SIZE = 100;
const GAP = 15;

// === Инициализация доски ===
function initGame() {
  board = Array(SIZE).fill().map(() => Array(SIZE).fill(0));
  score = 0;
  gameOver = false;
  keepPlaying = false;
  updateScore();
  addRandomTile();
  addRandomTile();
  render();
}

// === Добавление случайной плитки ===
function addRandomTile() {
  const emptyCells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) {
        emptyCells.push({ r, c });
      }
    }
  }
  if (emptyCells.length > 0) {
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
    // Добавляем класс new для анимации
    setTimeout(() => {
      const tile = getTileElement(r, c);
      if (tile) tile.classList.add('new');
    }, 10);
  }
}

// === Получение элемента плитки по координатам ===
function getTileElement(row, col) {
  return Array.from(gridEl.children).find(el => {
    const r = parseInt(el.dataset.row);
    const c = parseInt(el.dataset.col);
    return r === row && c === col;
  });
}

// === Создание нового элемента плитки ===
function createTileElement(value, row, col) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.dataset.row = row;
  tile.dataset.col = col;
  tile.textContent = value;
  tile.style.transform = `translate(${col * (TILE_SIZE + GAP)}px, ${row * (TILE_SIZE + GAP)}px)`;
  tile.style.width = `${TILE_SIZE}px`;
  tile.style.height = `${TILE_SIZE}px`;
  tile.classList.add(`tile-${value}`);
  return tile;
}

// === Отрисовка доски ===
function render() {
  gridEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = board[r][c];
      if (val !== 0) {
        const tile = createTileElement(val, r, c);
        gridEl.appendChild(tile);
      }
    }
  }
}

// === Обновление счёта ===
function updateScore() {
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('2048-best', best);
  }
  bestEl.textContent = best;
}

// === Управление клавиатурой ===
document.addEventListener('keydown', e => {
  if (gameOver && !keepPlaying) return;
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

// === Свайпы ===
let startX = 0, startY = 0;
document.addEventListener('touchstart', e => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (gameOver && !keepPlaying) return;
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

// === Логика движения ===
function moveLeft() {
  let moved = false;
  const previousBoard = JSON.stringify(board);
  for (let r = 0; r < SIZE; r++) {
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
    while (row.length < SIZE) row.push(0);
    board[r] = row;
  }
  return moved && previousBoard !== JSON.stringify(board);
}

function rotate() {
  const newBoard = Array(SIZE).fill().map(() => Array(SIZE).fill(0));
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      newBoard[c][SIZE - 1 - r] = board[r][c];
  board = newBoard;
}

function moveUp() { rotate(); const m = moveLeft(); rotate(); rotate(); rotate(); return m; }
function moveRight() { rotate(); rotate(); const m = moveLeft(); rotate(); rotate(); return m; }
function moveDown() { rotate(); rotate(); rotate(); const m = moveLeft(); rotate(); return m; }

// === Проверка окончания игры ===
function checkGameOver() {
  // Есть ли пустые?
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c] === 0) return;

  // Можно ли слить?
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE - 1; c++)
      if (board[r][c] === board[r][c + 1] || board[c][r] === board[c + 1][r])
        return;

  gameOver = true;
  showGameOverMessage();
}

// === Отображение сообщения о проигрыше ===
function showGameOverMessage() {
  if (keepPlaying) return;
  messageTextEl.textContent = 'Игра окончена!';
  gameMessageEl.style.display = 'flex';
}

// === Продолжить игру после проигрыша ===
keepPlayingBtn.addEventListener('click', () => {
  keepPlaying = true;
  gameMessageEl.style.display = 'none';
});

// === Новая игра ===
retryBtn.addEventListener('click', () => {
  gameMessageEl.style.display = 'none';
  keepPlaying = false;
  initGame();
});

// === Запуск игры ===
initGame();

