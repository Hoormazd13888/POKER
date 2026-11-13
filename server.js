const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const TOKEN = '9289298651:AAFFN5vCUIf8EBsmdTrn12DtOGBKonO2G4k';
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));

let adminId = null; 
let adminStates = {}; 
let giveaways = {};   

// تابع تبدیل اعداد فارسی/عربی به انگلیسی
function convertPersianNumbersToEnglish(str) {
  if (!str) return '';
  const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = str.toString();
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianNumbers[i], 'g'), i).replace(new RegExp(arabicNumbers[i], 'g'), i);
  }
  return result;
}

// دستور /admin برای تعیین یا ورود ادمین اصلی
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!adminId) {
    adminId = userId; // ثبت اولین کاربری که /admin بفرستد به عنوان ادمین
  }

  if (userId !== adminId) {
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

// بررسی کامل و امن رویداد دکمه‌های شیشه‌ای
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  // بررسی دکمه‌های مربوط به شرکت‌کنندگان (برای همه کاربران آزاد است)
  if (data.startsWith('info_')) {
    const giveawayId = data.replace('info_', '');
    const gw = giveaways[giveawayId];
    if (gw) {
      const infoText = gw.type === 'TICKET' 
        ? `🎫 تیکت‌های فروخته شده: ${gw.ticketsBought} از ${gw.maxTickets}` 
        : `👥 تعداد شرکت‌کنندگان: ${gw.participants.length} نفر`;
      bot.answerCallbackQuery(query.id, { text: infoText, show_alert: true });
    } else {
      bot.answerCallbackQuery(query.id, { text: 'اطلاعاتی یافت نشد یا قرعه‌کشی به پایان رسیده است.', show_alert: true });
    }
    return;
  }

  // بررسی دکمه بررسی عضویت جوین اجباری
  if (data.startsWith('check_')) {
    const giveawayId = data.replace('check_', '');
    const gw = giveaways[giveawayId];
    if (!gw || gw.finished) {
      return bot.answerCallbackQuery(query.id, { text: '❌ این قرعه‌کشی پایان یافته است.', show_alert: true });
    }
    await checkMembershipAndJoin(chatId, userId, query.from.first_name || 'کاربر', giveawayId, query.id);
    return;
  }

  // دکمه‌های پنل ادمین (فقط ادمین اصلی)
  if (adminId && userId !== adminId) {
    return bot.answerCallbackQuery(query.id, { text: 'شما ادمین نیستید!', show_alert: true });
  }

  if (data === 'start_giveaway') {
    adminStates[chatId] = {
      step: 'BANNER_PHOTO',
      data: { participants: [], ticketsBought: 0 }
    };
    bot.sendMessage(chatId, `🎁 **ساخت قرعه‌کشی جدید** (مرحله ۱ از ۷)\n\nلطفاً **عکس بنر** قرعه‌کشی را مستقیماً از گالری ارسال کنید:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ لغو ساخت', callback_data: 'cancel_gw' }]]
      }
    });
    bot.answerCallbackQuery(query.id);
  } else if (data === 'cancel_gw') {
    delete adminStates[chatId];
    bot.sendMessage(chatId, `❌ عملیات لغو شد.`);
    sendAdminMenu(chatId);
    bot.answerCallbackQuery(query.id);
  } else if (data === 'type_free') {
    if (!adminStates[chatId]) return;
    adminStates[chatId].data.type = 'FREE';
    adminStates[chatId].step = 'TIME';
    bot.sendMessage(chatId, `⏰ مدت زمان قرعه‌کشی به **دقیقه** را وارد کنید (مثلاً: 60):`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
    bot.answerCallbackQuery(query.id);
  } else if (data === 'type_ticket') {
    if (!adminStates[chatId]) return;
    adminStates[chatId].data.type = 'TICKET';
    adminStates[chatId].step = 'TICKET_DETAILS';
    bot.sendMessage(chatId, `🎫 قیمت هر تیکت و تعداد کل تیکت‌ها را با فاصله بفرستید:\nمثال: \`5 3\` (یعنی ۵ استارز و ۳ تیکت کل)`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
    });
    bot.answerCallbackQuery(query.id);
  }
});

