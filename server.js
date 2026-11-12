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
    tournaments: [], // مسابقات دستی ادمین
    tasks: [], // تسک‌ها و مأموریت‌های دستی ادمین
    bonuses: {}, // کدهای بونوس فعال (code -> {amount, maxUses, usedCount})
    settings: {
        feePercent: 5, // درصد مالیات بازی آرنا
        forceChannel: '',
        dailyBonusActive: false,
        dailyBonusAmount: 0.1
    },
    activeArenaGame: {
        status: 'waiting',
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
            balance: 0, // موجودی اولیه صفر با الماس 💎
            wins: 0,
            losses: 0,
            banned: false,
            claimedBonuses: [],
            history: []
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
        dailyBonus: db.settings.dailyBonusActive ? db.settings.dailyBonusAmount : null,
        arena: db.activeArenaGame,
        isAdmin: db.admins.includes(Number(id))
    });
});

// واریز و شارژ حساب
app.post('/api/deposit', (req, res) => {
    const { id, amount, txHash } = req.body;
    const user = db.users[id];
    if (!user) return res.status(404).json();

    const txId = txHash || 'TX_' + Date.now();
    db.transactions.push({ id: txId, userId: id, type: 'واریز', amount, status: 'تایید شده', date: new Date().toLocaleDateString('fa-IR') });
    
    user.balance += Number(amount);
    user.history.unshift(`+${amount} 💎 (واریز موفق)`);
    res.json({ success: true, user });
});

// برداشت TON
app.post('/api/withdraw', (req, res) => {
    const { id, amount, wallet } = req.body;
    const user = db.users[id];
    if (!user || user.balance < amount) return res.status(400).json({ error: 'موجودی کافی نیست.' });

    user.balance -= Number(amount);
    db.transactions.push({ userId: id, type: 'برداشت', amount, wallet, status: 'در حال بررسی', date: new Date().toLocaleDateString('fa-IR') });
    user.history.unshift(`-${amount} 💎 (درخواست برداشت)`);
    res.json({ success: true, user });
});

// بازی آرنا با کسر مالیات تعیین شده توسط ادمین
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
                        db.activeArenaGame.historyText = `برنده: ${winner.name} (${finalPrize.toFixed(2)} 💎)`;
                    }
                }, 4000);
            }
        }, 1000);
    }
    res.json({ success: true, arena: db.activeArenaGame, user });
});

// دریافت بونوس / گیفت‌کد
app.post('/api/bonus/claim', (req, res) => {
    const { id, code } = req.body;
    const user = db.users[id];
    const bonus = db.bonuses[code];
    if (!user || !bonus) return res.status(400).json({ error: 'کد نامعتبر است.' });
    if (bonus.usedCount >= bonus.maxUses) return res.status(400).json({ error: 'ظرفیت این بونوس تکمیل شده است.' });
    if (user.claimedBonuses.includes(code)) return res.status(400).json({ error: 'شما قبلاً این بونوس را دریافت کرده‌اید.' });

    bonus.usedCount += 1;
    user.claimedBonuses.push(code);
    user.balance += bonus.amount;
    user.history.unshift(`+${bonus.amount} 💎 (بونوس/گیفت‌کد)`);
    res.json({ success: true, user });
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
        tasks: db.tasks
    });
});

app.post('/api/admin/update-settings', (req, res) => {
    const { adminId, feePercent, dailyActive, dailyAmount, forceChannel } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();

    db.settings.feePercent = Number(feePercent);
    db.settings.dailyBonusActive = dailyActive;
    db.settings.dailyBonusAmount = Number(dailyAmount);
    db.settings.forceChannel = forceChannel;
    res.json({ success: true });
});

app.post('/api/admin/create-bonus', (req, res) => {
    const { adminId, code, amount, maxUses } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json();

    db.bonuses[code] = { amount: Number(amount), maxUses: Number(maxUses), usedCount: 0 };
    res.json({ success: true, link: `https://t.me/YourBot?start=bonus_${code}` });
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
        bot.sendMessage(chatId, `👑 پنل مدیریت کامل **POKER GIFT** فعال شد.`, {
            reply_markup: { inline_keyboard: [[{ text: '🚀 ورود به مینی‌اپ و مدیریت', web_app: { url: WEB_APP_URL } }]] }
        });
    }
});

bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const param = match ? match[1] : null;
    const user = getOrCreateUser(chatId, msg.from.first_name, msg.from.username);

    if (param && param.startsWith('bonus_')) {
        const code = param.replace('bonus_', '');
        const bonus = db.bonuses[code];
        if (bonus && bonus.usedCount < bonus.maxUses && !user.claimedBonuses.includes(code)) {
            bonus.usedCount += 1;
            user.claimedBonuses.push(code);
            user.balance += bonus.amount;
            bot.sendMessage(chatId, `🎉 تبریک! مبلغ ${bonus.amount} 💎 بونوس به حساب شما واریز شد.`);
        } else {
            bot.sendMessage(chatId, `❌ این بونوس نامعتبر، منقضی یا قبلاً استفاده شده است.`);
        }
    }

    bot.sendMessage(chatId, `♠️♥️ به پلتفرم **POKER GIFT** خوش آمدید!\n\nبرای ورود به بازی‌ها و مدیریت حساب روی دکمه زیر کلیک کنید:`, {
        reply_markup: { inline_keyboard: [[{ text: '🎲 ورود به مینی‌اپ POKER GIFT', web_app: { url: WEB_APP_URL } }]] }
    });
});

app.listen(PORT, () => console.log(`POKER GIFT Server running on port ${PORT}`));
