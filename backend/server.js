const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const BOT_TOKEN = process.env.BOT_TOKEN || "9059160078:AAG4IXQLFa9Yupm540BqqT8Mp2pOO3MaQ1Q";
const rooms = new Map();
const rolesList = ["پدرخوانده (مافیا)", "مافیای ساده", "دکتر", "کارآگاه", "شهروند", "شهروند"];

io.on("connection", (socket) => {
  socket.on("join_room", ({ code, name }) => {
    const roomCode = (code || "MAFIA1").toUpperCase();
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
        code: roomCode,
        hostId: socket.id,
        phase: "waiting",
        players: [],
        timeLeft: 60,
        timer: null
      });
    }

    const room = rooms.get(roomCode);
    room.players.push({ id: socket.id, name: name || "بازیکن", role: null, alive: true });
    socket.join(roomCode);

    io.to(roomCode).emit("room_update", {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: room.players.map(p => ({ id: p.id, name: p.name, alive: p.alive }))
    });
  });

  socket.on("start_game", (code) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    const shuffled = [...rolesList].sort(() => Math.random() - 0.5);
    room.players.forEach((p, idx) => {
      p.role = shuffled[idx % shuffled.length];
      p.alive = true;
      io.to(p.id).emit("your_role", p.role);
    });

    room.phase = "day";
    io.to(code).emit("narrator", "بازی شروع شد! روز اول است و هر نوبت ۶۰ ثانیه وقت صحبت دارید.");
    startCountdown(room, 60);
  });

  socket.on("start_night", (code) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    room.phase = "night";
    io.to(code).emit("narrator", "شب شد! فقط مافیا می‌تواند در شب مخفیانه چت کند.");
    startCountdown(room, 45);
  });

  socket.on("start_voting", (code) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    room.phase = "voting";
    io.to(code).emit("narrator", "زمان رأی‌گیری شروع شد!");
    startCountdown(room, 30);
  });

  socket.on("chat_msg", ({ code, text }) => {
    const room = rooms.get(code);
    if (!room || !text) return;
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender) return;

    if (room.phase === "night") {
      const isMafia = sender.role && sender.role.includes("مافیا");
      if (!isMafia) return;
      room.players.forEach(p => {
        if (p.role && p.role.includes("مافیا")) {
          io.to(p.id).emit("chat_msg", { from: `${sender.name} (مافیا)`, text });
        }
      });
      return;
    }

    io.to(code).emit("chat_msg", { from: sender.name, text });
  });
});

function startCountdown(room, sec) {
  if (room.timer) clearInterval(room.timer);
  room.timeLeft = sec;
  io.to(room.code).emit("tick", room.timeLeft);

  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit("tick", Math.max(0, room.timeLeft));
    if (room.timeLeft <= 0) clearInterval(room.timer);
  }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on", PORT));
