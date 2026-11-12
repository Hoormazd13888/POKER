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
    tournaments: [], // فقط مسابقات ایجادشده توسط ادمین
    tasks: [],       // فقط تسک‌های ایجادشده توسط ادمین
    bonuses: {},     // کمپین‌های بونوس
    settings: {
        feePercent: 5,            // مالیات هر راند بازی آرنا
        adminWallet: 'EQD...',    // آدرس کیف پول رسمی ادمین برای واریز کاربران
        forceChannel: '',         // جوین اجباری
        dailyActive: false,       // وضعیت پاداش روزانه
        dailyAmount: 0.05,        // مقدار پاداش روزانه
        dailyResetTime: '00:00'
    },
    activeArenaGame: {
        status: 'waiting', // waiting, countdown, spinning, finished
        timer: 15,
        players: [],
        bank: 0,
        winner: null
    },
    transactions: []
};

function getOrCreateUser(id, name = 'بازیکن', username = '') {
    if (!db.users[id]) {
        db.users[id] = {
            id,
            name,
            username,
            balance: 0,
            wins: 0,
            losses: 0,
            joinedDate: new Date().toLocaleDateString('fa-IR'),
            banned: false,
            claimedBonuses: [],
            history: [] // فقط واریز و برداشت TON
        };
    }
    return db.users[id];
}

// --- API های مینی‌اپ و پنل مدیریت ---

app.post('/api/sync', (req, res) => {
    const { id, first_name, username } = req.body;
    if (!id) return res.status(400).json({ error: 'Invalid User' });

    const user = getOrCreateUser(id, first_name, username);
    if (user.banned) return res.status(403).json({ error: 'حساب شما مسدود است.' });

    const leaderboard = Object.values(db.users)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map(u => ({ name: u.name, balance: u.balance }));

    res.json({
        user,
        leaderboard,
        tournaments: db.tournaments,
        tasks: db.tasks,
        dailyBonus: db.settings.dailyActive ? db.settings.dailyAmount : null,
        arena: db.activeArenaGame,
        adminWallet: db.settings.adminWallet,
        isAdmin: db.admins.includes(Number(id))
    });
});

// واریز TON (ثبت تراکنش)
app.post('/api/deposit', (req, res) => {
    const { id, amount, txHash } = req.body;
    const user = db.users[id];
    if (!user) return res.status(404).json();

    const txId = txHash || 'TX_' + Date.now();
    db.transactions.push({ id: txId, userId: id, type: 'واریز TON', amount, status: 'تایید شده', date: new Date().toLocaleDateString('fa-IR') });
    
    user.balance += Number(amount);
    user.history.unshift(`+${amount} TON (واریز)`);
    res.json({ success: true, user });
});

// درخواست برداشت TON
app.post('/api/withdraw', (req, res) => {
    const { id, amount, wallet } = req.body;
    const user = db.users[id];
    if (!user || user.balance < amount) return res.status(400).json({ error: 'موجودی کافی نیست.' });

    user.balance -= Number(amount);
    db.transactions.push({ userId: id, type: 'برداشت TON', amount, wallet, status: 'در حال بررسی', date: new Date().toLocaleDateString('fa-IR') });
    user.history.unshift(`-${amount} TON (برداشت)`);
    res.json({ success: true, user });
});

// سیستم بازی ARENA با کسر مالیات ادمین
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
                        db.users[winner.id].wins += 1;
                        db.activeArenaGame.winner = winner.name;
                        db.activeArenaGame.status = 'finished';
                        db.activeArenaGame.historyText = `برنده: ${winner.name} (${finalPrize.toFixed(2)} TON)`;
                    }
                }, 4000);
            }
        }, 1000);
    }
    res.json({ success: true, arena: db.activeArenaGame, user });
});

// --- پنل مدیریت ادمین ---
app.post('/api/admin/data', (req, res) => {
    const { adminId } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json({ error: 'Unauthorized' });

    res.json({
        settings: db.settings,
        transactions: db.transactions,
        usersCount: Object.keys(db.users).length,
        tournaments: db.tournaments,
        tasks: db.tasks,
        usersList: Object.values(db.users)
    });
});

app.post('/api/admin/update-settings', (req, res) => {
    const { adminId, feePercent, adminWallet, dailyActive, dailyAmount } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();

    db.settings.feePercent = Number(feePercent);
    db.settings.adminWallet = adminWallet;
    db.settings.dailyActive = dailyActive;
    db.settings.dailyAmount = Number(dailyAmount);
    res.json({ success: true });
});

app.post('/api/admin/create-tournament', (req, res) => {
    const { adminId, title, prize, rules } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();

    db.tournaments.push({ id: Date.now(), title, prize, rules, status: 'فعال' });
    res.json({ success: true, tournaments: db.tournaments });
});

app.post('/api/admin/add-task', (req, res) => {
    const { adminId, title, reward } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();

    db.tasks.push({ id: Date.now(), title, reward: Number(reward) });
    res.json({ success: true, tasks: db.tasks });
});

// --- دستورات ربات تلگرام ---
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (db.admins.length === 0 || db.admins.includes(chatId)) {
        if (!db.admins.includes(chatId)) db.admins.push(chatId);
        bot.sendMessage(chatId, `👑 پنل مدیریت **POKER GIFT** فعال شد.`, {
            reply_markup: { inline_keyboard: [[{ text: '🚀 ورود به پنل و مینی‌اپ', web_app: { url: WEB_APP_URL } }]] }
        });
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    getOrCreateUser(chatId, msg.from.first_name, msg.from.username);
    bot.sendMessage(chatId, `♠️♥️ به پلتفرم حرفه‌ای **POKER GIFT** خوش آمدید!\n\nبرای ورود به بازی **ARENA** و مدیریت حساب روی دکمه زیر کلیک کنید:`, {
        reply_markup: { inline_keyboard: [[{ text: '🎲 ورود به POKER GIFT', web_app: { url: WEB_APP_URL } }]] }
    });
});

app.listen(PORT, () => console.log(`POKER GIFT Server running on port ${PORT}`));
