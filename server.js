const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// توکن ربات تلگرام شما
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://poker.onrender.com';

// آدرس کانال شما که ان‌اف‌تی‌ها و گیفت‌های ارزان در آن پست می‌شوند
const CHANNEL_USERNAME = '@YourChannelUsername'; 

// حافظه موقت برای جلوگیری از ارسال تکراری یک آیتم
let postedItems = new Set();

// سیستم رصد و شکار ان‌اف‌تی‌ها و گیفت‌های ارزان مارکت تلگرام
async function checkAndHuntNFTs() {
    try {
        // در اینجا می‌توانید به API مارکت یا مینی‌اپ مورد نظر درخواست بزنید
        // مثال ساختار دیتای دریافتی از مارکت:
        const nfts = [
            { 
                id: 'nft_101', 
                name: 'Gift #4521', 
                priceStars: 150, 
                floorPrice: 200, 
                image: 'https://via.placeholder.com/300', 
                link: 'https://t.me/nft/gift-4521' 
            }
        ];

        for (let nft of nfts) {
            // اگر قیمت کمتر از کف بازار (Floor Price) بود و قبلاً پست نشده بود
            if (nft.priceStars < nft.floorPrice && !postedItems.has(nft.id)) {
                postedItems.add(nft.id);

                let discount = Math.round(((nft.floorPrice - nft.priceStars) / nft.floorPrice) * 100);

                let caption = `🎯 **شکار ان‌اف‌تی زیر قیمت (تخفیف‌دار)!**\n\n` +
                              `🎁 نام آیتم: **${nft.name}**\n` +
                              `💰 قیمت شکار: **${nft.priceStars} ⭐️**\n` +
                              `📉 قیمت کف بازار: ~~${nft.floorPrice} ⭐️~~\n` +
                              `🔥 میزان اختلاف: **${discount}% زیر قیمت!**\n\n` +
                              `⚡️ برای خرید سریع روی دکمه زیر کلیک کنید:`;

                let inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: '🛒 خرید مستقیم از مارکت', url: nft.link }]
                    ]
                };

                // ارسال خودکار به کانال
                await bot.sendPhoto(CHANNEL_USERNAME, nft.image, {
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_markup: inlineKeyboard
                });
            }
        }
    } catch (error) {
        console.error('خطا در اسکن مارکت:', error.message);
    }
}

// هر 1 دقیقه یک‌بار مارکت را برای یافتن آیتم‌های ارزان اسکن می‌کند
setInterval(checkAndHuntNFTs, 60000);

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🎯 **ربات شکارچی گیفت و ان‌اف‌تی‌های تلگرام**\n\nاین ربات مارکت استارز را رصد می‌کند و ارزان‌ترین آیتم‌ها را داخل کانال منتشر می‌سازد.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 ورود به مینی‌اپ ابزارها', web_app: { url: WEB_APP_URL } }]
            ]
        }
    });
});

app.listen(PORT, () => console.log(`Sniper Bot Server running on port ${PORT}`));
