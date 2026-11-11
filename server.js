const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Casino Mini App Bot is running!'));
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// توکن ربات خود را از BotFather اینجا قرار دهید
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg';
const bot = new TelegramBot(TOKEN, { polling: true });

// دیتابیس موقت کاربران (موجودی و امتیاز)
const users = {};

// منوی اصلی بازی کازینو
function getCasinoMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎲 بازی تاس (Roll Dice)', callback_data: 'play_dice' }],
                [{ text: '🎰 اسلات ماشین', callback_data: 'play_slots' }],
                [{ text: '💰 کیف پول و موجودی', callback_data: 'wallet' }, { text: '🎁 دریافت سکه رایگان', callback_data: 'free_coins' }],
                [{ text: 'ℹ️ راهنما و قوانین', callback_data: 'help' }]
            ]
        }
    };
}

// دستور /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'قمارباز';

    if (!users[chatId]) {
        users[chatId] = { balance: 1000 }; // هدیه اولیه ۱۰۰۰ سکه
    }

    let welcomeText = `🎰 **به کازینو آنلاین خوش آمدید، ${name}!**\n\n` +
                      `موجودی اولیه شما: **${users[chatId].balance} سکه** 🪙\n\n` +
                      `یک بخش را برای شروع بازی انتخاب کنید:`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        ...getCasinoMenu()
    });
});

// مدیریت کلیک دکمه‌ها
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (!users[chatId]) {
        users[chatId] = { balance: 1000 };
    }

    if (data === 'wallet') {
        bot.answerCallbackQuery(query.id, { 
            text: `💰 موجودی شما: ${users[chatId].balance} سکه`, 
            show_alert: true 
        });
    }
    else if (data === 'free_coins') {
        users[chatId].balance += 500;
        bot.answerCallbackQuery(query.id, { 
            text: '🎁 ۵۰۰ سکه رایگان به حساب شما اضافه شد!', 
            show_alert: true 
        });
        
        bot.editMessageText(`🎰 **کازینو آنلاین**\n\nموجودی فعلی: **${users[chatId].balance} سکه** 🪙`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            ...getCasinoMenu()
        });
    }
    else if (data === 'play_dice') {
        if (users[chatId].balance < 100) {
            bot.answerCallbackQuery(query.id, { text: '❌ موجودی شما برای شرط‌بندی (حداقل ۱۰۰ سکه) کافی نیست!', show_alert: true });
            return;
        }

        users[chatId].balance -= 100; // کسر هزینه شرط

        // ارسال تاس تلگرام
        const diceMsg = await bot.sendDice(chatId);
        const diceValue = diceMsg.dice.value; // عددی بین 1 تا 6

        setTimeout(() => {
            let winAmount = 0;
            let resultText = '';

            if (diceValue >= 4) {
                winAmount = 250;
                users[chatId].balance += winAmount;
                resultText = `🎉 **برنده شدید!** عدد تاس: ${diceValue}\n💰 جایزه: +${winAmount} سکه`;
            } else {
                resultText = `😢 **باختید!** عدد تاس: ${diceValue}\n❌ ۱۰۰ سکه از دست رفت.`;
            }

            bot.sendMessage(chatId, `${resultText}\n\nموجودی جدید: **${users[chatId].balance} سکه** 🪙`, {
                parse_mode: 'Markdown',
                ...getCasinoMenu()
            });
        }, 3500);
    }
    else if (data === 'play_slots') {
        if (users[chatId].balance < 200) {
            bot.answerCallbackQuery(query.id, { text: '❌ حداقل ۲۰۰ سکه برای اسلات لازم است!', show_alert: true });
            return;
        }

        users[chatId].balance -= 200;
        
        // شبیه‌سازی اسلات ماشین با ایموجی تاس/اقلام
        const emojis = ['🍇', '🍋', '🍊', '💎', '7️⃣'];
        const slot1 = emojis[Math.floor(Math.random() * emojis.length)];
        const slot2 = emojis[Math.floor(Math.random() * emojis.length)];
        const slot3 = emojis[Math.floor(Math.random() * emojis.length)];

        let resultText = `🎰 | ${slot1} | ${slot2} | ${slot3} |\n\n`;

        if (slot1 === slot2 && slot2 === slot3) {
            const prize = 1000;
            users[chatId].balance += prize;
            resultText += `👑 **جکپات بزرگ! ۳ تا شکل مشابه!**\n💰 برنده ${prize} سکه شدید!`;
        } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
            const prize = 400;
            users[chatId].balance += prize;
            resultText += `✨ **برنده شدید! ۲ شکل مشابه.**\n💰 برنده ${prize} سکه شدید!`;
        } else {
            resultText += `❌ **باختید!** شانسی دوباره امتحان کنید.`;
        }

        bot.editMessageText(`${resultText}\n\nموجودی جدید: **${users[chatId].balance} سکه** 🪙`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            ...getCasinoMenu()
        });
    }
    else if (data === 'help') {
        bot.answerCallbackQuery(query.id, { 
            text: 'قوانین: با انتخاب بازی‌ها روی موجودی خود شرط ببندید. با باخت موجودی کم و با برد چند برابر می‌شود!', 
            show_alert: true 
        });
    }

    bot.answerCallbackQuery(query.id);
});
