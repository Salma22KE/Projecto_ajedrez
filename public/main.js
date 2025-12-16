const socket = io();

let playerColor = null;
let selectedSquare = null;
let gameState = null;

// Comprobación de si el rey esta vivo
// Comprueba si hay algún rey vivo
function checkKingsStatus(board) {
    let whiteKingAlive = false;
    let blackKingAlive = false;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            if (piece.type === "king") {
                if (piece.color === "white") whiteKingAlive = true;
                if (piece.color === "black") blackKingAlive = true;
            }
        }
    }

    return {
        white: whiteKingAlive,
        black: blackKingAlive
    };
}



// Símbolos Unicode para las piezas
const pieceSymbols = {
    white: {
        king: '♔',
        queen: '♕',
        rook: '♖',
        bishop: '♗',
        knight: '♘',
        pawn: '♙'
    },
    black: {
        king: '♚',
        queen: '♛',
        rook: '♜',
        bishop: '♝',
        knight: '♞',
        pawn: '♟'
    }
};

// Recibir color del jugador
socket.on('player-color', (color) => {
    playerColor = color;
    const colorText = color === 'white' ? 'Blancas ' : 
                      color === 'black' ? 'Negras ' : 
                      'Espectador ';
    document.getElementById('player-color').textContent = colorText;
    console.log('Tu color es:', colorText);
});

// Recibir estado del juego
socket.on('game-state', (state) => {
    console.log('Estado del juego recibido:', state);
    gameState = state;
    renderBoard(state.board);
    updateTurnDisplay(state.currentTurn);
    updateCapturedPieces(state.capturedPieces);
});

// Recibir mensajes de chat
socket.on('chat-message', (data) => {
    addChatMessage(data.player, data.message);
});

// Movimiento inválido
socket.on('invalid-move', (message) => {
    console.log('Movimiento inválido:', message);
    alert(message);
    selectedSquare = null;
    if (gameState) {
        renderBoard(gameState.board);
    }
});

// Renderizar tablero
function renderBoard(board) {
    const boardElement = document.getElementById('board');
    if (!boardElement) {
        console.error('No se encuentra el elemento board');
        return;
    }
    
    boardElement.innerHTML = '';
    
    // Calcular movimientos válidos si hay una pieza seleccionada
    let validMoves = [];
    if (selectedSquare && gameState) {
        validMoves = getValidMovesForPiece(selectedSquare, board);
    }
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = 'square';
            
            // Alternar colores del tablero
            if ((row + col) % 2 === 0) {
                square.classList.add('light');
            } else {
                square.classList.add('dark');
            }
            
            square.dataset.row = row;
            square.dataset.col = col;
            
            // Agregar pieza si existe
            const piece = board[row][col];
            if (piece && pieceSymbols[piece.color] && pieceSymbols[piece.color][piece.type]) {
                const symbol = pieceSymbols[piece.color][piece.type];
                const pieceColor = piece.color === 'white' ? '#ffffff' : '#000000';
                const textShadow = piece.color === 'white' 
                    ? '0 0 3px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)' 
                    : '0 0 3px rgba(255, 255, 255, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)';
                square.innerHTML = `<span style="font-size: 50px; line-height: 1; color: ${pieceColor}; text-shadow: ${textShadow};">${symbol}</span>`;
            } else {
                square.innerHTML = '';
            }
            
            // Marcar casilla seleccionada
            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                square.classList.add('selected');
            }
            
            // Marcar movimientos válidos
            const isValidMove = validMoves.some(move => move.row === row && move.col === col);
            if (isValidMove) {
                square.classList.add('valid-move');
                
                // Agregar indicador visual
                const indicator = document.createElement('div');
                indicator.className = 'move-indicator';
                
                // Si hay una pieza enemiga, mostrar indicador de captura
                if (piece) {
                    indicator.classList.add('capture-indicator');
                }
                
                square.appendChild(indicator);
            }
            
            // Agregar evento de clic
            square.addEventListener('click', () => handleSquareClick(row, col));
            
            boardElement.appendChild(square);
        }
    }
    
    console.log('Tablero renderizado');

    // Al final de renderBoard
    if (gameState) {
    const kings = checkKingsStatus(board);

    if (!kings.white) {
        alert("¡El rey blanco ha sido capturado! Fin de la partida.");
        bloquearTablero();
    } else if (!kings.black) {
        alert("¡El rey negro ha sido capturado! Fin de la partida.");
        bloquearTablero();
    }
}

