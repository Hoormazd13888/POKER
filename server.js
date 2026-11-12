const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Giveaway Bot is running!'));

// دیتابیس در حافظه موقت برای مراحل ساخت قرعه‌کشی و ذخیره داده‌ها
let adminStates = {}; // ذخیره مرحله ساخت توسط ادمین
let giveaways = {};   // ذخیره اطلاعات قرعه‌کشی‌های فعال { giveawayId: { ... } }

// دستور شروع ساخت قرعه‌کشی (فقط برای ادمین یا در پی‌وی ادمین)
bot.onText(/\/newgiveaway/, (msg) => {
  const chatId = msg.chat.id;
  
  adminStates[chatId] = {
    step: 'BANNER',
    data: { participants: [], ticketsBought: 0 }
  };

  bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید**\n\nمرحله ۱ از ۵:\nلطفاً **عکس بنر** قرعه‌کشی را ارسال کنید.`, { parse_mode: 'Markdown' });
});

// مدیریت مراحل ساخت و پاسخ‌های ادمین
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const photo = msg.photo;

  if (!adminStates[chatId]) return;
  const state = adminStates[chatId];

  // مرحله ۱: دریافت عکس بنر
  if (state.step === 'BANNER') {
    if (photo && photo.length > 0) {
      state.data.bannerFileId = photo[photo.length - 1].file_id;
      state.step = 'PRIZE';
      bot.sendMessage(chatId, `✅ بنر دریافت شد.\n\nمرحله ۲ از ۵:\nلطفاً عنوان یا نوع **جایزه قرعه‌کشی** را بنویسید (مثلاً: ۱۰۰ تون‌کوین):`);
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً یک تصویر (عکس) به عنوان بنر ارسال کنید.`);
    }
  }
  // مرحله ۲: دریافت جایزه
  else if (state.step === 'PRIZE') {
    state.data.prize = text;
    state.step = 'DESC';
    bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\nمرحله ۳ از ۵:\n**توضیحات قرعه‌کشی** را بنویسید (اگر توضیحی ندارید، کلمه «رد» را بفرستید):`);
  }
  // مرحله ۳: توضیحات
  else if (state.step === 'DESC') {
    state.data.description = text === 'رد' ? '' : text;
    state.step = 'TYPE';
    bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\nمرحله ۴ از ۵:\nنوع قرعه‌کشی را انتخاب کنید:\n1️⃣ **رایگان** (با دعوت دوستان / لینک دعوت)\n2️⃣ **تیکتی** (خرید با Telegram Stars)\n\nلطفاً عدد **1** یا **2** را بفرستید:`);
  }
  // مرحله ۴: نوع قرعه‌کشی (رایگان یا تیکتی) + زمان‌بندی یا تعداد تیکت
  else if (state.step === 'TYPE') {
    if (text === '1') {
      state.data.type = 'FREE';
      state.step = 'TIME';
      bot.sendMessage(chatId, `⏰ قرعه‌کشی رایگان انتخاب شد.\n\nمدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`);
    } else if (text === '2') {
      state.data.type = 'TICKET';
      state.step = 'TICKET_DETAILS';
      bot.sendMessage(chatId, `🎫 قرعه‌کشی تیکتی انتخاب شد.\n\nفرمت را به این شکل بفرستید (قیمت هر تیکت به استارز و کل تیکت‌های لازم):\n\`قیمت_استارز تعداد_کل\`\nمثال (یعنی هر تیکت ۵ استارز و کل سقف ۱۰ تیکت):\n\`5 10\``, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً فقط عدد 1 یا 2 را بفرستید.`);
    }
  }
  // دریافت جزئیات تیکت
  else if (state.step === 'TICKET_DETAILS') {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      state.data.ticketPrice = parseInt(parts[0]);
      state.data.maxTickets = parseInt(parts[1]);
      state.step = 'CHANNELS';
      bot.sendMessage(chatId, `✅ تنظیم شد.\n\nمرحله ۵ از ۵ (آخر):\nآیدی کانال‌ها یا گروه‌هایی که بنر باید داخلشان ارسال شود را با کاما (,) جدا کنید بفرستید (مثلاً: \`@Channel1, @Channel2\`):`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `⚠️ فرمت اشتباه است. مثال: \`5 10\``, { parse_mode: 'Markdown' });
    }
  }
  // دریافت زمان (برای حالت رایگان)
  else if (state.step === 'TIME') {
    const minutes = parseInt(text);
    if (!isNaN(minutes)) {
      state.data.durationMinutes = minutes;
      state.step = 'CHANNELS';
      bot.sendMessage(chatId, `✅ زمان تنظیم شد.\n\nمرحله ۵ از ۵ (آخر):\nآیدی کانال‌ها یا گروه‌هایی که بنر باید داخلشان ارسال شود را بفرستید (مثلاً: \`@Channel1\``);
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
    }
  }
  // مرحله آخر: کانال‌ها، انتشار بنر و راه‌اندازی تایمر/دکمه‌ها
  else if (state.step === 'CHANNELS') {
    const channels = text.split(',').map(c => c.trim());
    state.data.channels = channels;

    const giveawayId = 'gw_' + Date.now();
    giveaways[giveawayId] = state.data;
    delete adminStates[chatId];

    // ارسال بنر به کانال‌های مقصد با دکمه‌های شیشه‌ای
    for (const channel of channels) {
      try {
        await bot.sendPhoto(channel, state.data.bannerFileId, {
          caption: `🎁 **قرعه‌کشی بزرگ: ${state.data.prize}**\n\n📝 ${state.data.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: 0\n${state.data.type === 'TICKET' ? `🎫 تیکت‌ها: 0 از ${state.data.maxTickets}` : ''}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${bot.options.username}?start=${giveawayId}` }
              ],
              [
                { text: '👥 شرکت‌کنندگان: 0 نفر', callback_data: `participants_${giveawayId}` }
              ]
            ]
          }
        });
      } catch (e) {
        bot.sendMessage(chatId, `❌ خطا در ارسال به کانال ${channel}: ${e.message}`);
      }
    }

    bot.sendMessage(chatId, `🎉 قرعه‌کشی با موفقیت ساخته شد و در کانال‌های مورد نظر منتشر گردید!`);

    // اگر زمان‌دار بود، تایمر را فعال کن
    if (state.data.type === 'FREE' && state.data.durationMinutes) {
      setTimeout(async () => {
        await finishGiveaway(giveawayId);
      }, state.data.durationMinutes * 60 * 1000);
    }
  }
});

