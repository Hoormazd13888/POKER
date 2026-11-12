const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

// پالت رنگ‌های نئونی برای بازیکنان
const COLORS = [
  '#FF2E93', '#00E5FF', '#FFD600', '#00E676', 
  '#AA00FF', '#FF6D00', '#2979FF', '#F50057'
];

// وضعیت فعلی اتاق بازی
let gameState = {
  status: 'WAITING', // WAITING | COUNTDOWN | SPINNING | RESULT
  timer: 15,
  pot: 0,
  players: [], // { id, name, bet, color, percentage, startAngle, endAngle }
  winner: null,
  winningAngle: 0
};

let countdownInterval = null;

function recalculateAngles() {
  let currentAngle = 0;
  gameState.players.forEach(p => {
    p.percentage = (p.bet / gameState.pot) * 100;
    const sliceAngle = (p.bet / gameState.pot) * 360;
    p.startAngle = currentAngle;
    p.endAngle = currentAngle + sliceAngle;
    currentAngle += sliceAngle;
  });
}

function startCountdown() {
  if (countdownInterval) return;
  gameState.status = 'COUNTDOWN';
  gameState.timer = 15;

  countdownInterval = setInterval(() => {
    gameState.timer -= 1;
    io.emit('gameState', gameState);

    if (gameState.timer <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      spinWheel();
    }
  }, 1000);
}

function spinWheel() {
  if (gameState.players.length === 0) {
    resetGame();
    return;
  }

  gameState.status = 'SPINNING';
  
  // انتخاب زاویه کاملاً تصادفی و امن روی سرور (0 تا 360)
  const randomFraction = crypto.randomInt(0, 1000000) / 1000000;
  const targetAngle = randomFraction * 360;
  gameState.winningAngle = targetAngle;

  // پیدا کردن برنده بر اساس زاویه
  const winner = gameState.players.find(
    p => targetAngle >= p.startAngle && targetAngle < p.endAngle
  ) || gameState.players[gameState.players.length - 1];

  gameState.winner = winner;
  io.emit('spinStart', {
    winningAngle: targetAngle,
    winner: winner,
    pot: gameState.pot
  });

  // 5 ثانیه انیمیشن چرخش + 4 ثانیه نمایش برنده
  setTimeout(() => {
    gameState.status = 'RESULT';
    io.emit('gameState', gameState);

    setTimeout(() => {
      resetGame();
    }, 4000);
  }, 5000);
}

function resetGame() {
  gameState = {
    status: 'WAITING',
    timer: 15,
    pot: 0,
    players: [],
    winner: null,
    winningAngle: 0
  };
  io.emit('gameState', gameState);
}

io.on('connection', (socket) => {
  // ارسال وضعیت فعلی به کاربر جدید
  socket.emit('gameState', gameState);

  // ورود یا افزایش شرط بازیکن
  socket.on('placeBet', ({ userId, username, amount }) => {
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) return;
    if (gameState.status === 'SPINNING' || gameState.status === 'RESULT') return;

    let existingPlayer = gameState.players.find(p => p.id === userId);
    if (existingPlayer) {
      existingPlayer.bet = parseFloat((existingPlayer.bet + betAmount).toFixed(4));
    } else {
      const color = COLORS[gameState.players.length % COLORS.length];
      gameState.players.push({
        id: userId,
        name: username || `Player_${userId.slice(-4)}`,
        bet: betAmount,
        color: color,
        percentage: 0,
        startAngle: 0,
        endAngle: 0
      });
    }

    gameState.pot = parseFloat((gameState.pot + betAmount).toFixed(4));
    recalculateAngles();

    // شروع تایمر ۱۵ ثانیه‌ای به محض ورود اولین نفر
    if (gameState.status === 'WAITING' && gameState.players.length >= 1) {
      startCountdown();
    }

    io.emit('gameState', gameState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Arena Server running on port ${PORT}`);
});
