const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));

let adminStates = {}; 
let giveaways = {};   

// پاسخ قطعی و سریع به دستور /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'مدیر';

  bot.sendMessage(chatId, `سلام ${firstName} عزیز! 🤖\nبه ربات مدیریت قرعه‌کشی خوش آمدید.\n\nبرای شروع ساخت قرعه‌کشی روی دکمه زیر کلیک کنید یا دستور /newgiveaway را بفرستید:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 ساخت قرعه‌کشی جدید', callback_data: 'start_giveaway' }]
      ]
    }
  });
});

bot.onText(/\/newgiveaway/, (msg) => {
  startGiveawayProcess(msg.chat.id);
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
    step: 'BANNER',
    data: { participants: [], ticketsBought: 0 }
  };

  bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید**\n\nمرحله ۱ از ۵:\nلطفاً **عکس بنر** قرعه‌کشی را ارسال کنید.`, { parse_mode: 'Markdown' });
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const photo = msg.photo;

  if (!adminStates[chatId]) return;
  const state = adminStates[chatId];

  if (state.step === 'BANNER') {
    if (photo && photo.length > 0) {
      state.data.bannerFileId = photo[photo.length - 1].file_id;
      state.step = 'PRIZE';
      bot.sendMessage(chatId, `✅ بنر دریافت شد.\n\nمرحله ۲ از ۵:\nلطفاً عنوان یا نوع **جایزه قرعه‌کشی** را بنویسید (مثلاً: ۱۰۰ تون‌کوین):`);
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً یک تصویر (عکس) به عنوان بنر ارسال کنید.`);
    }
  }
  else if (state.step === 'PRIZE') {
    state.data.prize = text;
    state.step = 'DESC';
    bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\nمرحله ۳ از ۵:\n**توضیحات قرعه‌کشی** را بنویسید (اگر توضیحی ندارید، کلمه «رد» را بفرستید):`);
  }
  else if (state.step === 'DESC') {
    state.data.description = text === 'رد' ? '' : text;
    state.step = 'TYPE';
    bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\nمرحله ۴ از ۵:\nنوع قرعه‌کشی را انتخاب کنید:\n1️⃣ **رایگان** (با دعوت دوستان / لینک دعوت)\n2️⃣ **تیکتی** (خرید با Telegram Stars)\n\nلطفاً عدد **1** یا **2** را بفرستید:`);
  }
  else if (state.step === 'TYPE') {
    if (text === '1') {
      state.data.type = 'FREE';
      state.step = 'TIME';
      bot.sendMessage(chatId, `⏰ قرعه‌کشی رایگان انتخاب شد.\n\nمدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`);
    } else if (text === '2') {
      state.data.type = 'TICKET';
      state.step = 'TICKET_DETAILS';
      bot.sendMessage(chatId, `🎫 قرعه‌کشی تیکتی انتخاب شد.\n\nفرمت را به این شکل بفرستید (قیمت هر تیکت به استارز و کل تیکت‌های لازم):\n\`قیمت_استارز تعداد_کل\`\nمثال: \`5 10\``, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً فقط عدد 1 یا 2 را بفرستید.`);
    }
  }
  else if (state.step === 'TICKET_DETAILS') {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      state.data.ticketPrice = parseInt(parts[0]);
      state.data.maxTickets = parseInt(parts[1]);
      state.step = 'CHANNELS';
      bot.sendMessage(chatId, `✅ تنظیم شد.\n\nمرحله ۵ از ۵ (آخر):\nآیدی کانال یا گروهی که بنر باید داخلش ارسال شود را بفرستید (مثلاً: \`@ChannelName\`):`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `⚠️ فرمت اشتباه است. مثال: \`5 10\``, { parse_mode: 'Markdown' });
    }
  }
  else if (state.step === 'TIME') {
    const minutes = parseInt(text);
    if (!isNaN(minutes)) {
      state.data.durationMinutes = minutes;
      state.step = 'CHANNELS';
      bot.sendMessage(chatId, `✅ زمان تنظیم شد.\n\nمرحله ۵ از ۵ (آخر):\nآیدی کانال یا گروهی که بنر باید داخلش ارسال شود را بفرستید (مثلاً: \`@ChannelName\`):`);
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
    }
  }
  else if (state.step === 'CHANNELS') {
    const channel = text.trim();
    state.data.channel = channel;

    const giveawayId = 'gw_' + Date.now();
    giveaways[giveawayId] = state.data;
    delete adminStates[chatId];

    try {
      const botInfo = await bot.getMe();
      const sentMsg = await bot.sendPhoto(channel, state.data.bannerFileId, {
        caption: `🎁 **قرعه‌کشی بزرگ: ${state.data.prize}**\n\n📝 ${state.data.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: 0\n${state.data.type === 'TICKET' ? `🎫 تیکت‌ها: 0 از ${state.data.maxTickets}` : ''}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }],
            [{ text: '👥 شرکت‌کنندگان: 0 نفر', callback_data: `participants_${giveawayId}` }]
          ]
        }
      });

      state.data.bannerMessageId = sentMsg.message_id;
      bot.sendMessage(chatId, `🎉 قرعه‌کشی با موفقیت ساخته شد و در کانال ${channel} منتشر گردید!`);

      if (state.data.type === 'FREE' && state.data.durationMinutes) {
        setTimeout(async () => {
          await finishGiveaway(giveawayId);
        }, state.data.durationMinutes * 60 * 1000);
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ خطا در ارسال به کانال (مطمئن شوید ربات در کانال ادمین است): ${e.message}`);
    }
  }
});

async function finishGiveaway(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) return;
  gw.finished = true;

  if (gw.participants.length === 0) {
    if (gw.channel) {
      bot.sendMessage(gw.channel, `⏰ زمان قرعه‌کشی به پایان رسید اما هیچ‌کس شرکت نکرده بود!`);
    }
    return;
  }

  const winnerIndex = Math.floor(Math.random() * gw.participants.length);
  const winner = gw.participants[winnerIndex];

  if (gw.channel) {
    await bot.sendMessage(gw.channel, `🏆 **برنده قرعه‌کشی (${gw.prize}) مشخص شد!**\n\n🎉 تبریک به کاربر: [${winner.name}](tg://user?id=${winner.id})\n\nلطفاً جهت دریافت جایزه به پی‌وی ادمین پیام دهید.`, { parse_mode: 'Markdown' });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
