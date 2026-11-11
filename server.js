const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let gameState = {
  bank: 0.00,
  timer: 15,
  status: 'waiting',
  players: [],
  history: [],
  feePercent: 2,
  adminWallet: "UQD_YOUR_ADMIN_WALLET_ADDRESS_HERE"
};

setInterval(() => {
  if (gameState.status === 'waiting') {
    if (gameState.players.length > 0) {
      gameState.timer--;
      if (gameState.timer <= 0) {
        startSpinning();
      }
    } else {
      gameState.timer = 15;
    }
  }
  io.emit('state', gameState);
}, 1000);

function startSpinning() {
  gameState.status = 'spinning';
  io.emit('state', gameState);

  setTimeout(() => {
    let totalPool = gameState.players.reduce((sum, p) => sum + p.amount, 0);
    let winningPoint = Math.random() * totalPool;
    let currentSum = 0;
    let winner = gameState.players[0];

    for (let p of gameState.players) {
      currentSum += p.amount;
      if (winningPoint <= currentSum) {
        winner = p;
        break;
      }
    }

    let fee = (totalPool * gameState.feePercent) / 100;
    let finalPrize = totalPool - fee;
    
    if (winner) {
      winner.balance = (winner.balance || 0) + finalPrize;
      gameState.history.unshift({
        gameId: Math.floor(Math.random() * 90000) + 10000,
        winnerName: winner.name,
        amount: finalPrize
      });
    }

    gameState.bank += fee;
    gameState.players = [];
    gameState.status = 'waiting';
    gameState.timer = 15;
    io.emit('state', gameState);
  }, 4000);
}

io.on('connection', (socket) => {
  socket.emit('state', gameState);

  socket.on('join_game', (data) => {
    if (gameState.status !== 'waiting') return;
    gameState.players.push({
      id: data.id,
      name: data.name,
      amount: parseFloat(data.amount),
      color: data.color
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
