const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const express = require('express');
const path = require('path');

const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// دیتابیس حافظه موقت
let db = {
  adminId: null, 
  adminWallet: 'UQD...AdminWalletAddressHere...', 
  channels: [], // لیست کانال‌هایی که ربات در آن‌ها قیمت می‌فرستد
  sendIntervalHours: 1, // زمان ارسال هر پیام (پیش‌فرض هر ۱ ساعت)
  userBalances: {}, // { userId: balanceTon }
  subscriptions: {}, // { userId: { expireAt, channels: [] } }
  prices: { 
    1: { days: 7, price: 1 }, 
    2: { days: 30, price: 3 } 
  }
};

let adminStates = {};

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

    bot.sendMessage(chatId, `⚙️ **پنل مدیریت پیشرفته ادمین**\n\n- والت: \`${db.adminWallet}\`\n- تعداد کانال‌ها: ${db.channels.length}\n- زمان ارسال: هر ${db.sendIntervalHours} ساعت`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 تغییر والت دریافت تون', callback_data: 'set_wallet' }],
          [{ text: '➕ افزودن کانال جدید', callback_data: 'add_channel' }],
          [{ text: '⏱️ تنظیم زمان ارسال پیام', callback_data: 'set_interval' }],
          [{ text: '💵 مدیریت واریز و افزایش موجودی', callback_data: 'add_balance' }],
          [{ text: '🏷️ تعیین قیمت اشتراک‌ها', callback_data: 'set_prices' }],
          [{ text: '📢 لیست کانال‌ها', callback_data: 'list_channels' }]
        ]
      }
    });
  } else if (query.data === 'set_wallet') {
    if (userId !== db.adminId) return;
    adminStates[userId] = 'WAITING_FOR_WALLET';
    bot.sendMessage(chatId, `لطفاً آدرس جدید والت ادمین را بفرستید:`);
  } else if (query.data === 'add_channel') {
    if (userId !== db.adminId) return;
    adminStates[userId] = 'WAITING_FOR_CHANNEL';
    bot.sendMessage(chatId, `لطفاً آیدی کانال (مثلاً @ChannelID یا آیدی عددی) را بفرستید (اطمینان حاصل کنید ربات در کانال ادمین است):`);
  } else if (query.data === 'set_interval') {
    if (userId !== db.adminId) return;
    adminStates[userId] = 'WAITING_FOR_INTERVAL';
    bot.sendMessage(chatId, `تعداد ساعات بین هر ارسال را وارد کنید (مثلاً عدد 1 برای هر ساعت):`);
  } else if (query.data === 'add_balance') {
    if (userId !== db.adminId) return;
    adminStates[userId] = 'WAITING_FOR_BALANCE';
    bot.sendMessage(chatId, `فرمت را به این شکل بفرستید (آیدی عددی و مبلغ):\n\`UserID Amount\`\nمثال: \`123456789 5\``, { parse_mode: 'Markdown' });
  } else if (query.data === 'set_prices') {
    if (userId !== db.adminId) return;
    adminStates[userId] = 'WAITING_FOR_PRICES';
    bot.sendMessage(chatId, `فرمت قیمت‌ها را به این صورت بفرستید (روز و قیمت):\n\`Days Price\`\nمثال برای ۷ روز با ۱ تون: \`7 1\``, { parse_mode: 'Markdown' });
  } else if (query.data === 'list_channels') {
    if (userId !== db.adminId) return;
    const list = db.channels.length > 0 ? db.channels.join('\n') : 'هیچ کانالی ثبت نشده است.';
    bot.sendMessage(chatId, `📢 **لیست کانال‌های ربات:**\n\n${list}`, { parse_mode: 'Markdown' });
  }
});

// دریافت پیام‌های متنی ادمین برای مدیریت
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (userId !== db.adminId || !adminStates[userId]) return;

  const state = adminStates[userId];

  if (state === 'WAITING_FOR_WALLET') {
    db.adminWallet = text.trim();
    delete adminStates[userId];
    bot.sendMessage(chatId, `✅ والت ادمین ثبت شد.`);
  } else if (state === 'WAITING_FOR_CHANNEL') {
    const ch = text.trim();
    if (!db.channels.includes(ch)) db.channels.push(ch);
    delete adminStates[userId];
    bot.sendMessage(chatId, `✅ کانال ${ch} با موفقیت اضافه شد.`);
  } else if (state === 'WAITING_FOR_INTERVAL') {
    const hours = parseInt(text);
    if (!isNaN(hours) && hours > 0) {
      db.sendIntervalHours = hours;
      delete adminStates[userId];
      bot.sendMessage(chatId, `✅ زمان ارسال هر ${hours} ساعت تنظیم شد.`);
    } else {
      bot.sendMessage(chatId, `❌ مقدار نامعتبر است. یک عدد صحیح وارد کنید.`);
    }
  } else if (state === 'WAITING_FOR_BALANCE') {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      const targetUser = parts[0];
      const amount = parseFloat(parts[1]);
      if (!db.userBalances[targetUser]) db.userBalances[targetUser] = 0;
      db.userBalances[targetUser] += amount;
      delete adminStates[userId];
      bot.sendMessage(chatId, `✅ موجودی کاربر ${targetUser} به میزان ${amount} تون افزایش یافت.`);
    } else {
      bot.sendMessage(chatId, `❌ فرمت اشتباه است. مثال: 123456789 5`);
    }
  } else if (state === 'WAITING_FOR_PRICES') {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      const days = parseInt(parts[0]);
      const price = parseFloat(parts[1]);
      const newId = Date.now();
      db.prices[newId] = { days, price };
      delete adminStates[userId];
      bot.sendMessage(chatId, `✅ پلن اشتراک ${days} روزه با قیمت ${price} تون اضافه شد.`);
    } else {
      bot.sendMessage(chatId, `❌ فرمت اشتباه است. مثال: 7 1`);
    }
  }
});

// ارسال خودکار قیمت به تمام کانال‌های ثبت شده بر اساس زمان تنظیم شده توسط ادمین
setInterval(async () => {
  const { usd, tomman } = await getTonPrices();
  const emoji = '🟢'; 

  for (const channelId of db.channels) {
    const text = `💎 **TONCOIN PRICE UPDATE**\n\n` +
                 `💵 قیمت دلار: **$${usd}** ${emoji}\n` +
                 `🇮🇷 قیمت تومان: **${tomman} تومان**\n\n` +
                 `⏰ ساعت و تاریخ: ${new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}`;

    bot.sendMessage(channelId, text, { parse_mode: 'Markdown' }).catch(err => console.log('Channel send error:', err.message));
  }
}, db.sendIntervalHours * 60 * 60 * 1000);

app.get('/api/data/:userId', (req, res) => {
  const userId = req.params.userId;
  const sub = db.subscriptions[userId] || { expireAt: 0, channels: [] };
  res.json({
    wallet: db.adminWallet,
    plans: db.prices,
    balance: db.userBalances[userId] || 0,
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

    bot.sendMessage(userId, `✅ پرداخت تایید شد! اشتراک ${plan.days} روزه شما فعال گردید.`);
    return res.json({ success: true, message: 'پرداخت تایید شد' });
  } else {
    return res.json({ success: false, message: 'تراکنش در بلاک‌چین تایید نشد.' });
  }
});

app.post('/api/set-channel', (req, res) => {
  const { userId, channelUsername } = req.body;
  const cleanChannel = channelUsername.trim();
  if (!db.channels.includes(cleanChannel)) {
    db.channels.push(cleanChannel);
  }
  res.json({ success: true, message: 'کانال با موفقیت ثبت شد' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
