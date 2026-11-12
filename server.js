const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

// توکن ربات تلگرام شما
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const COLORS = ['#FF2E93', '#00E5FF', '#FFD600', '#00E676', '#AA00FF', '#FF6D00'];
const usersBalances = {}; // موجودی والت کاربران

let rouletteState = {
  status: 'WAITING', // WAITING | COUNTDOWN | SPINNING | RESULT
  timer: 15,
  pot: 0,
  players: [],
  winner: null,
  winningAngle: 0
};

let countdownInterval = null;

// دستور /start در ربات تلگرام
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'کاربر';

  // لینک مینی‌اپ شما (آدرس سرور)
  const webAppUrl = process.env.WEB_APP_URL || 'https://your-domain.com';

  bot.sendMessage(chatId, `سلام ${firstName} عزیز! 🎮\nبه ربات آرنا و رولت TON خوش آمدید. برای شروع بازی روی دکمه زیر کلیک کنید:`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🚀 ورود به مینی‌اپ بازی',
            web_app: { url: webAppUrl }
          }
        ]
      ]
    }
  });
});

function recalculateRouletteAngles() {
  let currentAngle = 0;
  rouletteState.players.forEach(p => {
    p.percentage = (p.bet / rouletteState.pot) * 100;
    const sliceAngle = (p.bet / rouletteState.pot) * 360;
    p.startAngle = currentAngle;
    p.endAngle = currentAngle + sliceAngle;
    currentAngle += sliceAngle;
  });
}

function startRouletteCountdown() {
  if (countdownInterval) return;
  rouletteState.status = 'COUNTDOWN';
  rouletteState.timer = 15;

  countdownInterval = setInterval(() => {
    rouletteState.timer -= 1;
    io.emit('rouletteState', rouletteState);

    if (rouletteState.timer <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      spinRouletteWheel();
    }
  }, 1000);
}

function spinRouletteWheel() {
  if (rouletteState.players.length === 0) {
    resetRoulette();
    return;
  }

  rouletteState.status = 'SPINNING';
  const randomFraction = crypto.randomInt(0, 1000000) / 1000000;
  const targetAngle = randomFraction * 360;
  rouletteState.winningAngle = targetAngle;

  const winner = rouletteState.players.find(
    p => targetAngle >= p.startAngle && targetAngle < p.endAngle
  ) || rouletteState.players[rouletteState.players.length - 1];

  rouletteState.winner = winner;
  
  if (!usersBalances[winner.id]) usersBalances[winner.id] = 0;
  usersBalances[winner.id] += rouletteState.pot;

  io.emit('spinStart', {
    winningAngle: targetAngle,
    winner: winner,
    pot: rouletteState.pot
  });

  setTimeout(() => {
    rouletteState.status = 'RESULT';
    io.emit('rouletteState', rouletteState);
    setTimeout(() => { resetRoulette(); }, 4000);
  }, 5000);
}

function resetRoulette() {
  rouletteState = {
    status: 'WAITING',
    timer: 15,
    pot: 0,
    players: [],
    winner: null,
    winningAngle: 0
  };
  io.emit('rouletteState', rouletteState);
}

io.on('connection', (socket) => {
  socket.emit('rouletteState', rouletteState);

  socket.on('placeRouletteBet', ({ userId, username, amount }) => {
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) return;
    
    if (!usersBalances[userId]) usersBalances[userId] = 5.0; // هدیه تست اولیه
    if (usersBalances[userId] < betAmount) {
      socket.emit('errorMsg', 'موجودی والت کافی نیست! لطفاً واریز کنید.');
      return;
    }

    usersBalances[userId] -= betAmount;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let existingPlayer = rouletteState.players.find(p => p.id === userId);
    if (existingPlayer) {
      existingPlayer.bet = parseFloat((existingPlayer.bet + betAmount).toFixed(4));
    } else {
      const color = COLORS[rouletteState.players.length % COLORS.length];
      rouletteState.players.push({
        id: userId,
        name: username || `User_${userId.slice(-4)}`,
        bet: betAmount,
        color: color,
        percentage: 0,
        startAngle: 0,
        endAngle: 0
      });
    }

    rouletteState.pot = parseFloat((rouletteState.pot + betAmount).toFixed(4));
    recalculateRouletteAngles();

    if (rouletteState.status === 'WAITING' && rouletteState.players.length >= 1) {
      startRouletteCountdown();
    }

    io.emit('rouletteState', rouletteState);
  });

  socket.on('getWallet', (userId) => {
    if (!usersBalances[userId]) usersBalances[userId] = 5.0;
    socket.emit('balanceUpdate', usersBalances[userId]);
  });

  socket.on('walletAction', ({ userId, type, amount }) => {
    if (!usersBalances[userId]) usersBalances[userId] = 5.0;
    const val = parseFloat(amount);
    if (type === 'deposit') {
      usersBalances[userId] += val;
    } else if (type === 'withdraw' && usersBalances[userId] >= val) {
      usersBalances[userId] -= val;
    }
    socket.emit('balanceUpdate', usersBalances[userId]);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server and Bot running on port ${PORT}`);
});