// وقتی کاربر دکمه استارت ربات را با پارامتر قرعه‌کشی می‌زند
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const giveawayId = match[1];

  const gw = giveaways[giveawayId];
  if (!gw) {
    return bot.sendMessage(chatId, `❌ این قرعه‌کشی به پایان رسیده یا وجود ندارد.`);
  }

  // بررسی تکراری نبودن شرکت‌کننده
  if (!gw.participants.includes(userId)) {
    gw.participants.push({ id: userId, name: firstName });

    if (gw.type === 'TICKET') {
      // در حالت تیکتی، کاربر باید استارز پرداخت کند
      bot.sendInvoice(
        chatId,
        'خرید تیکت قرعه‌کشی',
        `خرید تیکت برای جایزه: ${gw.prize}`,
        `ticket_${giveawayId}`,
        'XTR', // ارز Telegram Stars
        [{ label: 'تیکت قرعه‌کشی', amount: gw.ticketPrice }]
      );
    } else {
      bot.sendMessage(chatId, `✅ شما با موفقیت در قرعه‌کشی شرکت کردید!\n\n🔗 لینک دعوت اختصاصی شما برای افزایش شانس:\n\`https://t.me/${bot.options.username}?start=${giveawayId}_${userId}\``, { parse_mode: 'Markdown' });
    }
  } else {
    bot.sendMessage(chatId, `⚠️ شما قبلاً در این قرعه‌کشی شرکت کرده‌اید.`);
  }
});

// تایید پرداخت موفق Telegram Stars برای قرعه‌کشی‌های تیکتی
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🎉 پرداخت استارز با موفقیت انجام شد! تیکت شما ثبت گردید.`);
});

// تابع پایان خودکار قرعه‌کشی و اعلام برنده
async function finishGiveaway(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) return;
  gw.finished = true;

  if (gw.participants.length === 0) {
    for (const channel of gw.channels) {
      bot.sendMessage(channel, `⏰ زمان قرعه‌کشی به پایان رسید اما هیچ‌کس شرکت نکرده بود!`);
    }
    return;
  }

  // انتخاب تصادفی برنده
  const winnerIndex = Math.floor(Math.random() * gw.participants.length);
  const winner = gw.participants[winnerIndex];

  // اعلام برنده در کانال‌ها
  for (const channel of gw.channels) {
    await bot.sendMessage(channel, `🏆 **برنده قرعه‌کشی (${gw.prize}) مشخص شد!**\n\n🎉 تبریک به کاربر: [${winner.name}](tg://user?id=${winner.id})\n\nلطفاً جهت دریافت جایزه به پی‌وی ادمین پیام دهید.`, { parse_mode: 'Markdown' });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Giveaway Bot running on port ${PORT}`);
});
