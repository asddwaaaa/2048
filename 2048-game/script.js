
document.addEventListener('DOMContentLoaded', () => {
    const gridDisplay = document.querySelector('.grid-container');
    const scoreDisplay = document.getElementById('score');
    const bestScoreDisplay = document.getElementById('best-score');
    const messageContainer = document.getElementById('game-message');
    const messageText = messageContainer.querySelector('p');
    const newGameButton = document.getElementById('new-game-button');
    const restartButton = messageContainer.querySelector('.btn-restart');
    const width = 4;
    let squares = [];
    let score = 0;
    let bestScore = localStorage.getItem('2048-best-score') || 0;

    // --- GAME SETUP ---

    function createBoard() {
        gridDisplay.innerHTML = '';
        squares = [];
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div');
            square.className = 'grid-cell';
            const tile = document.createElement('div');
            tile.className = 'tile';
            square.appendChild(tile);
            gridDisplay.appendChild(square);
            squares.push(tile);
        }
        updateBestScore();
    }

    function startGame() {
        // Clear board values
        for (let i = 0; i < squares.length; i++) {
            squares[i].textContent = '';
            squares[i].className = 'tile';
        }
        // Reset score and state
        score = 0;
        updateScoreDisplay();
        messageContainer.style.display = 'none';

        // Add starting numbers
        generateNumber();
        generateNumber();
        
        // Add listeners
        document.addEventListener('keydown', control);
        // Touch controls
        let touchStartX = 0;
        let touchStartY = 0;
        const gameContainer = document.querySelector('.game-container');
        gameContainer.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        gameContainer.addEventListener('touchend', e => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
        });
    }

    function updateScoreDisplay() {
        scoreDisplay.textContent = score;
    }

    function updateBestScore() {
        bestScoreDisplay.textContent = bestScore;
        localStorage.setItem('2048-best-score', bestScore);
    }
    
    function updateTile(tile, value) {
        tile.textContent = value > 0 ? value : '';
        tile.className = 'tile'; // Reset classes
        if (value > 0) {
            tile.classList.add(`tile-${value}`);
        }
    }

    // --- GAME LOGIC ---

    function generateNumber() {
        const emptySquares = squares.filter(sq => sq.textContent === '');
        if (emptySquares.length > 0) {
            const randomSquare = emptySquares[Math.floor(Math.random() * emptySquares.length)];
            const newValue = Math.random() > 0.1 ? 2 : 4;
            updateTile(randomSquare, newValue);
            randomSquare.classList.add('tile-new');
        }
    }
    
    function move(direction) {
        let moved = false;
        let rows = [];
        let columns = [];

        // Create rows and columns from the flat squares array
        for(let i=0; i<width*width; i+=width){
            rows.push(squares.slice(i, i+width).map(s => parseInt(s.textContent) || 0));
        }
        for(let i=0; i<width; i++){
            let col = [];
            for(let j=0; j<width; j++){
                col.push(parseInt(squares[i + j*width].textContent) || 0);
            }
            columns.push(col);
        }

        let originalState = JSON.stringify([...rows, ...columns]);

        if (direction === 'right') {
            rows = rows.map(row => slide(row.reverse()).reverse());
            moved = true;
        }
        if (direction === 'left') {
            rows = rows.map(row => slide(row));
            moved = true;
        }
        if (direction === 'down') {
            columns = columns.map(col => slide(col.reverse()).reverse());
            moved = true;
        }
        if (direction === 'up') {
            columns = columns.map(col => slide(col));
            moved = true;
        }

        // Update squares array from modified rows/columns
        if (direction === 'left' || direction === 'right') {
            for(let i=0; i<width; i++){
                for(let j=0; j<width; j++){
                     updateTile(squares[i*width + j], rows[i][j]);
                }
            }
        } else if (direction === 'up' || direction === 'down') {
            for(let i=0; i<width; i++){
                for(let j=0; j<width; j++){
                    updateTile(squares[i + j*width], columns[i][j]);
                }
            }
        }
        
        let newState = JSON.stringify([...rows, ...columns]);
        
        if (originalState !== newState) {
            generateNumber();
            checkForGameOver();
            checkForWin();
        }
    }

    function slide(line) {
        // 1. Filter out zeros
        let filteredLine = line.filter(num => num > 0);
        // 2. Combine identical numbers
        for (let i = 0; i < filteredLine.length - 1; i++) {
            if (filteredLine[i] === filteredLine[i+1]) {
                let combinedTotal = filteredLine[i] * 2;
                filteredLine[i] = combinedTotal;
                filteredLine.splice(i + 1, 1);
                score += combinedTotal;
                updateScoreDisplay();
                if (score > bestScore) {
                    bestScore = score;
                    updateBestScore();
                }
            }
        }
        // 3. Fill with zeros
        let missing = width - filteredLine.length;
        let zeros = Array(missing).fill(0);
        return filteredLine.concat(zeros);
    }
    
    function control(e) {
        if (e.key === 'ArrowLeft') move('left');
        else if (e.key === 'ArrowUp') move('up');
        else if (e.key === 'ArrowRight') move('right');
        else if (e.key === 'ArrowDown') move('down');
    }

    function handleSwipe(startX, startY, endX, endY) {
        const dx = endX - startX;
        const dy = endY - startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) > 30) { // Swipe threshold
            const direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            move(direction);
        }
    }
    
    function checkForWin() {
        if (squares.some(sq => sq.textContent == '2048')) {
            messageText.textContent = 'Вы победили!';
            messageContainer.style.display = 'flex';
            messageContainer.classList.add('game-won');
            document.removeEventListener('keydown', control);
        }
    }

    function checkForGameOver() {
        let zeros = squares.filter(sq => sq.textContent === '').length;
        if (zeros > 0) return;

        for (let i = 0; i < squares.length; i++) {
            // Check horizontal neighbors
            if ((i % width !== width - 1) && squares[i].textContent === squares[i + 1].textContent) return;
            // Check vertical neighbors
            if ((i < width * (width - 1)) && squares[i].textContent === squares[i + width].textContent) return;
        }

        messageText.textContent = 'Игра окончена!';
        messageContainer.style.display = 'flex';
        messageContainer.classList.remove('game-won');
        document.removeEventListener('keydown', control);
    }


    // --- Event Listeners ---
    newGameButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    
    
    // --- INITIALIZE ---
    createBoard();
    startGame();
});