// مدیریت جامع پیام‌های متنی و عکس‌های ادمین در ویزارد
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!adminId || userId !== adminId) return;
  if (!adminStates[chatId]) return;

  const state = adminStates[chatId];

  // مرحله ۱: دریافت عکس بنر
  if (state.step === 'BANNER_PHOTO') {
    if (msg.photo && msg.photo.length > 0) {
      const photo = msg.photo;
      state.data.bannerPhotoId = photo[photo.length - 1].file_id;
      state.step = 'PRIZE';
      
      return bot.sendMessage(chatId, `✅ عکس بنر دریافت شد.\n\n🏆 **مرحله ۲ از ۷:**\nعنوان یا نوع جایزه قرعه‌کشی را بنویسید (مثلاً: قرعه‌کشی تدی):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
    } else {
      return bot.sendMessage(chatId, `⚠️ لطفاً حتماً یک **عکس** (تصویر) بنر از گالری ارسال کنید.`);
    }
  }

  const text = msg.text;
  if (!text || text.startsWith('/')) return;
  const cleanText = convertPersianNumbersToEnglish(text.trim());

  switch (state.step) {
    case 'PRIZE':
      state.data.prize = text.trim();
      state.step = 'DESC';
      bot.sendMessage(chatId, `✅ جایزه ثبت شد.\n\n📝 **مرحله ۳ از ۷:**\nتوضیحات قرعه‌کشی را بنویسید (اگر ندارید، کلمه «رد» را بفرستید):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
      break;

    case 'DESC':
      state.data.description = text.trim() === 'رد' ? '' : text.trim();
      state.step = 'WINNERS_COUNT';
      bot.sendMessage(chatId, `✅ توضیحات ثبت شد.\n\n👥 **مرحله ۴ از ۷:**\nتعداد برندگان قرعه‌کشی را وارد کنید (مثلاً: 1 یا 3):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
      break;

    case 'WINNERS_COUNT':
      const winnersCount = parseInt(cleanText, 10);
      if (!isNaN(winnersCount) && winnersCount > 0) {
        state.data.winnersCount = winnersCount;
        state.step = 'TYPE';
        bot.sendMessage(chatId, `✅ تعداد برندگان (${winnersCount} نفر) ثبت شد.\n\n⚙️ **مرحله ۵ از ۷:**\nنوع قرعه‌کشی را انتخاب کنید (روی یکی از دکمه‌های زیر کلیک کنید):`, {
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

    case 'TICKET_DETAILS':
      const numbers = cleanText.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        state.data.ticketPrice = parseInt(numbers[0], 10);
        state.data.maxTickets = parseInt(numbers[1], 10);
        state.step = 'JOIN_CHANNELS';
        bot.sendMessage(chatId, `✅ جزئیات تیکت ثبت شد.\n\n🔒 **مرحله ۶ از ۷ (جوین اجباری):**\nآیدی کانال‌ها را بفرستید (**هر کانال در یک خط**، مثل @Channel یا اگر ندارید «رد» بفرستید):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ فرمت اشتباه است. مثال: \`5 3\``, { parse_mode: 'Markdown' });
      }
      break;

    case 'TIME':
      const minutes = parseInt(cleanText, 10);
      if (!isNaN(minutes)) {
        state.data.durationMinutes = minutes;
        state.step = 'JOIN_CHANNELS';
        bot.sendMessage(chatId, `✅ زمان ثبت شد.\n\n🔒 **مرحله ۶ از ۷ (جوین اجباری):**\nآیدی کانال‌ها را بفرستید (**هر کانال در یک خط**، مثل @Channel یا اگر ندارید «رد» بفرستید):`, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
        });
      } else {
        bot.sendMessage(chatId, `⚠️ لطفاً یک عدد معتبر به دقیقه وارد کنید.`);
      }
      break;

    case 'JOIN_CHANNELS':
      const joinChannels = text.trim() === 'رد' ? [] : text.split('\n').map(c => c.trim()).filter(c => c.length > 0);
      state.data.joinChannels = joinChannels;
      state.step = 'CHANNELS';
      bot.sendMessage(chatId, `✅ کانال‌های جوین اجباری ثبت شدند.\n\n📢 **مرحله ۷ (آخر):**\nآیدی یا لینک کانال‌های مقصد برای انتشار بنر را بفرستید (**هر کانال در یک خط**):`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ لغو', callback_data: 'cancel_gw' }]] }
      });
      break;

    case 'CHANNELS':
      const channels = text.split('\n').map(c => c.trim()).filter(c => c.length > 0);
      if (channels.length === 0) {
        return bot.sendMessage(chatId, `⚠️ لطفاً حداقل یک آیدی یا لینک کانال معتبر بفرستید.`);
      }
      state.data.channels = channels;

      const giveawayId = 'gw_' + Math.random().toString(36).substring(2, 9);
      giveaways[giveawayId] = state.data;
      delete adminStates[chatId];

      const botInfo = await bot.getMe();
      let successCount = 0;

      for (let ch of channels) {
        if (ch.startsWith('https://t.me/')) {
          ch = '@' + ch.replace('https://t.me/', '');
        }

        try {
          const captionText = `🎁 **قرعه‌کشی بزرگ: ${state.data.prize}**\n\n📝 ${state.data.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: 0\n${state.data.type === 'TICKET' ? `🎫 تیکت‌ها: 0 از ${state.data.maxTickets}` : ''}`;
          const secondButtonText = state.data.type === 'TICKET' 
            ? `🎫 تیکت‌ها: 0 از ${state.data.maxTickets}` 
            : `👥 شرکت‌کنندگان: 0 نفر`;

          const sentMsg = await bot.sendPhoto(ch, state.data.bannerPhotoId, {
            caption: captionText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }],
                [{ text: secondButtonText, callback_data: `info_${giveawayId}` }]
              ]
            }
          });
          state.data.bannerMessageId = sentMsg.message_id;
          successCount++;
        } catch (e) {
          bot.sendMessage(chatId, `❌ خطا در ارسال به کانال ${ch}: ${e.message}\n(مطمئن شوید ربات در کانال ادمین است)`);
        }
      }

      if (successCount > 0) {
        bot.sendMessage(chatId, `🎉 قرعه‌کشی با موفقیت در ${successCount} کانال منتشر شد! (شناسه: ${giveawayId})`);
      }

      if (state.data.type === 'FREE' && state.data.durationMinutes) {
        setTimeout(async () => {
          await finishGiveaway(giveawayId);
        }, state.data.durationMinutes * 60 * 1000);
      }
      break;
  }
});

