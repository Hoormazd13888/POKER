const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));

let adminId = null; 
let adminStates = {}; 
let giveaways = {};   

// دستور اختصاصی ادمین برای پنل مدیریت
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!adminId) {
    adminId = chatId;
  }

  if (chatId !== adminId) {
    return bot.sendMessage(chatId, `⚠️ **دسترسی غیرمجاز!**\nاین ربات انحصاری است و شما دسترسی ادمین ندارید.`, { parse_mode: 'Markdown' });
  }

  delete adminStates[chatId];
  sendAdminMenu(chatId);
});

function sendAdminMenu(chatId) {
  bot.sendMessage(chatId, `❄️ **پنل مدیریت ربات POKER**\n\n🤖 خوش آمدید ادمین عزیز. برای ساخت قرعه‌کشی جدید روی دکمه زیر کلیک کنید:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 ساخت قرعه‌کشی جدید', callback_data: 'start_giveaway' }]
      ]
    }
  });
}

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  if (data === 'start_giveaway') {
    if (userId !== adminId) {
      return bot.answerCallbackQuery(query.id, { text: 'شما ادمین نیستید!', show_alert: true });
    }

    adminStates[chatId] = {
      step: 'BANNER_PHOTO',
      data: { participants: [], ticketsBought: 0 }
    };
    bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید** (مرحله ۱ از ۶)\n\nلطفاً **عکس بنر** قرعه‌کشی را مستقیماً از گالری ارسال کنید:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ لغو ساخت', callback_data: 'cancel_gw' }]]
      }
    });
    bot.answerCallbackQuery(query.id);
  } else if (data === 'cancel_gw') {
    if (userId !== adminId) return;
    delete adminStates[chatId];
    bot.sendMessage(chatId, `❌ عملیات لغو شد.`);
    sendAdminMenu(chatId);
    bot.answerCallbackQuery(query.id);
  } 
  // انتخاب نوع قرعه‌کشی از طریق کلیک روی دکمه شیشه‌ای (جلوگیری از گیر کردن در مرحله ۵)
  else if (data === 'type_free') {
    if (userId !== adminId || !adminStates[chatId]) return;
    adminStates[chatId].data.type = 'FREE';
    adminStates[chatId].step = 'TIME';
    bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
    bot.answerCallbackQuery(query.id);
  } else if (data === 'type_ticket') {
    if (userId !== adminId || !adminStates[chatId]) return;
    adminStates[chatId].data.type = 'TICKET';
    adminStates[chatId].step = 'TICKET_DETAILS';
    bot.sendMessage(chatId, `🎫 قیمت هر تیکت و تعداد کل تیکت‌ها را با فاصله بفرستید:\nمثال: \`5 3\` (یعنی ۵ استارز و ۳ تیکت کل)`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
    bot.answerCallbackQuery(query.id);
  } else if (data.startsWith('info_')) {
    const giveawayId = data.split('_')[1];
    const gw = giveaways[giveawayId];
    if (gw) {
      bot.answerCallbackQuery(query.id, { 
        text: `👥 شرکت‌کنندگان: ${gw.participants.length} نفر\n🎫 تیکت‌ها: ${gw.ticketsBought} از ${gw.maxTickets || 'نامحدود'}`, 
        show_alert: true 
      });
    } else {
      bot.answerCallbackQuery(query.id, { text: 'اطلاعاتی یافت نشد.', show_alert: true });
    }
  }
});

// دریافت عکس بنر توسط ادمین (مرحله ۱)
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== adminId || !adminStates[chatId]) return;
  const state = adminStates[chatId];

  if (state.step === 'BANNER_PHOTO') {
    const photo = msg.photo;
    state.data.bannerPhotoId = photo[photo.length - 1].file_id;
    state.step = 'PRIZE';
    
    bot.sendMessage(chatId, `✅ عکس بنر دریافت شد.\n\n🏆 **مرحله ۲ از ۶:**\nعنوان یا نوع جایزه قرعه‌کشی را بنویسید (مثلاً: قرعه‌کشی تدی):`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
  }
});

