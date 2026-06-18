from flask import Flask, jsonify, request
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

# ============================================
# Classes Python (identiques au notebook)
# ============================================
class MorpionEnv:
    def __init__(self):
        self.WIN_MASKS = [7, 56, 448, 73, 146, 292, 273, 84]
        self.reset()

    def reset(self):
        self.board_X = 0
        self.board_O = 0
        return self.board_X, self.board_O

    def get_legal_moves(self):
        occupation = self.board_X | self.board_O
        vides_bits = (~occupation) & 511
        legal_moves = []
        for i in range(9):
            if (vides_bits >> i) & 1:
                legal_moves.append(i)
        return legal_moves

    def step(self, action, player):
        move_mask = 1 << action
        if player == 'X':
            self.board_X |= move_mask
        else:
            self.board_O |= move_mask

    def check_win(self, player_board):
        for mask in self.WIN_MASKS:
            if (player_board & mask) == mask:
                return True
        return False

    def is_draw(self):
        return (self.board_X | self.board_O) == 511


class QAgent:
    def __init__(self, alpha=0.2, gamma=0.95, epsilon=1.0):
        self.q_table = {}
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon

    def get_state(self, board_active, board_waiting):
        return (board_active << 9) | board_waiting

    def get_q_values(self, state):
        if state not in self.q_table:
            self.q_table[state] = [0.0] * 9
        return self.q_table[state]

    def load_from_json(self, filename="qtable_morpion.json"):
        try:
            with open(filename, 'r') as f:
                data = json.load(f)
                self.q_table = {int(k): v for k, v in data.items()}
            print(f"✅ Q-table chargé : {len(self.q_table)} états")
        except Exception as e:
            print(f"⚠️ Erreur chargement Q-table : {e}")
            self.q_table = {}


# ============================================
# Initialisation globale
# ============================================
agent = QAgent()
agent.load_from_json("qtable_morpion.json")
env = MorpionEnv()


# ============================================
# Routes API
# ============================================
@app.route('/api/ai-move', methods=['POST'])
def get_ai_move():
    """
    Récupère le meilleur coup de l'IA basé sur la Q-table
    
    Body: {
        "board_X": int (bitmap joueur X),
        "board_O": int (bitmap joueur O)
    }
    
    Response: {
        "move": int (0-8),
        "confidence": float (Q-value)
    }
    """
    try:
        data = request.json
        board_X = data.get('board_X', 0)
        board_O = data.get('board_O', 0)
        
        # Réinitialiser env avec les états actuels
        env.board_X = board_X
        env.board_O = board_O
        
        legal_moves = env.get_legal_moves()
        if not legal_moves:
            return jsonify({"error": "No legal moves"}), 400
        
        # État depuis perspective de l'IA (O)
        state = agent.get_state(board_O, board_X)
        
        # Chercher le meilleur coup
        if state in agent.q_table:
            q_values = agent.q_table[state]
            best_move = max(legal_moves, key=lambda m: q_values[m] if m < len(q_values) else 0)
            confidence = q_values[best_move] if best_move < len(q_values) else 0
        else:
            # État non entraîné : coup aléatoire
            import random
            best_move = random.choice(legal_moves)
            confidence = 0.0
        
        return jsonify({
            "move": best_move,
            "confidence": float(confidence),
            "state": state,
            "is_trained": state in agent.q_table
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/check-state', methods=['POST'])
def check_state():
    """Vérifie si un état est dans la Q-table"""
    try:
        data = request.json
        board_X = data.get('board_X', 0)
        board_O = data.get('board_O', 0)
        
        state = agent.get_state(board_O, board_X)
        
        return jsonify({
            "is_known": state in agent.q_table,
            "state_count": len(agent.q_table)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Récupère les stats du modèle"""
    return jsonify({
        "states_known": len(agent.q_table),
        "model_size_mb": sum(len(v) * 8 for v in agent.q_table.values()) / (1024 * 1024)
    })


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({"status": "ok", "model_loaded": len(agent.q_table) > 0})


if __name__ == '__main__':
    print("🚀 Démarrage du serveur Flask avec IA optimisée en Python...")
    app.run(debug=True, port=5000)
