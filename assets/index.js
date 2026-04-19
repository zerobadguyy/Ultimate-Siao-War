const socket = io();

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const leaderboardList = document.getElementById("leaderboardList");

function hydrateIndexText() {
  document.title = "สงครามโคตรเสียว";
  const musicLabel = document.querySelector(".music-widget label");
  if (musicLabel) musicLabel.textContent = "เพลง";

  const logo = document.querySelector(".logo");
  if (logo) logo.alt = "โลโก้เกม";

  const title = document.querySelector(".title");
  if (title) title.innerHTML = "สงครามโคตรเสียว<br>";

  const fieldLabels = document.querySelectorAll(".field > span");
  if (fieldLabels[0]) fieldLabels[0].textContent = "ชื่อผู้เล่น";
  if (fieldLabels[1]) fieldLabels[1].textContent = "Room ID สำหรับเข้าห้อง";

  nameInput.placeholder = "เช่น PinkBerry123";
  roomInput.placeholder = "เช่น AB12CD";

  const createBtn = document.getElementById("createBtn");
  const joinBtn = document.getElementById("joinBtn");
  if (createBtn) createBtn.textContent = "สร้างห้อง";
  if (joinBtn) joinBtn.textContent = "เข้าร่วมห้อง";

  const notice = document.querySelector(".home-card .notice");
  if (notice) {
    notice.textContent = "ระบบเกมตอนนี้กำลังเล่นได้แบบพื้นฐาน และรองรับกติกาหลักของการ์ดแล้ว";
  }

  const boardTitle = document.querySelector(".board-card h2");
  if (boardTitle) boardTitle.textContent = "สถิติ & ลีดเดอร์บอร์ด";
  const boardDesc = document.querySelector(".board-card .muted");
  if (boardDesc) {
    boardDesc.textContent = "ตรงนี้จะเก็บรายชื่อผู้เล่น จำนวนรอบที่เล่น ชนะ และคะแนนรวม";
  }
}

function getPlayerName() {
  return nameInput.value.trim();
}

function validateName() {
  const name = getPlayerName();
  if (!name) {
    alert("กรุณาตั้งชื่อก่อนเข้าห้อง");
    nameInput.focus();
    return null;
  }
  localStorage.setItem("playerName", name);
  return name;
}

function renderLeaderboard(players) {
  leaderboardList.innerHTML = "";
  if (!players.length) {
    leaderboardList.innerHTML = '<div class="empty-box">ยังไม่มีสถิติผู้เล่น</div>';
    return;
  }

  players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "leader-row";
    row.innerHTML = `
      <div class="rank-chip">#${index + 1}</div>
      <div>
        <div>${player.name}</div>
        <div class="muted">เล่น ${player.games} รอบ</div>
      </div>
      <div>ชนะ ${player.wins}</div>
      <div>คะแนน ${player.score}</div>
    `;
    leaderboardList.appendChild(row);
  });
}

function loadLeaderboard() {
  fetch("/api/leaderboard")
    .then((response) => response.json())
    .then((data) => renderLeaderboard(data.players || []))
    .catch(() => {
      leaderboardList.innerHTML = '<div class="empty-box">โหลดสถิติไม่สำเร็จ</div>';
    });
}

document.getElementById("createBtn").addEventListener("click", () => {
  const playerName = validateName();
  if (!playerName) return;
  socket.emit("createRoom", { playerName });
});

document.getElementById("joinBtn").addEventListener("click", () => {
  const playerName = validateName();
  if (!playerName) return;

  const roomId = roomInput.value.trim().toUpperCase();
  if (!roomId) {
    alert("กรุณาใส่ Room ID ก่อนเข้าห้อง");
    roomInput.focus();
    return;
  }

  window.location.href = `/game.html?room=${roomId}`;
});

socket.on("roomCreated", ({ roomId }) => {
  window.location.href = `/game.html?room=${roomId}`;
});

socket.on("errorMsg", (msg) => alert(msg));

nameInput.value = localStorage.getItem("playerName") || "";
hydrateIndexText();
loadLeaderboard();
