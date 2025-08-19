const boardSize = 4;
let board = [];
let score = 0;
let bestScore = 0;
let moves = 0;
let timer = 0;
let timerInterval;
let gameMode = "classic"; // classic | timed | chaos

// DOM элементы
const boardContainer = document.getElementById("game-board");
const scoreElem = document.getElementById("score");
const bestScoreElem = document.getElementById("best-score");
const movesElem = document.getElementById("moves");
const timeElem = document.getElementById("time");
const gameOverModal = document.getElementById("game-over");
const winModal = document.getElementById("win-message");

// кнопки
document.getElementById("new-game-btn").addEventListener("click", () => startGame("classic"));
document.getElementById("timed-mode-btn").addEventListener("click", () => startGame("timed"));
document.getElementById("chaos-mode-btn").addEventListener("click", () => startGame("chaos"));
document.getElementById("restart-btn").addEventListener("click", () => startGame(gameMode));
document.getElementById("new-game-win-btn").addEventListener("click", () => startGame("classic"));
document.getElementById("continue-btn").addEventListener("click", () => {
    winModal.style.display = "none";
});

// запуск игры
function startGame(mode = "classic") {
    gameMode = mode;
    score = 0;
    moves = 0;
    timer = 0;
    clearInterval(timerInterval);

    if (gameMode === "timed") {
        timer = 120; // 2 минуты
        timerInterval = setInterval(() => {
            timer--;
            updateTime();
            if (timer <= 0) {
                clearInterval(timerInterval);
                endGame();
            }
        }, 1000);
    }

    board = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    addRandomTile();
    addRandomTile();
    updateUI();
    hideModals();
}

function hideModals() {
    gameOverModal.style.display = "none";
    winModal.style.display = "none";
}

function updateUI() {
    boardContainer.innerHTML = "";
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const value = board[r][c];
            const tile = document.createElement("div");
            tile.classList.add("tile");
            if (value) {
                tile.textContent = value;
                tile.classList.add(`tile-${value}`);
            }
            boardContainer.appendChild(tile);
        }
    }

    scoreElem.textContent = score;
    bestScore = Math.max(bestScore, score);
    bestScoreElem.textContent = bestScore;
    movesElem.textContent = moves;
    updateTime();
}

function updateTime() {
    if (gameMode === "timed") {
        let min = Math.floor(timer / 60);
        let sec = timer % 60;
        timeElem.textContent = `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    } else {
        let min = Math.floor(timer / 60);
        let sec = timer % 60;
        timeElem.textContent = `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    }
}

function addRandomTile() {
    let emptyCells = [];
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === 0) emptyCells.push({ r, c });
        }
    }

    if (emptyCells.length === 0) return;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];

    if (gameMode === "chaos" && moves > 0 && moves % 10 === 0) {
        const specials = [8, 16, 32];
        board[r][c] = specials[Math.floor(Math.random() * specials.length)];
    } else {
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
}

function slide(row) {
    row = row.filter(v => v);
    for (let i = 0; i < row.length - 1; i++) {
        if (row[i] === row[i + 1]) {
            row[i] *= 2;
            score += row[i];
            row[i + 1] = 0;

            if (row[i] === 2048) {
                winModal.style.display = "flex";
                document.getElementById("win-score").textContent = score;
            }
        }
    }
    row = row.filter(v => v);
    while (row.length < boardSize) {
        row.push(0);
    }
    return row;
}

function moveLeft() {
    let moved = false;
    for (let r = 0; r < boardSize; r++) {
        let newRow = slide(board[r]);
        if (JSON.stringify(newRow) !== JSON.stringify(board[r])) moved = true;
        board[r] = newRow;
    }
    return moved;
}

function moveRight() {
    let moved = false;
    for (let r = 0; r < boardSize; r++) {
        let row = board[r].slice().reverse();
        row = slide(row);
        row.reverse();
        if (JSON.stringify(row) !== JSON.stringify(board[r])) moved = true;
        board[r] = row;
    }
    return moved;
}

function moveUp() {
    let moved = false;
    for (let c = 0; c < boardSize; c++) {
        let col = [];
        for (let r = 0; r < boardSize; r++) col.push(board[r][c]);
        col = slide(col);
        for (let r = 0; r < boardSize; r++) {
            if (board[r][c] !== col[r]) moved = true;
            board[r][c] = col[r];
        }
    }
    return moved;
}

function moveDown() {
    let moved = false;
    for (let c = 0; c < boardSize; c++) {
        let col = [];
        for (let r = 0; r < boardSize; r++) col.push(board[r][c]);
        col.reverse();
        col = slide(col);
        col.reverse();
        for (let r = 0; r < boardSize; r++) {
            if (board[r][c] !== col[r]) moved = true;
            board[r][c] = col[r];
        }
    }
    return moved;
}

function handleMove(direction) {
    let moved = false;
    if (direction === "left") moved = moveLeft();
    if (direction === "right") moved = moveRight();
    if (direction === "up") moved = moveUp();
    if (direction === "down") moved = moveDown();

    if (moved) {
        moves++;
        addRandomTile();
        updateUI();

        if (isGameOver()) {
            endGame();
        }
    }
}

function isGameOver() {
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (board[r][c] === 0) return false;
            if (c < boardSize - 1 && board[r][c] === board[r][c + 1]) return false;
            if (r < boardSize - 1 && board[r][c] === board[r + 1][c]) return false;
        }
    }
    return true;
}

function endGame() {
    gameOverModal.style.display = "flex";
    document.getElementById("final-score").textContent = score;
    document.getElementById("final-best-score").textContent = bestScore;
    clearInterval(timerInterval);
}

// управление
window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "a", "A"].includes(e.key)) handleMove("left");
    if (["ArrowRight", "d", "D"].includes(e.key)) handleMove("right");
    if (["ArrowUp", "w", "W"].includes(e.key)) handleMove("up");
    if (["ArrowDown", "s", "S"].includes(e.key)) handleMove("down");
});

// запуск при загрузке
startGame("classic");