// مدیریت دقیق دستور استارت با پارامتر
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name || 'کاربر';
  const startParam = match[1].trim();
  
  const giveawayId = startParam.startsWith('gw_') ? startParam.split('_')[0] + '_' + startParam.split('_')[1] : startParam.split('_')[0];

  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) {
    return bot.sendMessage(chatId, `❌ این قرعه‌کشی به پایان رسیده یا وجود ندارد.`);
  }

  // بررسی جوین اجباری
  if (gw.joinChannels && gw.joinChannels.length > 0) {
    let notJoinedChannels = [];
    for (let channel of gw.joinChannels) {
      if (channel.startsWith('https://t.me/')) channel = '@' + channel.replace('https://t.me/', '');
      try {
        const member = await bot.getChatMember(channel, userId);
        if (['left', 'kicked', 'restricted'].includes(member.status)) {
          notJoinedChannels.push(channel);
        }
      } catch (err) {
        notJoinedChannels.push(channel);
      }
    }

    if (notJoinedChannels.length > 0) {
      let buttons = notJoinedChannels.map(ch => {
        let chUsername = ch.replace('@', '');
        return [{ text: `📢 عضویت در کانال`, url: `https://t.me/${chUsername}` }];
      });
      buttons.push([{ text: '🔄 عضو شدم، بررسی مجدد', callback_data: `check_${giveawayId}` }]);

      return bot.sendMessage(chatId, `⚠️ **برای شرکت در قرعه‌کشی باید ابتدا در کانال‌های زیر عضو شوید:**`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });
    }
  }

  await proceedToJoin(chatId, userId, firstName, giveawayId, gw);
});

async function checkMembershipAndJoin(chatId, userId, firstName, giveawayId, queryId) {
  const gw = giveaways[giveawayId];
  if (!gw || gw.finished) {
    return bot.answerCallbackQuery(queryId, { text: '❌ قرعه‌کشی به پایان رسیده است.', show_alert: true });
  }

  let notJoinedChannels = [];
  for (let channel of gw.joinChannels) {
    if (channel.startsWith('https://t.me/')) channel = '@' + channel.replace('https://t.me/', '');
    try {
      const member = await bot.getChatMember(channel, userId);
      if (['left', 'kicked', 'restricted'].includes(member.status)) {
        notJoinedChannels.push(channel);
      }
    } catch (err) {
      notJoinedChannels.push(channel);
    }
  }

  if (notJoinedChannels.length > 0) {
    return bot.answerCallbackQuery(queryId, { text: '❌ شما هنوز در همه کانال‌ها عضو نشده‌اید!', show_alert: true });
  }

  bot.answerCallbackQuery(queryId, { text: '✅ عضویت شما تایید شد!' });
  await proceedToJoin(chatId, userId, firstName, giveawayId, gw);
}

