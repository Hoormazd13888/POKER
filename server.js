const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://poker.onrender.com';

// ذخیره‌سازی پایدار تنظیمات در حافظه سرور
let sniperConfig = {
    channelUsername: '@YourChannelUsername', 
    minPrice: 10,
    maxPrice: 500,
    minDiscount: 10
};

const db = {
    huntedItems: []
};

// دریافت تنظیمات فعلی در مینی‌اپ
app.post('/api/config/get', (req, res) => {
    res.json({ config: sniperConfig, stats: db.huntedItems });
});

// ذخیره تنظیمات کانال و فیلترها از داخل مینی‌اپ
app.post('/api/config/save', (req, res) => {
    const { channel, minPrice, maxPrice, minDiscount } = req.body;
    
    if (channel) {
        // مطمئن شویم آیدی کانال با @ شروع می‌شود
        sniperConfig.channelUsername = channel.startsWith('@') ? channel : '@' + channel;
    }
    if (minPrice) sniperConfig.minPrice = Number(minPrice);
    if (maxPrice) sniperConfig.maxPrice = Number(maxPrice);
    if (minDiscount) sniperConfig.minDiscount = Number(minDiscount);
    
    console.log('Updated Config:', sniperConfig);
    res.json({ success: true, message: 'تنظیمات و کانال با موفقیت ذخیره شد!' });
});

// ارسال تست یا شکار به کانال تنظیم شده
app.post('/api/test-hunt', async (req, res) => {
    try {
        if (!sniperConfig.channelUsername || sniperConfig.channelUsername === '@YourChannelUsername') {
            return res.status(400).json({ success: false, error: 'لطفاً ابتدا آیدی کانال خود را در مینی‌اپ وارد و ذخیره کنید!' });
        }

        const testItem = {
            name: 'Golden Star Gift #777',
            price: (sniperConfig.minPrice + 5),
            floor: (sniperConfig.minPrice + 40),
            link: 'https://t.me/nft/gift-777',
            image: 'https://via.placeholder.com/300'
        };

        let caption = `🎯 **شکار ان‌اف‌تی / گیفت زیر قیمت!**\n\n` +
                      `🎁 نام: **${testItem.name}**\n` +
                      `💰 قیمت شکار: **${testItem.price} ⭐️**\n` +
                      `📉 قیمت کف بازار: ~~${testItem.floor} ⭐️~~\n` +
                      `💎 محدوده قیمت: (${sniperConfig.minPrice} تا ${sniperConfig.maxPrice} استارز)\n\n` +
                      `⚡️ برای خرید سریع کلیک کنید:`;

        await bot.sendPhoto(sniperConfig.channelUsername, testItem.image, {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🛒 خرید مستقیم از مارکت', url: testItem.link }]]
            }
        });

        res.json({ success: true, message: `با موفقیت به کانال ${sniperConfig.channelUsername} ارسال شد!` });
    } catch (err) {
        console.error('Telegram Send Error:', err.message);
        res.status(500).json({ success: false, error: 'خطا: ربات نمی‌تواند به کانال پیام بفرستد. مطمئن شوید ربات ادمین کانال است و آیدی صحیح است.' });
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🎯 **ربات هوشمند شکارچی گیفت و ان‌اف‌تی‌های تلگرام**\n\nبرای تنظیم کانال و فیلتر قیمت‌ها، از مینی‌اپ زیر استفاده کنید:`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚙️ تنظیمات و مینی‌اپ شکارچی', web_app: { url: WEB_APP_URL } }]
            ]
        }
    });
});

app.listen(PORT, () => console.log(`Sniper Bot running on port ${PORT}`));
