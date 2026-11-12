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

const COLORS = ['#00E5FF', '#FF2E93', '#FFD600', '#00E676', '#AA00FF', '#FF6D00'];
const usersBalances = {};

// وضعیت رولت
let rouletteState = { status: 'WAITING', timer: 15, pot: 0, tax: 0, finalPrize: 0, players: [], winner: null, winningAngle: 0 };
let rouletteInterval = null;

// وضعیت آرنا
let arenaState = { status: 'WAITING', timer: 15, pot: 0, tax: 0, finalPrize: 0, players: [], winner: null, ballPosition: { x: 50, y: 50 } };
let arenaInterval = null;

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'کاربر';
  const webAppUrl = 'https://poker-xqj6.onrender.com/';

  bot.sendMessage(chatId, `👑 **به آرنا خوش آمدید!**\n\nجایی برای بازی، هیجان و برد بزرگ با TON.`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 ورود به مینی‌اپ بازی', web_app: { url: webAppUrl } }]]
    }
  });
});

// --- منطق رولت ---
function recalculateRoulette() {
  let currentAngle = 0;
  rouletteState.pot = rouletteState.players.reduce((sum, p) => sum + p.bet, 0);
  rouletteState.tax = Math.round(rouletteState.pot * 0.05);
  rouletteState.finalPrize = rouletteState.pot - rouletteState.tax;

  rouletteState.players.forEach(p => {
    p.percentage = rouletteState.pot > 0 ? Math.round((p.bet / rouletteState.pot) * 100) : 0;
    const sliceAngle = rouletteState.pot > 0 ? (p.bet / rouletteState.pot) * 360 : 0;
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
    rouletteState.timer--;
    io.emit('rouletteState', rouletteState);

    if (rouletteState.timer <= 0) {
      clearInterval(rouletteInterval);
      rouletteInterval = null;
      spinRoulette();
    }
  }, 1000);
}

function spinRoulette() {
  if (rouletteState.players.length < 2) { resetRoulette(); return; }
  rouletteState.status = 'SPINNING';
  const targetAngle = (crypto.randomInt(0, 1000000) / 1000000) * 360;
  rouletteState.winningAngle = targetAngle;

  const winner = rouletteState.players.find(p => targetAngle >= p.startAngle && targetAngle < p.endAngle) || rouletteState.players[rouletteState.players.length - 1];
  rouletteState.winner = winner;

  if (!usersBalances[winner.id]) usersBalances[winner.id] = 1000;
  usersBalances[winner.id] += rouletteState.finalPrize;

  io.emit('rouletteSpinStart', { winningAngle: targetAngle, winner, prize: rouletteState.finalPrize });

  setTimeout(() => {
    rouletteState.status = 'RESULT';
    io.emit('rouletteState', rouletteState);
    setTimeout(resetRoulette, 4000);
  }, 5000);
}

function resetRoulette() {
  rouletteState = { status: 'WAITING', timer: 15, pot: 0, tax: 0, finalPrize: 0, players: [], winner: null, winningAngle: 0 };
  io.emit('rouletteState', rouletteState);
}

// --- منطق آرنا ---
function recalculateArena() {
  arenaState.pot = arenaState.players.reduce((sum, p) => sum + p.bet, 0);
  arenaState.tax = Math.round(arenaState.pot * 0.05);
  arenaState.finalPrize = arenaState.pot - arenaState.tax;

  arenaState.players.forEach(p => {
    p.percentage = arenaState.pot > 0 ? Math.round((p.bet / arenaState.pot) * 100) : 0;
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
    arenaState.timer--;
    io.emit('arenaState', arenaState);

    if (arenaState.timer <= 0) {
      clearInterval(arenaInterval);
      arenaInterval = null;
      spinArena();
    }
  }, 1000);
}

function spinArena() {
  if (arenaState.players.length < 2) { resetArena(); return; }
  arenaState.status = 'SPINNING';

  const winnerIndex = crypto.randomInt(0, arenaState.players.length);
  const winner = arenaState.players[winnerIndex];
  arenaState.winner = winner;

  if (!usersBalances[winner.id]) usersBalances[winner.id] = 1000;
  usersBalances[winner.id] += arenaState.finalPrize;

  io.emit('arenaSpinStart', { winner, prize: arenaState.finalPrize });

  setTimeout(() => {
    arenaState.status = 'RESULT';
    io.emit('arenaState', arenaState);
    setTimeout(resetArena, 4000);
  }, 4000);
}

function resetArena() {
  arenaState = { status: 'WAITING', timer: 15, pot: 0, tax: 0, finalPrize: 0, players: [], winner: null, ballPosition: { x: 50, y: 50 } };
  io.emit('arenaState', arenaState);
}

io.on('connection', (socket) => {
  socket.emit('rouletteState', rouletteState);
  socket.emit('arenaState', arenaState);

  socket.on('getWallet', (userId) => {
    if (!usersBalances[userId]) usersBalances[userId] = 1000; // موجودی تست اولیه
    socket.emit('balanceUpdate', usersBalances[userId]);
  });

  socket.on('walletAction', ({ userId, type, amount }) => {
    if (!usersBalances[userId]) usersBalances[userId] = 1000;
    const val = parseFloat(amount);
    if (type === 'deposit') usersBalances[userId] += val;
    else if (type === 'withdraw' && usersBalances[userId] >= val) usersBalances[userId] -= val;
    socket.emit('balanceUpdate', usersBalances[userId]);
  });

  socket.on('placeRouletteBet', ({ userId, username, amount }) => {
    const bet = parseFloat(amount);
    if (!usersBalances[userId]) usersBalances[userId] = 1000;
    if (usersBalances[userId] < bet) { socket.emit('errorMsg', 'موجودی والت کافی نیست!'); return; }

    usersBalances[userId] -= bet;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let p = rouletteState.players.find(x => x.id === userId);
    if (p) { p.bet += bet; }
    else {
      rouletteState.players.push({
        id: userId, name: username || 'Player', bet,
        color: COLORS[rouletteState.players.length % COLORS.length], percentage: 0, startAngle: 0, endAngle: 0
      });
    }

    recalculateRoulette();
    if (rouletteState.status === 'WAITING' || rouletteState.status === 'COUNTDOWN') {
      startRouletteCountdown();
    }
    io.emit('rouletteState', rouletteState);
  });

  socket.on('placeArenaBet', ({ userId, username, amount }) => {
    const bet = parseFloat(amount);
    if (!usersBalances[userId]) usersBalances[userId] = 1000;
    if (usersBalances[userId] < bet) { socket.emit('errorMsg', 'موجودی والت کافی نیست!'); return; }

    usersBalances[userId] -= bet;
    socket.emit('balanceUpdate', usersBalances[userId]);

    let p = arenaState.players.find(x => x.id === userId);
    if (p) { p.bet += bet; }
    else {
      arenaState.players.push({
        id: userId, name: username || 'Player', bet,
        color: COLORS[arenaState.players.length % COLORS.length], percentage: 0
      });
    }

    recalculateArena();
    if (arenaState.status === 'WAITING' || arenaState.status === 'COUNTDOWN') {
      startArenaCountdown();
    }
    io.emit('arenaState', arenaState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
