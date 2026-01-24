document.addEventListener('DOMContentLoaded', () => {
  const BOARD_SIZE = 4;
  const WINNING_TILE = 2048;

  const boardContainer = document.getElementById('board-container');
  const tileContainer = document.getElementById('tile-container');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const newGameBtn = document.getElementById('new-game');
  const themeSelect = document.getElementById('theme-select');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const victoryOverlay = document.getElementById('victory-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const victoryScoreEl = document.getElementById('victory-score');
  const restartBtn = document.getElementById('restart-btn');
  const continueBtn = document.getElementById('continue-btn');
  const gridBackground = document.querySelector('.grid-background');

  let grid = [];
  let tiles = [];
  let score = 0;
  let best = 0;
  let hasWon = false;
  let isMoveInProgress = false;

  function Tile(value, row, col) {
    this.value = value || 0;
    this.row = row || -1;
    this.col = col || -1;
    this.id = Date.now() + Math.random();
    this.element = null;
    this.mergedFrom = null;
  }

  Tile.prototype.updatePosition = function (newRow, newCol) {
    this.row = newRow;
    this.col = newCol;
    if (this.element) {
      const tileWidth = (boardContainer.offsetWidth - 15 * (BOARD_SIZE + 1)) / BOARD_SIZE;
      const tileHeight = (boardContainer.offsetHeight - 15 * (BOARD_SIZE + 1)) / BOARD_SIZE;
      const x = 15 + this.col * (tileWidth + 15);
      const y = 15 + this.row * (tileHeight + 15);
      this.element.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  Tile.prototype.createElement = function () {
    const tile = document.createElement('div');
    tile.classList.add('tile', `v${this.value}`, 'new');
    tile.textContent = this.value;
    this.element = tile;
    tileContainer.appendChild(this.element);
    this.updatePosition(this.row, this.col);
  };
  
  function createGridCells() {
      gridBackground.innerHTML = '';
      for(let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++){
          const cell = document.createElement('div');
          cell.classList.add('grid-cell');
          gridBackground.appendChild(cell);
      }
  }

  function init() {
    createGridCells();
    best = parseInt(localStorage.getItem('bestScore') || '0', 10);
    bestEl.textContent = best;
    const savedTheme = localStorage.getItem('theme') || 'beige';
    document.body.className = savedTheme === 'beige' ? '' : `theme-${savedTheme}`;
    themeSelect.value = savedTheme;
    newGame();
  }

  function newGame() {
    grid = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
    tiles.forEach(t => t.element && t.element.remove());
    tiles = [];
    score = 0;
    hasWon = false;
    isMoveInProgress = false;
    updateScore();
    hideOverlays();
    addRandomTile();
    addRandomTile();
  }

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
      const tile = new Tile(value, r, c);
      grid[r][c] = tile;
      tiles.push(tile);
      tile.createElement();
    }
  }
  
  function handleMove(direction) {
    if (isMoveInProgress) return;
    isMoveInProgress = true;

    const vectors = { 'up': { r: -1, c: 0 }, 'down': { r: 1, c: 0 }, 'left': { r: 0, c: -1 }, 'right': { r: 0, c: 1 } };
    const moveVector = vectors[direction];

    const traversals = buildTraversals(moveVector);
    let moved = false;
    let newScore = 0;

    prepareTiles();

    traversals.r.forEach(row => {
      traversals.c.forEach(col => {
        const cell = {r: row, c: col};
        const tile = grid[cell.r][cell.c];

        if (tile) {
          const positions = findFarthestPosition(cell, moveVector);
          const next = grid[positions.next.r] && grid[positions.next.r][positions.next.c];

          if (next && next.value === tile.value && !next.mergedFrom) {
            const merged = new Tile(tile.value * 2, next.r, next.c);
            merged.mergedFrom = [tile, next];
            
            grid[tile.r][tile.c] = null;
            grid[next.r][next.c] = merged;
            
            tile.updatePosition(next.r, next.c);
            
            newScore += merged.value;
            moved = true;
          } else {
            moveTile(tile, positions.farthest);
            moved = (tile.row !== positions.farthest.r || tile.col !== positions.farthest.c) || moved;
          }
        }
      });
    });

    if (moved) {
        score += newScore;
        setTimeout(() => {
            commitMove();
            addRandomTile();
            if(!canMove()) {
                endGame();
            }
        }, 100);
    }
    
    setTimeout(() => {
        isMoveInProgress = false;
    }, 100);
  }

  function commitMove() {
      const newTiles = [];
      tiles.forEach(tile => {
          if(tile.mergedFrom) {
              const mergedTile = grid[tile.row][tile.col];
              if(mergedTile && mergedTile.mergedFrom) {
                  mergedTile.createElement();
                  mergedTile.element.classList.replace('new', 'merged');
                  newTiles.push(mergedTile);

                  if(!hasWon && mergedTile.value === WINNING_TILE) {
                      winGame();
                  }
              }
              tile.element.remove();
          } else {
              newTiles.push(tile);
          }
      });
      tiles = newTiles;
      updateScore();
  }


  function moveTile(tile, cell) {
    grid[tile.row][tile.col] = null;
    grid[cell.r][cell.c] = tile;
    tile.updatePosition(cell.r, cell.c);
  }

  function buildTraversals(vector) {
    const traversals = { r: [], c: [] };
    for (let pos = 0; pos < BOARD_SIZE; pos++) {
      traversals.r.push(pos);
      traversals.c.push(pos);
    }
    if (vector.r === 1) traversals.r = traversals.r.reverse();
    if (vector.c === 1) traversals.c = traversals.c.reverse();
    return traversals;
  }

  function findFarthestPosition(cell, vector) {
    let previous;
    do {
      previous = cell;
      cell = { r: previous.r + vector.r, c: previous.c + vector.c };
    } while (isInBounds(cell) && !grid[cell.r][cell.c]);
    return { farthest: previous, next: cell };
  }
  
  function isInBounds(position) {
      return position.r >= 0 && position.r < BOARD_SIZE &&
             position.c >= 0 && position.c < BOARD_SIZE;
  }

  function prepareTiles() {
    tiles.forEach(tile => {
      tile.mergedFrom = null;
      if (tile.element) {
        tile.element.classList.remove('new', 'merged');
      }
    });
  }

  function canMove() {
      if(getEmptyCells().length > 0) return true;
      for(let r=0; r < BOARD_SIZE; r++){
          for(let c=0; c < BOARD_SIZE; c++){
              const tile = grid[r][c];
              if(!tile) continue;
              if(c < BOARD_SIZE-1 && grid[r][c+1] && tile.value === grid[r][c+1].value) return true;
              if(r < BOARD_SIZE-1 && grid[r+1][c] && tile.value === grid[r+1][c].value) return true;
          }
      }
      return false;
  }
  
  function getEmptyCells(){
      const emptyCells = [];
      for(let r=0; r<BOARD_SIZE; r++){
          for(let c=0; c<BOARD_SIZE; c++){
              if(!grid[r][c]) emptyCells.push({r,c});
          }
      }
      return emptyCells;
  }
  

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem('bestScore', best);
    }
  }

  function endGame() {
    finalScoreEl.textContent = score;
    gameOverOverlay.classList.add('active');
  }

  function winGame() {
      hasWon = true;
      victoryScoreEl.textContent = score;
      victoryOverlay.classList.add('active');
  }

  function hideOverlays() {
    gameOverOverlay.classList.remove('active');
    victoryOverlay.classList.remove('active');
  }

  // Event Listeners
  newGameBtn.addEventListener('click', newGame);
  restartBtn.addEventListener('click', newGame);
  continueBtn.addEventListener('click', hideOverlays);
  
  themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    document.body.className = theme === 'beige' ? '' : `theme-${theme}`;
    localStorage.setItem('theme', theme);
  });
  
  document.addEventListener('keydown', (e) => {
    const keyMap = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' };
    if (keyMap[e.key]) {
      e.preventDefault();
      handleMove(keyMap[e.key]);
    }
  });

  let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
  boardContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  boardContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) {
      const direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      handleMove(direction);
    }
  }
  
  window.addEventListener('resize', ()=>{
      tiles.forEach(t => t.updatePosition(t.row, t.col));
  });

  init();
});
