
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: "20kb" }));

app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  max: 60
}));

app.use(express.static(path.join(__dirname, "public")));

// حافظه موقت؛ با ری‌استارت سرور پاک می‌شود.
const players = new Map();

function cleanName(name) {
  return String(name || "Player")
    .replace(/[<>]/g, "")
    .slice(0, 20);
}

// وضعیت اولیه بازیکن
app.get("/api/profile", (req, res) => {
  const id = String(req.query.id || "guest").slice(0, 64);

  if (!players.has(id)) {
    players.set(id, {
      id,
      name: "Player",
      score: 0,
      games: 0
    });
  }

  const player = players.get(id);

  res.json({
    success: true,
    player: {
      name: player.name,
      score: player.score,
      games: player.games
    }
  });
});

// ثبت نتیجه بازی
app.post("/api/score", (req, res) => {
  const id = String(req.body.id || "guest").slice(0, 64);
  const name = cleanName(req.body.name);
  const score = Number(req.body.score);

  if (!Number.isInteger(score) || score < 0 || score > 3600) {
    return res.status(400).json({
      success: false,
      message: "Invalid score"
    });
  }

  let player = players.get(id);

  if (!player) {
    player = {
      id,
      name,
      score: 0,
      games: 0
    };
    players.set(id, player);
  }

  player.name = name;
  player.games += 1;
  player.score = Math.max(player.score, score);

  res.json({
    success: true,
    bestScore: player.score
  });
});

// جدول برترین‌ها
app.get("/api/leaderboard", (req, res) => {
  const leaderboard = [...players.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((p, index) => ({
      rank: index + 1,
      name: p.name,
      score: p.score,
      games: p.games
    }));

  res.json({
    success: true,
    leaderboard
  });
});

// بررسی سلامت سرور
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    game: "Arena Arcade"
  });
});

// مسیر اصلی
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log(`Arena Arcade running on port ${PORT}`);
});
