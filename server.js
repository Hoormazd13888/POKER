const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const express = require('express');
const path = require('path');

const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db = {
  adminId: null, 
  adminWallet: 'UQD...AdminWalletAddressHere...', // آدرس والت ادمین برای دریافت تون
  channels: [], 
  subscriptions: {}, 
  prices: { 1: { days: 7, price: 1 }, 2: { days: 30, price: 3 } }
};

async function getTonPrices() {
  try {
    const resUsd = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
    const dataUsd = await resUsd.json();
    const priceUsd = dataUsd['the-open-network']?.usd || 5.0;
    const priceTomman = Math.round(priceUsd * 60000); 

    return { usd: priceUsd.toFixed(2), tomman: priceTomman.toLocaleString('fa-IR') };
  } catch (err) {
    return { usd: '5.00', tomman: '300,000' };
  }
}

async function verifyTonTransaction(commentMemo, expectedAmount) {
  try {
    const url = `https://tonapi.io/v2/blockchain/accounts/${db.adminWallet}/transactions?limit=10`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.transactions) return false;

    for (const tx of data.transactions) {
      if (tx.in_msg && tx.in_msg.comment === String(commentMemo)) {
        const valueTon = tx.in_msg.value / 1e9; 
        if (valueTon >= parseFloat(expectedAmount)) {
          return true; 
        }
      }
    }
    return false;
  } catch (e) {
    console.error('Error verifying tx:', e);
    return false;
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'کاربر';
  const webAppUrl = 'https://poker-xqj6.onrender.com/';

  bot.sendMessage(chatId, `سلام ${firstName} عزیز! 💎\nبه ربات مدیریت کانال‌های قیمت TON خوش آمدید.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛒 خرید / تمدید اشتراک', web_app: { url: webAppUrl } }],
        [{ text: '⚙️ پنل مدیریت ادمین', callback_data: 'admin_panel' }]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.data === 'admin_panel') {
    if (!db.adminId) db.adminId = userId; 
    if (userId !== db.adminId) {
      return bot.answerCallbackQuery(query.id, { text: 'شما دسترسی ادمین ندارید!', show_alert: true });
    }

    bot.sendMessage(chatId, `⚙️ **پنل مدیریت ادمین**\n\n- والت ثبت شده: \`${db.adminWallet}\`\n- تعداد کانال‌ها: ${db.channels.length}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 تنظیم والت دریافت تون', callback_data: 'set_wallet' }],
          [{ text: '📢 مدیریت کانال‌ها', callback_data: 'manage_channels' }]
        ]
      }
    });
  }
});

// ارسال خودکار قیمت به کانال همراه با تاریخ و ساعت ایران و ایموجی وضعیت
setInterval(async () => {
  const now = Date.now();
  const { usd, tomman } = await getTonPrices();
  const emoji = '🟢'; // 🟢 برای صعودی/ثابت، 🔴 برای نزولی

  for (const [userId, sub] of Object.entries(db.subscriptions)) {
    if (sub.expireAt > now) {
      for (const channelId of sub.channels) {
        const text = `💎 **TONCOIN PRICE UPDATE**\n\n` +
                     `💵 قیمت دلار: **$${usd}** ${emoji}\n` +
                     `🇮🇷 قیمت تومان: **${tomman} تومان**\n\n` +
                     `⏰ ساعت و تاریخ: ${new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}`;

        bot.sendMessage(channelId, text, { parse_mode: 'Markdown' }).catch(err => console.log('Channel send error:', err.message));
      }
    } else {
      bot.sendMessage(userId, `⚠️ اشتراک شما در ربات به پایان رسید. لطفاً اشتراک خود را تمدید کنید.`);
      delete db.subscriptions[userId];
    }
  }
}, 60 * 60 * 1000);

app.get('/api/data/:userId', (req, res) => {
  const userId = req.params.userId;
  const sub = db.subscriptions[userId] || { active: false };
  res.json({
    wallet: db.adminWallet,
    plans: db.prices,
    subscription: sub
  });
});

app.post('/api/verify-payment', async (req, res) => {
  const { userId, planId } = req.body;
  const plan = db.prices[planId];
  if (!plan) return res.status(400).json({ success: false, message: 'پلن نامعتبر است' });

  const isPaid = await verifyTonTransaction(userId, plan.price);

  if (isPaid) {
    const expireTime = Date.now() + (plan.days * 24 * 60 * 60 * 1000);
    db.subscriptions[userId] = {
      expireAt: expireTime,
      durationDays: plan.days,
      channels: db.subscriptions[userId]?.channels || []
    };

    bot.sendMessage(userId, `✅ پرداخت شما با موفقیت تایید شد!\nاشتراک ${plan.days} روزه شما فعال گردید.`);
    return res.json({ success: true, message: 'پرداخت تایید شد' });
  } else {
    setTimeout(async () => {
      if (db.adminId && !db.subscriptions[userId]?.active) {
        bot.sendMessage(db.adminId, `⚠️ تراکنش کاربر \`${userId}\` برای خرید پلن ${plan.days} روزه تایید نشد یا نیاز به بررسی دستی دارد.`);
      }
    }, 5 * 60 * 1000);

    return res.json({ success: false, message: 'تراکنش هنوز در بلاک‌چین تایید نشده است. لطفاً چند دقیقه دیگر تلاش کنید.' });
  }
});

app.post('/api/set-channel', (req, res) => {
  const { userId, channelUsername } = req.body;
  if (!db.subscriptions[userId] || db.subscriptions[userId].expireAt < Date.now()) {
    return res.status(403).json({ success: false, message: 'اشتراک فعال ندارید!' });
  }

  if (!db.subscriptions[userId].channels.includes(channelUsername)) {
    db.subscriptions[userId].channels.push(channelUsername);
    if (!db.channels.includes(channelUsername)) db.channels.push(channelUsername);
  }

  res.json({ success: true, message: 'کانال با موفقیت ثبت شد' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
