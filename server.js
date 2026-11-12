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

// مدیریت تمام مراحل متنی با قابلیت‌پذیرش بالا
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
      if (cleanText.includes('1') || cleanText.includes('رایگان')) {
        state.data.type = 'FREE';
        state.step = 'TIME';
        bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else if (cleanText.includes('2') || cleanText.includes('تیکت')) {
        state.data.type = 'TICKET';
        state.step = 'TICKET_DETAILS';
        bot.sendMessage(chatId, `🎫 قیمت هر تیکت و تعداد کل تیکت‌ها را با فاصله بفرستید:\nمثال: \`5 10\` (یعنی ۵ استارز و ۱۰ تیکت کل)`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ لطفاً فقط عدد 1 یا 2 را بفرستید.`);
      }
      break;

    case 'TICKET_DETAILS':
      // استخراج تمام اعداد موجود در پیام کاربر به صورت امن
      const numbers = cleanText.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        state.data.ticketPrice = parseInt(numbers[0]);
        state.data.maxTickets = parseInt(numbers[1]);
        state.step = 'CHANNEL';
        bot.sendMessage(chatId, `✅ جزئیات تیکت ثبت شد (قیمت: ${state.data.ticketPrice} | کل تیکت‌ها: ${state.data.maxTickets}).\n\n📢 **مرحله ۵ (آخر):**\nآیدی کانال یا گروه مقصد را بفرستید (مثلاً: \`@ChannelName\`):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ لطفاً دو عدد با فاصله بفرستید. مثال: \`5 10\``, { parse_mode: 'Markdown' });
      }
      break;

    case 'TIME':
      const minutes = parseInt(cleanText);
      if (!isNaN(minutes)) {
        state.data.durationMinutes = minutes;

      
