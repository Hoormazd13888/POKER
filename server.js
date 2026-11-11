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
const WEB_APP_URL = 'https://POKER.onrender.com'; 

const bot = new TelegramBot(TOKEN, { polling: true });

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
    playersCount: 16128,
    timer: 15,
    status: 'waiting',
    players: [],
    leaderboard: [
        { name: "AMIRPROMAX", volume: 14.50, prize: "5 TON" },
        { name: "CryptoKing", volume: 9.20, prize: "3 TON" }
    ]
};

setInterval(() => {
    if (gameState.status === 'waiting' && gameState.players.length > 0) {
        gameState.timer--;
        if (gameState.timer <= 0) {
            startBattle();
        }
    } else if (gameState.players.length === 0) {
        gameState.timer = 15;
    }
    io.emit('state', gameState);
}, 1000);

function startBattle() {
    gameState.status = 'battling';
    io.emit('state', gameState);

    setTimeout(() => {
        let totalPool = gameState.bank;
        let fee = totalPool * 0.05;
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
        let bet = parseFloat(data.amount);
        gameState.bank += bet;
        gameState.playersCount++;

        gameState.players.push({
            id: socket.id,
            name: data.name || "WARRIOR",
            amount: bet
        });

        io.emit('state', gameState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Arena Server running on port ${PORT}`));
