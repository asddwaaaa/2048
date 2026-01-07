document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const tileContainer = document.getElementById('tile-container');
    const scoreDisplay = document.getElementById('score');
    const bestScoreDisplay = document.getElementById('best-score');
    const newGameButton = document.getElementById('new-game-button');
    const gameMessage = document.getElementById('game-message');
    const messageText = gameMessage.querySelector('p');
    const restartButton = gameMessage.querySelector('.btn-restart');

    const GRID_SIZE = 4;
    const CELL_GAP = 15;

    let grid = [];
    let score = 0;
    let bestScore = localStorage.getItem('2048-best-score') || 0;
    let isGameOver = false;

    // --- UTILITY ---
    function getCellSize() {
        return gridContainer.querySelector('.grid-cell').offsetWidth;
    }

    function updateTilePositions() {
        const cellSize = getCellSize();
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const x = parseInt(tile.dataset.x, 10);
            const y = parseInt(tile.dataset.y, 10);
            tile.style.width = `${cellSize}px`;
            tile.style.height = `${cellSize}px`;
            tile.style.transform = `translate(${x * (cellSize + CELL_GAP)}px, ${y * (cellSize + CELL_GAP)}px)`;
        });
    }

    // --- GAME SETUP ---
    class Grid {
        constructor() {
            this.cells = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        }

        getEmptyCells() {
            const emptyCells = [];
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    if (this.cells[y][x] === null) {
                        emptyCells.push({ x, y });
                    }
                }
            }
            return emptyCells;
        }

        randomEmptyCell() {
            const emptyCells = this.getEmptyCells();
            if (emptyCells.length === 0) return null;
            return emptyCells[Math.floor(Math.random() * emptyCells.length)];
        }
    }

    class Tile {
        constructor(x, y, value = Math.random() > 0.9 ? 4 : 2) {
            this.x = x;
            this.y = y;
            this.value = value;
            this.element = this.createElement();
            this.update(x, y, this.value);
            grid.cells[y][x] = this;
            tileContainer.appendChild(this.element);
        }

        createElement() {
            const tile = document.createElement('div');
            tile.classList.add('tile');
            return tile;
        }
        
        update(x, y, value, isMerged = false) {
            this.x = x;
            this.y = y;
            this.value = value;

            this.element.dataset.x = x;
            this.element.dataset.y = y;
            this.element.dataset.value = value;
            this.element.textContent = value;
            
            this.element.classList.remove('tile-merged');
            if (isMerged) {
                this.element.classList.add('tile-merged');
            }
            
            updateTilePositions();
        }

        remove() {
            grid.cells[this.y][this.x] = null;
            this.element.remove();
        }
    }
    
    function startGame() {
        tileContainer.innerHTML = '';
        gameMessage.style.display = 'none';
        isGameOver = false;
        grid = new Grid();
        score = 0;
        updateScore(0);
        updateBestScore();

        addRandomTile();
        addRandomTile();
        updateTilePositions();
    }

    function addRandomTile() {
        const cell = grid.randomEmptyCell();
        if (cell) {
            const newTile = new Tile(cell.x, cell.y);
            newTile.element.classList.add('tile-new');
        }
    }

    // --- SCORE ---
    function updateScore(newPoints) {
        score += newPoints;
        scoreDisplay.textContent = score;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('2048-best-score', bestScore);
            updateBestScore();
        }
    }

    function updateBestScore() {
        bestScoreDisplay.textContent = bestScore;
    }

    // --- MOVEMENT LOGIC ---
    function canMove(cells) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const tile = cells[y][x];
                if (tile === null) return true; // Can move if there is an empty cell
                // Check neighbors
                if (x + 1 < GRID_SIZE && cells[y][x + 1] && cells[y][x + 1].value === tile.value) return true;
                if (y + 1 < GRID_SIZE && cells[y + 1][x] && cells[y + 1][x].value === tile.value) return true;
            }
        }
        return false;
    }

    function move(direction) {
        if (isGameOver) return;

        let moved = false;
        const promises = [];

        // 0: up, 1: right, 2: down, 3: left
        const vector = { x: 0, y: 0 };
        if (direction === 'up') vector.y = -1;
        if (direction === 'down') vector.y = 1;
        if (direction === 'left') vector.x = -1;
        if (direction === 'right') vector.x = 1;

        const traversals = buildTraversals(vector);
        
        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const currentTile = grid.cells[y][x];
                if (currentTile) {
                    const positions = findFarthestPosition(x, y, vector);
                    const nextTile = grid.cells[positions.next.y]?.[positions.next.x];

                    if (nextTile && nextTile.value === currentTile.value && !nextTile.mergedFrom) {
                        // Merge
                        const mergedValue = currentTile.value * 2;
                        
                        grid.cells[positions.next.y][positions.next.x] = currentTile;
                        grid.cells[y][x] = null;
                        
                        currentTile.update(positions.next.x, positions.next.y, mergedValue, true);
                        nextTile.remove();

                        currentTile.mergedFrom = true;
                        
                        updateScore(mergedValue);
                        moved = true;
                    } else {
                        // Move
                        if(positions.farthest.x !== x || positions.farthest.y !== y) {
                            grid.cells[positions.farthest.y][positions.farthest.x] = currentTile;
                            grid.cells[y][x] = null;
                            currentTile.update(positions.farthest.x, positions.farthest.y, currentTile.value);
                            moved = true;
                        }
                    }
                }
            });
        });


        // Clear merge flags
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (grid.cells[r][c]) {
                    delete grid.cells[r][c].mergedFrom;
                }
            }
        }
        
        if (moved) {
            addRandomTile();
            if (!canMove(grid.cells)) {
                endGame(false); // Game over
            }
        }
    }
    
    function buildTraversals(vector) {
        const traversals = { x: [], y: [] };
        for (let pos = 0; pos < GRID_SIZE; pos++) {
            traversals.x.push(pos);
            traversals.y.push(pos);
        }
        // Always traverse from the farthest cell in the chosen direction
        if (vector.x === 1) traversals.x = traversals.x.reverse();
        if (vector.y === 1) traversals.y = traversals.y.reverse();
        
        return traversals;
    }

    function findFarthestPosition(x, y, vector) {
        let previous;
        do {
            previous = { x, y };
            x += vector.x;
            y += vector.y;
        } while (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && grid.cells[y][x] === null);

        return {
            farthest: previous,
            next: { x, y } // position of the next tile or wall
        };
    }


    // --- GAME END ---
    function endGame(isWon) {
        isGameOver = true;
        gameMessage.style.display = 'flex';
        gameMessage.classList.remove('game-won');

        if (isWon) {
            messageText.textContent = 'Вы победили!';
            gameMessage.classList.add('game-won');
        } else {
            messageText.textContent = 'Игра окончена!';
        }
    }
    
    // --- INPUT HANDLING ---
    function handleKeyDown(e) {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                move('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                move('down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                move('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                move('right');
                break;
        }
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    gridContainer.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    gridContainer.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const SWIPE_THRESHOLD = 50;

        if (Math.max(absDx, absDy) > SWIPE_THRESHOLD) {
            if (absDx > absDy) {
                // Horizontal swipe
                move(dx > 0 ? 'right' : 'left');
            } else {
                // Vertical swipe
                move(dy > 0 ? 'down' : 'up');
            }
        }
    }

    // --- EVENT LISTENERS ---
    window.addEventListener('keydown', handleKeyDown);
    newGameButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    window.addEventListener('resize', updateTilePositions);


    // --- INITIALIZE ---
    startGame();
});
