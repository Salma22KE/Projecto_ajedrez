const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '../public')));

// Estado del juego
let gameState = {
  board: initializeBoard(),
  currentTurn: 'white',
  players: { white: null, black: null },
  moveHistory: [],
  capturedPieces: { white: [], black: [] } // Piezas capturadas por cada jugador
};

function initializeBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Peones
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black' };
    board[6][i] = { type: 'pawn', color: 'white' };
  }
  
  // Torres
  board[0][0] = board[0][7] = { type: 'rook', color: 'black' };
  board[7][0] = board[7][7] = { type: 'rook', color: 'white' };
  
  // Caballos
  board[0][1] = board[0][6] = { type: 'knight', color: 'black' };
  board[7][1] = board[7][6] = { type: 'knight', color: 'white' };
  
  // Alfiles
  board[0][2] = board[0][5] = { type: 'bishop', color: 'black' };
  board[7][2] = board[7][5] = { type: 'bishop', color: 'white' };
  
  // Reinas
  board[0][3] = { type: 'queen', color: 'black' };
  board[7][3] = { type: 'queen', color: 'white' };
  
  // Reyes
  board[0][4] = { type: 'king', color: 'black' };
  board[7][4] = { type: 'king', color: 'white' };
  
  return board;
}

function isValidMove(from, to, board, currentTurn) {
  const piece = board[from.row][from.col];
  
  if (!piece) return false;
  if (piece.color !== currentTurn) return false;
  
  const target = board[to.row][to.col];
  if (target && target.color === piece.color) return false;
  
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  
  switch (piece.type) {
    case 'pawn':
      return isValidPawnMove(from, to, piece, board, rowDiff, colDiff);
    case 'rook':
      return isValidRookMove(from, to, board, rowDiff, colDiff);
    case 'knight':
      return isValidKnightMove(rowDiff, colDiff);
    case 'bishop':
      return isValidBishopMove(from, to, board, rowDiff, colDiff);
    case 'queen':
      return isValidQueenMove(from, to, board, rowDiff, colDiff);
    case 'king':
      return isValidKingMove(rowDiff, colDiff);
    default:
      return false;
  }
}

function isValidPawnMove(from, to, piece, board, rowDiff, colDiff) {
  const direction = piece.color === 'white' ? -1 : 1;
  const startRow = piece.color === 'white' ? 6 : 1;
  const target = board[to.row][to.col];
  
  // Movimiento hacia adelante
  if (colDiff === 0 && !target) {
    if (rowDiff === direction) return true;
    if (from.row === startRow && rowDiff === 2 * direction && !board[from.row + direction][from.col]) {
      return true;
    }
  }
  
  // Captura diagonal
  if (Math.abs(colDiff) === 1 && rowDiff === direction && target) {
    return true;
  }
  
  return false;
}

function isValidRookMove(from, to, board, rowDiff, colDiff) {
  if (rowDiff !== 0 && colDiff !== 0) return false;
  return isPathClear(from, to, board);
}

function isValidKnightMove(rowDiff, colDiff) {
  return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
         (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
}

function isValidBishopMove(from, to, board, rowDiff, colDiff) {
  if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
  return isPathClear(from, to, board);
}

function isValidQueenMove(from, to, board, rowDiff, colDiff) {
  return isValidRookMove(from, to, board, rowDiff, colDiff) ||
         isValidBishopMove(from, to, board, rowDiff, colDiff);
}

function isValidKingMove(rowDiff, colDiff) {
  return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
}

function isPathClear(from, to, board) {
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

io.on('connection', (socket) => {
  console.log('Nuevo jugador conectado:', socket.id);
  
  // Asignar color al jugador
  if (!gameState.players.white) {
    gameState.players.white = socket.id;
    socket.emit('player-color', 'white');
  } else if (!gameState.players.black) {
    gameState.players.black = socket.id;
    socket.emit('player-color', 'black');
  } else {
    socket.emit('player-color', 'spectator');
  }
  
  // Enviar estado inicial
  socket.emit('game-state', gameState);
  
  // Manejar movimientos
  socket.on('move', (data) => {
    const playerColor = socket.id === gameState.players.white ? 'white' : 'black';
    
    console.log(`Movimiento de ${playerColor}: (${data.from.row},${data.from.col}) -> (${data.to.row},${data.to.col})`);
    
    if (playerColor !== gameState.currentTurn) {
      socket.emit('invalid-move', 'No es tu turno');
      return;
    }
    
    if (isValidMove(data.from, data.to, gameState.board, gameState.currentTurn)) {
      const piece = gameState.board[data.from.row][data.from.col];
      const capturedPiece = gameState.board[data.to.row][data.to.col];
      
      console.log(`Moviendo pieza: ${piece.type} ${piece.color}`);
      
      // Si hay una pieza en el destino, la capturamos
      if (capturedPiece) {
        console.log(`Capturada: ${capturedPiece.type} ${capturedPiece.color}`);
        // El jugador que mueve captura la pieza
        gameState.capturedPieces[piece.color].push({
          type: capturedPiece.type,
          color: capturedPiece.color
        });
      }
      
      // Realizar movimiento
      gameState.board[data.to.row][data.to.col] = gameState.board[data.from.row][data.from.col];
      gameState.board[data.from.row][data.from.col] = null;
      
      // Cambiar turno
      gameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
      
      console.log('Nuevo turno:', gameState.currentTurn);
      
      // Emitir nuevo estado
      io.emit('game-state', gameState);
    } else {
      console.log('Movimiento inválido');
      socket.emit('invalid-move', 'Movimiento inválido');
    }
  });
  
  // Manejar mensajes de chat
  socket.on('chat-message', (message) => {
    const playerColor = socket.id === gameState.players.white ? 'Blancas' :
                       socket.id === gameState.players.black ? 'Negras' : 'Espectador';
    io.emit('chat-message', { player: playerColor, message });
  });
  
  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log('Jugador desconectado:', socket.id);
    if (gameState.players.white === socket.id) {
      gameState.players.white = null;
    } else if (gameState.players.black === socket.id) {
      gameState.players.black = null;
    }
  });
  
  // Reiniciar juego
  socket.on('reset-game', () => {
    gameState.board = initializeBoard();
    gameState.currentTurn = 'white';
    gameState.moveHistory = [];
    gameState.capturedPieces = { white: [], black: [] };
    io.emit('game-state', gameState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});