// Función para bloquear el tablero
    function bloquearTablero() {
    const boardElement = document.getElementById('board');
    boardElement.querySelectorAll('.square').forEach(sq => {
        sq.replaceWith(sq.cloneNode(true)); // elimina todos los event listeners
    });
}


}

// Obtener movimientos válidos para una pieza
function getValidMovesForPiece(from, board) {
    const validMoves = [];
    const piece = board[from.row][from.col];
    
    if (!piece || piece.color !== playerColor) {
        return validMoves;
    }
    
    // Probar todos los movimientos posibles
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (isValidMoveClient(from, { row, col }, board, piece)) {
                validMoves.push({ row, col });
            }
        }
    }
    
    return validMoves;
}

// Validación de movimiento en el cliente (simplificada)
function isValidMoveClient(from, to, board, piece) {
    // No puede moverse a la misma casilla
    if (from.row === to.row && from.col === to.col) {
        return false;
    }
    
    const target = board[to.row][to.col];
    
    // No puede capturar pieza del mismo color
    if (target && target.color === piece.color) {
        return false;
    }
    
    const rowDiff = to.row - from.row;
    const colDiff = to.col - from.col;
    
    switch (piece.type) {
        case 'pawn':
            return isValidPawnMoveClient(from, to, piece, board, rowDiff, colDiff);
        case 'rook':
            return isValidRookMoveClient(from, to, board, rowDiff, colDiff);
        case 'knight':
            return isValidKnightMoveClient(rowDiff, colDiff);
        case 'bishop':
            return isValidBishopMoveClient(from, to, board, rowDiff, colDiff);
        case 'queen':
            return isValidQueenMoveClient(from, to, board, rowDiff, colDiff);
        case 'king':
            return isValidKingMoveClient(rowDiff, colDiff);
        default:
            return false;
    }
}

function isValidPawnMoveClient(from, to, piece, board, rowDiff, colDiff) {
    const direction = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;
    const target = board[to.row][to.col];
    
    if (colDiff === 0 && !target) {
        if (rowDiff === direction) return true;
        if (from.row === startRow && rowDiff === 2 * direction && !board[from.row + direction][from.col]) {
            return true;
        }
    }
    
    if (Math.abs(colDiff) === 1 && rowDiff === direction && target) {
        return true;
    }
    
    return false;
}

function isValidRookMoveClient(from, to, board, rowDiff, colDiff) {
    if (rowDiff !== 0 && colDiff !== 0) return false;
    return isPathClearClient(from, to, board);
}

