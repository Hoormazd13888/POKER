const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// توکن جدید ربات شما
const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Giveaway Bot is running!'));

let adminStates = {}; 
let giveaways = {};   

// دستور شروع ساخت قرعه‌کشی در پی‌وی ادمین
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
  // مرحله ۴: نوع قرعه‌کشی (رایگان یا تیکتی)
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
      bot.sendMessage(chatId, `✅ تنظیم شد.\n\nمرحله ۵ از ۵ (آخر):\nآیدی کانال یا گروهی که بنر باید داخلش ارسال شود را بفرستید (مثلاً: \`@ChannelName\`):`, { parse_mode: 'Markdown' });
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
      bot.sendMessage(chatId, `✅ زمان تنظیم شد.\n\nمرحله ۵ از ۵ (آخر):\nآیدی کانال یا گروهی که بنر باید داخلش ارسال شود را بفرستید (مثلاً: \`@ChannelName\`):`);
    } else {
      bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
    }
  }
  // مرحله آخر: کانال مقصد، انتشار بنر و راه‌اندازی
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
            [
              { text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }
            ],
            [
              { text: '👥 شرکت‌کنندگان: 0 نفر', callback_data: `participants_${giveawayId}` }
            ]
          ]
        }
      });

      state.data.bannerMessageId = sentMsg.message_id;
      bot.sendMessage(chatId, `🎉 قرعه‌کشی با موفقیت ساخته شد و در کانال ${channel} منتشر گردید!`);

      // تایمر پایان قرعه‌کشی رایگان
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

// ورود کاربر به ربات از طریق لینک بنر
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const param = match[1];

  let giveawayId = param;
  if (param.includes('_')) {
    giveawayId = param.split('_')[0];
  }

  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) {
    return bot.sendMessage(chatId, `❌ این قرعه‌کشی به پایان رسیده یا وجود ندارد.`);
  }

  // بررسی عضویت جوین اجباری (اگر کانال ست شده باشد)
  if (gw.channel) {
    try {
      const chatMember = await bot.getChatMember(gw.channel, userId);
      if (['left', 'kicked'].includes(chatMember.status)) {
        return bot.sendMessage(chatId, `⚠️ برای شرکت در قرعه‌کشی باید ابتدا در کانال زیر عضو شوید:\n\n👉 ${gw.channel}\n\nپس از عضویت، دوباره روی لینک قرعه‌کشی کلیک کنید.`);
      }
    } catch (err) {
      console.log('Error checking chat member:', err.message);
    }
  }

  // بررسی تکراری نبودن
  const alreadyJoined = gw.participants.some(p => p.id === userId);
  if (!alreadyJoined) {
    gw.participants.push({ id: userId, name: firstName });

    if (gw.type === 'TICKET') {
      gw.ticketsBought++;
      bot.sendInvoice(
        chatId,
        'خرید تیکت قرعه‌کشی',
        `خرید تیکت برای جایزه: ${gw.prize}`,
        `ticket_${giveawayId}`,
        'XTR',
        [{ label: 'تیکت قرعه‌کشی', amount: gw.ticketPrice }]
      );
    } else {
      const botInfo = await bot.getMe();
      bot.sendMessage(chatId, `✅ شما با موفقیت در قرعه‌کشی شرکت کردید!\n\n🔗 لینک دعوت اختصاصی شما:\n\`https://t.me/${botInfo.username}?start=${giveawayId}_${userId}\``, { parse_mode: 'Markdown' });
    }

    // آپدیت زنده تعداد نفرات روی بنر کانال
    updateBannerCaption(giveawayId);

    // اگر مدل تیکتی بود و ظرفیت تکمیل شد
    if (gw.type === 'TICKET' && gw.ticketsBought >= gw.maxTickets) {
      finishGiveaway(giveawayId);
    }
  } else {
    bot.sendMessage(chatId, `⚠️ شما قبلاً در این قرعه‌کشی شرکت کرده‌اید.`);
  }
});

// آپدیت متن بنر در کانال
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
          [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }],
          [{ text: `👥 شرکت‌کنندگان: ${gw.participants.length} نفر`, callback_data: `participants_${giveawayId}` }]
        ]
      }
    });
  } catch (e) {
    console.log('Error updating caption:', e.message);
  }
}

// پرداخت موفق استارز
bot.on('pre_checkout_query', (query) => bot.answerPreCheckoutQuery(query.id, true));
bot.on('successful_payment', (msg) => {
  bot.sendMessage(msg.chat.id, `🎉 پرداخت استارز تایید شد و تیکت شما ثبت گردید.`);
});

// پایان قرعه‌کشی و اعلام برنده
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
  console.log(`Giveaway Bot running on port ${PORT}`);
});
