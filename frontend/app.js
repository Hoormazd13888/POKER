const SERVER_URL = "https://poker-1-ksta.onrender.com";
const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const socket = io(SERVER_URL);
let currentCode = "";
const myName = tg?.initDataUnsafe?.user?.first_name || "بازیکن";

document.getElementById("statusText").innerText = "سلام " + myName + "، کد اتاق را بزن";

function enterRoom() {
  currentCode = (document.getElementById("roomCodeInput").value || "MAFIA1").toUpperCase();
  socket.emit("join_room", { code: currentCode, name: myName });
  document.getElementById("gameBox").classList.remove("hidden");
  document.getElementById("roomTitle").innerText = currentCode;
}

socket.on("room_update", (room) => {
  if (socket.id === room.hostId) {
    document.getElementById("hostBtns").classList.remove("hidden");
  }
  document.getElementById("players").innerHTML =
    "بازیکنان: " + room.players.map(p => p.name).join(" ، ");
});

socket.on("your_role", (role) => {
  document.getElementById("myRole").innerText = role;
});

socket.on("narrator", (msg) => {
  document.getElementById("narrator").innerText = msg;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = "fa-IR";
    window.speechSynthesis.speak(u);
  }
});

socket.on("tick", (sec) => {
  document.getElementById("timer").innerText = sec;
});

socket.on("chat_msg", ({ from, text }) => {
  const box = document.getElementById("chatBox");
  box.innerHTML += `<div><b>${from}:</b> ${text}</div>`;
  box.scrollTop = box.scrollHeight;
});

function startMatch() { socket.emit("start_game", currentCode); }
function goNight() { socket.emit("start_night", currentCode); }
function goVoting() { socket.emit("start_voting", currentCode); }

function sendMsg() {
  const inp = document.getElementById("msgInput");
  if (!inp.value.trim()) return;
  socket.emit("chat_msg", { code: currentCode, text: inp.value });
  inp.value = "";
}
