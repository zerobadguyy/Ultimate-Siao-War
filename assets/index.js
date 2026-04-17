const socket = io();

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const leaderboardList = document.getElementById("leaderboardList");

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
loadLeaderboard();
