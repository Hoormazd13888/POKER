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

// وضعیت بازی آرنا
let arenaState = { status: 'WAITING', timer: 15, pot: 0, players: [], winner: null, winningAngle: 0 };
let arenaInterval = null;

// دستور /start در تلگرام با لینک سایت شما
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'کاربر';
  const webAppUrl = 'https://poker-xqj6.onrender.com/';[span_3](start_span)[span_3](end_span)

  bot.sendMessage(chatId, `سلام ${firstName} عزیز! 🎮\nبه ربات آرنا و رولت TON خوش آمدید:`, {
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 ورود به مینی‌اپ بازی', web_app: { url: webAppUrl } }]]
    }
  });
});

// --- رولت ---
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
    if (rouletteState.players.length < 2) {
      rouletteState.timer = 15;
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

  io.emit('spinStart', { type: 'roulette', winningAngle: targetAngle, winner, pot: rouletteState.pot });

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


// --- آرنا (با محاسبه دقیق سهم و رنگ هر کاربر مثل رولت) ---
function recalculateArenaAngles() {
  let currentAngle = 0;
  arenaState.players.forEach(p => {
    p.percentage = (p.bet / arenaState.pot) * 100;
    const sliceAngle = (p.bet / arenaState.pot) * 360;
    p.startAngle = currentAngle;
    p.endAngle = currentAngle + sliceAngle;
    currentAngle += sliceAngle;
  });
}

function startArenaCountdown() {
  if (arenaInterval) return;
  arenaState.status = 'COUNTDOWN';
  arenaState.timer = 15;

  arenaInterval = setInterval(() => {
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
      spinArenaWheel();
    }
  }, 1000);
}

function spinArenaWheel() {
  if (arenaState.players.length < 2) { resetArena(); return; }
  arenaState.status = 'SPINNING';
  const targetAngle = (crypto.randomInt(0, 1000000) / 1000000) * 360;
  arenaState.winningAngle = targetAngle;

  const winner = arenaState.players.find(p => targetAngle >= p.startAngle && targetAngle < p.endAngle) || arenaState.players[arenaState.players.length - 1];
  arenaState.winner = winner;

  if (!usersBalances[winner.id]) usersBalances[winner.id] = 0;
  usersBalances[winner.id] += arenaState.pot;

  io.emit('spinStart', { type: 'arena', winningAngle: targetAngle, winner, pot: arenaState.pot });

  setTimeout(() => {
    arenaState.status = 'RESULT';
    io.emit('arenaState', arenaState);
    setTimeout(() => { resetArena(); }, 4000);
  }, 5000);
}

function resetArena() {
  arenaState = { status: 'WAITING', timer: 15, pot: 0, players: [], winner: null, winningAngle: 0 };
  io.emit('arenaState', arenaState);
}


io.on('connection', (socket) => {
  socket.emit('rouletteState', rouletteState);
  socket.emit('arenaState', arenaState);

  socket.on('placeRouletteBet', ({ userId, username, photoUrl, amount }) => {
    const bet = parseFloat(amount);
    if (!usersBalances[userId]) usersBalances[userId] = 10.0;
    if (usersBalances[userId] < bet) { socket.emit('errorMsg', 'موجودی کافی نیست!'); return; }

    usersBalances[userId] -= bet;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let p = rouletteState.players.find(x => x.id === userId);
    if (p) { p.bet = parseFloat((p.bet + bet).toFixed(4)); } 
    else { 
      rouletteState.players.push({ 
        id: userId, name: username || 'User', photo: photoUrl || '', bet, 
        color: COLORS[rouletteState.players.length % COLORS.length], percentage: 0, startAngle: 0, endAngle: 0 
      }); 
    }

    rouletteState.pot = parseFloat((rouletteState.pot + bet).toFixed(4));
    recalculateRouletteAngles();

    if (rouletteState.status === 'WAITING' || rouletteState.status === 'COUNTDOWN') {
      startRouletteCountdown();
    }
    io.emit('rouletteState', rouletteState);
  });

  socket.on('placeArenaBet', ({ userId, username, photoUrl, amount }) => {
    const bet = parseFloat(amount);
    if (!usersBalances[userId]) usersBalances[userId] = 10.0;
    if (usersBalances[userId] < bet) { socket.emit('errorMsg', 'موجودی کافی نیست!'); return; }

    usersBalances[userId] -= bet;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let p = arenaState.players.find(x => x.id === userId);
    if (p) { p.bet = parseFloat((p.bet + bet).toFixed(4)); } 
    else { 
      arenaState.players.push({ 
        id: userId, name: username || 'User', photo: photoUrl || '', bet, 
        color: COLORS[arenaState.players.length % COLORS.length], percentage: 0, startAngle: 0, endAngle: 0 
      }); 
    }

    arenaState.pot = parseFloat((arenaState.pot + bet).toFixed(4));
    recalculateArenaAngles();

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
