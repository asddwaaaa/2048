document.addEventListener('DOMContentLoaded', () => {
  const BOARD_SIZE = 4;
  const WINNING_TILE = 2048;

  // DOM Elements
  const gameContainer = document.querySelector('.game-container');
  const tileContainer = document.getElementById('tile-container');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const scoreAddition = document.getElementById('score-addition');
  const newGameBtn = document.getElementById('new-game');
  const undoBtn = document.getElementById('undo-btn');
  const gameMessage = document.getElementById('game-message');
  const gameMessageText = gameMessage.querySelector('p');
  const retryButton = gameMessage.querySelector('.retry-button');
  const keepPlayingButton = gameMessage.querySelector('.keep-playing-button');

  // Game state
  let grid = [];
  let score = 0;
  let best = 0;
  let hasWon = false;
  let isGameOver = false;
  let keepPlaying = false;
  let isMoveInProgress = false;

  // Undo state
  let previousGrid = null;
  let previousScore = null;
  let canUndo = false;

  // Initialize game
  function init() {
    best = parseInt(localStorage.getItem('bestScore') || '0', 10);
    bestEl.textContent = best;
    newGame();
  }

  function newGame() {
    grid = createEmptyGrid();
    tileContainer.innerHTML = '';
    score = 0;
    hasWon = false;
    isGameOver = false;
    keepPlaying = false;
    isMoveInProgress = false;
    previousGrid = null;
    previousScore = null;
    canUndo = false;

    updateScore(0);
    updateUndoButton();
    hideMessage();

    addRandomTile();
    addRandomTile();
    renderGrid();
  }

  function createEmptyGrid() {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null)
    );
  }

  // Save state for undo
  function saveState() {
    previousGrid = grid.map(row => row.map(cell => cell ? { ...cell } : null));
    previousScore = score;
    canUndo = true;
    updateUndoButton();
  }

  // Undo last move
  function undo() {
    if (!canUndo || !previousGrid) return;

    grid = previousGrid;
    score = previousScore;
    canUndo = false;

    updateScore(0);
    updateUndoButton();
    renderGrid();
    hideMessage();
    isGameOver = false;
  }

  function updateUndoButton() {
    undoBtn.disabled = !canUndo;
  }

  // Add random tile (2 or 4)
  function addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!grid[r][c]) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      grid[r][c] = { value, isNew: true, isMerged: false };
    }
  }

  // Render the grid
  function renderGrid() {
    tileContainer.innerHTML = '';

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = grid[r][c];
        if (cell) {
          const tile = document.createElement('div');
          const tileClass = cell.value <= 2048 ? `tile-${cell.value}` : 'tile-super';
          tile.className = `tile ${tileClass}`;

          if (cell.isNew) {
            tile.classList.add('tile-new');
            cell.isNew = false;
          }
          if (cell.isMerged) {
            tile.classList.add('tile-merged');
            cell.isMerged = false;
          }

          tile.textContent = cell.value;
          // Position using percentages for responsive layout
          // Each cell is 25% width/height with gaps accounted for
          tile.style.left = `calc(${c} * (100% - 45px) / 4 + ${c * 15}px)`;
          tile.style.top = `calc(${r} * (100% - 45px) / 4 + ${r * 15}px)`;

          tileContainer.appendChild(tile);
        }
      }
    }
  }

  // Handle move
  function handleMove(direction) {
    if (isMoveInProgress || isGameOver) return;
    isMoveInProgress = true;

    saveState();

    const vectors = {
      'up': { r: -1, c: 0 },
      'down': { r: 1, c: 0 },
      'left': { r: 0, c: -1 },
      'right': { r: 0, c: 1 }
    };
    const vector = vectors[direction];

    const traversals = buildTraversals(vector);
    let moved = false;
    let mergeScore = 0;

    // Clear merge flags
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (grid[r][c]) {
          grid[r][c].isMerged = false;
        }
      }
    }

    traversals.rows.forEach(row => {
      traversals.cols.forEach(col => {
        const cell = grid[row][col];
        if (cell) {
          const { farthest, next } = findFarthestPosition(row, col, vector);
          const nextCell = next.r >= 0 && next.r < BOARD_SIZE &&
                          next.c >= 0 && next.c < BOARD_SIZE ?
                          grid[next.r][next.c] : null;

          if (nextCell && nextCell.value === cell.value && !nextCell.isMerged) {
            // Merge
            const mergedValue = cell.value * 2;
            grid[next.r][next.c] = {
              value: mergedValue,
              isNew: false,
              isMerged: true
            };
            grid[row][col] = null;
            mergeScore += mergedValue;
            moved = true;

            // Check for win
            if (mergedValue === WINNING_TILE && !hasWon && !keepPlaying) {
              hasWon = true;
            }
          } else if (farthest.r !== row || farthest.c !== col) {
            // Move
            grid[farthest.r][farthest.c] = cell;
            grid[row][col] = null;
            moved = true;
          }
        }
      });
    });

    if (moved) {
      addRandomTile();
      updateScore(mergeScore);
      renderGrid();

      if (hasWon && !keepPlaying) {
        showMessage('Победа!', true);
      } else if (!canMove()) {
        isGameOver = true;
        canUndo = true;
        updateUndoButton();
        showMessage('Игра окончена!', false);
      }
    } else {
      // No move made, restore undo state
      canUndo = previousGrid !== null && previousScore !== null;
      updateUndoButton();
    }

    setTimeout(() => {
      isMoveInProgress = false;
    }, 100);
  }

  function buildTraversals(vector) {
    const traversals = { rows: [], cols: [] };

    for (let i = 0; i < BOARD_SIZE; i++) {
      traversals.rows.push(i);
      traversals.cols.push(i);
    }

    if (vector.r === 1) traversals.rows.reverse();
    if (vector.c === 1) traversals.cols.reverse();

    return traversals;
  }

  function findFarthestPosition(row, col, vector) {
    let previous = { r: row, c: col };
    let cell = { r: row + vector.r, c: col + vector.c };

    while (
      cell.r >= 0 && cell.r < BOARD_SIZE &&
      cell.c >= 0 && cell.c < BOARD_SIZE &&
      !grid[cell.r][cell.c]
    ) {
      previous = cell;
      cell = { r: previous.r + vector.r, c: previous.c + vector.c };
    }

    return { farthest: previous, next: cell };
  }

  function canMove() {
    // Check for empty cells
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!grid[r][c]) return true;
      }
    }

    // Check for possible merges
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = grid[r][c];
        if (!cell) continue;

        // Check right
        if (c < BOARD_SIZE - 1 && grid[r][c + 1] && cell.value === grid[r][c + 1].value) {
          return true;
        }
        // Check down
        if (r < BOARD_SIZE - 1 && grid[r + 1][c] && cell.value === grid[r + 1][c].value) {
          return true;
        }
      }
    }

    return false;
  }

  // Score functions
  function updateScore(addition) {
    score += addition;
    scoreEl.textContent = score;

    if (addition > 0) {
      showScoreAddition(addition);
    }

    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem('bestScore', best.toString());
    }
  }

  function showScoreAddition(value) {
    scoreAddition.textContent = `+${value}`;
    scoreAddition.classList.remove('active');

    // Force reflow
    void scoreAddition.offsetWidth;

    scoreAddition.classList.add('active');

    setTimeout(() => {
      scoreAddition.classList.remove('active');
    }, 600);
  }

  // Message functions
  function showMessage(text, won) {
    gameMessageText.textContent = text;
    gameMessage.classList.remove('game-won', 'game-over');
    gameMessage.classList.add(won ? 'game-won' : 'game-over');
  }

  function hideMessage() {
    gameMessage.classList.remove('game-won', 'game-over');
  }

  // Event listeners
  newGameBtn.addEventListener('click', newGame);
  undoBtn.addEventListener('click', undo);
  retryButton.addEventListener('click', newGame);
  keepPlayingButton.addEventListener('click', () => {
    keepPlaying = true;
    hideMessage();
  });

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    const keyMap = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'w': 'up',
      'W': 'up',
      's': 'down',
      'S': 'down',
      'a': 'left',
      'A': 'left',
      'd': 'right',
      'D': 'right'
    };

    if (keyMap[e.key]) {
      e.preventDefault();
      handleMove(keyMap[e.key]);
    }
  });

  // Touch controls
  let touchStartX = 0;
  let touchStartY = 0;

  gameContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  gameContainer.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) {
      const direction = absDx > absDy
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      handleMove(direction);
    }
  }, { passive: true });

  // Prevent scrolling on touch
  gameContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // No resize handler needed - CSS handles responsive layout

  // Start game
  init();
});
