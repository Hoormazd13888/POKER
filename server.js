const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));

let adminStates = {}; 
let giveaways = {};   

// شروع با دستور /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'مدیر';

  bot.sendMessage(chatId, `سلام ${firstName} عزیز! 🤖\nبه ربات مدیریت قرعه‌کشی خوش آمدید.\n\nبرای ساخت قرعه‌کشی روی دکمه زیر کلیک کنید:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 ساخت قرعه‌کشی جدید', callback_data: 'start_giveaway' }]
      ]
    }
  });
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  if (query.data === 'start_giveaway') {
    startGiveawayProcess(chatId);
    bot.answerCallbackQuery(query.id);
  }
});

function startGiveawayProcess(chatId) {
  adminStates[chatId] = {
    step: 'BANNER_URL',
    data: { participants: [], ticketsBought: 0 }
  };

  bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید**\n\nمرحله ۱ از ۵:\nلطفاً **لینک عکس بنر** (یا آدرس اینترنتی تصویر) را ارسال کنید:`, { parse_mode: 'Markdown' });
}

// مدیریت مراحل با متن
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!adminStates[chatId]) return;
  const state = adminStates[chatId];

  // مرحله ۱: دریافت لینک بنر
  if (state.step === 'BANNER_URL') {
    state.data.bannerUrl = text.trim();
    state.step = 'PRIZE';
    bot.sendMessage(chatId, `✅ لینک بنر ثبت شد.\n\nمرحله ۲ از ۵:\nعنوان یا نوع **جایزه قرعه‌کشی** را بنویسید (مثلاً: ۱۰۰ تون‌کوین):`);
  }
  // مرحله ۲: جایزه
  else if (state.step === 'PRIZE') {
    state.data.prize = text;
    state.step = 'DESC';
    bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\nمرحله ۳ از ۵:\n**توضیحات قرعه‌کشی** را بنویسید (اگر ندارید، کلمه «رد» را بفرستید):`);
  }
  // مرحله ۳: توضیحات
  else if (state.step === 'DESC') {
    state.data.description = text === 'رد' ? '' : text;
    state.step = 'TYPE';
    bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\nمرحله ۴ از ۵:\nنوع قرعه‌کشی را انتخاب کنید:\n1️⃣ **رایگان** (با لینک دعوت)\n2️⃣ **تیکتی** (خرید با Telegram Stars)\n\nعدد **1** یا **2** را بفرستید:`, { parse_mode: 'Markdown' });
  }
  // مرحله ۴: نوع
  else if (state.step === 'TYPE') {
    if (text === '1') {
      state.data.type = 'FREE';
      state.step = 'TIME';
      bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, { parse_mode: 'Markdown' });
    } else if (state.data.type === 'TICKET' || text === '2') {
      state.data.type = 'TICKET';
      state.step = 'TICKET_DETAILS';
      bot.sendMessage(chatId, `🎫 فرمت قیمت و تعداد کل تیکت‌ها را بفرستید:\n\`قیمت_استارز تعداد_کل\`\nمثال: \`5 10\``, { parse_mode: 'Markdown' });
    }
  }
  else if (state.step === 'TICKET_DETAILS') {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      state.data.ticketPrice = parseInt(parts[0]);
      state.data.maxTickets = parseInt(parts[1]);
      state.step = 'CHANNEL';
      bot.sendMessage(chatId, `مرحله ۵ (آخر): آیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `فرمت اشتباه است. مثال: \`5 10\``, { parse_mode: 'Markdown' });
    }
  }
  else if (state.step === 'TIME') {
    const minutes = parseInt(text);
    if (!isNaN(minutes)) {
      state.data.durationMinutes = minutes;
      state.step = 'CHANNEL';
      bot.sendMessage(chatId, `مرحله ۵ (آخر): آیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
    }
  }
  // مرحله آخر: انتشار در کانال
  else if (state.step === 'CHANNEL') {
    const channel = text.trim();
    state.data.channel = channel;

    const giveawayId = 'gw_' + Date.now();
    giveaways[giveawayId] = state.data;
    delete adminStates[chatId];

    try {
      const botInfo = await bot.getMe();
      const sentMsg = await bot.sendPhoto(channel, state.data.bannerUrl, {
        caption: `🎁 **قرعه‌کشی بزرگ: ${state.data.prize}**\n\n📝 ${state.data.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: 0\n${state.data.type === 'TICKET' ? `🎫 تیکت‌ها: 0 از ${state.data.maxTickets}` : ''}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }]
          ]
        }
      });

      state.data.bannerMessageId = sentMsg.message_id;
      bot.sendMessage(chatId, `🎉 قرعه‌کشی با موفقیت در کانال ${channel} منتشر شد!`);

      if (state.data.type === 'FREE' && state.data.durationMinutes) {
        setTimeout(async () => {
          await finishGiveaway(giveawayId);
        }, state.data.durationMinutes * 60 * 1000);
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ خطا: مطمئن شوید ربات در کانال ادمین است و لینک عکس معتبر می‌باشد. (${e.message})`);
    }
  }
});

// استارت شرکت کاربران
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const giveawayId = match[1].split('_')[0];

  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) {
    return bot.sendMessage(chatId, `❌ این قرعه‌کشی به پایان رسیده یا وجود ندارد.`);
  }

  const alreadyJoined = gw.participants.some(p => p.id === userId);
  if (!alreadyJoined) {
    gw.participants.push({ id: userId, name: firstName });
    bot.sendMessage(chatId, `✅ شما با موفقیت در قرعه‌کشی شرکت کردید!`);
    updateBannerCaption(giveawayId);
  } else {
    bot.sendMessage(chatId, `⚠️ شما قبلاً ثبت‌نام کرده‌اید.`);
  }
});

async function updateBannerCaption(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || !gw.channel || !gw.bannerMessageId) return;
  const botInfo = await bot.getMe();

  const newCaption = `🎁 **قرعه‌کشی بزرگ: ${gw.prize}**\n\n📝 ${gw.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: ${gw.participants.length}\n${gw.type === 'TICKET' ? `🎫 تیکت‌ها: ${gw.ticketsBought} از ${gw.maxTickets}` : ''}`;

  try {
    await bot.editMessageCaption(newCaption, {
      chat_id: gw.channel,
      message_id: gw.bannerMessageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }]
        ]
      }
    });
  } catch (e) {}
}

async function finishGiveaway(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) return;
  gw.finished = true;

  if (gw.participants.length > 0) {
    const winner = gw.participants[Math.floor(Math.random() * gw.participants.length)];
    bot.sendMessage(gw.channel, `🏆 **برنده قرعه‌کشی (${gw.prize}) مشخص شد!**\n\n🎉 تبریک به کاربر: [${winner.name}](tg://user?id=${winner.id})\n\nلطفاً برای دریافت جایزه به ادمین پیام دهید.`, { parse_mode: 'Markdown' });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Bot running on port ${PORT}`); });
