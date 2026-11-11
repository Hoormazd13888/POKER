const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Starzify Bot is running online!'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// توکن جدید ربات شما
const TOKEN = '8912298462:AAG6yIlAvRWRKkGG9eLLEkRCjK5wtHcoVmc';
const bot = new TelegramBot(TOKEN, { polling: true });

// تنظیمات ادمین و کانال‌ها (این مقادیر را با آیدی‌های خودتان تنظیم کنید)
const ADMIN_ID = 123456789; // آیدی عددی تلگرام شما به عنوان ادمین
const CHANNEL_REPORT = '@Starzify_Reports'; // کانال عمومی گزارشات خرید
const CHANNEL_ADMIN_ORDERS = -1001234567890; // آیدی عددی کانال خصوصی ادمین‌ها برای بررسی سفارش‌ها
const FORCE_CHANNEL = '@Starzify_Channel'; // کانال جوین اجباری

// کیف پول رسمی ادمین برای دریافت TON
const ADMIN_TON_WALLET = 'EQD...WalletAddressExample...'; 

// دیتابیس موقت کاربران
const users = {};

// تابع بررسی عضویت اجباری در کانال
async function checkMembership(userId) {
    try {
        const chatMember = await bot.getChatMember(FORCE_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (e) {
        return true; // اگر ربات دسترسی چک کردن نداشت، موقتاً اجازه عبور می‌دهد
    }
}

// منوی اصلی ربات با دکمه‌های ساختاریافته
function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🛒 خرید محصول', callback_data: 'buy_product' }],
                [{ text: '➕ افزایش موجودی', callback_data: 'add_balance' }, { text: '👤 حساب کاربری', callback_data: 'profile' }],
                [{ text: '👥 زیر مجموعه گیری', callback_data: 'referral' }],
                [{ text: '📞 پشتیبانی', callback_data: 'support' }, { text: '📦 پیگیری سفارش', callback_data: 'track_order' }],
                [{ text: '❤️ چطور میتوانم به شما اعتماد کنم', callback_data: 'trust' }]
            ]
        }
    };
}

// دستور Start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'کاربر';

    // بررسی جوین اجباری
    const isJoined = await checkMembership(chatId);
    if (!isJoined) {
        bot.sendMessage(chatId, `⚠️ برای استفاده از ربات باید ابتدا در کانال زیر عضو شوید:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📢 عضویت در کانال', url: `https://t.me/${FORCE_CHANNEL.replace('@', '')}` }],
                    [{ text: '✅ عضو شدم / بررسی مجدد', callback_data: 'check_join' }]
                ]
            }
        });
        return;
    }

    if (!users[chatId]) {
        users[chatId] = { balance: 0, discountBalance: 0, level: 'برنز', referrals: 0, card: 'ثبت نشده' };
    }

    let welcomeText = `سلام ${name} عزیز به ربات Starzify خوش آمدید! 💎\n\nاز لیست زیر، گزینه مورد نظرتان را انتخاب کنید:`;
    
    let menu = getMainMenu();
    if (chatId === ADMIN_ID) {
        menu.reply_markup.inline_keyboard.unshift([{ text: '⚙️ پنل مدیریت ادمین', callback_data: 'admin_panel' }]);
    }

    bot.sendMessage(chatId, welcomeText, menu);
});

