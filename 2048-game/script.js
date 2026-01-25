/**
 * 2048 Game - Modern Implementation
 * Features: Multiple game modes, undo, statistics, sound, haptic feedback, themes
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // Configuration & Constants
  // ==========================================
  const BOARD_SIZE = 4;
  const WINNING_TILE = 2048;
  const TIME_ATTACK_DURATION = 120; // 2 minutes in seconds
  const GAP = 12; // Default gap in pixels

  // ==========================================
  // DOM Elements
  // ==========================================
  const elements = {
    boardContainer: document.getElementById('board-container'),
    tileContainer: document.getElementById('tile-container'),
    gridBackground: document.getElementById('grid-background'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    scoreAdd: document.getElementById('score-add'),
    movesCount: document.getElementById('moves-count'),
    bestTile: document.getElementById('best-tile'),
    timer: document.getElementById('timer'),
    timerDisplay: document.getElementById('timer-display'),
    newGameBtn: document.getElementById('new-game'),
    undoBtn: document.getElementById('undo-btn'),
    themeSelect: document.getElementById('theme-select'),
    gameModeSelect: document.getElementById('game-mode'),
    soundToggle: document.getElementById('sound-toggle'),
    vibrationToggle: document.getElementById('vibration-toggle'),
    statsBtn: document.getElementById('stats-btn'),
    // Overlays
    gameOverOverlay: document.getElementById('game-over-overlay'),
    victoryOverlay: document.getElementById('victory-overlay'),
    statsOverlay: document.getElementById('stats-overlay'),
    timeUpOverlay: document.getElementById('time-up-overlay'),
    // Modal elements
    finalScore: document.getElementById('final-score'),
    finalBestTile: document.getElementById('final-best-tile'),
    finalMoves: document.getElementById('final-moves'),
    victoryScore: document.getElementById('victory-score'),
    victoryMoves: document.getElementById('victory-moves'),
    timeFinalScore: document.getElementById('time-final-score'),
    timeBestTile: document.getElementById('time-best-tile'),
    // Stats elements
    statGames: document.getElementById('stat-games'),
    statWins: document.getElementById('stat-wins'),
    statBestScore: document.getElementById('stat-best-score'),
    statHighestTile: document.getElementById('stat-highest-tile'),
    statTotalMoves: document.getElementById('stat-total-moves'),
    statWinRate: document.getElementById('stat-win-rate'),
    // Buttons
    restartBtn: document.getElementById('restart-btn'),
    continueBtn: document.getElementById('continue-btn'),
    victoryRestartBtn: document.getElementById('victory-restart-btn'),
    timeRestartBtn: document.getElementById('time-restart-btn'),
    statsClose: document.getElementById('stats-close'),
    resetStatsBtn: document.getElementById('reset-stats-btn'),
  };

  // ==========================================
  // Game State
  // ==========================================
  let state = {
    grid: [],
    tiles: [],
    score: 0,
    best: 0,
    moves: 0,
    currentBestTile: 0,
    hasWon: false,
    isMoving: false,
    gameMode: 'classic',
    timeRemaining: TIME_ATTACK_DURATION,
    timerInterval: null,
    history: [],
    maxHistoryLength: 10,
  };

  // ==========================================
  // Settings
  // ==========================================
  let settings = {
    theme: 'modern',
    soundEnabled: true,
    vibrationEnabled: true,
  };

  // ==========================================
  // Statistics
  // ==========================================
  let stats = {
    gamesPlayed: 0,
    wins: 0,
    bestScore: 0,
    highestTile: 0,
    totalMoves: 0,
  };

  // ==========================================
  // Audio Context (Web Audio API for sounds)
  // ==========================================
  let audioContext = null;

  function initAudio() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playSound(type) {
    if (!settings.soundEnabled) return;

    try {
      initAudio();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      switch (type) {
        case 'move':
          oscillator.frequency.value = 220;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
        case 'merge':
          oscillator.frequency.value = 440;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
          break;
        case 'win':
          playWinSound();
          break;
        case 'lose':
          oscillator.frequency.value = 150;
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
      }
    } catch (e) {
      // Audio not supported
    }
  }

  function playWinSound() {
    if (!audioContext) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, audioContext.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
      osc.start(audioContext.currentTime + i * 0.15);
      osc.stop(audioContext.currentTime + i * 0.15 + 0.3);
    });
  }

  function vibrate(pattern) {
    if (!settings.vibrationEnabled) return;
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // ==========================================
  // Tile Class
  // ==========================================
  class Tile {
    constructor(value, row, col) {
      this.value = value;
      this.row = row;
      this.col = col;
      this.id = Date.now() + Math.random();
      this.element = null;
      this.mergedFrom = null;
      this.previousPosition = null;
    }

    savePreviousPosition() {
      this.previousPosition = { row: this.row, col: this.col };
    }

    getPosition() {
      const containerWidth = elements.boardContainer.offsetWidth;
      const gap = parseFloat(getComputedStyle(elements.boardContainer).getPropertyValue('--gap')) || GAP;
      const padding = gap;
      const cellSize = (containerWidth - padding * 2 - gap * (BOARD_SIZE - 1)) / BOARD_SIZE;

      return {
        x: padding + this.col * (cellSize + gap),
        y: padding + this.row * (cellSize + gap),
        size: cellSize,
      };
    }

    createElement(isNew = true) {
      const pos = this.getPosition();

      this.element = document.createElement('div');
      this.element.className = `tile v${this.value}`;
      if (this.value > 2048) {
        this.element.classList.add('v-super');
      }

      this.element.textContent = this.value;
      this.element.style.width = `${pos.size}px`;
      this.element.style.height = `${pos.size}px`;
      this.element.style.setProperty('--x', `${pos.x}px`);
      this.element.style.setProperty('--y', `${pos.y}px`);
      this.element.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

      if (isNew) {
        this.element.classList.add('new');
      }

      elements.tileContainer.appendChild(this.element);
    }

    updatePosition() {
      if (!this.element) return;

      const pos = this.getPosition();
      this.element.style.width = `${pos.size}px`;
      this.element.style.height = `${pos.size}px`;
      this.element.style.setProperty('--x', `${pos.x}px`);
      this.element.style.setProperty('--y', `${pos.y}px`);
      this.element.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }

    updateValue(newValue) {
      this.value = newValue;
      if (this.element) {
        this.element.textContent = newValue;
        this.element.className = `tile v${newValue}`;
        if (newValue > 2048) {
          this.element.classList.add('v-super');
        }
      }
    }

    destroy() {
      if (this.element && this.element.parentNode) {
        this.element.remove();
      }
    }
  }

  // ==========================================
  // Grid Management
  // ==========================================
  function createGridCells() {
    elements.gridBackground.innerHTML = '';
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      elements.gridBackground.appendChild(cell);
    }
  }

  function initializeGrid() {
    state.grid = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      state.grid[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        state.grid[r][c] = null;
      }
    }
  }

  function getEmptyCells() {
    const empty = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!state.grid[r][c]) {
          empty.push({ r, c });
        }
      }
    }
    return empty;
  }

  function addRandomTile() {
    const emptyCells = getEmptyCells();
    if (emptyCells.length === 0) return null;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = new Tile(value, r, c);

    state.grid[r][c] = tile;
    state.tiles.push(tile);
    tile.createElement(true);

    updateBestTile(value);

    return tile;
  }

  // ==========================================
  // Movement Logic
  // ==========================================
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

  function findFarthestPosition(cell, vector) {
    let previous;
    let current = { r: cell.r, c: cell.c };

    do {
      previous = current;
      current = { r: previous.r + vector.r, c: previous.c + vector.c };
    } while (isWithinBounds(current) && !state.grid[current.r][current.c]);

    return {
      farthest: previous,
      next: current,
    };
  }

  function isWithinBounds(pos) {
    return pos.r >= 0 && pos.r < BOARD_SIZE && pos.c >= 0 && pos.c < BOARD_SIZE;
  }

  function prepareTiles() {
    state.tiles.forEach(tile => {
      tile.mergedFrom = null;
      tile.savePreviousPosition();
      if (tile.element) {
        tile.element.classList.remove('new', 'merged');
      }
    });
  }

  function moveTile(tile, cell) {
    state.grid[tile.row][tile.col] = null;
    state.grid[cell.r][cell.c] = tile;
    tile.row = cell.r;
    tile.col = cell.c;
    tile.updatePosition();
  }

  function handleMove(direction) {
    if (state.isMoving) return;

    const vectors = {
      up: { r: -1, c: 0 },
      down: { r: 1, c: 0 },
      left: { r: 0, c: -1 },
      right: { r: 0, c: 1 },
    };

    const vector = vectors[direction];
    if (!vector) return;

    state.isMoving = true;

    // Save state for undo (before move)
    saveStateForUndo();

    const traversals = buildTraversals(vector);
    let moved = false;
    let scoreGain = 0;
    const mergedTiles = [];

    prepareTiles();

    traversals.rows.forEach(row => {
      traversals.cols.forEach(col => {
        const tile = state.grid[row][col];
        if (!tile) return;

        const positions = findFarthestPosition({ r: row, c: col }, vector);
        const nextTile = isWithinBounds(positions.next) ? state.grid[positions.next.r][positions.next.c] : null;

        if (nextTile && nextTile.value === tile.value && !nextTile.mergedFrom) {
          // Merge tiles
          const mergedValue = tile.value * 2;

          // Move the current tile to merge position
          moveTile(tile, positions.next);

          // Mark as merged
          tile.mergedFrom = [tile, nextTile];
          tile.updateValue(mergedValue);

          // Remove the other tile
          const nextIndex = state.tiles.indexOf(nextTile);
          if (nextIndex > -1) {
            state.tiles.splice(nextIndex, 1);
          }
          nextTile.destroy();

          scoreGain += mergedValue;
          mergedTiles.push(tile);
          moved = true;

          updateBestTile(mergedValue);

          // Check for win
          if (mergedValue === WINNING_TILE && !state.hasWon) {
            state.hasWon = true;
          }
        } else {
          // Just move
          if (positions.farthest.r !== row || positions.farthest.c !== col) {
            moveTile(tile, positions.farthest);
            moved = true;
          }
        }
      });
    });

    if (moved) {
      // Update score
      if (scoreGain > 0) {
        state.score += scoreGain;
        showScoreAnimation(scoreGain);
        playSound('merge');
        vibrate(50);
      } else {
        playSound('move');
        vibrate(20);
      }

      state.moves++;
      updateUI();

      // Add merged animation class
      setTimeout(() => {
        mergedTiles.forEach(tile => {
          if (tile.element) {
            tile.element.classList.add('merged');
          }
        });
      }, 0);

      // Add new tile after animation
      setTimeout(() => {
        addRandomTile();

        // Check game state
        if (state.hasWon && state.gameMode !== 'zen') {
          showVictory();
        } else if (!canMove()) {
          endGame();
        }

        state.isMoving = false;
        updateUndoButton();
      }, 100);
    } else {
      // No move happened, remove the saved undo state
      state.history.pop();
      state.isMoving = false;
    }
  }

  function canMove() {
    // Check for empty cells
    if (getEmptyCells().length > 0) return true;

    // Check for possible merges
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const tile = state.grid[r][c];
        if (!tile) continue;

        // Check right neighbor
        if (c < BOARD_SIZE - 1 && state.grid[r][c + 1] && state.grid[r][c + 1].value === tile.value) {
          return true;
        }
        // Check bottom neighbor
        if (r < BOARD_SIZE - 1 && state.grid[r + 1][c] && state.grid[r + 1][c].value === tile.value) {
          return true;
        }
      }
    }

    return false;
  }

  // ==========================================
  // Undo Functionality
  // ==========================================
  function saveStateForUndo() {
    const gridState = state.grid.map(row =>
      row.map(tile => tile ? { value: tile.value, row: tile.row, col: tile.col } : null)
    );

    state.history.push({
      grid: gridState,
      score: state.score,
      moves: state.moves,
      currentBestTile: state.currentBestTile,
    });

    // Limit history size
    if (state.history.length > state.maxHistoryLength) {
      state.history.shift();
    }
  }

  function undo() {
    if (state.history.length === 0 || state.isMoving) return;

    const previousState = state.history.pop();

    // Clear current tiles
    state.tiles.forEach(tile => tile.destroy());
    state.tiles = [];
    initializeGrid();

    // Restore grid
    previousState.grid.forEach((row, r) => {
      row.forEach((tileData, c) => {
        if (tileData) {
          const tile = new Tile(tileData.value, r, c);
          state.grid[r][c] = tile;
          state.tiles.push(tile);
          tile.createElement(false);
        }
      });
    });

    // Restore score and moves
    state.score = previousState.score;
    state.moves = previousState.moves;
    state.currentBestTile = previousState.currentBestTile;

    updateUI();
    updateUndoButton();
    playSound('move');
    vibrate(30);
  }

  function updateUndoButton() {
    elements.undoBtn.disabled = state.history.length === 0;
  }

  // ==========================================
  // Game Modes
  // ==========================================
  function setGameMode(mode) {
    state.gameMode = mode;
    stopTimer();

    if (mode === 'time') {
      elements.timerDisplay.style.display = 'flex';
      state.timeRemaining = TIME_ATTACK_DURATION;
      updateTimerDisplay();
    } else {
      elements.timerDisplay.style.display = 'none';
    }

    newGame();
  }

  function startTimer() {
    if (state.gameMode !== 'time') return;

    stopTimer();
    state.timerInterval = setInterval(() => {
      state.timeRemaining--;
      updateTimerDisplay();

      if (state.timeRemaining <= 0) {
        stopTimer();
        timeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    elements.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Add warning/danger classes
    elements.timer.classList.remove('warning', 'danger');
    if (state.timeRemaining <= 10) {
      elements.timer.classList.add('danger');
    } else if (state.timeRemaining <= 30) {
      elements.timer.classList.add('warning');
    }
  }

  function timeUp() {
    elements.timeFinalScore.textContent = state.score;
    elements.timeBestTile.textContent = state.currentBestTile;
    elements.timeUpOverlay.classList.add('active');
    playSound('lose');
    vibrate([100, 50, 100]);
    updateStats(false);
  }

  // ==========================================
  // UI Updates
  // ==========================================
  function updateUI() {
    elements.score.textContent = state.score;
    elements.movesCount.textContent = state.moves;
    elements.bestTile.textContent = state.currentBestTile;

    // Update best score
    if (state.score > state.best) {
      state.best = state.score;
      elements.best.textContent = state.best;
      localStorage.setItem('2048_best', state.best);

      // Also update stats
      if (state.score > stats.bestScore) {
        stats.bestScore = state.score;
        saveStats();
      }
    }

    // Pulse animation on score card
    const scoreCard = elements.score.closest('.score-card');
    scoreCard.classList.remove('pulse');
    void scoreCard.offsetWidth; // Trigger reflow
    scoreCard.classList.add('pulse');
  }

  function showScoreAnimation(amount) {
    elements.scoreAdd.textContent = `+${amount}`;
    elements.scoreAdd.classList.remove('active');
    void elements.scoreAdd.offsetWidth;
    elements.scoreAdd.classList.add('active');
  }

  function updateBestTile(value) {
    if (value > state.currentBestTile) {
      state.currentBestTile = value;
      elements.bestTile.textContent = value;

      // Update global stats
      if (value > stats.highestTile) {
        stats.highestTile = value;
        saveStats();
      }
    }
  }

  function updateAllTilePositions() {
    state.tiles.forEach(tile => tile.updatePosition());
  }

  // ==========================================
  // Game Flow
  // ==========================================
  function newGame() {
    hideAllOverlays();
    stopTimer();

    // Clear tiles
    state.tiles.forEach(tile => tile.destroy());
    state.tiles = [];
    initializeGrid();

    // Reset state
    state.score = 0;
    state.moves = 0;
    state.currentBestTile = 0;
    state.hasWon = false;
    state.isMoving = false;
    state.history = [];

    if (state.gameMode === 'time') {
      state.timeRemaining = TIME_ATTACK_DURATION;
      updateTimerDisplay();
    }

    // Add initial tiles
    addRandomTile();
    addRandomTile();

    updateUI();
    updateUndoButton();

    // Start timer for time attack mode
    if (state.gameMode === 'time') {
      startTimer();
    }
  }

  function endGame() {
    stopTimer();

    elements.finalScore.textContent = state.score;
    elements.finalBestTile.textContent = state.currentBestTile;
    elements.finalMoves.textContent = state.moves;
    elements.gameOverOverlay.classList.add('active');

    playSound('lose');
    vibrate([100, 50, 100]);

    updateStats(false);
  }

  function showVictory() {
    elements.victoryScore.textContent = state.score;
    elements.victoryMoves.textContent = state.moves;
    elements.victoryOverlay.classList.add('active');

    playSound('win');
    vibrate([50, 50, 50, 50, 100]);

    updateStats(true);
  }

  function hideAllOverlays() {
    elements.gameOverOverlay.classList.remove('active');
    elements.victoryOverlay.classList.remove('active');
    elements.statsOverlay.classList.remove('active');
    elements.timeUpOverlay.classList.remove('active');
  }

  // ==========================================
  // Statistics
  // ==========================================
  function loadStats() {
    const saved = localStorage.getItem('2048_stats');
    if (saved) {
      try {
        stats = JSON.parse(saved);
      } catch (e) {
        // Use default stats
      }
    }
  }

  function saveStats() {
    localStorage.setItem('2048_stats', JSON.stringify(stats));
  }

  function updateStats(won) {
    stats.gamesPlayed++;
    if (won) stats.wins++;
    stats.totalMoves += state.moves;

    if (state.score > stats.bestScore) {
      stats.bestScore = state.score;
    }
    if (state.currentBestTile > stats.highestTile) {
      stats.highestTile = state.currentBestTile;
    }

    saveStats();
  }

  function showStats() {
    elements.statGames.textContent = stats.gamesPlayed;
    elements.statWins.textContent = stats.wins;
    elements.statBestScore.textContent = stats.bestScore;
    elements.statHighestTile.textContent = stats.highestTile;
    elements.statTotalMoves.textContent = stats.totalMoves;

    const winRate = stats.gamesPlayed > 0
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0;
    elements.statWinRate.textContent = `${winRate}%`;

    elements.statsOverlay.classList.add('active');
  }

  function resetStats() {
    if (confirm('Are you sure you want to reset all statistics?')) {
      stats = {
        gamesPlayed: 0,
        wins: 0,
        bestScore: 0,
        highestTile: 0,
        totalMoves: 0,
      };
      saveStats();
      showStats();
    }
  }

  // ==========================================
  // Settings & Themes
  // ==========================================
  function loadSettings() {
    settings.theme = localStorage.getItem('2048_theme') || 'modern';
    settings.soundEnabled = localStorage.getItem('2048_sound') !== 'false';
    settings.vibrationEnabled = localStorage.getItem('2048_vibration') !== 'false';

    applyTheme(settings.theme);
    elements.themeSelect.value = settings.theme;
    elements.soundToggle.checked = settings.soundEnabled;
    elements.vibrationToggle.checked = settings.vibrationEnabled;
  }

  function applyTheme(theme) {
    document.body.className = theme === 'modern' ? '' : `theme-${theme}`;
    settings.theme = theme;
    localStorage.setItem('2048_theme', theme);

    // Update tile positions after theme change (gap might change)
    setTimeout(updateAllTilePositions, 50);
  }

  // ==========================================
  // Event Handlers
  // ==========================================
  function setupEventListeners() {
    // Buttons
    elements.newGameBtn.addEventListener('click', newGame);
    elements.undoBtn.addEventListener('click', undo);
    elements.restartBtn.addEventListener('click', newGame);
    elements.continueBtn.addEventListener('click', () => {
      hideAllOverlays();
    });
    elements.victoryRestartBtn.addEventListener('click', newGame);
    elements.timeRestartBtn.addEventListener('click', newGame);
    elements.statsBtn.addEventListener('click', showStats);
    elements.statsClose.addEventListener('click', () => {
      elements.statsOverlay.classList.remove('active');
    });
    elements.resetStatsBtn.addEventListener('click', resetStats);

    // Theme selection
    elements.themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });

    // Game mode selection
    elements.gameModeSelect.addEventListener('change', (e) => {
      setGameMode(e.target.value);
    });

    // Settings toggles
    elements.soundToggle.addEventListener('change', (e) => {
      settings.soundEnabled = e.target.checked;
      localStorage.setItem('2048_sound', settings.soundEnabled);
      if (settings.soundEnabled) {
        initAudio();
        playSound('move');
      }
    });

    elements.vibrationToggle.addEventListener('change', (e) => {
      settings.vibrationEnabled = e.target.checked;
      localStorage.setItem('2048_vibration', settings.vibrationEnabled);
      if (settings.vibrationEnabled) {
        vibrate(50);
      }
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeydown);

    // Touch controls
    setupTouchControls();

    // Window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateAllTilePositions, 100);
    });

    // Click on overlay background to close (stats only)
    elements.statsOverlay.addEventListener('click', (e) => {
      if (e.target === elements.statsOverlay) {
        elements.statsOverlay.classList.remove('active');
      }
    });
  }

  function handleKeydown(e) {
    const keyMap = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      W: 'up',
      s: 'down',
      S: 'down',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
    };

    const direction = keyMap[e.key];
    if (direction) {
      e.preventDefault();
      handleMove(direction);
    }

    // Undo with Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  }

  function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    elements.boardContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    elements.boardContainer.addEventListener('touchmove', (e) => {
      // Prevent scrolling while swiping on board
      e.preventDefault();
    }, { passive: false });

    elements.boardContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const minSwipeDistance = 30;

      if (Math.max(absDx, absDy) < minSwipeDistance) return;

      if (absDx > absDy) {
        handleMove(dx > 0 ? 'right' : 'left');
      } else {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    }
  }

  // ==========================================
  // Initialization
  // ==========================================
  function init() {
    createGridCells();
    loadStats();
    loadSettings();

    // Load best score
    state.best = parseInt(localStorage.getItem('2048_best') || '0', 10);
    elements.best.textContent = state.best;

    setupEventListeners();
    newGame();
  }

  // Start the game
  init();
});
