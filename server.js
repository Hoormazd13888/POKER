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

// تنظیمات ربات شکارچی
const sniperConfig = {
    channelUsername: '@YourChannelUsername', // کانال پیش‌فرض
    minPrice: 10,
    maxPrice: 500,
    minDiscount: 10
};

const db = {
    admins: [],
    huntedItems: [
        { id: '1', name: 'Telegram Gift #88', price: 45, floor: 70, time: '10 دقیقه پیش' }
    ]
};

// دریافت اطلاعات برای مینی‌اپ
app.post('/api/config/get', (req, res) => {
    res.json({ config: sniperConfig, stats: db.huntedItems });
});

// ذخیره تنظیمات از داخل مینی‌اپ
app.post('/api/config/save', (req, res) => {
    const { channel, minPrice, maxPrice, minDiscount } = req.body;
    if (channel) sniperConfig.channelUsername = channel;
    if (minPrice) sniperConfig.minPrice = Number(minPrice);
    if (maxPrice) sniperConfig.maxPrice = Number(maxPrice);
    if (minDiscount) sniperConfig.minDiscount = Number(minDiscount);
    
    res.json({ success: true, message: 'تنظیمات با موفقیت ذخیره شد!' });
});

// شبیه‌سازی اسکن و ارسال تست به کانال
app.post('/api/test-hunt', async (req, res) => {
    try {
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
                      `💎 محدوده قیمت مجاز: (${sniperConfig.minPrice} تا ${sniperConfig.maxPrice} استارز)\n\n` +
                      `⚡️ برای خرید سریع کلیک کنید:`;

        await bot.sendPhoto(sniperConfig.channelUsername, testItem.image, {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🛒 خرید مستقیم از مارکت', url: testItem.link }]]
            }
        });

        res.json({ success: true, message: 'آیتم تستی با موفقیت به کانال ارسال شد!' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'خطا در ارسال به کانال. آیا ربات ادمین کانال است؟' });
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🎯 **ربات هوشمند شکارچی گیفت و ان‌اف‌تی‌های تلگرام**\n\nاین ربات مارکت استارز را با سرعت بالا رصد کرده و ارزان‌ترین آیتم‌ها را طبق فیلتر قیمت شما به کانال ارسال می‌کند.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚙️ تنظیمات و مینی‌اپ شکارچی', web_app: { url: WEB_APP_URL } }]
            ]
        }
    });
});

app.listen(PORT, () => console.log(`Sniper Bot running on port ${PORT}`));
