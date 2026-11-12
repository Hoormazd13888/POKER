const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://poker.onrender.com';

const db = {
    admins: [],
    users: {},
    tournaments: [],
    tasks: [],
    bonuses: {},
    settings: { feePercent: 5, dailyBonusActive: false, dailyBonusAmount: 0.1 },
    activeArenaGame: { status: 'waiting', timer: 15, players: [], bank: 0, winner: null },
    transactions: []
};

function getOrCreateUser(id, name = 'بازیکن', username = '') {
    if (!db.users[id]) {
        db.users[id] = { id, name, username, balance: 0, wins: 0, losses: 0, banned: false, claimedBonuses: [], history: [] };
    }
    return db.users[id];
}

app.post('/api/sync', (req, res) => {
    const { id, first_name, username } = req.body;
    if (!id) return res.status(400).json({ error: 'Invalid User' });

    const user = getOrCreateUser(id, first_name, username);
    if (user.banned) return res.status(403).json({ error: 'حساب مسدود است.' });

    const leaderboard = Object.values(db.users).sort((a, b) => b.balance - a.balance).slice(0, 10).map(u => ({ name: u.name, balance: u.balance }));

    res.json({
        user,
        leaderboard,
        tournaments: db.tournaments,
        tasks: db.tasks,
        dailyBonus: db.settings.dailyBonusActive ? db.settings.dailyBonusAmount : null,
        arena: db.activeArenaGame,
        isAdmin: db.admins.includes(Number(id))
    });
});

app.post('/api/withdraw', (req, res) => {
    const { id, amount, wallet } = req.body;
    const user = db.users[id];
    if (!user || user.balance < amount) return res.status(400).json({ error: 'موجودی کافی نیست.' });

    user.balance -= Number(amount);
    db.transactions.push({ userId: id, type: 'برداشت', amount, wallet, status: 'در حال بررسی', date: new Date().toLocaleDateString('fa-IR') });
    user.history.unshift(`-${amount} 💎 (برداشت TON)`);
    res.json({ success: true, user });
});

app.post('/api/arena/join', (req, res) => {
    const { id, amount } = req.body;
    const user = db.users[id];
    if (!user || user.balance < amount) return res.status(400).json({ error: 'موجودی کافی نیست.' });

    user.balance -= Number(amount);
    db.activeArenaGame.bank += Number(amount);
    db.activeArenaGame.players.push({ id, name: user.name, amount });

    if (db.activeArenaGame.status === 'waiting' && db.activeArenaGame.players.length === 1) {
        db.activeArenaGame.status = 'countdown';
        db.activeArenaGame.timer = 15;
        const timerInterval = setInterval(() => {
            db.activeArenaGame.timer -= 1;
            if (db.activeArenaGame.timer <= 0) {
                clearInterval(timerInterval);
                db.activeArenaGame.status = 'spinning';
                setTimeout(() => {
                    const players = db.activeArenaGame.players;
                    if (players.length > 0) {
                        const winner = players[Math.floor(Math.random() * players.length)];
                        const fee = (db.activeArenaGame.bank * db.settings.feePercent) / 100;
                        const finalPrize = db.activeArenaGame.bank - fee;
                        db.users[winner.id].balance += finalPrize;
                        db.activeArenaGame.winner = winner.name;
                        db.activeArenaGame.status = 'finished';
                        db.activeArenaGame.historyText = `برنده: ${winner.name} (${finalPrize.toFixed(2)} 💎)`;
                    }
                }, 4000);
            }
        }, 1000);
    }
    res.json({ success: true, arena: db.activeArenaGame, user });
});

app.post('/api/bonus/claim', (req, res) => {
    const { id, code } = req.body;
    const user = db.users[id];
    const bonus = db.bonuses[code];
    if (!user || !bonus || bonus.usedCount >= bonus.maxUses || user.claimedBonuses.includes(code)) return res.status(400).json({ error: 'کد نامعتبر یا منقضی است.' });

    bonus.usedCount += 1;
    user.claimedBonuses.push(code);
    user.balance += bonus.amount;
    user.history.unshift(`+${bonus.amount} 💎 (بونوس)`);
    res.json({ success: true, user });
});

// پنل ادمین API
app.post('/api/admin/data', (req, res) => {
    const { adminId } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json({ error: 'Unauthorized' });
    res.json({ settings: db.settings, transactions: db.transactions, usersCount: Object.keys(db.users).length });
});

app.post('/api/admin/update-settings', (req, res) => {
    const { adminId, feePercent, dailyActive, dailyAmount } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();
    db.settings.feePercent = Number(feePercent);
    db.settings.dailyBonusActive = dailyActive;
    db.settings.dailyBonusAmount = Number(dailyAmount);
    res.json({ success: true });
});

app.post('/api/admin/create-bonus', (req, res) => {
    const { adminId, code, amount, maxUses } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();
    db.bonuses[code] = { amount: Number(amount), maxUses: Number(maxUses), usedCount: 0 };
    res.json({ success: true, link: `https://t.me/YourBot?start=bonus_${code}` });
});

bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (db.admins.length === 0 || db.admins.includes(chatId)) {
        if (!db.admins.includes(chatId)) db.admins.push(chatId);
        bot.sendMessage(chatId, `👑 دسترسی ادمین تایید شد. مینی‌اپ را باز کنید و تب مدیریت را ببینید.`);
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    getOrCreateUser(chatId, msg.from.first_name, msg.from.username);
    bot.sendMessage(chatId, `♠️♥️ به **POKER GIFT** خوش آمدید!`, {
        reply_markup: { inline_keyboard: [[{ text: '🎲 ورود به مینی‌اپ POKER GIFT', web_app: { url: WEB_APP_URL } }]] }
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
