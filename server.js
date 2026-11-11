const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Tel Shop Bot is running online!'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// توکن جدید ربات شما
const TOKEN = '8912298462:AAG6yIlAvRWRKkGG9eLLEkRCjK5wtHcoVmc';
const bot = new TelegramBot(TOKEN, { polling: true });

// تنظیمات کانال‌ها
const CHANNEL_REPORT = '@Tel_Shop26'; // کانال گزارشات خرید
const CHANNEL_ADMIN_ORDERS = -1001234567890; // کانال بررسی سفارشات ادمین
const FORCE_CHANNEL = '@Tel_Shop26'; // کانال جوین اجباری

// کیف پول رسمی ادمین برای واریز TON
const ADMIN_TON_WALLET = 'EQD...WalletAddressExample...'; 

// دیتابیس حافظه موقت
const db = {
    adminId: null, // اولین نفری که /admin بفرستد ادمین می‌شود
    users: {},
    products: {
        stars: { name: '⭐ استارز تلگرام', pricePerUnit: 1500 }, // قیمت هر واحد به تومان
        premium: { name: '💎 اشتراک پریمیوم', pricePerUnit: 350000 },
        boost: { name: '🚀 بوست کانال', pricePerUnit: 120000 }
    },
    tonPriceToman: 350000 // قیمت لحظه‌ای هر تون به تومان (قابل تغییر توسط ادمین)
};

// وضعیت موقت کاربران برای دریافت مقدار یا لینک
const userState = {};

// تابع بررسی عضویت اجباری
async function checkMembership(userId) {
    try {
        const chatMember = await bot.getChatMember(FORCE_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (e) {
        return true; 
    }
}

// منوی اصلی با دکمه‌های رنگی فعال
function getMainMenu(isUserAdmin) {
    let keyboard = [
        [{ text: '🟢 🛒 خرید محصول', callback_data: 'buy_product' }],
        [{ text: '🔵 ➕ افزایش موجودی', callback_data: 'add_balance' }, { text: '🔵 👤 حساب کاربری', callback_data: 'profile' }],
        [{ text: '🔵 👥 زیر مجموعه گیری', callback_data: 'referral' }],
        [{ text: '🔵 📞 پشتیبانی', callback_data: 'support' }, { text: '🔵 📦 پیگیری سفارش', callback_data: 'track_order' }],
        [{ text: '🔴 ❤️ چطور میتوانم به شما اعتماد کنم', callback_data: 'trust' }]
    ];

    if (isUserAdmin) {
        keyboard.unshift([{ text: '⚙️ 👑 پنل مدیریت پیشرفته ادمین', callback_data: 'admin_panel' }]);
    }

    return { reply_markup: { inline_keyboard: keyboard } };
}

// دستور /admin برای تعیین اولین نفر به عنوان ادمین
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!db.adminId) {
        db.adminId = chatId;
        bot.sendMessage(chatId, `🎉 تبریک! شما به عنوان **ادمین اصلی** ربات Tel Shop ثبت شدید.`, { parse_mode: 'Markdown', ...getMainMenu(true) });
    } else if (db.adminId === chatId) {
        bot.sendMessage(chatId, `⚙️ شما ادمین ربات هستید. پنل مدیریت:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 آمار ربات', callback_data: 'admin_stats' }, { text: '💱 تنظیم قیمت تون', callback_data: 'admin_set_ton' }],
                    [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_home' }]
                ]
            }
        });
    } else {
        bot.sendMessage(chatId, `❌ شما دسترسی ادمین ندارید.`);
    }
});

// دستور Start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'کاربر';

    const isJoined = await checkMembership(chatId);
    if (!isJoined) {
        bot.sendMessage(chatId, `⚠️ برای استفاده از ربات Tel Shop باید ابتدا در کانال زیر عضو شوید:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📢 عضویت در کانال', url: `https://t.me/${FORCE_CHANNEL.replace('@', '')}` }],
                    [{ text: '✅ عضو شدم / بررسی مجدد', callback_data: 'check_join' }]
                ]
            }
        });
        return;
    }

    if (!db.users[chatId]) {
        db.users[chatId] = { balance: 0, discountBalance: 0, level: 'برنز', referrals: 0 };
    }

    const isAdmin = (db.adminId === chatId);
    bot.sendMessage(chatId, `سلام ${name} عزیز به ربات **Tel Shop** خوش آمدید! 💎\n\nاز لیست زیر، گزینه مورد نظرتان را انتخاب کنید:`, {
        parse_mode: 'Markdown',
        ...getMainMenu(isAdmin)
    });
});

