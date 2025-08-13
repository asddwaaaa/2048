// 2048 — Молочная версия с плавной анимацией

let TILE_ID = 1;

class Tile {
    constructor(value, row, col) {
        this.id = TILE_ID++;
        this.value = value;
        this.row = row;
        this.col = col;
        this.mergedFrom = null;
        this.justCreated = true;
        this.toBeRemoved = false;
        this.previousPosition = null;
        this.mergeTarget = null;
    }
}

class Game2048 {
    constructor() {
        this.size = 4;
        this.grid = this.createEmptyGrid();
        this.score = 0;
        this.bestScore = Number(localStorage.getItem('2048-best-score') || 0);
        this.gameWon = false;
        this.gameOver = false;
        this.tiles = [];
        this.tileElements = {};
        this.pendingMerges = [];
        this.isAnimating = false;
        this.animationQueue = [];
        this.moves = 0;
        this.startTime = null;
        this.gameTimer = null;
        
        // Новые свойства для расширенной функциональности
        this.gameMode = 'classic'; // classic, timed, moves
        this.moveHistory = [];
        this.maxMoves = 50; // для режима ограниченных ходов
        this.timeLimit = 300; // 5 минут для временного режима
        this.hintsUsed = 0;
        this.achievements = this.loadAchievements();
        
        this.init();
    }

    createEmptyGrid() {
        return Array(this.size).fill(null).map(() => Array(this.size).fill(null));
    }

    init() {
        TILE_ID = 1;
        this.grid = this.createEmptyGrid();
        this.score = 0;
        this.gameWon = false;
        this.gameOver = false;
        this.tiles = [];
        this.tileElements = {};
        this.pendingMerges = [];
        this.isAnimating = false;
        this.animationQueue = [];
        this.moves = 0;
        this.startTime = Date.now();
        this.moveHistory = [];
        this.hintsUsed = 0;
        this.createBoard();
        this.addRandomTile();
        this.addRandomTile();
        
        // Очищаем все DOM элементы перед обновлением
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            const tiles = gameBoard.querySelectorAll('.tile');
            tiles.forEach(tile => tile.remove());
        }
        
        this.updateDisplay();
        this.setupEventListeners();
        this.startTimer();
        
