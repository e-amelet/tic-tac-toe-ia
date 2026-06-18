// ============================================
// TIC-TAC-TOE IA - Port JavaScript du Notebook Python
// ============================================

// ============================================
// 1. ENVIRONMENT (Port de MorpionEnv)
// ============================================
class MorpionEnv {
    constructor() {
        this.WIN_MASKS = [7, 56, 448, 73, 146, 292, 273, 84];
        this.reset();
    }

    reset() {
        this.board_X = 0;
        this.board_O = 0;
        return [this.board_X, this.board_O];
    }

    getLegalMoves() {
        const occupation = this.board_X | this.board_O;
        const vides_bits = (~occupation) & 511;
        const legal_moves = [];
        for (let i = 0; i < 9; i++) {
            if ((vides_bits >> i) & 1) {
                legal_moves.push(i);
            }
        }
        return legal_moves;
    }

    step(action, player) {
        const move_mask = 1 << action;
        if (player === 'X') {
            this.board_X |= move_mask;
        } else {
            this.board_O |= move_mask;
        }
    }

    checkWin(player_board) {
        for (let mask of this.WIN_MASKS) {
            if ((player_board & mask) === mask) {
                return true;
            }
        }
        return false;
    }

    isDraw() {
        return (this.board_X | this.board_O) === 511;
    }
}

// ============================================
// 2. Q-AGENT (Port de QAgent)
// ============================================
class QAgent {
    constructor(alpha = 0.2, gamma = 0.95, epsilon = 1.0, epsilon_decay = 0.99998, min_epsilon = 0.01) {
        this.q_table = {};
        this.alpha = alpha;
        this.gamma = gamma;
        this.epsilon = epsilon;
        this.epsilon_decay = epsilon_decay;
        this.min_epsilon = min_epsilon;
    }

    getState(board_active, board_waiting) {
        return (board_active << 9) | board_waiting;
    }

    getQValues(state) {
        if (!(state in this.q_table)) {
            this.q_table[state] = new Array(9).fill(0.0);
        }
        return this.q_table[state];
    }

    chooseAction(state, legal_moves) {
        if (Math.random() < this.epsilon) {
            return legal_moves[Math.floor(Math.random() * legal_moves.length)];
        }

        const q_values = this.getQValues(state);
        let best_action = legal_moves[0];
        let max_q = q_values[best_action];

        for (let action of legal_moves) {
            if (q_values[action] > max_q) {
                max_q = q_values[action];
                best_action = action;
            }
        }
        return best_action;
    }

    updateQValue(state, action, reward, next_state, next_legal_moves) {
        const current_q = this.getQValues(state)[action];
        let max_future_q = 0.0;

        if (next_state !== null && next_legal_moves.length > 0) {
            const future_q_values = this.getQValues(next_state);
            max_future_q = Math.max(...next_legal_moves.map(m => future_q_values[m]));
        }

        const new_q = current_q + this.alpha * (reward + this.gamma * max_future_q - current_q);
        this.q_table[state][action] = Math.round(new_q * 10000) / 10000;
    }

    decayEpsilon() {
        if (this.epsilon > this.min_epsilon) {
            this.epsilon *= this.epsilon_decay;
        }
    }

    loadFromJSON(qtable_data) {
        // Convertir les clés string en nombres si nécessaire
        this.q_table = {};
        for (let key in qtable_data) {
            this.q_table[key] = qtable_data[key];
        }
    }
}

// ============================================
// 3. GAME INTERFACE
// ============================================
let env = new MorpionEnv();
let agent = new QAgent();
let gameBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0];
let gameOver = false;
let currentPlayer = 'X';

let scores = {
    playerWins: 0,
    iaWins: 0,
    draws: 0
};

// ============================================
// 4. INIT & LOAD Q-TABLE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadScores();
    loadQTable();
    setupEventListeners();
    console.log(`✅ Q-table chargé : ${Object.keys(agent.q_table).length} états connus`);
});

function loadQTable() {
    // Charger depuis localStorage d'abord
    const stored = localStorage.getItem('qTable');
    if (stored) {
        agent.loadFromJSON(JSON.parse(stored));
        return;
    }

    // Sinon, charger depuis le fichier JSON
    fetch('qtable_morpion.json')
        .then(response => response.json())
        .then(data => {
            agent.loadFromJSON(data);
            localStorage.setItem('qTable', JSON.stringify(data));
            console.log(`✅ Q-table chargé depuis qtable_morpion.json : ${Object.keys(agent.q_table).length} états`);
            updateStateCount();
        })
        .catch(error => {
            console.warn('⚠️ Q-table non disponible, mode aléatoire', error);
            agent.q_table = {};
        });
}

function updateStateCount() {
    const stateCount = Object.keys(agent.q_table).length;
    const stateDisplay = document.getElementById('stateCount');
    if (stateDisplay) {
        stateDisplay.textContent = `États connus: ${stateCount}`;
    }
}

function setupEventListeners() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('resetScoreBtn').addEventListener('click', resetScore);
}

// ============================================
// 5. GAME LOGIC
// ============================================
function handleCellClick(e) {
    if (gameOver || currentPlayer !== 'X') return;

    const cell = e.target;
    const index = parseInt(cell.dataset.index);

    if (gameBoard[index] !== 0) return;

    // Coup du joueur
    makeMove(index, 'X');
    updateDisplay();

    if (checkGameEnd()) return;

    // Coup de l'IA
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
        env.board_X |= moveMask;
    } else {
        env.board_O |= moveMask;
    }

    currentPlayer = player === 'X' ? 'O' : 'X';
}

function getAIMove() {
    const legal_moves = env.getLegalMoves();
    if (legal_moves.length === 0) return -1;

    // État depuis la perspective de l'IA (O)
    const state = agent.getState(env.board_O, env.board_X);
    const state_str = state.toString();

    if (state_str in agent.q_table) {
        const q_values = agent.q_table[state_str];
        let best_move = legal_moves[0];
        let best_value = q_values[best_move] || 0;

        for (let move of legal_moves) {
            if ((q_values[move] || 0) > best_value) {
                best_value = q_values[move];
                best_move = move;
            }
        }
        return best_move;
    }

    // Si l'état n'existe pas : coup aléatoire
    return legal_moves[Math.floor(Math.random() * legal_moves.length)];
}

function checkGameEnd() {
    if (env.checkWin(env.board_X)) {
        endGame('Tu as battu l\'IA ! Incroyable. 👑');
        scores.playerWins++;
        return true;
    } else if (env.checkWin(env.board_O)) {
        endGame('L\'IA a gagné ! Elle a profité de ton erreur. 🤖🏆');
        scores.iaWins++;
        return true;
    } else if (env.isDraw()) {
        endGame('Match nul. L\'IA a bloqué tes attaques ! ⏱️');
        scores.draws++;
        return true;
    }
    return false;
}

function endGame(message) {
    gameOver = true;
    document.getElementById('gameStatus').textContent = message;
    document.getElementById('gameStatus').classList.add(
        message.includes('gagné') || message.includes('Incroyable') ? 'winner' : 'draw'
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
            currentPlayer === 'X' ? 'À ton tour (X)' : 'L\'IA joue (O)...';
    }
}

function updateScoreDisplay() {
    document.getElementById('playerWins').textContent = scores.playerWins;
    document.getElementById('iaWins').textContent = scores.iaWins;
    document.getElementById('draws').textContent = scores.draws;
}

function resetGame() {
    gameBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    env.reset();
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
