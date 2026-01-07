document.addEventListener('DOMContentLoaded', () => {
    const tileContainer = document.getElementById('tile-container');
    const scoreDisplay = document.getElementById('score');
    const bestScoreDisplay = document.getElementById('best-score');
    const newGameButton = document.getElementById('new-game-button');
    const gameMessage = document.getElementById('game-message');
    const messageText = gameMessage.querySelector('p');
    const restartButton = gameMessage.querySelector('.btn-restart');
    const gameContainer = document.querySelector('.game-container');

    const GRID_SIZE = 4;
    const CELL_SIZE = 20; // in vmin
    const CELL_GAP = 2; // in vmin

    let grid = [];
    let score = 0;
    let bestScore = 0;
    let isGameOver = false;
    let win = false;

    // --- GAME SETUP ---

    function createCellElements(gridElement) {
        gridElement.innerHTML = '';
        const cells = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement("div");
            cell.classList.add("grid-cell");
            cells.push(cell);
            gridElement.appendChild(cell);
        }
        return cells;
    }

    class Grid {
        constructor() {
            this.cells = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        }

        get emptyCells() {
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
            const emptyCells = this.emptyCells;
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
            this.update(x, y, this.value, true);
            grid.cells[y][x] = this;
            tileContainer.appendChild(this.element);
        }

        createElement() {
            const tile = document.createElement('div');
            tile.classList.add('tile');
            return tile;
        }

        update(x, y, value, isNew = false) {
            this.x = x;
            this.y = y;
            this.value = value;
            
            this.element.dataset.value = value;
            this.element.textContent = value;
            
            const cellSize = gameContainer.querySelector('.grid-cell').offsetWidth;
            const gap = parseFloat(getComputedStyle(gameContainer).gap) || 15;
            
            this.element.style.width = `${cellSize}px`;
            this.element.style.height = `${cellSize}px`;
            this.element.style.transform = `translate(${x * (cellSize + gap)}px, ${y * (cellSize + gap)}px)`;

            this.element.classList.remove('tile-new', 'tile-merged');
            if (isNew) {
                this.element.classList.add('tile-new');
            }
        }
        
        merge() {
            this.element.classList.add('tile-merged');
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
        win = false;
        grid = new Grid();
        score = 0;
        updateScore(0);
        bestScore = localStorage.getItem('2048-best-score') || 0;
        updateBestScore();

        addRandomTile();
        addRandomTile();
        updateTilePositions();
    }

    function addRandomTile() {
        if (grid.emptyCells.length === 0) return false;
        const cell = grid.randomEmptyCell();
        if (cell) {
            new Tile(cell.x, cell.y);
        }
        return true;
    }
    
    function updateTilePositions() {
        const cellSize = gameContainer.querySelector('.grid-cell').offsetWidth;
        const gap = parseFloat(getComputedStyle(gameContainer.querySelector('.grid-container')).gap) || 15;

        for(let y=0; y<GRID_SIZE; y++) {
            for(let x=0; x<GRID_SIZE; x++) {
                const tile = grid.cells[y][x];
                if(tile) {
                    tile.element.style.width = `${cellSize}px`;
                    tile.element.style.height = `${cellSize}px`;
                    tile.element.style.transform = `translate(${x * (cellSize + gap)}px, ${y * (cellSize + gap)}px)`;
                }
            }
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

    function handleInput(e) {
        if (isGameOver) return;
        switch (e.key) {
            case 'ArrowUp':
                moveUp();
                break;
            case 'ArrowDown':
                moveDown();
                break;
            case 'ArrowLeft':
                moveLeft();
                break;
            case 'ArrowRight':
                moveRight();
                break;
            default:
                return;
        }
        e.preventDefault();
        
        if (!win && grid.cells.flat().some(t => t && t.value === 2048)) {
            win = true;
            endGame(true);
        } else {
             if (grid.emptyCells.length === 0 && !canMove()) {
                endGame(false);
            }
        }
    }
    
    function slideTiles(line) {
        const newLine = line.filter(tile => tile !== null);
        for(let i=0; i<newLine.length - 1; i++){
            if(newLine[i].value === newLine[i+1].value){
                const mergedValue = newLine[i].value * 2;
                updateScore(mergedValue);
                newLine[i].value = mergedValue;
                newLine[i+1].remove();
                newLine.splice(i+1, 1);
                newLine[i].merge();
            }
        }
        const emptyTiles = Array(GRID_SIZE - newLine.length).fill(null);
        return newLine.concat(emptyTiles);
    }
    
    function moveLeft(){
        let moved = false;
        for(let y=0; y<GRID_SIZE; y++){
            const line = grid.cells[y];
            const newLine = slideTiles(line);
            for(let x=0; x<GRID_SIZE; x++){
                 if (grid.cells[y][x]?.value !== newLine[x]?.value) moved = true;
                grid.cells[y][x] = newLine[x];
                if (grid.cells[y][x]) grid.cells[y][x].update(x, y, grid.cells[y][x].value);
            }
        }
        if (moved) addRandomTile();
    }
    
    function moveRight(){
        let moved = false;
        for(let y=0; y<GRID_SIZE; y++){
            const line = grid.cells[y].slice().reverse();
            const newLine = slideTiles(line).reverse();
            for(let x=0; x<GRID_SIZE; x++){
                 if (grid.cells[y][x]?.value !== newLine[x]?.value) moved = true;
                grid.cells[y][x] = newLine[x];
                if (grid.cells[y][x]) grid.cells[y][x].update(x, y, grid.cells[y][x].value);
            }
        }
        if (moved) addRandomTile();
    }

    function moveUp(){
        let moved = false;
        for(let x=0; x<GRID_SIZE; x++){
            const line = [];
            for(let y=0; y<GRID_SIZE; y++) line.push(grid.cells[y][x]);
            const newLine = slideTiles(line);
            for(let y=0; y<GRID_SIZE; y++){
                if (grid.cells[y][x]?.value !== newLine[y]?.value) moved = true;
                grid.cells[y][x] = newLine[y];
                if (grid.cells[y][x]) grid.cells[y][x].update(x, y, grid.cells[y][x].value);
            }
        }
        if (moved) addRandomTile();
    }
    
    function moveDown(){
        let moved = false;
        for(let x=0; x<GRID_SIZE; x++){
            const line = [];
            for(let y=0; y<GRID_SIZE; y++) line.push(grid.cells[y][x]);
            const newLine = slideTiles(line.slice().reverse()).reverse();
            for(let y=0; y<GRID_SIZE; y++){
                if (grid.cells[y][x]?.value !== newLine[y]?.value) moved = true;
                grid.cells[y][x] = newLine[y];
                if (grid.cells[y][x]) grid.cells[y][x].update(x, y, grid.cells[y][x].value);
            }
        }
        if (moved) addRandomTile();
    }

    function canMove() {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const tile = grid.cells[y][x];
                if (!tile) return true;
                if (x + 1 < GRID_SIZE && grid.cells[y][x + 1] && grid.cells[y][x+1].value === tile.value) return true;
                if (y + 1 < GRID_SIZE && grid.cells[y+1][x] && grid.cells[y+1][x].value === tile.value) return true;
            }
        }
        return false;
    }


    // --- GAME END ---
    function endGame(isWon) {
        if (!win && isWon) {
             messageText.textContent = 'Вы победили!';
             gameMessage.classList.add('game-won');
             gameMessage.style.display = 'flex';
             restartButton.textContent = "Играть снова";
             // Don't set isGameOver to true, allow continuing
        } else if (!isWon) {
            isGameOver = true;
            messageText.textContent = 'Игра окончена!';
            gameMessage.classList.remove('game-won');
            gameMessage.style.display = 'flex';
            restartButton.textContent = "Попробовать снова";
        }
    }
    
    function continueGame() {
        win = true; // Acknowledge win
        gameMessage.style.display = 'none';
    }

    // --- INPUT HANDLING ---
    let touchStartX = 0;
    let touchStartY = 0;

    gameContainer.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    gameContainer.addEventListener('touchmove', e => {
        e.preventDefault();
    }, { passive: false });

    gameContainer.addEventListener('touchend', e => {
        if (isGameOver) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) > 30) { // Swipe threshold
            const direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            
            switch (direction) {
                case 'up': moveUp(); break;
                case 'down': moveDown(); break;
                case 'left': moveLeft(); break;
                case 'right': moveRight(); break;
            }

            if (!win && grid.cells.flat().some(t => t && t.value === 2048)) {
                win = true;
                endGame(true);
            } else {
                 if (grid.emptyCells.length === 0 && !canMove()) {
                    endGame(false);
                }
            }
        }
    });

    // --- EVENT LISTENERS ---
    window.addEventListener('keydown', handleInput);
    newGameButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', () => {
        if(isGameOver || win) {
            startGame();
        } else {
            // This case should not be reachable if logic is correct
             gameMessage.style.display = 'none';
        }
    });
    
    gameMessage.querySelector('.btn-restart').addEventListener('click', () => {
        if (win && !isGameOver) {
             continueGame(); // If game was won, this button means "continue"
        } else {
             startGame(); // If game was lost, this means "restart"
        }
    });


    window.addEventListener('resize', updateTilePositions);


    // --- INITIALIZE ---
    startGame();
});