        // Обновляем кнопку отмены после инициализации
        this.updateUndoButton();
    }

    startTimer() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        this.startTime = Date.now();
        this.gameTimer = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    updateTimer() {
        if (this.gameOver && this.gameWon) {
            clearInterval(this.gameTimer);
            return;
        }
        
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('time').textContent = timeString;
    }

    createBoard() {
        const gameBoard = document.getElementById('game-board');
        gameBoard.innerHTML = '';
        
        const cellSize = 75;
        const gap = 12;
        
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.style.transform = `translate(${col * (cellSize + gap)}px, ${row * (cellSize + gap)}px)`;
                gameBoard.appendChild(cell);
            }
        }
    }

    addRandomTile() {
        const emptyCells = [];
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (!this.grid[i][j]) emptyCells.push({row: i, col: j});
            }
        }
        
        if (emptyCells.length > 0) {
            const {row, col} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const tile = new Tile(Math.random() < 0.9 ? 2 : 4, row, col);
            
            // Добавляем более мягкое случайное смещение для эффекта появления
            tile.randomAppearOffset = {
                x: Math.round((Math.random() - 0.5) * 20),
                y: Math.round((Math.random() - 0.5) * 20)
            };
            
            this.grid[row][col] = tile;
            this.tiles.push(tile);
        }
    }

    updateDisplay() {
        const gameBoard = document.getElementById('game-board');
        const cellSize = 75;
        const gap = 12;
        
        // Удаляем DOM-элементы для исчезнувших плиток
        for (const id in this.tileElements) {
            const tile = this.tiles.find(t => t.id == id);
            if (!tile) {
                const el = this.tileElements[id];
                if (el && el.parentNode) {
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0)';
                    setTimeout(() => {
                        if (el.parentNode) el.parentNode.removeChild(el);
                    }, 250);
                }
                delete this.tileElements[id];
            }
        }
        
        // Обновляем/создаём DOM-элементы для всех плиток
        for (const tile of this.tiles) {
            let el = this.tileElements[tile.id];
            let baseX = tile.col * (cellSize + gap);
            let baseY = tile.row * (cellSize + gap);
            
            if (!el) {
                el = document.createElement('div');
                el.className = 'tile';
                el.textContent = tile.value;
                el.dataset.value = tile.value;
                el.style.zIndex = 2;
                this.tileElements[tile.id] = el;
                gameBoard.appendChild(el);
                
                // Анимация появления новой плитки
                if (tile.justCreated) {
                    const dx = tile.randomAppearOffset ? tile.randomAppearOffset.x : 0;
                    const dy = tile.randomAppearOffset ? tile.randomAppearOffset.y : 0;
                    
                    el.classList.add('new');
                    el.style.transform = `translate(${baseX + dx}px, ${baseY + dy}px) scale(0)`;
                    el.style.opacity = '0';
                    
                    // Плавное появление
                    requestAnimationFrame(() => {
                        el.style.transform = `translate(${baseX}px, ${baseY}px) scale(1)`;
                        el.style.opacity = '1';
                    });
                    
                    setTimeout(() => { 
                        tile.justCreated = false; 
                        el.classList.remove('new');
                    }, 300);
                } else {
                    el.style.transform = `translate(${baseX}px, ${baseY}px)`;
                }
            } else {
                // Обновляем значение и позицию
                const oldValue = el.dataset.value;
                if (oldValue != tile.value) {
                    el.textContent = tile.value;
                    el.dataset.value = tile.value;
                }
                
                // Плавное перемещение с улучшенной производительностью
                const currentTransform = el.style.transform;
                const newTransform = `translate(${baseX}px, ${baseY}px)`;
                
                // Проверяем, действительно ли позиция изменилась
                if (currentTransform !== newTransform) {
                    // Применяем новую позицию напрямую для предотвращения телепортации
                    el.style.transform = newTransform;
                }
            }
        }
        
        document.getElementById('score').textContent = this.score;
        document.getElementById('best-score').textContent = this.bestScore;
        
        // Обновляем отображение в зависимости от режима
        this.updateModeDisplay();
        
        // Обновляем кнопку отмены
        this.updateUndoButton();
    }

    setupEventListeners() {
        if (this._eventsSet) return;
        this._eventsSet = true;
        
        // Клавиатура с улучшенной обработкой
        let lastKeyTime = 0;
        const keyCooldown = 50; // Минимальный интервал между нажатиями
        
        document.addEventListener('keydown', (e) => {
            if (this.gameOver || this.isAnimating) return;
            
            const now = Date.now();
            if (now - lastKeyTime < keyCooldown) return;
            
            let moved = false;
            switch(e.key) {
                case 'ArrowUp': 
                case 'w':
                case 'W':
                    moved = this.move('up'); 
                    break;
                case 'ArrowDown': 
                case 's':
                case 'S':
                    moved = this.move('down'); 
                    break;
                case 'ArrowLeft': 
                case 'a':
                case 'A':
                    moved = this.move('left'); 
                    break;
                case 'ArrowRight': 
                case 'd':
                case 'D':
                    moved = this.move('right'); 
                    break;
            }
            
            if (moved) {
                e.preventDefault();
                lastKeyTime = now;
                // Сохраняем состояние только при успешном ходе
                this.saveGameState();
                this.moves++;
                this.addRandomTile();
                this.updateDisplay();
                this.checkGameState();
            }
        });
        
        // Touch events для мобильных устройств с улучшенной обработкой
        let startX, startY, startTime;
        let isSwiping = false;
        let lastSwipeTime = 0;
        const swipeCooldown = 100; // Минимальный интервал между свайпами
        
        document.addEventListener('touchstart', (e) => {
            if (this.gameOver || this.isAnimating) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
            isSwiping = false;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (this.gameOver || this.isAnimating || startX == null) return;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = Math.abs(currentX - startX);
            const diffY = Math.abs(currentY - startY);
            
            if (diffX > 8 || diffY > 8) {
                isSwiping = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (this.gameOver || this.isAnimating || startX == null || !isSwiping) return;
            
            const now = Date.now();
            if (now - lastSwipeTime < swipeCooldown) return;
            
            const endTime = now;
            const duration = endTime - startTime;
            
            // Игнорируем слишком быстрые свайпы
            if (duration < 80) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Минимальное расстояние для свайпа
            if (Math.abs(diffX) < 25 && Math.abs(diffY) < 25) return;
            
            let moved = false;
            if (Math.abs(diffX) > Math.abs(diffY)) {
                moved = diffX > 0 ? this.move('left') : this.move('right');
            } else {
                moved = diffY > 0 ? this.move('up') : this.move('down');
            }
            
            if (moved) {
                e.preventDefault();
                lastSwipeTime = now;
                // Сохраняем состояние только при успешном ходе
                this.saveGameState();
                this.moves++;
                this.addRandomTile();
                this.updateDisplay();
                this.checkGameState();
            }
            
            startX = startY = null;
            isSwiping = false;
        });
        
        // Кнопки управления
        document.getElementById('new-game-btn').onclick = () => this.newGame();
        document.getElementById('restart-btn').onclick = () => this.newGame();
        document.getElementById('continue-btn').onclick = () => {
            document.getElementById('win-message').style.display = 'none';
        };
        document.getElementById('new-game-win-btn').onclick = () => this.newGame();
        
        // Кнопка отмены хода
        document.getElementById('undo-btn').onclick = () => this.undoMove();
        
        // Кнопка подсказки
        document.getElementById('hint-btn').onclick = () => this.getHint();
        
        // Переключение режимов игры
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                this.changeGameMode(mode);
                
                // Обновляем активную кнопку
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });
    }

    move(direction) {
        if (this.isAnimating || this.gameOver) return false;
        
        let moved = false;
        let traversals = this.buildTraversals(direction);
        let mergedThisTurn = this.createEmptyGrid();
        
        // Сохраняем предыдущие позиции для анимации
        for (const tile of this.tiles) {
            tile.previousPosition = {row: tile.row, col: tile.col};
            tile.mergedFrom = null;
        }
        
        // Движение и объединение
        let merges = [];
        for (let i of traversals.x) {
            for (let j of traversals.y) {
                let tile = this.grid[i][j];
                if (!tile) continue;
                
                let {row, col} = this.findFarthestPosition(i, j, direction);
                
                // Проверяем возможность объединения
                let next = this.getNextTile(row, col, direction);
                if (next && next.value === tile.value && !mergedThisTurn[next.row][next.col]) {
                    // Объединяем
                    merges.push({
                        from: [tile, next], 
                        to: [next.row, next.col], 
                        value: tile.value * 2
                    });
                    
                    this.grid[tile.row][tile.col] = null;
                    this.grid[next.row][next.col] = null;
                    this.tiles = this.tiles.filter(t => t !== tile && t !== next);
                    mergedThisTurn[next.row][next.col] = true;
                    this.score += tile.value * 2;
                    moved = true;
                } else {
                    // Просто перемещаем
                    if (tile.row !== row || tile.col !== col) moved = true;
                    this.grid[tile.row][tile.col] = null;
                    this.grid[row][col] = tile;
                    tile.row = row;
                    tile.col = col;
                }
            }
        }
        
        // Анимация объединений
        if (merges.length > 0) {
            this.isAnimating = true;
            
            // Сначала анимируем движение плиток к месту объединения
            this.updateDisplay();
            
            setTimeout(() => {
                // Удаляем старые плитки и создаем новые объединенные
                for (const merge of merges) {
                    for (const t of merge.from) {
                        const el = this.tileElements[t.id];
                        if (el) {
                            el.style.opacity = '0';
                            el.style.transform = 'scale(0.7)';
                            setTimeout(() => {
                                if (el.parentNode) el.parentNode.removeChild(el);
                            }, 180);
                        }
                        delete this.tileElements[t.id];
                    }
                    
                    const [row, col] = merge.to;
                    const tile = new Tile(merge.value, row, col);
                    tile.justCreated = false;
                    this.grid[row][col] = tile;
                    this.tiles.push(tile);
                }
                
                // Обновляем отображение только один раз после всех изменений
                requestAnimationFrame(() => {
                    this.updateDisplay();
                    
                    // Добавляем pop-анимацию для объединенных плиток
                    setTimeout(() => {
                        for (const merge of merges) {
                            const [row, col] = merge.to;
                            const tile = this.grid[row][col];
                            const el = this.tileElements[tile.id];
                            if (el) {
                                el.classList.add('merged');
                                setTimeout(() => el.classList.remove('merged'), 350);
                            }
                        }
                        this.isAnimating = false;
                    }, 30);
                });
            }, 250);
        } else if (moved) {
            this.updateDisplay();
        }
        
        return moved;
    }

    buildTraversals(direction) {
        let x = [], y = [];
        for (let i = 0; i < this.size; i++) x.push(i), y.push(i);
        if (direction === 'right') x = x.reverse();
        if (direction === 'down') y = y.reverse();
        return {x, y};
    }

    findFarthestPosition(row, col, direction) {
        let prev;
        do {
            prev = {row, col};
            switch(direction) {
                case 'up':    row--; break;
                case 'down':  row++; break;
                case 'left':  col--; break;
                case 'right': col++; break;
            }
        } while (this.withinBounds(row, col) && !this.grid[row][col]);
        return prev;
    }

    getNextTile(row, col, direction) {
        switch(direction) {
            case 'up':    row--; break;
            case 'down':  row++; break;
            case 'left':  col--; break;
            case 'right': col++; break;
        }
        if (this.withinBounds(row, col)) return this.grid[row][col];
        return null;
    }

    withinBounds(row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    loadAchievements() {
        const saved = localStorage.getItem('2048-achievements');
        return saved ? JSON.parse(saved) : {
            firstWin: false,
            score1000: false,
            score5000: false,
            score10000: false,
            tile512: false,
            tile1024: false,
            tile2048: false,
            moves50: false,
            moves100: false,
            timeUnder5min: false
        };
    }

    saveAchievements() {
        localStorage.setItem('2048-achievements', JSON.stringify(this.achievements));
    }

    unlockAchievement(achievement) {
        if (!this.achievements[achievement]) {
            this.achievements[achievement] = true;
            this.saveAchievements();
            this.showAchievement(achievement);
        }
    }

    showAchievement(achievement) {
        const messages = {
            firstWin: '🎉 Первая победа!',
            score1000: '💰 Счёт 1000!',
            score5000: '💎 Счёт 5000!',
            score10000: '🏆 Счёт 10000!',
            tile512: '🔥 Плитка 512!',
            tile1024: '⚡ Плитка 1024!',
            tile2048: '👑 Плитка 2048!',
            moves50: '🎯 50 ходов!',
            moves100: '🎖️ 100 ходов!',
            timeUnder5min: '⏱️ Быстрая игра!'
        };
        
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.textContent = messages[achievement];
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    saveGameState() {
        // Глубокое клонирование состояния
        const state = {
            grid: this.createEmptyGrid(),
            score: this.score,
            tiles: [],
            moves: this.moves,
            gameMode: this.gameMode
        };
        
        // Клонируем сетку
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.grid[i][j]) {
                    const tile = this.grid[i][j];
                    const clonedTile = new Tile(tile.value, tile.row, tile.col);
                    // Используем оригинальный ID для корректного восстановления
                    clonedTile.id = tile.id;
                    state.grid[i][j] = clonedTile;
                    state.tiles.push(clonedTile);
                }
            }
        }
        
        this.moveHistory.push(state);
        
        // Ограничиваем историю последними 10 ходами
        if (this.moveHistory.length > 10) {
            this.moveHistory.shift();
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0 || this.isAnimating) return false;
        
        const previousState = this.moveHistory.pop();
        
        // Восстанавливаем состояние
        this.grid = previousState.grid;
        this.score = previousState.score;
        this.tiles = previousState.tiles;
        this.moves = previousState.moves;
        
        // Очищаем DOM элементы
        for (const id in this.tileElements) {
            const el = this.tileElements[id];
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        this.tileElements = {};
        
        // Обновляем отображение
        this.updateDisplay();
        this.updateUndoButton();
        
        return true;
    }

    updateUndoButton() {
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.disabled = this.moveHistory.length === 0;
        }
    }

    getHint() {
        if (this.hintsUsed >= 3) return null;
        
        // Простая логика подсказки - находим лучший ход
        const directions = ['up', 'down', 'left', 'right'];
        let bestDirection = null;
        let bestScore = -1;
        
        for (const direction of directions) {
            const testGrid = JSON.parse(JSON.stringify(this.grid));
            const testTiles = JSON.parse(JSON.stringify(this.tiles));
            
            // Симулируем ход
            const moved = this.simulateMove(testGrid, testTiles, direction);
            if (moved) {
                const score = this.evaluatePosition(testGrid);
                if (score > bestScore) {
                    bestScore = score;
                    bestDirection = direction;
                }
            }
        }
        
        if (bestDirection) {
            this.hintsUsed++;
            this.showHint(bestDirection);
        }
        
        return bestDirection;
    }

    simulateMove(grid, tiles, direction) {
        // Упрощенная симуляция хода
        let moved = false;
        const traversals = this.buildTraversals(direction);
        
        for (let i of traversals.x) {
            for (let j of traversals.y) {
                let tile = grid[i][j];
                if (!tile) continue;
                
                let {row, col} = this.findFarthestPosition(i, j, direction);
                
                if (tile.row !== row || tile.col !== col) {
                    moved = true;
                    grid[tile.row][tile.col] = null;
                    grid[row][col] = tile;
                    tile.row = row;
                    tile.col = col;
                }
            }
        }
        
        return moved;
    }

    evaluatePosition(grid) {
        // Простая оценка позиции
        let score = 0;
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (grid[i][j]) {
                    score += grid[i][j].value;
                }
            }
        }
        return score;
    }

    showHint(direction) {
        const arrows = {
            up: '↑',
            down: '↓',
            left: '←',
            right: '→'
        };
        
        const hint = document.createElement('div');
        hint.className = 'hint-notification';
        hint.textContent = `💡 Подсказка: ${arrows[direction]}`;
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.remove();
        }, 2000);
    }

    changeGameMode(mode) {
        this.gameMode = mode;
        
        // Сбрасываем игру при смене режима
        this.newGame();
        
        // Обновляем отображение в зависимости от режима
        this.updateModeDisplay();
    }

    updateModeDisplay() {
        const movesDisplay = document.getElementById('moves');
        const timeDisplay = document.getElementById('time');
        
        if (this.gameMode === 'moves') {
            movesDisplay.textContent = `${this.moves}/${this.maxMoves}`;
        } else {
            movesDisplay.textContent = this.moves;
        }
        
        if (this.gameMode === 'timed') {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const remaining = this.timeLimit - elapsed;
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    checkGameState() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('2048-best-score', this.bestScore);
        }
        
        // Проверяем достижения
        this.checkAchievements();
        
        // Проверка на победу
        for (const tile of this.tiles) {
            if (tile.value === 2048 && !this.gameWon) {
                this.gameWon = true;
                this.unlockAchievement('tile2048');
                this.unlockAchievement('firstWin');
                setTimeout(() => {
                    document.getElementById('win-score').textContent = this.score;
                    document.getElementById('win-message').style.display = 'flex';
                }, 500);
                return;
            }
        }
        
        // Проверяем режимы игры
        if (this.gameMode === 'moves' && this.moves >= this.maxMoves) {
            this.gameOver = true;
            if (this.gameTimer) {
                clearInterval(this.gameTimer);
            }
            setTimeout(() => {
                document.getElementById('final-score').textContent = this.score;
                document.getElementById('final-best-score').textContent = this.bestScore;
                document.getElementById('game-over').style.display = 'flex';
            }, 500);
            return;
        }
        
        if (this.gameMode === 'timed') {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (elapsed >= this.timeLimit) {
                this.gameOver = true;
                if (this.gameTimer) {
                    clearInterval(this.gameTimer);
                }
                setTimeout(() => {
                    document.getElementById('final-score').textContent = this.score;
                    document.getElementById('final-best-score').textContent = this.bestScore;
                    document.getElementById('game-over').style.display = 'flex';
                }, 500);
                return;
            }
        }
        
        // Проверка на проигрыш
        if (this.isGameOver()) {
            this.gameOver = true;
            if (this.gameTimer) {
                clearInterval(this.gameTimer);
            }
            setTimeout(() => {
                document.getElementById('final-score').textContent = this.score;
                document.getElementById('final-best-score').textContent = this.bestScore;
                document.getElementById('game-over').style.display = 'flex';
            }, 500);
        }
    }

    checkAchievements() {
        // Проверяем достижения по счёту
        if (this.score >= 1000) this.unlockAchievement('score1000');
        if (this.score >= 5000) this.unlockAchievement('score5000');
        if (this.score >= 10000) this.unlockAchievement('score10000');
        
        // Проверяем достижения по плиткам
        for (const tile of this.tiles) {
            if (tile.value >= 512) this.unlockAchievement('tile512');
            if (tile.value >= 1024) this.unlockAchievement('tile1024');
        }
        
        // Проверяем достижения по ходам
        if (this.moves >= 50) this.unlockAchievement('moves50');
        if (this.moves >= 100) this.unlockAchievement('moves100');
        
        // Проверяем достижение по времени
        if (this.gameMode === 'timed') {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            if (elapsed < 300 && this.score >= 1000) { // 5 минут
                this.unlockAchievement('timeUnder5min');
            }
        }
    }

    isGameOver() {
        // Есть пустые клетки
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (!this.grid[i][j]) return false;
            }
        }
        
        // Есть возможные объединения
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                let tile = this.grid[i][j];
                if (!tile) continue;
                
                for (const [dx, dy] of [[0,1],[1,0]]) {
                    let ni = i + dx, nj = j + dy;
                    if (this.withinBounds(ni, nj) && this.grid[ni][nj] && this.grid[ni][nj].value === tile.value) return false;
                }
            }
        }
        return true;
    }

    newGame() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        this.init();
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('win-message').style.display = 'none';
    }
}

// Инициализация игры
document.addEventListener('DOMContentLoaded', () => {
    new Game2048();
});