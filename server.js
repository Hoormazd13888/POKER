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

// 9173107929:AAG4CcOtg-8bT_4G_a4qJpN9LlJSrI7yBLg
const TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'; 
const WEB_APP_URL = 'https://POKER.onrender.com'; // لینک سایت شما در رندر

const bot = new TelegramBot(TOKEN, { polling: true });

// دستور Start و ارسال دکمه شیشه‌ای (Inline Keyboard)
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'User';

    bot.sendMessage(chatId, `Welcome to POKER GIFT, ${firstName}!\n\nClick the button below to open the app and start playing:`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 Launch POKER GIFT', web_app: { url: WEB_APP_URL } }]
            ]
        }
    });
});

// وضعیت بازی آرنا (بانک از صفر شروع می‌شود)
let gameState = {
    bank: 0.00,
    timer: 15,
    status: 'waiting',
    players: [],
    wheelEnabled: true,
    leaderboard: [
        { name: "AMIRPROMAX", volume: 14.50, prize: "5 TON" },
        { name: "CryptoKing", volume: 9.20, prize: "3 TON" }
    ]
};

// تایمر بازی
setInterval(() => {
    if (gameState.status === 'waiting' && gameState.players.length > 0) {
        gameState.timer--;
        if (gameState.timer <= 0) {
            startSpinning();
        }
    } else if (gameState.players.length === 0) {
        gameState.timer = 15;
    }
    io.emit('state', gameState);
}, 1000);

function startSpinning() {
    gameState.status = 'spinning';
    io.emit('state', gameState);

    setTimeout(() => {
        let totalPool = gameState.bank;
        let fee = totalPool * 0.05; // کسر ۵ درصد کمیسیون/مالیات ادمین
        let finalPrize = totalPool - fee;

        let winningPoint = Math.random() * totalPool;
        let currentSum = 0;
        let winner = gameState.players[0];

        for (let p of gameState.players) {
            currentSum += p.amount;
            if (winningPoint <= currentSum) {
                winner = p;
                break;
            }
        }

        if (winner) {
            let userLb = gameState.leaderboard.find(u => u.name === winner.name);
            if (userLb) {
                userLb.volume += finalPrize;
            } else {
                gameState.leaderboard.push({ name: winner.name, volume: finalPrize, prize: "Reward" });
            }
            gameState.leaderboard.sort((a, b) => b.volume - a.volume);
        }

        // ریست شدن بانک برای دور بعدی
        gameState.bank = 0.00;
        gameState.players = [];
        gameState.status = 'waiting';
        gameState.timer = 15;
        io.emit('state', gameState);
    }, 4000);
}

io.on('connection', (socket) => {
    socket.emit('state', gameState);

    socket.on('join_game', (data) => {
        if (gameState.status !== 'waiting') return;
        
        let betAmount = parseFloat(data.amount);
        gameState.bank += betAmount; // اضافه شدن به بانک بازی

        gameState.players.push({
            id: socket.id,
            name: data.name || "PLAYER",
            amount: betAmount
        });

        io.emit('state', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
