const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// توکن ربات
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

// آدرس دامنه شما در Render (حتماً با لینک واقعی سرویس خود جایگزین کنید)
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://poker.onrender.com';

// دیتابیس مرکزی در حافظه (قابل ارتقا به PostgreSQL)
const db = {
    admins: [], // اولین نفری که /admin بزند اضافه می‌شود
    users: {},
    tournaments: [
        { id: 1, title: '🏆 تورنمنت روزانه ARENA', prize: '5000 امتیاز + نشان VIP', status: 'فعال' },
        { id: 2, title: '🔥 لیگ هفتگی پادشاهان TON', prize: '25000 امتیاز + اسکین طلایی', status: 'در حال ثبت‌نام' }
    ],
    shopItems: [
        { id: 'skin_gold', name: '👑 اسکین طلایی میز', price: 1500, currency: 'PTS' },
        { id: 'vip_pass', name: '💎 اشتراک VIP ماهانه', price: 2.5, currency: 'TON' },
        { id: 'avatar_pro', name: '🦁 آواتار اختصاصی آرنا', price: 800, currency: 'PTS' }
    ],
    transactions: []
};

// دریافت یا ساخت پروفایل کاربر
function getOrCreateUser(id, name = 'بازیکن', username = '') {
    if (!db.users[id]) {
        db.users[id] = {
            id,
            name,
            username,
            points: 1000,
            level: 1,
            wins: 0,
            losses: 0,
            referrals: 0,
            banned: false,
            vip: false,
            inventory: [],
            missions: { dailyClaimed: false },
            history: ['ثبت‌نام در پلتفرم ARENA | TON']
        };
    }
    return db.users[id];
}

// --- API های ارتباطی مینی‌اپ ---

// دریافت اطلاعات کامل کاربر و سیستم
app.post('/api/sync', (req, res) => {
    const { id, first_name, username, ref } = req.body;
    if (!id) return res.status(400).json({ error: 'Invalid User' });

    const isNew = !db.users[id];
    const user = getOrCreateUser(id, first_name, username);

    if (isNew && ref && db.users[ref] && ref != id) {
        db.users[ref].referrals += 1;
        db.users[ref].points += 500;
        db.users[ref].history.unshift(`دعوت موفق کاربر ${first_name} (+500 امتیاز)`);
    }

    if (user.banned) return res.status(403).json({ error: 'حساب شما مسدود شده است.' });

    // رتبه‌بندی
    const leaderboard = Object.values(db.users)
        .sort((a, b) => b.points - a.points)
        .slice(0, 10)
        .map(u => ({ name: u.name, points: u.points, level: u.level, vip: u.vip }));

    res.json({
        user,
        leaderboard,
        tournaments: db.tournaments,
        shopItems: db.shopItems,
        isAdmin: db.admins.includes(Number(id))
    });
});

// ثبت نتیجه بازی
app.post('/api/game-result', (req, res) => {
    const { id, gameName, won, pointsChange } = req.body;
    const user = db.users[id];
    if (!user || user.banned) return res.status(403).json({ error: 'Access denied' });

    if (won) {
        user.wins += 1;
        user.points += pointsChange;
        user.history.unshift(`برد در ${gameName} (+${pointsChange} امتیاز)`);
    } else {
        user.losses += 1;
        user.points = Math.max(0, user.points - pointsChange);
        user.history.unshift(`باخت در ${gameName} (-${pointsChange} امتیاز)`);
    }
    user.level = Math.floor(user.points / 1000) + 1;

    res.json({ user });
});

// دریافت پاداش مأموریت روزانه
app.post('/api/claim-mission', (req, res) => {
    const { id } = req.body;
    const user = db.users[id];
    if (!user) return res.status(404).json({ error: 'Not found' });

    if (user.missions.dailyClaimed) {
        return res.status(400).json({ error: 'پاداش امروز قبلاً دریافت شده است.' });
    }
    user.missions.dailyClaimed = true;
    user.points += 300;
    user.history.unshift('تکمیل مأموریت روزانه (+300 امتیاز)');
    res.json({ user });
});

// خرید از فروشگاه
app.post('/api/buy-item', (req, res) => {
    const { id, itemId, txHash } = req.body;
    const user = db.users[id];
    const item = db.shopItems.find(i => i.id === itemId);
    if (!user || !item) return res.status(400).json({ error: 'Invalid request' });

    if (item.currency === 'PTS') {
        if (user.points < item.price) return res.status(400).json({ error: 'امتیاز کافی نیست!' });
        user.points -= item.price;
    } else if (item.currency === 'TON') {
        db.transactions.push({ userId: id, item: item.name, amount: item.price, hash: txHash || 'TON_CONNECT_TX', date: new Date().toLocaleString('fa-IR') });
        if (item.id === 'vip_pass') user.vip = true;
    }

    user.inventory.push(item.name);
    user.history.unshift(`خرید ${item.name}`);
    res.json({ user });
});

// API پنل ادمین
app.post('/api/admin/stats', (req, res) => {
    const { id } = req.body;
    if (!db.admins.includes(Number(id))) return res.status(403).json({ error: 'Unauthorized' });

    const allUsers = Object.values(db.users);
    res.json({
        totalUsers: allUsers.length,
        totalGames: allUsers.reduce((acc, u) => acc + u.wins + u.losses, 0),
        totalTx: db.transactions.length,
        usersList: allUsers,
        transactions: db.transactions
    });
});

app.post('/api/admin/ban', (req, res) => {
    const { adminId, targetId } = req.body;
    if (!db.admins.includes(Number(adminId))) return res.status(403).json({ error: 'Unauthorized' });
    if (db.users[targetId]) {
        db.users[targetId].banned = !db.users[targetId].banned;
    }
    res.json({ success: true });
});

// --- دستورات ربات تلگرام ---

bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    if (db.admins.length === 0 || db.admins.includes(chatId)) {
        if (!db.admins.includes(chatId)) db.admins.push(chatId);
        bot.sendMessage(chatId, `👑 دسترسی **مدیر ارشد ARENA | TON** برای شما فعال شد.\nوارد مینی‌اپ شوید تا تب **پنل مدیریت** را مشاهده کنید.`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🚀 ورود به مینی‌اپ و پنل مدیریت', web_app: { url: WEB_APP_URL } }]]
            }
        });
    } else {
        bot.sendMessage(chatId, '⛔ شما دسترسی مدیریت ندارید.');
    }
});

bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'بازیکن';
    const refParam = match[1] ? `?ref=${match[1]}` : '';

    getOrCreateUser(chatId, name, msg.from.username);

    const text = `⚔️ **به دنیای رقابت ARENA | TON خوش آمدید!**\n\n` +
                 `سلام ${name} عزیز؛ پلتفرم جامع بازی‌های رقابتی، تورنمنت‌ها و پاداش‌های مبتنی بر شبکه **TON** آماده است.\n\n` +
                 `👇 برای ورود به محیط گرافیکی مینی‌اپ روی دکمه زیر کلیک کنید:`;

    bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎮 ورود به مینی‌اپ ARENA | TON', web_app: { url: `${WEB_APP_URL}${refParam}` } }],
                [{ text: '📢 کانال رسمی ما', url: 'https://t.me/Tel_Shop26' }]
            ]
        }
    });
});

app.listen(PORT, () => console.log(`ARENA | TON Server running on port ${PORT}`));
