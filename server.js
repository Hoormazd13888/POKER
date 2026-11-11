const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// توکن ربات تلگرام شما که در کد قرار داده شد
const TOKEN = '9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg'; 
const WEB_APP_URL = 'https://POKER.onrender.com'; // لینک سایت شما در رندر (اگر لینک پروژه‌تان چیز دیگری است، اینجا را تغییر دهید)

const bot = new TelegramBot(TOKEN, { polling: true });

// تنظیم دستور استارت ربات با دکمه شیشه‌ای (Inline Keyboard)
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Warrior';

    bot.sendMessage(chatId, `Welcome to ARENA, ${firstName}!\n\nTap the button below to enter the battleground:`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚔️ Enter Arena', web_app: { url: WEB_APP_URL } }]
            ]
        }
    });
});

let gameState = {
    bank: 0.0516,
    playersCount: 16128
};

io.on('connection', (socket) => {
    socket.emit('state', gameState);

    socket.on('join_game', (data) => {
        let bet = parseFloat(data.amount);
        gameState.bank += bet;
        gameState.playersCount++;
        io.emit('state', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Arena Server & Bot running on port ${PORT}`));