// مدیریت دقیق تمام مراحل متنی ادمین
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (chatId === adminId && adminStates[chatId]) {
    const state = adminStates[chatId];
    const cleanText = text.trim();

    switch (state.step) {
      case 'PRIZE':
        state.data.prize = cleanText;
        state.step = 'DESC';
        bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\n📝 **مرحله ۳ از ۶:**\nتوضیحات قرعه‌کشی را بنویسید (اگر ندارید، کلمه «رد» را بفرستید):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
        break;

      case 'DESC':
        state.data.description = cleanText === 'رد' ? '' : cleanText;
        state.step = 'WINNERS_COUNT';
        bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\n👥 **مرحله ۴ از ۶:**\nتعداد برندگان قرعه‌کشی را وارد کنید (مثلاً: 1 یا 3):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
        break;

      case 'WINNERS_COUNT':
        const winnersCount = parseInt(cleanText);
        if (!isNaN(winnersCount) && winnersCount > 0) {
          state.data.winnersCount = winnersCount;
          state.step = 'TYPE';
          bot.sendMessage(chatId, `✅ تعداد برندگان (${winnersCount} نفر) ثبت شد.\n\n⚙️ **مرحله ۵ از ۶:**\nنوع قرعه‌کشی را انتخاب کنید (روی یکی از دکمه‌های زیر کلیک کنید):`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '1️⃣ رایگان (لینک دعوت)', callback_data: 'type_free' },
                  { text: '2️⃣ تیکتی (Telegram Stars)', callback_data: 'type_ticket' }
                ],
                [{ text: '❌ لغو', callback_data: 'cancel_gw' }]
              ]
            }
          });
        } else {
          bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر برای تعداد برندگان وارد کنید.`);
        }
        break;

      case 'TYPE':
        // برای پشتیبانی از حالت تایپ دستی هم این بخش حفظ شده است
        if (cleanText === '1' || cleanText.includes('رایگان')) {
          state.data.type = 'FREE';
          state.step = 'TIME';
          bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
          });
        } else if (cleanText === '2' || cleanText.includes('تیکت')) {
          state.data.type = 'TICKET';
          state.step = 'TICKET_DETAILS';
          bot.sendMessage(chatId, `🎫 قیمت هر تیکت و تعداد کل تیکت‌ها را با فاصله بفرستید:\nمثال: \`5 3\` (یعنی ۵ استارز و ۳ تیکت کل)`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
          });
        } else {
          bot.sendMessage(chatId, `⚠️ لطفاً روی یکی از دکمه‌های بالا کلیک کنید یا عدد 1 یا 2 را بفرستید.`);
        }
        break;

      case 'TICKET_DETAILS':
        const numbers = cleanText.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
          state.data.ticketPrice = parseInt(numbers[0]);
          state.data.maxTickets = parseInt(numbers[1]);
          state.step = 'CHANNELS';
          bot.sendMessage(chatId, `✅ جزئیات تیکت ثبت شد.\n\n📢 **مرحله ۶ (آخر):**\nآیدی یا لینک کانال‌ها را بفرستید (**هر کانال در یک خط جداگانه**):`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
          });
        } else {
          bot.sendMessage(chatId, `⚠️ فرمت اشتباه است. مثال: \`5 3\``, { parse_mode: 'Markdown' });
        }
        break;

      case 'TIME':
        const minutes = parseInt
            case 'TIME':
      const minutes = parseInt(cleanText);
      if (!isNaN(minutes)) {
        state.data.durationMinutes = minutes;
        state.step = 'CHANNELS';
        bot.sendMessage(chatId, `✅ زمان ثبت شد.\n\n📢 **مرحله ۶ (آخر):**\nآیدی یا لینک کانال‌ها را بفرستید (**هر کانال در یک خط جداگانه**):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
      }
      break;

    case 'CHANNELS':
      const channels = cleanText.split('\n').map(c => c.trim()).filter(c => c.length > 0);
      state.data.channels = channels;

      const giveawayId = 'gw_' + Date.now();
      giveaways[giveawayId] = state.data;
      delete adminStates[chatId];

      const botInfo = await bot.getMe();
      let successCount = 0;

      for (const ch of channels) {
        try {
          const captionText = `🎁 **قرعه‌کشی بزرگ: ${state.data.prize}**\n\n📝 ${state.data.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: 0\n🎫 تیکت‌ها: 0 از ${state.data.maxTickets || 0}`;
          
          const sentMsg = await bot.sendPhoto(ch, state.data.bannerPhotoId, {
            caption: captionText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }],
                [{ text: `🎫 تیکت‌ها: 0 از ${state.data.maxTickets || 0}`, callback_data: `info_${giveawayId}` }]
              ]
            }
          });
          state.data.bannerMessageId = sentMsg.message_id;
          successCount++;
        } catch (e) {
          bot.sendMessage(chatId, `❌ خطا در ارسال به کانال ${ch}: ${e.message}`);
        }
      }

      bot.sendMessage(chatId, `🎉 قرعه‌کشی با موفقیت در ${successCount} کانال منتشر شد!`);

      if (state.data.type === 'FREE' && state.data.durationMinutes) {
        setTimeout(async () => {
          await finishGiveaway(giveawayId);
        }, state.data.durationMinutes * 60 * 1000);
      }
      break;
  }
});

// مدیریت دستور استارت کاربران برای شرکت یا خرید تیکت
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
    if (gw.type === 'TICKET') {
      if (gw.ticketsBought >= gw.maxTickets) {
        return bot.sendMessage(chatId, `❌ ظرفیت تیکت‌های این قرعه‌کشی تکمیل شده است.`);
      }
      bot.sendInvoice(
        chatId,
        'خرید تیکت قرعه‌کشی',
        `خرید تیکت برای جایزه: ${gw.prize}`,
        `ticket_${giveawayId}_${userId}`,
        'XTR',
        [{ label: 'تیکت لاتاری', amount: gw.ticketPrice }]
      );
    } else {
      gw.participants.push({ id: userId, name: firstName });
      bot.sendMessage(chatId, `✅ شما با موفقیت در قرعه‌کشی شرکت کردید!`);
      updateAllBanners(giveawayId);
    }
  } else {
    bot.sendMessage(chatId, `⚠️ شما قبلاً در این قرعه‌کشی شرکت کرده‌اید.`);
  }
});

// پیام خوش‌آمدگویی برای کاربران عادی
bot.onText(/\/start$/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId === adminId) return;

  bot.sendMessage(chatId, `❄️ **سلام و احترام به ربات رسمی POKER خوش آمدید.**\n\n🤖 این سیستم پلتفرم هوشمند مدیریت و اجرای چالش‌های رایگان کانال و لاتاری‌های معتبر بر پایه ستارگان تلگرام می‌باشد.\n\n⚠️ دسترسی به قابلیت‌های این ربات انحصاری است و استفاده عمومی آزاد نیست.`, { parse_mode: 'Markdown' });
});

bot.on('pre_checkout_query', (query) => bot.answerPreCheckoutQuery(query.id, true));

bot.on('successful_payment', (msg) => {
  const chatId = msg.chat.id;
  const payload = msg.successful_payment.invoice_payload; 
  const parts = payload.split('_');
  const giveawayId = parts[1] + '_' + parts[2];
  const userId = parseInt(parts[3]);
  const firstName = msg.from.first_name;

  const gw = giveaways[giveawayId];
  if (gw && !gw.finished) {
    gw.ticketsBought++;
    if (!gw.participants.some(p => p.id === userId)) {
      gw.participants.push({ id: userId, name: firstName });
    }

    bot.sendMessage(chatId, `❄️ **پرداخت شما تایید شد.**\n\n✅ بلیت لاتاری با موفقیت خریداری شد!\n🎫 تکت شما در دیتابیس ثبت شد.`, { parse_mode: 'Markdown' });
    updateAllBanners(giveawayId);

    if (gw.ticketsBought >= gw.maxTickets) {
      finishGiveaway(giveawayId);
    }
  }
});

async function updateAllBanners(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || !gw.channels) return;
  const botInfo = await bot.getMe();

  const newCaption = `🎁 **قرعه‌کشی بزرگ: ${gw.prize}**\n\n📝 ${gw.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: ${gw.participants.length}\n🎫 تیکت‌ها: ${gw.ticketsBought} از ${gw.maxTickets || 0}`;

  for (const ch of gw.channels) {
    try {
      await bot.editMessageCaption(newCaption, {
        chat_id: ch,
        message_id: gw.bannerMessageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }],
            [{ text: `🎫 تیکت‌ها: ${gw.ticketsBought} از ${gw.maxTickets || 0}`, callback_data: `info_${giveawayId}` }]
          ]
        }
      });
    } catch (e) {}
  }
}

async function finishGiveaway(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) return;
  gw.finished = true;

  if (gw.participants.length > 0) {
    let winnersList = [];
    let tempParticipants = [...gw.participants];
    let count = Math.min(gw.winnersCount || 1, tempParticipants.length);

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * tempParticipants.length);
      winnersList.push(tempParticipants.splice(randomIndex, 1)[0]);
    }

    const winnersText = winnersList.map(w => `[${w.name}](tg://user?id=${w.id})`).join('\n');

    for (const ch of gw.channels) {
      bot.sendMessage(ch, `🏆 **برندگان قرعه‌کشی (${gw.prize}) مشخص شدند!**\n\n🎉 تبریک به نفرات برتر:\n${winnersText}\n\nلطفاً برای دریافت جایزه به ادمین پیام دهید.`, { parse_mode: 'Markdown' });
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Bot running on port ${PORT}`); });
