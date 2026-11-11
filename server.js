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

// تنظیمات سراسری و پنل ادمین فرضی پشت صحنه
let gameState = {
  bank: 0.00,
  timer: 15,
  status: 'waiting',
  players: [],
  history: [],
  feePercent: 2,
  wheelEnabled: true, // ادمین می‌تواند این را تغییر دهد
  wheelText: "Spin daily for free crypto rewards!",
  leaderboardTimerEnd: new Date().getTime() + (7 * 24 * 60 * 60 * 1000), // پیش‌فرض 7 روزه
  leaderboard: [
    { name: "AmirPro", volume: 14.50, prize: "5 TON" },
    { name: "CryptoKing", volume: 9.20, prize: "3 TON" },
    { name: "Sina_99", volume: 4.10, prize: "1 TON" }
  ]
};

// تایمر اصلی بازی آرنا
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
      // اضافه شدن حجم برد به لیدربرد کاربر
      let existingUser = gameState.leaderboard.find(u => u.name === winner.name);
      if (existingUser) {
        existingUser.volume += finalPrize;
      } else {
        gameState.leaderboard.push({ name: winner.name, volume: finalPrize, prize: "Reward" });
      }
      // مرتب‌سازی لیدربرد بر اساس بیشترین حجم برد
      gameState.leaderboard.sort((a, b) => b.volume - a.volume);
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
      id: socket.id,
      name: data.name,
      amount: parseFloat(data.amount)
    });
    io.emit('state', gameState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
