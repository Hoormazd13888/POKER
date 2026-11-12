const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// توکن ربات شما
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

// تابع دریافت قیمت TON به دلار و تومان
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

// پاسخ به دستور /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'کاربر';

    const priceData = await getTonPrice();
    
    let priceText = "⚠️ در حال حاضر دریافت قیمت با خطا مواجه شد.";
    if (priceData) {
        priceText = `💎 **گزارش لحظه‌ای قیمت تون‌کوین (TON)**\n\n` +
                    `💵 قیمت دلار: **$${priceData.usd}**\n` +
                    `🇮🇷 قیمت تومان: **${priceData.toman.toLocaleString()} تومان**\n\n` +
                    `🤖 ربات قیمت‌دهی فعال است.`;
    }

    const keyboard = {
        inline_keyboard: [
            [{ text: '🔄 به‌روزرسانی قیمت', callback_data: 'refresh_price' }]
        ]
    };

    bot.sendMessage(chatId, `سلام ${userName} عزیز! 👋\n\n` + priceText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
});

// مدیریت کلیک روی دکمه به‌روزرسانی
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (query.data === 'refresh_price') {
        const priceData = await getTonPrice();
        if (priceData) {
            const priceText = `💎 **گزارش لحظه‌ای قیمت تون‌کوین (TON)**\n\n` +
                              `💵 قیمت دلار: **$${priceData.usd}**\n` +
                              `🇮🇷 قیمت تومان: **${priceData.toman.toLocaleString()} تومان**\n\n` +
                              `🤖 ربات قیمت‌دهی فعال است.`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 به‌روزرسانی قیمت', callback_data: 'refresh_price' }]
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
                // اگر قیمت تغییری نکرده باشد ممکن است ارور بدهد که نادیده گرفته می‌شود
            }
        }
        bot.answerCallbackQuery(query.id, { text: 'قیمت به‌روز شد ✅' });
    }
});

console.log('Bot is running...');
