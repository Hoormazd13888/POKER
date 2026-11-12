const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const COLORS = ['#FF2E93', '#00E5FF', '#FFD600', '#00E676', '#AA00FF', '#FF6D00'];
const usersBalances = {};

// وضعیت بازی رولت
let rouletteState = { status: 'WAITING', timer: 15, pot: 0, players: [], winner: null, winningAngle: 0 };
let rouletteInterval = null;

// وضعیت بازی آرنا (مربعی)
let arenaState = { status: 'WAITING', timer: 15, pot: 0, players: [], winner: null, selectedRoom: 1 };
let arenaInterval = null;

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'کاربر';
  // آدرس سرور خودت روی Render یا Railway رو اینجا بگذار
  const webAppUrl = process.env.WEB_APP_URL || 'https://poker-xqj6.onrender.com';

  bot.sendMessage(chatId, `سلام ${firstName} عزیز! 🎮\nبه ربات آرنا و رولت TON خوش آمدید:`, {
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 ورود به مینی‌اپ بازی', web_app: { url: webAppUrl } }]]
    }
  });
});

// --- منطق رولت ---
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
  if (rouletteInterval) return;
  rouletteState.status = 'COUNTDOWN';
  rouletteState.timer = 15;

  rouletteInterval = setInterval(() => {
    // بررسی اینکه حتماً حداقل ۲ بازیکن حضور داشته باشند
    if (rouletteState.players.length < 2) {
      rouletteState.timer = 15; // منتظر ماندن تایمر تا ورود نفر دوم
      io.emit('rouletteState', rouletteState);
      return;
    }

    rouletteState.timer -= 1;
    io.emit('rouletteState', rouletteState);

    if (rouletteState.timer <= 0) {
      clearInterval(rouletteInterval);
      rouletteInterval = null;
      spinRouletteWheel();
    }
  }, 1000);
}

function spinRouletteWheel() {
  if (rouletteState.players.length < 2) { resetRoulette(); return; }
  rouletteState.status = 'SPINNING';
  const targetAngle = (crypto.randomInt(0, 1000000) / 1000000) * 360;
  rouletteState.winningAngle = targetAngle;

  const winner = rouletteState.players.find(p => targetAngle >= p.startAngle && targetAngle < p.endAngle) || rouletteState.players[rouletteState.players.length - 1];
  rouletteState.winner = winner;
  
  if (!usersBalances[winner.id]) usersBalances[winner.id] = 0;
  usersBalances[winner.id] += rouletteState.pot;

  io.emit('spinStart', { winningAngle: targetAngle, winner, pot: rouletteState.pot });

  setTimeout(() => {
    rouletteState.status = 'RESULT';
    io.emit('rouletteState', rouletteState);
    setTimeout(() => { resetRoulette(); }, 4000);
  }, 5000);
}

function resetRoulette() {
  rouletteState = { status: 'WAITING', timer: 15, pot: 0, players: [], winner: null, winningAngle: 0 };
  io.emit('rouletteState', rouletteState);
}


// --- منطق آرنا (مربعی) ---
function startArenaCountdown() {
  if (arenaInterval) return;
  arenaState.status = 'COUNTDOWN';
  arenaState.timer = 15;

  arenaInterval = setInterval(() => {
    // شرط حیاتی: تا بازیکن دوم نیامده تایمر شروع نشود یا معلق بماند
    if (arenaState.players.length < 2) {
      arenaState.timer = 15;
      io.emit('arenaState', arenaState);
      return;
    }

    arenaState.timer -= 1;
    io.emit('arenaState', arenaState);

    if (arenaState.timer <= 0) {
      clearInterval(arenaInterval);
      arenaInterval = null;
      finishArenaGame();
    }
  }, 1000);
}

function finishArenaGame() {
  if (arenaState.players.length < 2) { resetArena(); return; }
  arenaState.status = 'SPINNING';

  // انتخاب تصادفی برنده در آرنا مربعی
  const winnerIndex = crypto.randomInt(0, arenaState.players.length);
  const winner = arenaState.players[winnerIndex];
  arenaState.winner = winner;

  if (!usersBalances[winner.id]) usersBalances[winner.id] = 0;
  usersBalances[winner.id] += arenaState.pot;

  io.emit('arenaFinish', { winner, pot: arenaState.pot });

  setTimeout(() => {
    arenaState.status = 'RESULT';
    io.emit('arenaState', arenaState);
    setTimeout(() => { resetArena(); }, 4000);
  }, 4000);
}

function resetArena() {
  arenaState = { status: 'WAITING', timer: 15, pot: 0, players: [], winner: null, selectedRoom: arenaState.selectedRoom };
  io.emit('arenaState', arenaState);
}


io.on('connection', (socket) => {
  socket.emit('rouletteState', rouletteState);
  socket.emit('arenaState', arenaState);

  // ثبت شرط رولت
  socket.on('placeRouletteBet', ({ userId, username, amount }) => {
    const bet = parseFloat(amount);
    if (!usersBalances[userId]) usersBalances[userId] = 10.0; // تست اولیه
    if (usersBalances[userId] < bet) { socket.emit('errorMsg', 'موجودی کافی نیست!'); return; }

    usersBalances[userId] -= bet;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let p = rouletteState.players.find(x => x.id === userId);
    if (p) { p.bet = parseFloat((p.bet + bet).toFixed(4)); } 
    else { rouletteState.players.push({ id: userId, name: username || 'User', bet, color: COLORS[rouletteState.players.length % COLORS.length], percentage: 0, startAngle: 0, endAngle: 0 }); }

    rouletteState.pot = parseFloat((rouletteState.pot + bet).toFixed(4));
    recalculateRouletteAngles();

    if (rouletteState.status === 'WAITING' || rouletteState.status === 'COUNTDOWN') {
      startRouletteCountdown();
    }
    io.emit('rouletteState', rouletteState);
  });

  // ثبت شرط آرنا
  socket.on('placeArenaBet', ({ userId, username, amount }) => {
    const bet = parseFloat(amount);
    if (!usersBalances[userId]) usersBalances[userId] = 10.0;
    if (usersBalances[userId] < bet) { socket.emit('errorMsg', 'موجودی کافی نیست!'); return; }

    usersBalances[userId] -= bet;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let p = arenaState.players.find(x => x.id === userId);
    if (p) { p.bet = parseFloat((p.bet + bet).toFixed(4)); }
    else { arenaState.players.push({ id: userId, name: username || 'User', bet, color: COLORS[arenaState.players.length % COLORS.length] }); }

    arenaState.pot = parseFloat((arenaState.pot + bet).toFixed(4));

    if (arenaState.status === 'WAITING' || arenaState.status === 'COUNTDOWN') {
      startArenaCountdown();
    }
    io.emit('arenaState', arenaState);
  });

  socket.on('getWallet', (userId) => {
    if (!usersBalances[userId]) usersBalances[userId] = 10.0;
    socket.emit('balanceUpdate', usersBalances[userId]);
  });

  socket.on('walletAction', ({ userId, type, amount }) => {
    if (!usersBalances[userId]) usersBalances[userId] = 10.0;
    const val = parseFloat(amount);
    if (type === 'deposit') usersBalances[userId] += val;
    else if (type === 'withdraw' && usersBalances[userId] >= val) usersBalances[userId] -= val;
    socket.emit('balanceUpdate', usersBalances[userId]);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
