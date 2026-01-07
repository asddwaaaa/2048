document.addEventListener('DOMContentLoaded', () => {
    const scoreDisplay = document.getElementById('score');
    const bestScoreDisplay = document.getElementById('best-score');
    const messageContainer = document.getElementById('game-message');
    const messageText = messageContainer.querySelector('p');
    const newGameButton = document.getElementById('new-game-button');
    const restartButton = messageContainer.querySelector('.btn-restart');
    const tileContainer = document.getElementById('tile-container');
    
    const width = 4;
    let grid = Array(width * width).fill(0);
    let score = 0;
    let bestScore = localStorage.getItem('2048-best-score') || 0;
    let isGameOver = false;

    // --- GAME SETUP ---

    function updateBestScore() {
        bestScoreDisplay.textContent = bestScore;
        localStorage.setItem('2048-best-score', bestScore);
    }
    
    function updateScoreDisplay() {
        scoreDisplay.textContent = score;
        if (score > bestScore) {
            bestScore = score;
            updateBestScore();
        }
    }

    function startGame() {
        grid = Array(width * width).fill(0);
        score = 0;
        isGameOver = false;
        updateScoreDisplay();
        messageContainer.style.display = 'none';
        
        generateNumber();
        generateNumber();
        drawBoard();
    }
    
    // --- DRAWING ---

    function drawBoard() {
        tileContainer.innerHTML = '';
        grid.forEach((value, i) => {
            if (value > 0) {
                const tile = document.createElement('div');
                const x = i % width;
                const y = Math.floor(i / width);
                
                tile.className = `tile tile-${value}`;
                tile.textContent = value;

                // Adjust font size for larger numbers
                if (value > 100 && value < 1000) tile.style.fontSize = '45px';
                if (value > 1000) tile.style.fontSize = '35px';

                // Size and position calculation
                const tileWidth = (tileContainer.clientWidth - 15 * (width + 1)) / width;
                const tileHeight = (tileContainer.clientHeight - 15 * (width + 1)) / width;
                tile.style.width = `${tileWidth}px`;
                tile.style.height = `${tileHeight}px`;
                tile.style.top = `${y * (tileHeight + 15) + 15}px`;
                tile.style.left = `${x * (tileWidth + 15) + 15}px`;
                
                tileContainer.appendChild(tile);
            }
        });
        
        checkForGameOver();
    }

    // --- GAME LOGIC ---

    function generateNumber() {
        const emptySquares = grid.map((val, i) => val === 0 ? i : -1).filter(i => i !== -1);
        if (emptySquares.length > 0) {
            const randomIndex = emptySquares[Math.floor(Math.random() * emptySquares.length)];
            grid[randomIndex] = Math.random() > 0.1 ? 2 : 4;
        }
    }
    
    function move(direction) {
        if(isGameOver) return;
        
        let originalGrid = [...grid];
        let moved = false;

        function slide(line) {
            let filteredLine = line.filter(num => num > 0);
            for (let i = 0; i < filteredLine.length - 1; i++) {
                if (filteredLine[i] === filteredLine[i+1]) {
                    let combinedTotal = filteredLine[i] * 2;
                    filteredLine[i] = combinedTotal;
                    filteredLine.splice(i + 1, 1);
                    score += combinedTotal;
                    updateScoreDisplay();
                }
            }
            let zeros = Array(width - filteredLine.length).fill(0);
            return filteredLine.concat(zeros);
        }

        if (direction === 'left' || direction === 'right') {
            for (let i = 0; i < width; i++) {
                let row = grid.slice(i * width, i * width + width);
                if (direction === 'right') row.reverse();
                let newRow = slide(row);
                if (direction === 'right') newRow.reverse();
                for (let j = 0; j < width; j++) {
                    grid[i * width + j] = newRow[j];
                }
            }
        } else if (direction === 'up' || direction === 'down') {
            for (let i = 0; i < width; i++) {
                let column = [];
                for(let j=0; j<width; j++) {
                    column.push(grid[i + j * width]);
                }
                if (direction === 'down') column.reverse();
                let newColumn = slide(column);
                if (direction === 'down') newColumn.reverse();
                for(let j=0; j<width; j++) {
                    grid[i + j * width] = newColumn[j];
                }
            }
        }
        
        moved = JSON.stringify(originalGrid) !== JSON.stringify(grid);

        if (moved) {
            generateNumber();
            drawBoard();
        }
    }
    
    // --- CONTROLS ---

    function control(e) {
        if (e.key === 'ArrowLeft') move('left');
        else if (e.key === 'ArrowUp') move('up');
        else if (e.key === 'ArrowRight') move('right');
        else if (e.key === 'ArrowDown') move('down');
    }
    document.addEventListener('keydown', control);

    let touchStartX = 0;
    let touchStartY = 0;
    document.querySelector('.game-container').addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.querySelector('.game-container').addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - startX;
        const dy = touchEndY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) > 30) { // Swipe threshold
            const direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            move(direction);
        }
    });

    // --- GAME STATE ---

    function checkForWin() {
        if (grid.includes(2048)) {
            messageText.textContent = 'Вы победили!';
            messageContainer.style.display = 'flex';
            messageContainer.classList.add('game-won');
            isGameOver = true;
        }
    }

    function checkForGameOver() {
        checkForWin();
        let zeros = grid.filter(val => val === 0).length;
        if (zeros > 0) return;

        for (let i = 0; i < grid.length; i++) {
            // Check horizontal neighbors
            if ((i % width !== width - 1) && grid[i] === grid[i + 1]) return;
            // Check vertical neighbors
            if ((i < width * (width - 1)) && grid[i] === grid[i + width]) return;
        }

        messageText.textContent = 'Игра окончена!';
        messageContainer.style.display = 'flex';
        messageContainer.classList.remove('game-won');
        isGameOver = true;
    }


    // --- Event Listeners ---
    newGameButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    window.addEventListener('resize', drawBoard); // Redraw on resize
    
    // --- INITIALIZE ---
    updateBestScore();
    startGame();
});
