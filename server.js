const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// توکن ربات شما
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

// تابع دریافت قیمت لحظه‌ای TON
async function getTonPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd,irr');
        const data = response.data['the-open-network'];
        const usd = data.usd;
        const toman = Math.round(data.irr / 10); // تبدیل ریال به تومان
        return { usd, toman };
    } catch (error) {
        console.error('خطا در دریافت قیمت:', error.message);
        return null;
    }
}

// دستور /start (منوی اصلی دکمه‌ای)
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'کاربر';

    const keyboard = {
        inline_keyboard: [
            [{ text: '📊 دریافت قیمت لحظه‌ای TON', callback_data: 'get_price' }],
            [{ text: '🔄 درباره ربات', callback_data: 'about' }]
        ]
    };

    bot.sendMessage(chatId, `سلام ${userName} عزیز! 👋\n\nبه ربات استعلام قیمت **تون‌کوین (TON)** خوش آمدید.\nبرای دریافت قیمت روی دکمه زیر کلیک کنید:`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// مدیریت کلیک روی دکمه‌ها
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (query.data === 'get_price') {
        const priceData = await getTonPrice();
        if (priceData) {
            const priceText = `💎 **گزارش لحظه‌ای قیمت تون‌کوین (TON)**\n\n` +
                              `💵 قیمت دلار: **$${priceData.usd}**\n` +
                              `🇮🇷 قیمت تومان: **${priceData.toman.toLocaleString()} تومان**\n\n` +
                              `🕒 به‌روزرسانی شد.`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 بروزرسانی قیمت', callback_data: 'get_price' }],
                    [{ text: '⬅️ بازگشت به منو', callback_data: 'back_home' }]
                ]
            };

            try {
                await bot.editMessageText(priceText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } catch (e) {
                // خطای یکسان بودن متن نادیده گرفته می‌شود
            }
        } else {
            bot.answerCallbackQuery(query.id, { text: 'خطا در دریافت قیمت!', show_alert: true });
        }
    } 
    else if (query.data === 'about') {
        const aboutText = `ℹ️ این ربات به صورت کاملاً خودکار قیمت لحظه‌ای رمزارز تون‌کوین را استعلام کرده و به تومان و دلار نمایش می‌دهد.`;
        const keyboard = {
            inline_keyboard: [
                [{ text: '⬅️ بازگشت به منو', callback_data: 'back_home' }]
            ]
        };
        await bot.editMessageText(aboutText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    else if (query.data === 'back_home') {
        const homeText = `🏠 منوی اصلی ربات:\nبرای دریافت قیمت روی دکمه زیر کلیک کنید:`;
        const keyboard = {
            inline_keyboard: [
                [{ text: '📊 دریافت قیمت لحظه‌ای TON', callback_data: 'get_price' }],
                [{ text: '🔄 درباره ربات', callback_data: 'about' }]
            ]
        };
        await bot.editMessageText(homeText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    bot.answerCallbackQuery(query.id);
});

console.log('Button-based Bot is running...');
