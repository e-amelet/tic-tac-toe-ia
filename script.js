// Game state
let gameBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // Using indices 0-8
let boardX = 0;
let boardO = 0;
let currentPlayer = 'X'; // Human starts
let gameOver = false;
let qTable = {};

// Score tracking
let scores = {
    playerWins: 0,
    iaWins: 0,
    draws: 0
};

// Win masks for tic-tac-toe
const WIN_MASKS = [7, 56, 448, 73, 146, 292, 273, 84];

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    loadScores();
    loadQTable();
    setupEventListeners();
});

function setupEventListeners() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('resetScoreBtn').addEventListener('click', resetScore);
}

function handleCellClick(e) {
    if (gameOver || currentPlayer !== 'X') return;

    const cell = e.target;
    const index = parseInt(cell.dataset.index);

    if (gameBoard[index] !== 0) return; // Cell already occupied

    // Player move
    makeMove(index, 'X');
    updateDisplay();

    if (checkGameEnd()) return;

    // AI move
    currentPlayer = 'O';
    updatePlayerTurn();
    document.getElementById('iaThinking').style.display = 'block';

    setTimeout(() => {
        const aiMove = getAIMove();
        if (aiMove !== -1) {
            makeMove(aiMove, 'O');
        }
        updateDisplay();
        document.getElementById('iaThinking').style.display = 'none';
        checkGameEnd();
    }, 500);
}

function makeMove(index, player) {
    gameBoard[index] = player === 'X' ? 1 : 2;
    const moveMask = 1 << index;

    if (player === 'X') {
        boardX |= moveMask;
    } else {
        boardO |= moveMask;
    }

    currentPlayer = player === 'X' ? 'O' : 'X';
}

function getAIMove() {
    const legalMoves = getLegalMoves();
    if (legalMoves.length === 0) return -1;

    const state = getState(boardO, boardX);
    const stateStr = state.toString();

    if (stateStr in qTable) {
        const qValues = qTable[stateStr];
        let bestMove = legalMoves[0];
        let bestValue = qValues[bestMove] || 0;

        for (let move of legalMoves) {
            if ((qValues[move] || 0) > bestValue) {
                bestValue = qValues[move];
                bestMove = move;
            }
        }
        return bestMove;
    }

    // Random move if state not in Q-table
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}

function getLegalMoves() {
    const occupied = boardX | boardO;
    const moves = [];
    for (let i = 0; i < 9; i++) {
        if (!((occupied >> i) & 1)) {
            moves.push(i);
        }
    }
    return moves;
}

function getState(boardActive, boardWaiting) {
    return (boardActive << 9) | boardWaiting;
}

function checkWin(playerBoard) {
    for (let mask of WIN_MASKS) {
        if ((playerBoard & mask) === mask) {
            return true;
        }
    }
    return false;
}

function isBoardFull() {
    return (boardX | boardO) === 511; // 511 = 111111111 in binary (all 9 cells)
}

function checkGameEnd() {
    if (checkWin(boardX)) {
        endGame('You won! 👑');
        scores.playerWins++;
        return true;
    } else if (checkWin(boardO)) {
        endGame('IA won! 🤖🏆');
        scores.iaWins++;
        return true;
    } else if (isBoardFull()) {
        endGame('Draw! ⏱️');
        scores.draws++;
        return true;
    }
    return false;
}

function endGame(message) {
    gameOver = true;
    document.getElementById('gameStatus').textContent = message;
    document.getElementById('gameStatus').classList.add(
        message.includes('won') ? 'winner' : 'draw'
    );
    updateScoreDisplay();
    saveScores();
}

function updateDisplay() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const index = parseInt(cell.dataset.index);
        if (gameBoard[index] === 1) {
            cell.textContent = 'X';
            cell.classList.add('x');
            cell.classList.remove('o');
        } else if (gameBoard[index] === 2) {
            cell.textContent = 'O';
            cell.classList.add('o');
            cell.classList.remove('x');
        } else {
            cell.textContent = '';
            cell.classList.remove('x', 'o');
        }
    });
    updatePlayerTurn();
}

function updatePlayerTurn() {
    if (!gameOver) {
        document.getElementById('playerTurn').textContent =
            currentPlayer === 'X' ? 'Your Turn (X)' : 'IA is Playing (O)...';
    }
}

function updateScoreDisplay() {
    document.getElementById('playerWins').textContent = scores.playerWins;
    document.getElementById('iaWins').textContent = scores.iaWins;
    document.getElementById('draws').textContent = scores.draws;
}

function resetGame() {
    gameBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    boardX = 0;
    boardO = 0;
    currentPlayer = 'X';
    gameOver = false;
    document.getElementById('gameStatus').textContent = '';
    document.getElementById('gameStatus').classList.remove('winner', 'draw');
    document.getElementById('iaThinking').style.display = 'none';
    updateDisplay();
}

function resetScore() {
    scores = { playerWins: 0, iaWins: 0, draws: 0 };
    updateScoreDisplay();
    saveScores();
    resetGame();
}

function loadQTable() {
    // Try to load from localStorage first
    const stored = localStorage.getItem('qTable');
    if (stored) {
        qTable = JSON.parse(stored);
        return;
    }

    // Fallback: simple Q-table for demonstration
    // In production, this would be loaded from your trained model
    qTable = {};
    localStorage.setItem('qTable', JSON.stringify(qTable));
}

function saveQTable() {
    localStorage.setItem('qTable', JSON.stringify(qTable));
}

function loadScores() {
    const stored = localStorage.getItem('tictactoe_scores');
    if (stored) {
        scores = JSON.parse(stored);
        updateScoreDisplay();
    }
}

function saveScores() {
    localStorage.setItem('tictactoe_scores', JSON.stringify(scores));
}