function isValidKnightMoveClient(rowDiff, colDiff) {
    return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
           (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
}

function isValidBishopMoveClient(from, to, board, rowDiff, colDiff) {
    if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
    return isPathClearClient(from, to, board);
}

function isValidQueenMoveClient(from, to, board, rowDiff, colDiff) {
    return isValidRookMoveClient(from, to, board, rowDiff, colDiff) ||
           isValidBishopMoveClient(from, to, board, rowDiff, colDiff);
}

function isValidKingMoveClient(rowDiff, colDiff) {
    return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
}

function isPathClearClient(from, to, board) {
    const rowStep = Math.sign(to.row - from.row);
    const colStep = Math.sign(to.col - from.col);
    let row = from.row + rowStep;
    let col = from.col + colStep;
    
    while (row !== to.row || col !== to.col) {
        if (board[row][col]) return false;
        row += rowStep;
        col += colStep;
    }
    
    return true;
}

// Manejar clic en casilla
function handleSquareClick(row, col) {
    console.log('Clic en casilla:', row, col);
    
    if (!gameState) {
        console.log('No hay estado del juego');
        return;
    }
    
    // Si es espectador, no puede jugar
    if (playerColor === 'spectator') {
        alert('Eres espectador, no puedes mover piezas');
        return;
    }
    
    // Si no es tu turno
    if (playerColor !== gameState.currentTurn) {
        alert('No es tu turno. Turno actual: ' + (gameState.currentTurn === 'white' ? 'Blancas' : 'Negras'));
        return;
    }
    
    const piece = gameState.board[row][col];
    
    // Si no hay pieza seleccionada
    if (!selectedSquare) {
        if (piece && piece.color === playerColor) {
            selectedSquare = { row, col };
            console.log('Pieza seleccionada:', piece);
            renderBoard(gameState.board);
        } else if (piece) {
            alert('Esa pieza no es tuya');
        } else {
            alert('No hay pieza en esa casilla');
        }
    } else {
        // Si hay pieza seleccionada, intentar mover
        if (selectedSquare.row === row && selectedSquare.col === col) {
            // Deseleccionar si se hace clic en la misma casilla
            console.log('Pieza deseleccionada');
            selectedSquare = null;
            renderBoard(gameState.board);
        } else {
            // Enviar movimiento al servidor
            console.log('Enviando movimiento:', selectedSquare, '->', {row, col});
            socket.emit('move', {
                from: selectedSquare,
                to: { row, col }
            });
            selectedSquare = null;
        }
    }
}

// Actualizar indicador de turno
function updateTurnDisplay(currentTurn) {
    const turnElement = document.getElementById('current-turn');
    if (turnElement) {
        turnElement.textContent = currentTurn === 'white' ? 'Blancas ' : 'Negras ';
        turnElement.style.color = currentTurn === 'white' ? '#333' : '#333';
    }
}

// Actualizar piezas capturadas
function updateCapturedPieces(capturedPieces) {
    // Actualizar piezas capturadas por blancas
    const whiteCapturedElement = document.getElementById('white-captured');
    const whiteScoreElement = document.getElementById('white-score');
    if (whiteCapturedElement && whiteScoreElement) {
        whiteCapturedElement.innerHTML = '';
        whiteScoreElement.textContent = capturedPieces.white.length;
        
        capturedPieces.white.forEach(piece => {
            const pieceSpan = document.createElement('span');
            pieceSpan.className = 'captured-piece';
            pieceSpan.textContent = pieceSymbols[piece.color][piece.type];
            pieceSpan.style.color = piece.color === 'white' ? '#ffffff' : '#000000';
            pieceSpan.style.textShadow = piece.color === 'white' 
                ? '0 0 3px rgba(0, 0, 0, 0.8)' 
                : '0 0 3px rgba(255, 255, 255, 0.6)';
            whiteCapturedElement.appendChild(pieceSpan);
        });
    }
    
    // Actualizar piezas capturadas por negras
    const blackCapturedElement = document.getElementById('black-captured');
    const blackScoreElement = document.getElementById('black-score');
    if (blackCapturedElement && blackScoreElement) {
        blackCapturedElement.innerHTML = '';
        blackScoreElement.textContent = capturedPieces.black.length;
        
        capturedPieces.black.forEach(piece => {
            const pieceSpan = document.createElement('span');
            pieceSpan.className = 'captured-piece';
            pieceSpan.textContent = pieceSymbols[piece.color][piece.type];
            pieceSpan.style.color = piece.color === 'white' ? '#ffffff' : '#000000';
            pieceSpan.style.textShadow = piece.color === 'white' 
                ? '0 0 3px rgba(0, 0, 0, 0.8)' 
                : '0 0 3px rgba(255, 255, 255, 0.6)';
            blackCapturedElement.appendChild(pieceSpan);
        });
    }
}

// Agregar mensaje al chat
function addChatMessage(player, message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const playerSpan = document.createElement('div');
    playerSpan.className = 'player';
    playerSpan.textContent = player + ':';
    
    const textSpan = document.createElement('div');
    textSpan.className = 'text';
    textSpan.textContent = message;
    
    messageDiv.appendChild(playerSpan);
    messageDiv.appendChild(textSpan);
    chatMessages.appendChild(messageDiv);
    
    // Scroll automático
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Enviar mensaje de chat
const sendBtn = document.getElementById('send-btn');
const chatInput = document.getElementById('chat-input');

if (sendBtn) {
    sendBtn.addEventListener('click', sendChatMessage);
}

if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (message) {
        socket.emit('chat-message', message);
        input.value = '';
    }
}

// Reiniciar juego
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres reiniciar el juego?')) {
            socket.emit('reset-game');
            selectedSquare = null;
        }
    });
}

// Verificar conexión
socket.on('connect', () => {
    console.log('Conectado al servidor');
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
});

console.log('Script cargado correctamente');