// مدیریت کامل کلیک دکمه‌ها
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = db.users[chatId] || { balance: 0 };
    const isAdmin = (db.adminId === chatId);

    if (data === 'check_join') {
        const isJoined = await checkMembership(chatId);
        if (isJoined) {
            bot.deleteMessage(chatId, query.message.message_id);
            bot.sendMessage(chatId, `🎉 عضویت شما تایید شد! خوش آمدید.`, getMainMenu(isAdmin));
        } else {
            bot.answerCallbackQuery(query.id, { text: '❌ شما هنوز در کانال عضو نشده‌اید!', show_alert: true });
        }
        return;
    }

    if (data === 'buy_product') {
        bot.editMessageText('🛒 **وقتشه محصولتو انتخاب کنی !**\n\nمحصول مورد نظر رو انتخاب کن:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🟢 ⭐ خرید استارز (هر واحد ' + db.products.stars.pricePerUnit + ' تومان)', callback_data: 'buy_stars' }],
                    [{ text: '🟢 💎 خرید پریمیوم', callback_data: 'buy_premium' }],
                    [{ text: '🟢 🚀 خرید بوست', callback_data: 'buy_boost' }],
                    [{ text: '🔴 🔙 برگشت', callback_data: 'back_home' }]
                ]
            }
        });
    }
    else if (data === 'buy_stars') {
        userState[chatId] = { action: 'buying_stars', price: db.products.stars.pricePerUnit };
        bot.sendMessage(chatId, `⭐ لطفاً **تعداد** استارز مورد نظر خود را به صورت عدد انگلیسی ارسال کنید (مثلا: 50):`, { parse_mode: 'Markdown' });
    }
    else if (data === 'add_balance') {
        bot.editMessageText('💎 **افزایش موجودی کیف پول**\n\nلطفاً روش پرداخت را انتخاب کنید:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔴 💎 پرداخت با ارز دیجیتال (Tonkeeper با محاسبه قیمت روز)', callback_data: 'pay_crypto_ton' }],
                    [{ text: '🔵 💳 پرداخت کارت به کارت', callback_data: 'pay_card' }],
                    [{ text: '🔴 🔙 برگشت', callback_data: 'back_home' }]
                ]
            }
        });
    }
    else if (data === 'pay_crypto_ton') {
        userState[chatId] = { action: 'entering_ton_amount' };
        bot.sendMessage(chatId, `💱 قیمت روز هر تن‌کوین: **${db.tonPriceToman.toLocaleString()} تومان**\n\nلطفاً مشخص کنید چه تعداد **TON** می‌خواهید واریز کنید تا معادل تومانی آن محاسبه شود (مثلا: 1.5):`, { parse_mode: 'Markdown' });
    }
    else if (data === 'verify_tx') {
        bot.answerCallbackQuery(query.id, { text: '⏳ تراکنش بررسی شد. درخواست تایید به ادمین ارسال گردید.', show_alert: true });
        bot.sendMessage(CHANNEL_ADMIN_ORDERS, `🔔 **درخواست واریز ارزی جدید**\n\n👤 کاربر: <code>${chatId}</code>\n💬 برای بررسی به کیف پول ادمین مراجعه کنید.`);
    }
    else if (data === 'profile') {
        let profileText = `👤 **حساب کاربری شما در Tel Shop**\n\n` +
                          `• آیدی عددی: <code>${chatId}</code>\n` +
                          `• موجودی کیف پول: **${user.balance.toLocaleString()} تومان**`;

        bot.editMessageText(profileText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔴 🔙 برگشت', callback_data: 'back_home' }]
                ]
            }
        });
    }
    else if (data === 'admin_panel' && isAdmin) {
        bot.editMessageText('⚙️ **پنل مدیریت پیشرفته ادمین Tel Shop**', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💱 تنظیم قیمت روز TON', callback_data: 'admin_set_ton' }],
                    [{ text: '📊 آمار کل کاربران', callback_data: 'admin_stats' }],
                    [{ text: '🔴 🔙 بازگشت', callback_data: 'back_home' }]
                ]
            }
        });
    }
    else if (data === 'admin_stats' && isAdmin) {
        const totalUsers = Object.keys(db.users).length;
        bot.answerCallbackQuery(query.id, { text: `📊 تعداد کل کاربران ربات: ${totalUsers} نفر`, show_alert: true });
        return;
    }
    else if (data === 'admin_set_ton' && isAdmin) {
        userState[chatId] = { action: 'setting_ton_price' };
        bot.sendMessage(chatId, `💱 قیمت فعلی هر TON مبلغ ${db.tonPriceToman} تومان است.\nلطفاً قیمت جدید (به تومان) را ارسال کنید:`);
    }
    else if (data === 'back_home') {
        bot.editMessageText('منوی اصلی ربات Tel Shop:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            ...getMainMenu(isAdmin)
        });
    }

    bot.answerCallbackQuery(query.id);
});