async function proceedToJoin(chatId, userId, firstName, giveawayId, gw) {
  const alreadyJoined = gw.participants.some(p => p.id === userId);
  const botInfo = await bot.getMe();

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
      bot.sendMessage(chatId, `✅ شما با موفقیت در قرعه‌کشی شرکت کردید!\n\n🔗 لینک دعوت اختصاصی شما:\nhttps://t.me/${botInfo.username}?start=${giveawayId}_${userId}`);
      await updateAllBanners(giveawayId);
    }
  } else {
    bot.sendMessage(chatId, `⚠️ شما قبلاً در این قرعه‌کشی شرکت کرده‌اید.\n\n🔗 لینک دعوت اختصاصی شما:\nhttps://t.me/${botInfo.username}?start=${giveawayId}_${userId}`);
  }
}

bot.onText(/\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  if (adminId && chatId === adminId) return;

  bot.sendMessage(chatId, `❄️ **سلام و احترام به ربات رسمی POKER خوش آمدید.**\n\n🤖 این سیستم پلتفرم هوشمند مدیریت و اجرای چالش‌های رایگان کانال و لاتاری‌های معتبر بر پایه ستارگان تلگرام می‌باشد.\n\n⚠️ دسترسی به قابلیت‌های این ربات انحصاری است و استفاده عمومی آزاد نیست.`, { parse_mode: 'Markdown' });
});

bot.on('pre_checkout_query', (query) => bot.answerPreCheckoutQuery(query.id, true));

bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id;
  const payload = msg.successful_payment.invoice_payload; 
  const parts = payload.split('_');
  const giveawayId = parts[1] + '_' + parts[2];
  const userId = parseInt(parts[3], 10);
  const firstName = msg.from.first_name || 'کاربر';

  const gw = giveaways[giveawayId];
  if (gw && !gw.finished) {
    gw.ticketsBought++;
    if (!gw.participants.some(p => p.id === userId)) {
      gw.participants.push({ id: userId, name: firstName });
    }

    const botInfo = await bot.getMe();
    bot.sendMessage(chatId, `❄️ **پرداخت شما تایید شد.**\n\n✅ بلیت لاتاری با موفقیت خریداری شد!\n🎫 تیکت شما در دیتابیس ثبت شد.\n\n🔗 لینک دعوت شما:\nhttps://t.me/${botInfo.username}?start=${giveawayId}_${userId}`, { parse_mode: 'Markdown' });
    await updateAllBanners(giveawayId);

    if (gw.ticketsBought >= gw.maxTickets) {
      await finishGiveaway(giveawayId);
    }
  }
});

async function updateAllBanners(giveawayId) {
  const gw = giveaways[giveawayId];
  if (!gw || !gw.channels) return;
  const botInfo = await bot.getMe();

  const newCaption = `🎁 **قرعه‌کشی بزرگ: ${gw.prize}**\n\n📝 ${gw.description || 'بدون توضیحات'}\n\n👥 تعداد شرکت‌کنندگان: ${gw.participants.length}\n${gw.type === 'TICKET' ? `🎫 تیکت‌ها: ${gw.ticketsBought} از ${gw.maxTickets}` : ''}`;
  const secondButtonText = gw.type === 'TICKET' 
    ? `🎫 تیکت‌ها: ${gw.ticketsBought} از ${gw.maxTickets}` 
    : `👥 شرکت‌کنندگان: ${gw.participants.length} نفر`;

  for (let ch of gw.channels) {
    if (ch.startsWith('https://t.me/')) ch = '@' + ch.replace('https://t.me/', '');
    try {
      await bot.editMessageCaption(newCaption, {
        chat_id: ch,
        message_id: gw.bannerMessageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ورود به ربات و شرکت', url: `https://t.me/${botInfo.username}?start=${giveawayId}` }],
            [{ text: secondButtonText, callback_data: `info_${giveawayId}` }]
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

    for (let ch of gw.channels) {
      if (ch.startsWith('https://t.me/')) ch = '@' + ch.replace('https://t.me/', '');
      bot.sendMessage(ch, `🏆 **برندگان قرعه‌کشی (${gw.prize}) مشخص شدند!**\n\n🎉 تبریک به نفرات برتر:\n${winnersText}\n\nلطفاً برای دریافت جایزه به ادمین پیام دهید.`, { parse_mode: 'Markdown' });
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Bot running on port ${PORT}`); });
  
