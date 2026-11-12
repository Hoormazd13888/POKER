const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));

let adminStates = {}; 
let giveaways = {};   

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  resetAdmin(chatId);
  sendStartMenu(chatId);
});

function sendStartMenu(chatId) {
  bot.sendMessage(chatId, `🤖 به ربات مدیریت قرعه‌کشی خوش آمدید.\n\nبرای ساخت قرعه‌کشی جدید روی دکمه زیر کلیک کنید:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 ساخت قرعه‌کشی جدید', callback_data: 'start_giveaway' }]
      ]
    }
  });
}

function resetAdmin(chatId) {
  delete adminStates[chatId];
}

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  if (query.data === 'start_giveaway') {
    adminStates[chatId] = {
      step: 'BANNER_URL',
      data: { participants: [], ticketsBought: 0 }
    };
    bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید** (مرحله ۱ از ۵)\n\nلطفاً **لینک عکس بنر** (آدرس اینترنتی تصویر) را ارسال کنید:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ لغو ساخت', callback_data: 'cancel_gw' }]]
      }
    });
    bot.answerCallbackQuery(query.id);
  } else if (query.data === 'cancel_gw') {
    resetAdmin(chatId);
    bot.sendMessage(chatId, `❌ عملیات لغو شد.`);
    sendStartMenu(chatId);
    bot.answerCallbackQuery(query.id);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (!adminStates[chatId]) {
    return; // اگر در حال ساخت نیست، پیام را نادیده بگیر
  }

  const state = adminStates[chatId];

  if (state.step === 'BANNER_URL') {
    state.data.bannerUrl = text.trim();
    state.step = 'PRIZE';
    bot.sendMessage(chatId, `✅ لینک بنر ثبت شد.\n\n🏆 **مرحله ۲ از ۵:**\nعنوان یا نوع جایزه قرعه‌کشی را بنویسید (مثلاً: ۱۰۰ تون‌کوین):`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
  }
  else if (state.step === 'PRIZE') {
    state.data.prize = text.trim();
    state.step = 'DESC';
    bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\n📝 **مرحله ۳ از ۵:**\nتوضیحات قرعه‌کشی را بنویسید (اگر ندارید، کلمه «رد» را بفرستید):`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
  }
  else if (state.step === 'DESC') {
    state.data.description = text.trim() === 'رد' ? '' : text.trim();
    state.step = 'TYPE';
    bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\n⚙️ **مرحله ۴ از ۵:**\nنوع قرعه‌کشی را انتخاب کنید:\n1️⃣ رایگان (با لینک دعوت)\n2️⃣ تیکتی (خرید با Telegram Stars)\n\nعدد 1 یا 2 را بفرستید:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
  }
  else if (state.step === 'TYPE') {
    if (text.trim() === '1') {
      state.data.type = 'FREE';
      state.step = 'TIME';
      bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
    } else if (text.trim() === '2') {
      state.data.type = 'TICKET';
      state.step = 'TICKET_DETAILS';
      bot.sendMessage(chatId, `🎫 فرمت قیمت و تعداد کل تیکت‌ها را بفرستید:\n\`قیمت_استارز تعداد_کل\`\nمثال: \`5 10\``, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً فقط عدد 1 یا 2 را بفرستید.`);
    }
  }
  else if (state.step === 'TICKET_DETAILS') {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      state.data.ticketPrice = parseInt(parts[0]);
      state.data.maxTickets = parseInt(parts[1]);
      state.step = 'CHANNEL';
      bot.sendMessage(chatId, `📢 **مرحله ۵ (آخر):**\nآیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
    } else {
      bot.sendMessage(chatId, `⚠️ فرمت اشتباه است. مثال: \`5 10\``, { parse_mode: 'Markdown' });
    }
  }
  else if (state.step === 'TIME') {
    const minutes = parseInt(text);
    if (!isNaN(minutes)) {
      state.data.durationMinutes = minutes;
      state.step = 'CHANNEL';
      bot.sendMessage(chatId, `📢 **مرحله ۵ (آخر):**\nآیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
    }
  }
  else if (state.step === 'CHANNEL') {
    const channel = text.trim();
    state.data.channel = channel;

    const giveawayId = 'gw_' + Date.now();
    giveaways[giveawayId] = state.data;
    resetAdmin(chatId);

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
      bot.sendMessage(chatId, `❌ خطا در ارسال به کانال (مطمئن شوید ربات در کانال ادمین است): ${e.message}`);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Bot running on port ${PORT}`); });