// مدیریت کلیک روی دکمه‌ها
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = users[chatId] || { balance: 0, discountBalance: 0, level: 'برنز', referrals: 0, card: 'ثبت نشده' };

    if (data === 'check_join') {
        const isJoined = await checkMembership(chatId);
        if (isJoined) {
            bot.deleteMessage(chatId, query.message.message_id);
            bot.sendMessage(chatId, `🎉 عضویت شما تایید شد! خوش آمدید.`, getMainMenu());
        } else {
            bot.answerCallbackQuery(query.id, { text: '❌ شما هنوز در کانال عضو نشده‌اید!', show_alert: true });
        }
        return;
    }

    if (data === 'buy_product') {
        bot.editMessageText('🛒 <b>وقتشه محصولتو انتخاب کنی !</b>\n\nاز لیست زیر، محصول مورد نظرت رو انتخاب کن:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📦 سفارش های اخیر من', callback_data: 'recent_orders' }],
                    [{ text: '⭐ استارز', callback_data: 'cat_stars' }, { text: '💎 پریمیوم', callback_data: 'cat_premium' }],
                    [{ text: '💳 خرید رمز ارز', callback_data: 'cat_crypto' }],
                    [{ text: '🎁 گیفت استارزی', callback_data: 'cat_gift' }, { text: '🔄 ریاکشن استارزی', callback_data: 'cat_reaction' }],
                    [{ text: '🚀 بوست تلگرام', callback_data: 'cat_boost' }],
                    [{ text: '🔙 برگشت', callback_data: 'back_home' }]
                ]
            }
        });
    } 
    else if (data === 'add_balance') {
        bot.editMessageText('💎 <b>افزایش موجودی کیف پول</b>\n\nلطفاً یکی از روش‌های زیر را برای شارژ حساب انتخاب کنید:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔴 پرداخت با ارز دیجیتال (تون‌کوین)', callback_data: 'pay_crypto_ton' }],
                    [{ text: '💳 پرداخت ریالی / درگاهی', callback_data: 'pay_rial' }],
                    [{ text: '🔙 برگشت', callback_data: 'back_home' }]
                ]
            }
        });
    }
    else if (data === 'pay_crypto_ton') {
        const amountTon = '1.5'; 
        const nanoTon = Math.floor(parseFloat(amountTon) * 1000000000); 
        const commentId = `User_${chatId}`; // کامنت خودکار حاوی آیدی عددی کاربر
        const tonkeeperLink = `ton://transfer/${ADMIN_TON_WALLET}?amount=${nanoTon}&text=${encodeURIComponent(commentId)}`;

        let cryptoText = `💎 <b>پرداخت آنی با ارز دیجیتال (Toncoin)</b>\n\n` +
                         `• مقدار: <code>${amountTon} TON</code>\n` +
                         `• آیدی کامنت اختصاصی شما: <code>${commentId}</code>\n\n` +
                         `👇 برای واریز مستقیم از طریق اپلیکیشن **Tonkeeper** روی دکمه زیر کلیک کنید (کامنت به صورت خودکار درج می‌شود):`;

        bot.editMessageText(cryptoText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 پرداخت مستقیم با Tonkeeper', url: tonkeeperLink }],
                    [{ text: '🔍 بررسی خودکار تراکنش', callback_data: 'verify_tx' }],
                    [{ text: '🔙 برگشت', callback_data: 'add_balance' }]
                ]
            }
        });
    }
    else if (data === 'verify_tx') {
        const isTxFound = false; // شبیه‌سازی بررسی تراکنش

        if (isTxFound) {
            user.balance += 100000; 
            bot.answerCallbackQuery(query.id, { text: '✅ واریز شما با موفقیت تایید و به حساب اضافه شد!', show_alert: true });
            
            bot.sendMessage(CHANNEL_REPORT, `📢 <b>گزارش #خرید_موفق</b>\n\n👤 خریدار: ******${chatId.toString().slice(-4)}\n💎 شارژ کیف پول با ارز دیجیتال\n💰 مبلغ: تایید شده\n🕒 ${new Date().toLocaleString('fa-IR')}`, { parse_mode: 'HTML' });
        } else {
            bot.answerCallbackQuery(query.id, { text: '⏳ تراکنش یافت نشد. درخواست شما برای بررسی دستی به ادمین ارسال شد.', show_alert: true });
            
            bot.sendMessage(CHANNEL_ADMIN_ORDERS, `🔔 <b>درخواست بررسی دستی تراکنش/شارژ جدید</b>\n\n👤 آیدی کاربر: <code>${chatId}</code>\n💬 کامنت ارسالی: <code>User_${chatId}</code>\n\nلطفاً حساب را بررسی و تایید کنید.`);
        }
    }
    else if (data === 'profile') {
        let profileText = `👤 <b>حساب کاربری شما</b>\n\n` +
                          `• نام : ${query.from.first_name}\n` +
                          `• آیدی عددی : <code>${chatId}</code>\n` +
                          `• موجودی فعلی: ${user.balance.toLocaleString()} تومان`;

        bot.editMessageText(profileText, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 برگشت', callback_data: 'back_home' }]
                ]
            }
        });
    }
    else if (data === 'back_home') {
        let menu = getMainMenu();
        if (chatId === ADMIN_ID) {
            menu.reply_markup.inline_keyboard.unshift([{ text: '⚙️ پنل مدیریت ادمین', callback_data: 'admin_panel' }]);
        }
        bot.editMessageText('منوی اصلی ربات:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: menu.reply_markup
        });
    }

    bot.answerCallbackQuery(query.id);
});
