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
  delete adminStates[chatId];
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

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  if (query.data === 'start_giveaway') {
    adminStates[chatId] = {
      step: 'BANNER_PHOTO',
      data: { participants: [], ticketsBought: 0 }
    };
    bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید** (مرحله ۱ از ۵)\n\nلطفاً **عکس بنر** قرعه‌کشی را مستقیماً از گالری ارسال کنید:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ لغو ساخت', callback_data: 'cancel_gw' }]]
      }
    });
    bot.answerCallbackQuery(query.id);
  } else if (query.data === 'cancel_gw') {
    delete adminStates[chatId];
    bot.sendMessage(chatId, `❌ عملیات لغو شد.`);
    sendStartMenu(chatId);
    bot.answerCallbackQuery(query.id);
  }
});

// دریافت عکس بنر (مرحله ۱)
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (!adminStates[chatId]) return;
  const state = adminStates[chatId];

  if (state.step === 'BANNER_PHOTO') {
    const photo = msg.photo;
    state.data.bannerPhotoId = photo[photo.length - 1].file_id;
    state.step = 'PRIZE';
    
    bot.sendMessage(chatId, `✅ عکس بنر دریافت شد.\n\n🏆 **مرحله ۲ از ۵:**\nعنوان یا نوع جایزه قرعه‌کشی را بنویسید (مثلاً: ۱۰۰ تون‌کوین):`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
  }
});

// مدیریت تمام مراحل متنی با switch-case دقیق
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (!adminStates[chatId]) return;
  const state = adminStates[chatId];
  const cleanText = text.trim();

  switch (state.step) {
    case 'PRIZE':
      state.data.prize = cleanText;
      state.step = 'DESC';
      bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\n📝 **مرحله ۳ از ۵:**\nتوضیحات قرعه‌کشی را بنویسید (اگر ندارید، کلمه «رد» را بفرستید):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
      break;

    case 'DESC':
      state.data.description = cleanText === 'رد' ? '' : cleanText;
      state.step = 'TYPE';
      bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\n⚙️ **مرحله ۴ از ۵:**\nنوع قرعه‌کشی را انتخاب کنید:\n1️⃣ رایگان (با لینک دعوت)\n2️⃣ تیکتی (خرید با Telegram Stars)\n\nلطفاً عدد 1 یا 2 را بفرستید:`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
      break;

    case 'TYPE':
      if (cleanText === '1') {
        state.data.type = 'FREE';
        state.step = 'TIME';
        bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else if (cleanText === '2') {
        state.data.type = 'TICKET';
        state.step = 'TICKET_DETAILS';
        bot.sendMessage(chatId, `🎫 فرمت قیمت و تعداد کل تیکت‌ها را با فاصله بفرستید:\nمثال: \`5 10\` (یعنی ۵ استارز و ۱۰ تیکت کل)`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ لطفاً فقط عدد 1 یا 2 را بفرستید.`);
      }
      break;

    case 'TICKET_DETAILS':
      const parts = cleanText.split(/\s+/);
      if (parts.length >= 2) {
        state.data.ticketPrice = parseInt(parts[0]);
        state.data.maxTickets = parseInt(parts[1]);
        state.step = 'CHANNEL';
        bot.sendMessage(chatId, `✅ جزئیات تیکت ثبت شد.\n\n📢 **مرحله ۵ (آخر):**\nآیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ فرمت اشتباه است. مثال: \`5 10\``, { parse_mode: 'Markdown' });
      }
      break;

    case 'TIME':
      const minutes = parseInt(cleanText);
      if (!isNaN(minutes)) {
        state.data.durationMinutes = minutes;
        state.step = 'CHANNEL';
        bot.sendMessage(chatId, `✅ زمان ثبت شد.\n\n📢 **مرحله ۵ (آخر):**\nآیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
      }
      break;

    case 'CHANNEL':
      const channel = cleanText;
      state.data.channel = channel;

      const giveawayId = 'gw_' + Date.now();
      giveaways[giveawayId] = state.data;
      delete adminStates[chatId];

      try {
        const botInfo = await bot.getMe();
        const sentMsg = await bot.sendPhoto(channel, state.data.bannerPhotoId, {
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
      break;
  }
});

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