// مدیریت پیام‌های متنی ارسالی کاربران (برای دریافت تعداد خرید یا مقدار TON)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    if (userState[chatId]) {
        const state = userState[chatId];

        if (state.action === 'buying_stars') {
            const count = parseInt(text);
            if (isNaN(count) || count <= 0) {
                bot.sendMessage(chatId, `❌ لطفاً یک عدد معتبر وارد کنید.`);
                return;
            }
            const totalPrice = count * state.price;
            delete userState[chatId];

            bot.sendMessage(chatId, `🛒 **فاکتور نهایی خرید استارز**\n\n• تعداد: ${count}\n• مبلغ کل: **${totalPrice.toLocaleString()} تومان**`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🟢 ✅ پرداخت از موجودی کیف پول', callback_data: 'pay_from_wallet' }],
                        [{ text: '🔴 ❌ انصراف', callback_data: 'back_home' }]
                    ]
                }
            });
        }
        else if (state.action === 'entering_ton_amount') {
            const tonAmount = parseFloat(text);
            if (isNaN(tonAmount) || tonAmount <= 0) {
                bot.sendMessage(chatId, `❌ مقدار TON نامعتبر است.`);
                return;
            }
            const totalToman = Math.floor(tonAmount * db.tonPriceToman);
            delete userState[chatId];

            // ساخت لینک تونکیپر
            const nanoTon = Math.floor(tonAmount * 1000000000);
            const commentId = `User_${chatId}`;
            const tonkeeperLink = `ton://transfer/${ADMIN_TON_WALLET}?amount=${nanoTon}&text=${encodeURIComponent(commentId)}`;

            let textResult = `💎 **محاسبه واریز ارزی**\n\n` +
                             `• مقدار ارسالی: **${tonAmount} TON**\n` +
                             `• قیمت روز: **${db.tonPriceToman.toLocaleString()} تومان**\n` +
                             `• معادل شارژ کیف پول: **${totalToman.toLocaleString()} تومان**\n\n` +
                             `👇 با کلیک روی دکمه زیر مستقیماً وارد **Tonkeeper** شوید (کامنت به صورت خودکار درج می‌شود):`;

            bot.sendMessage(chatId, textResult, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🚀 پرداخت مستقیم با Tonkeeper', url: tonkeeperLink }],
                        [{ text: '🔍 بررسی تراکنش و شارژ حساب', callback_data: 'verify_tx' }],
                        [{ text: '🔴 🔙 بازگشت', callback_data: 'back_home' }]
                    ]
                }
            });
        }
        else if (state.action === 'setting_ton_price' && db.adminId === chatId) {
            const newPrice = parseInt(text);
            if (!isNaN(newPrice) && newPrice > 0) {
                db.tonPriceToman = newPrice;
                delete userState[chatId];
                bot.sendMessage(chatId, `✅ قیمت روز TON با موفقیت به ${newPrice.toLocaleString()} تومان تغییر یافت.`);
            } else {
                bot.sendMessage(chatId, `❌ مبلغ نامعتبر است.`);
            }
        }
    }
});
