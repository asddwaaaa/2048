/**
 * 2048 Modern Edition
 * A feature-rich implementation of the classic 2048 game
 * with smooth animations, multiple game modes, and statistics tracking
 */

(function() {
  'use strict';

  // ==========================================
  // Configuration & Constants
  // ==========================================
  const CONFIG = {
    BOARD_SIZES: {
      classic: 4,
      '5x5': 5,
      speed: 4,
      zen: 4
    },
    WINNING_TILE: 2048,
    ANIMATION_DURATION: 120,
    NEW_TILE_DELAY: 100,
    SPEED_MODE_TIMER: 60,
    MAX_UNDO_HISTORY: 5,
    SOUND_ENABLED_DEFAULT: true,
    ANIMATIONS_ENABLED_DEFAULT: true
  };

  // ==========================================
  // Game State
  // ==========================================
  const state = {
    grid: [],
    tiles: [],
    score: 0,
    best: 0,
    moves: 0,
    highestTile: 0,
    hasWon: false,
    isGameOver: false,
    isMoveInProgress: false,
    gameMode: 'classic',
    boardSize: 4,
    undoHistory: [],

    // Timer
    startTime: null,
    elapsedTime: 0,
    timerInterval: null,
    speedModeTimeLeft: CONFIG.SPEED_MODE_TIMER,

    // Settings
    theme: 'gradient',
    soundEnabled: CONFIG.SOUND_ENABLED_DEFAULT,
    animationsEnabled: CONFIG.ANIMATIONS_ENABLED_DEFAULT,
    showTimer: true,

    // Statistics
    stats: {
      gamesPlayed: 0,
      victories: 0,
      bestScore: 0,
      highestTile: 0,
      totalMoves: 0,
      totalTimePlayed: 0,
      tilesAchieved: {}
    }
  };

  // ==========================================
  // DOM Elements
  // ==========================================
  let elements = {};

  function initElements() {
    elements = {
      // Board
      boardContainer: document.getElementById('board-container'),
      tileContainer: document.getElementById('tile-container'),
      gridBackground: document.getElementById('grid-background'),

      // Scores
      scoreEl: document.getElementById('score'),
      bestEl: document.getElementById('best'),
      scoreAddition: document.getElementById('score-addition'),

      // Game Info
      movesEl: document.getElementById('moves'),
      timerEl: document.getElementById('timer'),
      highestTileEl: document.getElementById('highest-tile'),
      modeLabelEl: document.getElementById('mode-label'),
      modeInfoEl: document.getElementById('mode-info'),

      // Buttons
      newGameBtn: document.getElementById('new-game'),
      undoBtn: document.getElementById('undo-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      statsBtn: document.getElementById('stats-btn'),

      // Modals
      gameOverOverlay: document.getElementById('game-over-overlay'),
      victoryOverlay: document.getElementById('victory-overlay'),
      settingsOverlay: document.getElementById('settings-overlay'),
      statsOverlay: document.getElementById('stats-overlay'),

      // Game Over Modal
      finalScoreEl: document.getElementById('final-score'),
      finalMovesEl: document.getElementById('final-moves'),
      finalTimeEl: document.getElementById('final-time'),
      restartBtn: document.getElementById('restart-btn'),

      // Victory Modal
      victoryScoreEl: document.getElementById('victory-score'),
      victoryMovesEl: document.getElementById('victory-moves'),
      continueBtn: document.getElementById('continue-btn'),
      victoryRestartBtn: document.getElementById('victory-restart-btn'),
      confettiContainer: document.getElementById('confetti'),

      // Settings
      closeSettingsBtn: document.getElementById('close-settings'),
      soundToggle: document.getElementById('sound-toggle'),
      animationToggle: document.getElementById('animation-toggle'),
      timerToggle: document.getElementById('timer-toggle'),

      // Stats
      closeStatsBtn: document.getElementById('close-stats'),
      resetStatsBtn: document.getElementById('reset-stats'),
      statGames: document.getElementById('stat-games'),
      statWins: document.getElementById('stat-wins'),
      statBest: document.getElementById('stat-best'),
      statHighest: document.getElementById('stat-highest'),
      statMoves: document.getElementById('stat-moves'),
      statTime: document.getElementById('stat-time'),
      achievementTiles: document.getElementById('achievement-tiles'),

      // Other
      swipeHint: document.getElementById('swipe-hint'),
      particles: document.getElementById('particles')
    };
  }

  // ==========================================
  // Tile Class
  // ==========================================
  class Tile {
    constructor(value, row, col) {
      this.value = value || 2;
      this.row = row;
      this.col = col;
      this.id = Date.now() + Math.random();
      this.element = null;
      this.mergedFrom = null;
      this.isNew = true;
    }

    updatePosition(newRow, newCol) {
      this.row = newRow;
      this.col = newCol;
      if (this.element) {
        const { x, y, size } = this.calculatePosition();
        this.element.style.transform = `translate(${x}px, ${y}px)`;
        this.element.style.width = `${size}px`;
        this.element.style.height = `${size}px`;
      }
    }

    calculatePosition() {
      const container = elements.tileContainer;
      const gap = state.boardSize === 5 ? 10 : 12;
      const containerSize = container.offsetWidth;
      const tileSize = (containerSize - gap * (state.boardSize + 1)) / state.boardSize;
      const x = gap + this.col * (tileSize + gap);
      const y = gap + this.row * (tileSize + gap);
      return { x, y, size: tileSize };
    }

    createElement() {
      const tile = document.createElement('div');
      tile.className = `tile v${this.value > 2048 ? '-super' : this.value}`;
      if (this.isNew && state.animationsEnabled) {
        tile.classList.add('new');
      }

      const inner = document.createElement('div');
      inner.className = 'tile-inner';
      inner.textContent = this.value;
      tile.appendChild(inner);

      this.element = tile;
      elements.tileContainer.appendChild(tile);
      this.updatePosition(this.row, this.col);
      this.isNew = false;
    }

    updateValue(newValue) {
      this.value = newValue;
      if (this.element) {
        const inner = this.element.querySelector('.tile-inner');
        inner.textContent = this.value;
        this.element.className = `tile v${this.value > 2048 ? '-super' : this.value}`;
        if (state.animationsEnabled) {
          this.element.classList.add('merged');
        }
      }
    }

    remove() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  // ==========================================
  // Sound Manager
  // ==========================================
  const SoundManager = {
    audioContext: null,

    init() {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.log('Web Audio API not supported');
      }
    },

    play(type) {
      if (!state.soundEnabled || !this.audioContext) return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      const sounds = {
        move: { freq: 220, duration: 0.1, type: 'sine' },
        merge: { freq: 440, duration: 0.15, type: 'triangle' },
        newTile: { freq: 330, duration: 0.08, type: 'sine' },
        win: { freq: 523, duration: 0.5, type: 'triangle' },
        lose: { freq: 165, duration: 0.3, type: 'sawtooth' }
      };

      const sound = sounds[type] || sounds.move;
      oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
      oscillator.type = sound.type;
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + sound.duration);
    },

    resume() {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    }
  };

  // ==========================================
  // Statistics Manager
  // ==========================================
  const StatsManager = {
    load() {
      const saved = localStorage.getItem('2048_stats');
      if (saved) {
        try {
          state.stats = { ...state.stats, ...JSON.parse(saved) };
        } catch (e) {
          console.error('Failed to load stats:', e);
        }
      }
    },

    save() {
      try {
        localStorage.setItem('2048_stats', JSON.stringify(state.stats));
      } catch (e) {
        console.error('Failed to save stats:', e);
      }
    },

    recordGameEnd(won) {
      state.stats.gamesPlayed++;
      if (won) state.stats.victories++;
      if (state.score > state.stats.bestScore) {
        state.stats.bestScore = state.score;
      }
      if (state.highestTile > state.stats.highestTile) {
        state.stats.highestTile = state.highestTile;
      }
      state.stats.totalMoves += state.moves;
      state.stats.totalTimePlayed += state.elapsedTime;
      this.save();
    },

    recordTileAchieved(value) {
      if (!state.stats.tilesAchieved[value]) {
        state.stats.tilesAchieved[value] = true;
        this.save();
      }
    },

    reset() {
      state.stats = {
        gamesPlayed: 0,
        victories: 0,
        bestScore: 0,
        highestTile: 0,
        totalMoves: 0,
        totalTimePlayed: 0,
        tilesAchieved: {}
      };
      this.save();
    },

    updateDisplay() {
      elements.statGames.textContent = state.stats.gamesPlayed;
      elements.statWins.textContent = state.stats.victories;
      elements.statBest.textContent = formatNumber(state.stats.bestScore);
      elements.statHighest.textContent = state.stats.highestTile;
      elements.statMoves.textContent = formatNumber(state.stats.totalMoves);
      elements.statTime.textContent = formatDuration(state.stats.totalTimePlayed);
      this.updateAchievements();
    },

    updateAchievements() {
      const tiles = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
      elements.achievementTiles.innerHTML = tiles.map(value => {
        const achieved = state.stats.tilesAchieved[value] ? 'achieved' : '';
        const bgClass = `v${value > 2048 ? '-super' : value}`;
        return `<div class="achievement-tile tile ${bgClass} ${achieved}"><div class="tile-inner">${value}</div></div>`;
      }).join('');
    }
  };

  // ==========================================
  // Core Game Functions
  // ==========================================
  function init() {
    initElements();
    loadSettings();
    StatsManager.load();
    SoundManager.init();
    createParticles();
    createGridCells();
    setupEventListeners();

    // Show hint on first visit
    if (!localStorage.getItem('2048_played')) {
      showSwipeHint();
    }

    newGame();
  }

  function loadSettings() {
    state.best = parseInt(localStorage.getItem('2048_best') || '0', 10);
    state.theme = localStorage.getItem('2048_theme') || 'gradient';
    state.gameMode = localStorage.getItem('2048_mode') || 'classic';
    state.soundEnabled = localStorage.getItem('2048_sound') !== 'false';
    state.animationsEnabled = localStorage.getItem('2048_animations') !== 'false';
    state.showTimer = localStorage.getItem('2048_timer') !== 'false';

    applyTheme(state.theme);
    updateSettingsUI();
    updateModeDisplay();
  }

  function saveSettings() {
    localStorage.setItem('2048_best', state.best);
    localStorage.setItem('2048_theme', state.theme);
    localStorage.setItem('2048_mode', state.gameMode);
    localStorage.setItem('2048_sound', state.soundEnabled);
    localStorage.setItem('2048_animations', state.animationsEnabled);
    localStorage.setItem('2048_timer', state.showTimer);
  }

  function createGridCells() {
    elements.gridBackground.innerHTML = '';
    elements.gridBackground.style.setProperty('--board-size', state.boardSize);

    for (let i = 0; i < state.boardSize * state.boardSize; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      elements.gridBackground.appendChild(cell);
    }
  }

  function createParticles() {
    const particleCount = 15;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 15}s`;
      particle.style.animationDuration = `${15 + Math.random() * 10}s`;
      elements.particles.appendChild(particle);
    }
  }

  function newGame() {
    // Save current game to undo history if in progress
    if (state.moves > 0 && !state.isGameOver) {
      saveToUndoHistory();
    }

    // Reset state
    state.boardSize = CONFIG.BOARD_SIZES[state.gameMode] || 4;
    state.grid = Array.from({ length: state.boardSize }, () => Array(state.boardSize).fill(null));
    state.tiles.forEach(t => t.remove());
    state.tiles = [];
    state.score = 0;
    state.moves = 0;
    state.highestTile = 0;
    state.hasWon = false;
    state.isGameOver = false;
    state.isMoveInProgress = false;
    state.undoHistory = [];

    // Update board class for different sizes
    elements.boardContainer.classList.remove('board-5x5');
    if (state.boardSize === 5) {
      elements.boardContainer.classList.add('board-5x5');
    }

    // Recreate grid
    createGridCells();

    // Reset timer
    resetTimer();

    // Speed mode timer
    if (state.gameMode === 'speed') {
      state.speedModeTimeLeft = CONFIG.SPEED_MODE_TIMER;
      startSpeedModeTimer();
    }

    // Hide overlays
    hideAllOverlays();

    // Update UI
    updateScore();
    updateMoves();
    updateHighestTile();
    updateUndoButton();

    // Add initial tiles
    addRandomTile();
    addRandomTile();

    // Start timer
    startTimer();

    localStorage.setItem('2048_played', 'true');
  }

  function addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < state.boardSize; r++) {
      for (let c = 0; c < state.boardSize; c++) {
        if (!state.grid[r][c]) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      // In zen mode, always spawn 2s; otherwise 90% 2, 10% 4
      const value = state.gameMode === 'zen' ? 2 : (Math.random() < 0.9 ? 2 : 4);
      const tile = new Tile(value, r, c);
      state.grid[r][c] = tile;
      state.tiles.push(tile);
      tile.createElement();
      SoundManager.play('newTile');

      if (value > state.highestTile) {
        state.highestTile = value;
        updateHighestTile();
      }
    }
  }

  // ==========================================
  // Move Handling
  // ==========================================
  function handleMove(direction) {
    if (state.isMoveInProgress || state.isGameOver) return;

    SoundManager.resume();
    state.isMoveInProgress = true;

    const vectors = {
      up: { r: -1, c: 0 },
      down: { r: 1, c: 0 },
      left: { r: 0, c: -1 },
      right: { r: 0, c: 1 }
    };
    const moveVector = vectors[direction];
    const traversals = buildTraversals(moveVector);

    let moved = false;
    let mergeScore = 0;

    // Save state for undo
    saveToUndoHistory();

    // Prepare tiles
    prepareTiles();

    traversals.r.forEach(row => {
      traversals.c.forEach(col => {
        const tile = state.grid[row][col];
        if (!tile) return;

        const positions = findFarthestPosition({ r: row, c: col }, moveVector);
        const next = state.grid[positions.next.r]?.[positions.next.c];

        if (next && next.value === tile.value && !next.mergedFrom) {
          // Merge tiles
          const mergedValue = tile.value * 2;

          // Remove the moving tile
          tile.updatePosition(next.row, next.col);
          state.grid[tile.row][tile.col] = null;

          // Update the target tile
          setTimeout(() => {
            tile.remove();
            next.updateValue(mergedValue);
            next.mergedFrom = [tile, next];

            // Update highest tile
            if (mergedValue > state.highestTile) {
              state.highestTile = mergedValue;
              updateHighestTile();
              StatsManager.recordTileAchieved(mergedValue);
            }

            // Check for win
            if (!state.hasWon && mergedValue >= CONFIG.WINNING_TILE) {
              state.hasWon = true;
              setTimeout(() => winGame(), 300);
            }
          }, CONFIG.ANIMATION_DURATION);

          mergeScore += mergedValue;
          moved = true;
          SoundManager.play('merge');
        } else if (positions.farthest.r !== row || positions.farthest.c !== col) {
          // Move tile
          moveTile(tile, positions.farthest);
          moved = true;
        }
      });
    });

    if (moved) {
      state.score += mergeScore;
      state.moves++;

      // Show score addition animation
      if (mergeScore > 0) {
        showScoreAddition(mergeScore);
      }

      setTimeout(() => {
        // Clean up merged tiles
        state.tiles = state.tiles.filter(t => {
          if (t.mergedFrom) {
            t.mergedFrom = null;
          }
          return state.grid[t.row]?.[t.col] === t;
        });

        addRandomTile();
        updateScore();
        updateMoves();
        updateUndoButton();

        if (!canMove()) {
          state.isGameOver = true;
          setTimeout(() => endGame(), 500);
        }

        state.isMoveInProgress = false;
      }, CONFIG.NEW_TILE_DELAY);

      SoundManager.play('move');
    } else {
      // Remove the saved state since no move was made
      state.undoHistory.pop();
      state.isMoveInProgress = false;
    }
  }

  function buildTraversals(vector) {
    const traversals = { r: [], c: [] };
    for (let i = 0; i < state.boardSize; i++) {
      traversals.r.push(i);
      traversals.c.push(i);
    }
    if (vector.r === 1) traversals.r.reverse();
    if (vector.c === 1) traversals.c.reverse();
    return traversals;
  }

  function findFarthestPosition(cell, vector) {
    let previous;
    do {
      previous = cell;
      cell = { r: previous.r + vector.r, c: previous.c + vector.c };
    } while (isInBounds(cell) && !state.grid[cell.r][cell.c]);
    return { farthest: previous, next: cell };
  }

  function isInBounds(pos) {
    return pos.r >= 0 && pos.r < state.boardSize &&
           pos.c >= 0 && pos.c < state.boardSize;
  }

  function moveTile(tile, cell) {
    state.grid[tile.row][tile.col] = null;
    state.grid[cell.r][cell.c] = tile;
    tile.updatePosition(cell.r, cell.c);
  }

  function prepareTiles() {
    state.tiles.forEach(tile => {
      tile.mergedFrom = null;
      if (tile.element) {
        tile.element.classList.remove('new', 'merged');
      }
    });
  }

  function canMove() {
    // Check for empty cells
    for (let r = 0; r < state.boardSize; r++) {
      for (let c = 0; c < state.boardSize; c++) {
        if (!state.grid[r][c]) return true;
      }
    }

    // Check for possible merges
    for (let r = 0; r < state.boardSize; r++) {
      for (let c = 0; c < state.boardSize; c++) {
        const tile = state.grid[r][c];
        if (!tile) continue;

        // Check right neighbor
        if (c < state.boardSize - 1 && state.grid[r][c + 1]?.value === tile.value) {
          return true;
        }
        // Check bottom neighbor
        if (r < state.boardSize - 1 && state.grid[r + 1][c]?.value === tile.value) {
          return true;
        }
      }
    }

    return false;
  }

  // ==========================================
  // Undo System
  // ==========================================
  function saveToUndoHistory() {
    if (state.undoHistory.length >= CONFIG.MAX_UNDO_HISTORY) {
      state.undoHistory.shift();
    }

    const snapshot = {
      grid: state.grid.map(row => row.map(tile => tile ? { value: tile.value, row: tile.row, col: tile.col } : null)),
      score: state.score,
      moves: state.moves,
      highestTile: state.highestTile
    };

    state.undoHistory.push(snapshot);
  }

  function undo() {
    if (state.undoHistory.length === 0 || state.isMoveInProgress) return;

    const snapshot = state.undoHistory.pop();

    // Clear current tiles
    state.tiles.forEach(t => t.remove());
    state.tiles = [];

    // Restore grid
    state.grid = snapshot.grid.map((row, r) =>
      row.map((data, c) => {
        if (data) {
          const tile = new Tile(data.value, r, c);
          tile.isNew = false;
          state.tiles.push(tile);
          return tile;
        }
        return null;
      })
    );

    // Recreate tile elements
    state.tiles.forEach(tile => tile.createElement());

    // Restore state
    state.score = snapshot.score;
    state.moves = snapshot.moves;
    state.highestTile = snapshot.highestTile;
    state.isGameOver = false;

    // Update UI
    updateScore();
    updateMoves();
    updateHighestTile();
    updateUndoButton();
    hideAllOverlays();
  }

  function updateUndoButton() {
    elements.undoBtn.disabled = state.undoHistory.length === 0;
  }

  // ==========================================
  // Timer Functions
  // ==========================================
  function startTimer() {
    state.startTime = Date.now() - state.elapsedTime * 1000;
    if (state.timerInterval) clearInterval(state.timerInterval);

    state.timerInterval = setInterval(() => {
      state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
      updateTimerDisplay();
    }, 1000);
  }

  function resetTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.elapsedTime = 0;
    state.startTime = null;
    updateTimerDisplay();
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (state.showTimer) {
      elements.timerEl.textContent = formatTime(state.elapsedTime);
    } else {
      elements.timerEl.textContent = '--:--';
    }
  }

  function startSpeedModeTimer() {
    const speedInterval = setInterval(() => {
      if (state.gameMode !== 'speed' || state.isGameOver) {
        clearInterval(speedInterval);
        return;
      }

      state.speedModeTimeLeft--;
      elements.modeInfoEl.textContent = `${state.speedModeTimeLeft}s remaining`;

      if (state.speedModeTimeLeft <= 0) {
        clearInterval(speedInterval);
        state.isGameOver = true;
        endGame();
      }
    }, 1000);
  }

  // ==========================================
  // Score & UI Updates
  // ==========================================
  function updateScore() {
    elements.scoreEl.textContent = formatNumber(state.score);

    if (state.score > state.best) {
      state.best = state.score;
      elements.bestEl.textContent = formatNumber(state.best);
      localStorage.setItem('2048_best', state.best);
    }
  }

  function showScoreAddition(amount) {
    elements.scoreAddition.textContent = `+${amount}`;
    elements.scoreAddition.classList.remove('show');
    void elements.scoreAddition.offsetWidth; // Force reflow
    elements.scoreAddition.classList.add('show');
  }

  function updateMoves() {
    elements.movesEl.textContent = state.moves;
  }

  function updateHighestTile() {
    elements.highestTileEl.textContent = state.highestTile;
  }

  function updateModeDisplay() {
    const modeNames = {
      classic: 'Classic Mode',
      '5x5': 'Extended Mode (5x5)',
      speed: 'Speed Mode',
      zen: 'Zen Mode'
    };
    elements.modeLabelEl.textContent = modeNames[state.gameMode] || 'Classic Mode';

    if (state.gameMode === 'speed') {
      elements.modeInfoEl.textContent = `${state.speedModeTimeLeft}s remaining`;
    } else if (state.gameMode === 'zen') {
      elements.modeInfoEl.textContent = 'No 4s spawn';
    } else {
      elements.modeInfoEl.textContent = '';
    }
  }

  // ==========================================
  // Game End States
  // ==========================================
  function endGame() {
    stopTimer();
    state.isGameOver = true;

    elements.finalScoreEl.textContent = formatNumber(state.score);
    elements.finalMovesEl.textContent = state.moves;
    elements.finalTimeEl.textContent = formatTime(state.elapsedTime);

    elements.gameOverOverlay.classList.add('active');
    SoundManager.play('lose');

    StatsManager.recordGameEnd(false);
  }

  function winGame() {
    stopTimer();

    elements.victoryScoreEl.textContent = formatNumber(state.score);
    elements.victoryMovesEl.textContent = state.moves;

    elements.victoryOverlay.classList.add('active');
    createConfetti();
    SoundManager.play('win');

    StatsManager.recordGameEnd(true);
  }

  function createConfetti() {
    elements.confettiContainer.innerHTML = '';
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#feca57', '#4ade80'];

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
      elements.confettiContainer.appendChild(confetti);
    }
  }

  // ==========================================
  // Modals & Overlays
  // ==========================================
  function hideAllOverlays() {
    elements.gameOverOverlay.classList.remove('active');
    elements.victoryOverlay.classList.remove('active');
    elements.settingsOverlay.classList.remove('active');
    elements.statsOverlay.classList.remove('active');
  }

  function showSettings() {
    updateSettingsUI();
    elements.settingsOverlay.classList.add('active');
  }

  function hideSettings() {
    elements.settingsOverlay.classList.remove('active');
  }

  function showStats() {
    StatsManager.updateDisplay();
    elements.statsOverlay.classList.add('active');
  }

  function hideStats() {
    elements.statsOverlay.classList.remove('active');
  }

  function updateSettingsUI() {
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === state.theme);
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.gameMode);
    });

    // Toggles
    elements.soundToggle.classList.toggle('active', state.soundEnabled);
    elements.animationToggle.classList.toggle('active', state.animationsEnabled);
    elements.timerToggle.classList.toggle('active', state.showTimer);
  }

  function applyTheme(theme) {
    document.body.className = theme === 'gradient' ? '' : `theme-${theme}`;
    state.theme = theme;
    saveSettings();
  }

  function setGameMode(mode) {
    if (mode !== state.gameMode) {
      state.gameMode = mode;
      saveSettings();
      updateModeDisplay();
      newGame();
    }
  }

  function showSwipeHint() {
    elements.swipeHint.classList.add('show');
    setTimeout(() => {
      elements.swipeHint.classList.remove('show');
    }, 5000);
  }

  // ==========================================
  // Event Listeners
  // ==========================================
  function setupEventListeners() {
    // Buttons
    elements.newGameBtn.addEventListener('click', () => {
      SoundManager.resume();
      newGame();
    });
    elements.undoBtn.addEventListener('click', undo);
    elements.settingsBtn.addEventListener('click', showSettings);
    elements.statsBtn.addEventListener('click', showStats);

    // Game Over Modal
    elements.restartBtn.addEventListener('click', newGame);

    // Victory Modal
    elements.continueBtn.addEventListener('click', () => {
      hideAllOverlays();
      startTimer();
    });
    elements.victoryRestartBtn.addEventListener('click', newGame);

    // Settings Modal
    elements.closeSettingsBtn.addEventListener('click', hideSettings);
    elements.soundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      updateSettingsUI();
      saveSettings();
    });
    elements.animationToggle.addEventListener('click', () => {
      state.animationsEnabled = !state.animationsEnabled;
      document.body.classList.toggle('no-animations', !state.animationsEnabled);
      updateSettingsUI();
      saveSettings();
    });
    elements.timerToggle.addEventListener('click', () => {
      state.showTimer = !state.showTimer;
      updateSettingsUI();
      updateTimerDisplay();
      saveSettings();
    });

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.theme);
        updateSettingsUI();
      });
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setGameMode(btn.dataset.mode);
        updateSettingsUI();
        hideSettings();
      });
    });

    // Stats Modal
    elements.closeStatsBtn.addEventListener('click', hideStats);
    elements.resetStatsBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all statistics?')) {
        StatsManager.reset();
        StatsManager.updateDisplay();
      }
    });

    // Close modals on overlay click
    [elements.settingsOverlay, elements.statsOverlay].forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeydown);

    // Touch controls
    setupTouchControls();

    // Window resize
    window.addEventListener('resize', handleResize);

    // Visibility change (pause timer when tab is hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopTimer();
      } else if (!state.isGameOver && state.moves > 0) {
        startTimer();
      }
    });
  }

  function handleKeydown(e) {
    const keyMap = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right'
    };

    if (keyMap[e.key]) {
      e.preventDefault();
      handleMove(keyMap[e.key]);
    }

    // Undo with Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }

    // New game with Ctrl+N
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      newGame();
    }
  }

  function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    elements.boardContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    elements.boardContainer.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime;

      // Ignore long touches (might be scrolling)
      if (touchDuration > 500) return;

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
  }

  function handleResize() {
    state.tiles.forEach(tile => {
      tile.updatePosition(tile.row, tile.col);
    });
  }

  // ==========================================
  // Utility Functions
  // ==========================================
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }

  // ==========================================
  // Initialize Game
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
