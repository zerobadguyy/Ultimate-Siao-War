const socket = io();
const roomId = new URLSearchParams(window.location.search).get("room");
const playerName = localStorage.getItem("playerName");

if (!playerName) {
  window.location.href = "/";
}

const HOLD_DELAY_MS = 340;
const DRAG_THRESHOLD_PX = 18;
const slotIds = ["player-0", "player-1", "player-2", "player-3"];

const state = {
  roomState: null,
  graveCards: [],
  overflowHandCards: [],
  overflowHandOpen: false,
  pendingAction: null,
  pendingActionKey: "",
  selectedCardIds: [],
  lastInspectKey: "",
  seenEffectKeys: new Set(),
  lastTurnKey: "",
  winnerOverlayKey: "",
  dismissedWinnerOverlayKey: "",
  bannerTimer: null,
  drag: null,
  unreadChatCount: 0,
  lastChatCount: 0,
  audioUnlocked: false,
  soundSchedule: {},
  revealCounts: {},
  revealTimers: [],
  lastWarningSoundKey: "",
  lastLogSnapshot: [],
  specialWinnerAnimationKey: "",
  specialWinnerTimer: null,
  lastPlayedSoundKey: "",
};

const SOUND_PATH = "/assets/audio";
const VALESKA_WIN_YOUTUBE_URL = "[ytauto=h7oqtfgvT64][/ytauto]";
const SOUND_FILES = {
  cardReceive: "card1.mp3",
  cardPlay: "card2.mp3",
  turnChange: "turn1.mp3",
  myTurn: "turn2.mp3",
  stop: "stop.mp3",
  chat: "msn.mp3",
  reverse: "rv.mp3",
  victory: "victory.mp3",
  pinkExodia: "pinkexodia.mp3",
  pinkLegendaryWin: "pinklnwzawin.mp3",
  zeroWin: "zerowin.mp3",
  bethWin: "bethwin.mp3",
  joWin: "jowin1.mp3",
  japinkWin: "japink.mp3",
  click: "click.mp3",
  lastCard: "ey.mp3",
  josephineLaugh: "loljo.mp3",
};
const SOUND_VOLUMES = {
  cardReceive: 0.72,
  cardPlay: 0.78,
  turnChange: 0.75,
  myTurn: 0.9,
  stop: 0.86,
  chat: 0.72,
  reverse: 0.78,
  victory: 0.96,
  pinkExodia: 0.96,
  pinkLegendaryWin: 1,
  zeroWin: 1,
  bethWin: 1,
  joWin: 1,
  japinkWin: 1,
  click: 0.55,
  lastCard: 0.88,
  josephineLaugh: 0.92,
};

const drawBtn = document.getElementById("drawBtn");
const startBtn = document.getElementById("startBtn");
const callLastCardBtn = document.getElementById("callLastCardBtn");
const myTurnBanner = document.getElementById("myTurnBanner");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerOverlayTitle = document.getElementById("winnerOverlayTitle");
const winnerOverlayName = document.getElementById("winnerOverlayName");
const winnerOverlayReason = document.getElementById("winnerOverlayReason");
const winnerOverlayContinueBtn = document.getElementById("winnerOverlayContinueBtn");
const winnerOverlayExitBtn = document.getElementById("winnerOverlayExitBtn");
const assemblyWinLayer = document.getElementById("assemblyWinLayer");
const assemblyWinArena = document.getElementById("assemblyWinArena");
const assemblyWinFlash = document.getElementById("assemblyWinFlash");
const videoWinLayer = document.getElementById("videoWinLayer");
const videoWinPlayer = document.getElementById("videoWinPlayer");
const posterWinLayer = document.getElementById("posterWinLayer");
const posterWinImage = document.getElementById("posterWinImage");
const turnTicker = document.getElementById("turnTicker");
const effectLayer = document.getElementById("effectLayer");
const centerDropZone = document.getElementById("centerDropZone");
const centerWarning = document.getElementById("centerWarning");

const cardTooltip = document.getElementById("cardTooltip");
const cardTooltipImage = document.getElementById("cardTooltipImage");
const cardTooltipTitle = document.getElementById("cardTooltipTitle");
const cardTooltipDesc = document.getElementById("cardTooltipDesc");

const graveyardModal = document.getElementById("graveyardModal");
const graveyardModalCount = document.getElementById("graveyardModalCount");
const graveyardModalList = document.getElementById("graveyardModalList");

const logModal = document.getElementById("logModal");
const logModalList = document.getElementById("logModalList");

const chatModal = document.getElementById("chatModal");
const chatModalList = document.getElementById("chatModalList");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const openChatModalBtn = document.getElementById("openChatModalBtn");
const openChatModalBtnLabel = document.getElementById("openChatModalBtnLabel");
const chatUnreadBadge = document.getElementById("chatUnreadBadge");

const guideModal = document.getElementById("guideModal");

const targetModal = document.getElementById("targetModal");
const targetModalTitle = document.getElementById("targetModalTitle");
const targetModalDescription = document.getElementById("targetModalDescription");
const targetModalChoices = document.getElementById("targetModalChoices");

const inspectModal = document.getElementById("inspectModal");
const inspectModalTitle = document.getElementById("inspectModalTitle");
const inspectModalDescription = document.getElementById("inspectModalDescription");
const inspectModalCards = document.getElementById("inspectModalCards");

const cardSelectModal = document.getElementById("cardSelectModal");
const cardSelectModalTitle = document.getElementById("cardSelectModalTitle");
const cardSelectModalDescription = document.getElementById("cardSelectModalDescription");
const cardSelectModalCounter = document.getElementById("cardSelectModalCounter");
const cardSelectModalCards = document.getElementById("cardSelectModalCards");
const confirmCardSelectionBtn = document.getElementById("confirmCardSelectionBtn");
const overflowHandModal = document.getElementById("overflowHandModal");
const overflowHandModalTitle = document.getElementById("overflowHandModalTitle");
const overflowHandModalDescription = document.getElementById("overflowHandModalDescription");
const overflowHandModalCards = document.getElementById("overflowHandModalCards");

let youtubeApiPromise = null;
let youtubePlayer = null;

function hydrateStaticText() {
  document.title = "สงครามโคตรเสียว";
  myTurnBanner.textContent = "ถึงตาคุณแล้ว";
  drawBtn.textContent = "จั่วการ์ด 1 ใบ";
  callLastCardBtn.textContent = "เอื้อยข่าบ";
  startBtn.textContent = "เริ่มเกม";
  document.getElementById("openGuideModalBtn").textContent = "คำแนะนำ";
  document.getElementById("openLogModalBtn").textContent = "พิธีกรข้างสนาม";
  if (openChatModalBtnLabel) {
    openChatModalBtnLabel.textContent = "แชทห้อง";
  } else {
    document.getElementById("openChatModalBtn").textContent = "แชทห้อง";
  }
  document.getElementById("closeGraveyardModalBtn").textContent = "ปิด";
  document.getElementById("closeLogModalBtn").textContent = "ปิด";
  document.getElementById("closeChatModalBtn").textContent = "ปิด";
  document.getElementById("closeGuideModalBtn").textContent = "ปิด";
  document.getElementById("closeTargetModalBtn").textContent = "ปิด";
  document.getElementById("closeInspectModalBtn").textContent = "ปิด";
  document.getElementById("closeCardSelectModalBtn").textContent = "ปิด";
  confirmCardSelectionBtn.textContent = "ยืนยันการเลือก";
  sendChatBtn.textContent = "ส่ง";

  winnerOverlayContinueBtn.textContent = "แค้นนี้ต้องชำระ";
  winnerOverlayExitBtn.textContent = "พอแค่นี้";

  const title = document.querySelector(".top-bar strong");
  if (title) {
    title.textContent = "สงครามโคตรเสียว";
  }

  const stackLabel = document.querySelector(".stack-zone .table-label");
  const centerLabel = document.querySelector(".center-card > .table-label");
  const graveLabel = document.querySelector(".grave-zone .table-label");
  if (stackLabel) stackLabel.textContent = "เดค";
  if (centerLabel) centerLabel.textContent = "การ์ดที่ถูกใช้งานล่าสุด";
  if (graveLabel) graveLabel.textContent = "สุสาน";

  const musicLabel = document.querySelector('.music-widget label');
  if (musicLabel) musicLabel.textContent = "เพลง";
  const roundStatus = document.getElementById("roundStatus");
  const turnStatus = document.getElementById("turnStatus");
  const noticeBox = document.getElementById("noticeBox");
  if (roundStatus) roundStatus.textContent = "กำลังเชื่อมต่อ...";
  if (turnStatus) turnStatus.textContent = "กำลังเชื่อมต่อ...";
  if (noticeBox) noticeBox.textContent = "กำลังเชื่อมต่อข้อมูลห้อง...";

  const modalTitles = {
    chatModalTitle: "แชทห้อง",
    targetModalTitle: "เลือกผู้เล่น",
    inspectModalTitle: "การ์ดที่เปิดดู",
    cardSelectModalTitle: "เลือกการ์ด",
    overflowHandModalTitle: "การ์ดที่ซ่อนอยู่ในมือ",
  };
  Object.entries(modalTitles).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  });

  const graveyardHead = document.querySelector("#graveyardModal .modal-head strong");
  if (graveyardHead) graveyardHead.textContent = "การ์ดในสุสาน";
  const logHead = document.querySelector("#logModal .modal-head strong");
  if (logHead) logHead.textContent = "พิธีกรข้างสนาม";
  const guideHead = document.querySelector("#guideModal .modal-head strong");
  if (guideHead) guideHead.textContent = "คำแนะนำการเล่นเกม";

  const targetDesc = document.getElementById("targetModalDescription");
  if (targetDesc) targetDesc.textContent = "เลือกผู้เล่นที่ต้องการ";
  const inspectDesc = document.getElementById("inspectModalDescription");
  if (inspectDesc) inspectDesc.textContent = "กำลังดูการ์ดในมือของผู้เล่น";
  const selectDesc = document.getElementById("cardSelectModalDescription");
  if (selectDesc) selectDesc.textContent = "เลือกการ์ดที่ต้องการ";
  const selectCounter = document.getElementById("cardSelectModalCounter");
  if (selectCounter) selectCounter.textContent = "เลือกแล้ว 0 ใบ";
  if (overflowHandModalDescription) {
    overflowHandModalDescription.textContent = "การ์ดที่เกินจาก 10 ใบจะถูกรวมไว้ตรงนี้";
  }

  if (chatInput) {
    chatInput.placeholder = "พิมพ์ข้อความคุยกับเพื่อนในห้อง";
  }
  if (cardTooltipImage) {
    cardTooltipImage.alt = "การ์ดที่กำลังดู";
  }

  const guideCopy = document.querySelector(".guide-copy");
  if (guideCopy) {
    guideCopy.innerHTML = `
      <p><strong>วิธีการเล่นเกม</strong> เกมนี้เป็นเกมแบบ Turn-Base</p>
      <p><strong>เป้าหมายของเกม:</strong> ใครการ์ดหมดมือก่อนเป็นคนชนะ หรือชนะทันทีตามเงื่อนไขพิเศษบนหน้าการ์ด</p>
      <p>ทุกคนจะได้รับการ์ดคนละ 5 ใบในมือ</p>
      <p>ดูที่มุมขวา ซ้าย และบน จะเห็นว่าการ์ดของเพื่อนเหลือกันคนละกี่ใบ</p>
      <p>ตาใครเล่น จะมีแสงสีเขียวขึ้นรอบชื่อของคนนั้น และจะมีแจ้งเตือนว่าถึงตาคุณแล้วตรงกลางจอ มุมขวาล่างจะบอกว่าตอนนี้ถึงตาของใคร</p>
      <p><strong>การเล่นในแต่ละตา</strong></p>
      <p>เลือกการ์ดในมือแล้วกดค้าง เพื่อลากลงสนาม การ์ดที่ลงจะไปอยู่ที่กองกลาง</p>
      <p>การ์ดแต่ละใบมีความสามารถ ก่อนลงให้กดค้างที่การ์ดเพื่ออ่านความสามารถ เช่น แกล้งเพื่อนให้จั่วเพิ่ม หรือป้องกันตัวเอง</p>
      <p>เมื่อลงการ์ดเสร็จ หรือจั่วการ์ดแล้ว เทิร์นจะสลับไปของเพื่อนคนถัดไปอัตโนมัติ</p>
      <p>ถ้าเหลือการ์ด 1 ใบ ให้กดปุ่มเอื้อยข่าบก่อนจบเทิร์น ไม่งั้นจะถูกลงโทษ</p>
    `;
  }
}

function repairText(value) {
  if (typeof value !== "string") return value;
  if (!/[ÃƒÃ Ã‚]/.test(value)) return value;

  let fixed = value;
  for (let count = 0; count < 2; count += 1) {
    try {
      const candidate = decodeURIComponent(escape(fixed));
      if (!candidate || candidate.includes("ï¿½")) break;
      fixed = candidate;
      if (!/[ÃƒÃ Ã‚]/.test(fixed)) break;
    } catch (_error) {
      break;
    }
  }
  return fixed;
}

function repairText(value) {
  if (typeof value !== "string") return value;
  if (!value) return value;
  if (/[\u0E00-\u0E7F]/.test(value) && !/(?:Ã|Â|à¸|à¹|àº|ï¿½|�|ðŸ|â)/.test(value)) return value;
  if (/^[\x00-\x7F]*$/.test(value)) return value;

  const scoreText = (text) => {
    const thai = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
    const mojibake = (text.match(/(?:Ã|Â|à¸|à¹|àº|ï¿½)/g) || []).length;
    const replacement = (text.match(/�/g) || []).length;
    return (thai * 4) - (mojibake * 3) - (replacement * 6);
  };

  let fixed = value;
  let best = value;
  let bestScore = scoreText(value);
  for (let count = 0; count < 3; count += 1) {
    try {
      const candidate = decodeURIComponent(escape(fixed));
      if (!candidate || candidate === fixed) break;
      const candidateScore = scoreText(candidate);
      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
      fixed = candidate;
      if (/[\u0E00-\u0E7F]/.test(candidate) && !/(?:Ã|Â|à¸|à¹|àº|ï¿½)/.test(candidate)) break;
    } catch (_error) {
      break;
    }
  }
  return best;
}

function repairText(value) {
  if (typeof value !== "string") return value;
  if (!value) return value;
  if (/[\u0E00-\u0E7F]/.test(value) && !/(?:Ã|Â|à¸|à¹|àº|ï¿½|�|ðŸ|â)/.test(value)) return value;
  if (/^[\x00-\x7F]*$/.test(value)) return value;

  const cp1252Map = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F,
  };

  const encodeCp1252 = (text) => new Uint8Array(
    [...text].map((char) => {
      const code = char.charCodeAt(0);
      if (code <= 0xFF) return code;
      return cp1252Map[code] ?? 0x3F;
    }),
  );
  const scoreText = (text) => {
    const thai = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
    const mojibake = (text.match(/(?:Ã|Â|à¸|à¹|àº|ï¿½|�)/g) || []).length;
    return (thai * 4) - (mojibake * 3);
  };

  let fixed = value;
  let best = value;
  let bestScore = scoreText(value);
  for (let count = 0; count < 4; count += 1) {
    try {
      const candidate = new TextDecoder("utf-8").decode(encodeCp1252(fixed));
      if (!candidate || candidate === fixed) break;
      const candidateScore = scoreText(candidate);
      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
      fixed = candidate;
      if (/[\u0E00-\u0E7F]/.test(candidate) && !/(?:Ã|Â|à¸|à¹|àº|ï¿½|�)/.test(candidate)) break;
    } catch (_error) {
      break;
    }
  }
  return best;
}

function normalizeCard(card) {
  if (!card) return null;
  return {
    ...card,
    name: repairText(card.name),
    desc: repairText(card.desc),
  };
}

function normalizePendingAction(action) {
  if (!action) return null;

  if (action.mode === "select_player") {
    return {
      ...action,
      cardName: repairText(action.cardName),
      title: repairText(action.title),
      description: repairText(action.description),
      options: (action.options || []).map((option) => ({
        ...option,
        name: repairText(option.name),
      })),
    };
  }

  return {
    ...action,
    cardName: repairText(action.cardName),
    title: repairText(action.title),
    description: repairText(action.description),
    availableCards: (action.availableCards || []).map(normalizeCard),
  };
}

function normalizeRoomState(roomState) {
  return {
    ...roomState,
    roomId: repairText(roomState.roomId),
    currentTurnName: repairText(roomState.currentTurnName),
    notice: repairText(roomState.notice),
    winnerNames: (roomState.winnerNames || []).map(repairText),
    winnerReason: repairText(roomState.winnerReason || ""),
    logs: (roomState.logs || []).map(repairText),
    chatMessages: (roomState.chatMessages || []).map((message) => ({
      ...message,
      name: repairText(message.name),
      text: repairText(message.text),
      time: repairText(message.time),
    })),
    graveTopCard: normalizeCard(roomState.graveTopCard),
    lastPlayedCard: normalizeCard(roomState.lastPlayedCard),
    graveCards: (roomState.graveCards || []).map(normalizeCard),
    centerWarning: roomState.centerWarning
      ? {
        ...roomState.centerWarning,
        text: repairText(roomState.centerWarning.text),
        cyclesLeft: roomState.centerWarning.cyclesLeft,
      }
      : null,
    pendingAction: normalizePendingAction(roomState.pendingAction),
    inspectedHand: roomState.inspectedHand
      ? {
        ...roomState.inspectedHand,
        targetName: repairText(roomState.inspectedHand.targetName),
        cards: (roomState.inspectedHand.cards || []).map(normalizeCard),
      }
      : null,
    players: (roomState.players || []).map((player) => ({
      ...player,
      name: repairText(player.name),
      hand: (player.hand || []).map(normalizeCard),
    })),
  };
}

function imagePath(cardId) {
  return `/assets/images/${cardId}.png`;
}

function unlockAudio() {
  state.audioUnlocked = true;
}

function playSound(name, repeat = 1, options = {}) {
  if (!state.audioUnlocked) return;
  const fileName = SOUND_FILES[name];
  if (!fileName) return;

  const playCount = Math.max(1, Math.min(Number(repeat) || 1, 24));
  const defaultSpacing = {
    cardReceive: 190,
    cardPlay: 220,
  };
  const baseDelay = options.spacingMs ?? options.delayMs ?? defaultSpacing[name] ?? 90;
  const startDelayMs = Math.max(0, options.startDelayMs ?? 0);
  const now = Date.now();
  const scheduledFrom = Math.max(now + startDelayMs, state.soundSchedule[name] || 0);

  for (let index = 0; index < playCount; index += 1) {
    const scheduledAt = scheduledFrom + (index * baseDelay);
    window.setTimeout(() => {
      const audio = new Audio(`${SOUND_PATH}/${fileName}`);
      audio.preload = "auto";
      audio.volume = SOUND_VOLUMES[name] ?? 0.8;
      audio.play().catch(() => {});
    }, Math.max(0, scheduledAt - now));
  }

  state.soundSchedule[name] = scheduledFrom + (Math.max(0, playCount - 1) * baseDelay) + 120;
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function getNewLogEntries(previousLogs = [], nextLogs = []) {
  if (!previousLogs.length) return [];

  const maxOverlap = Math.min(previousLogs.length, nextLogs.length);
  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    if (arraysEqual(previousLogs.slice(-overlap), nextLogs.slice(0, overlap))) {
      return nextLogs.slice(overlap);
    }
  }

  return nextLogs;
}

function getPlayerCardCount(player) {
  if (!player) return 0;
  if (typeof player.cardCount === "number") return player.cardCount;
  return Array.isArray(player.hand) ? player.hand.length : 0;
}

function getPositiveHandDelta(previousRoomState, nextRoomState) {
  if (!previousRoomState) return 0;

  let delta = 0;
  (nextRoomState.players || []).forEach((nextPlayer) => {
    const previousPlayer = (previousRoomState.players || []).find((candidate) => candidate.id === nextPlayer.id);
    const playerDelta = getPlayerCardCount(nextPlayer) - getPlayerCardCount(previousPlayer);
    if (playerDelta > 0) {
      delta += playerDelta;
    }
  });
  return delta;
}

function waitMs(duration) {
  return new Promise((resolve) => {
    state.specialWinnerTimer = window.setTimeout(resolve, duration);
  });
}

function clearRevealTimers() {
  state.revealTimers.forEach((timerId) => clearTimeout(timerId));
  state.revealTimers = [];
}

function setRevealCount(playerId, count) {
  state.revealCounts[playerId] = Math.max(0, count);
}

function getRevealCount(player) {
  const actualCount = player.id === socket.id ? (player.hand || []).length : player.cardCount;
  if (typeof state.revealCounts[player.id] !== "number") {
    return actualCount;
  }
  return Math.max(0, Math.min(actualCount, state.revealCounts[player.id]));
}

function prepareRevealCounts(roomState, previousRoomState) {
  if (!previousRoomState || (!previousRoomState.gameStarted && roomState.gameStarted) || (previousRoomState.roundEnded && !roomState.roundEnded)) {
    clearRevealTimers();
    state.revealCounts = Object.fromEntries((roomState.players || []).map((player) => [player.id, 0]));
    return;
  }

  (roomState.players || []).forEach((player) => {
    const actualCount = player.id === socket.id ? (player.hand || []).length : player.cardCount;
    if (typeof state.revealCounts[player.id] !== "number") {
      state.revealCounts[player.id] = actualCount;
      return;
    }
    state.revealCounts[player.id] = Math.min(state.revealCounts[player.id], actualCount);
  });
}

function applyImmediateRevealEffects(roomState) {
  (roomState.effects || []).forEach((effect) => {
    const effectKey = `${roomState.roomId}:${effect.id}`;
    if (state.seenEffectKeys.has(effectKey)) return;
    if (effect.type === "hand_reset") {
      (effect.playerIds || []).forEach((playerId) => setRevealCount(playerId, 0));
    }
  });
}

function clearSpecialWinnerAnimation() {
  if (state.specialWinnerTimer) {
    clearTimeout(state.specialWinnerTimer);
    state.specialWinnerTimer = null;
  }
  state.specialWinnerAnimationKey = "";
  assemblyWinLayer.classList.remove("show");
  assemblyWinLayer.classList.add("hidden");
  assemblyWinFlash.classList.remove("show");
  assemblyWinArena.innerHTML = "";
  videoWinLayer.classList.remove("show");
  videoWinLayer.classList.add("hidden");
  if (youtubePlayer && typeof youtubePlayer.destroy === "function") {
    try {
      youtubePlayer.destroy();
    } catch (_error) {
      // ignore cleanup errors
    }
  }
  youtubePlayer = null;
  if (videoWinPlayer) {
    videoWinPlayer.innerHTML = "";
  }
  posterWinLayer.classList.remove("show");
  posterWinLayer.classList.add("hidden");
  if (posterWinImage) {
    posterWinImage.src = "";
  }
}

function isPinkAssemblyWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸£à¸§à¸šà¸£à¸§à¸¡à¸«à¸±à¸§ à¹à¸‚à¸™ à¹à¸¥à¸°à¸‚à¸²") && text.includes("à¸žà¸´à¸‡à¸„à¹Œà¹€à¸šà¸­à¸£à¹Œà¸£à¸µà¹ˆ");
}

/*
function isPinkLegendaryWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("Ã Â¸Å¾Ã Â¸Â´Ã Â¸â€¡Ã Â¸â€žÃ Â¹Å’Ã Â¹â‚¬Ã Â¸Å¡Ã Â¸Â­Ã Â¸Â£Ã Â¹Å’Ã Â¸Â£Ã Â¸ÂµÃ Â¹Ë†Ã Â¹â‚¬Ã Â¸â€”Ã Â¸Å¾Ã Â¸â€¹Ã Â¹Ë†Ã Â¸Â²") && text.includes("Ã Â¸Å Ã Â¸â„¢Ã Â¸Â°Ã Â¸â€”Ã Â¸Â±Ã Â¸â„¢Ã Â¸â€”Ã Â¸Âµ");
}

function isZeroWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("Ã Â¸â€¹Ã Â¸ÂµÃ Â¹â€šÃ Â¸Â£Ã Â¹Ë†Ã Â¹â‚¬Ã Â¸â€”Ã Â¸Å¾Ã Â¸Ë†Ã Â¸Â¸Ã Â¸â€¢Ã Â¸Â´Ã Â¸Â¡Ã Â¸Â²Ã Â¹â‚¬Ã Â¸ÂÃ Â¸Â´Ã Â¸â€) && text.includes("3 Ã Â¸â€žÃ Â¸Â£Ã Â¸Â±Ã Â¹â€°Ã Â¸â€¡");
}

function isValeskaWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("Ã Â¸Â§Ã Â¸Â²Ã Â¹â‚¬Ã Â¸Â¥Ã Â¸ÂªÃ Â¸ÂÃ Â¹â€°Ã Â¸Â²Ã Â¸Å“Ã Â¸Â¹Ã Â¹â€°Ã Â¸Â¡Ã Â¸Â±Ã Â¹Ë†Ã Â¸â€¡Ã Â¸â€žÃ Â¸Â±Ã Â¹Ë†Ã Â¸â€¡");
}

*/
function isPinkLegendaryWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸žà¸´à¸‡à¸„à¹Œà¹€à¸šà¸­à¸£à¹Œà¸£à¸µà¹ˆà¹€à¸—à¸žà¸‹à¹ˆà¸²") && text.includes("à¸Šà¸™à¸°à¸—à¸±à¸™à¸—à¸µ");
}

function isZeroWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸‹à¸µà¹‚à¸£à¹ˆà¹€à¸—à¸žà¸ˆà¸¸à¸•à¸´à¸¡à¸²à¹€à¸à¸´à¸”") && text.includes("3 à¸„à¸£à¸±à¹‰à¸‡");
}

function isValeskaWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸§à¸²à¹€à¸¥à¸ªà¸à¹‰à¸²à¸œà¸¹à¹‰à¸¡à¸±à¹ˆà¸‡à¸„à¸±à¹ˆà¸‡");
}

function isBethanyWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("\u0e40\u0e1a\u0e18\u0e32\u0e19\u0e35\u0e40\u0e17\u0e1e\u0e2b\u0e25\u0e31\u0e1a") && text.includes("\u0e04\u0e23\u0e1a 3 \u0e04\u0e23\u0e31\u0e49\u0e07");
}
function showWinnerOverlayContent(winnerNamesText, winnerReason, overlayKey, options = {}) {
  state.winnerOverlayKey = overlayKey;
  if (options.playSound) {
    playSound("victory");
  }
  winnerOverlayTitle.textContent = "Ã Â¹â‚¬Ã Â¸ÂÃ Â¸Â¡Ã Â¸Ë†Ã Â¸Å¡Ã Â¹ÂÃ Â¸Â¥Ã Â¹â€°Ã Â¸Â§ Ã Â¸Â¢Ã Â¸Â´Ã Â¸â„¢Ã Â¸â€Ã Â¸ÂµÃ Â¸â€Ã Â¹â€°Ã Â¸Â§Ã Â¸Â¢ Ã Â¸Å“Ã Â¸Â¹Ã Â¹â€°Ã Â¸Å Ã Â¸â„¢Ã Â¸Â°Ã Â¸â€žÃ Â¸Â·Ã Â¸Â­";
  renderAnimatedWinnerText(winnerOverlayName, winnerNamesText);
  winnerOverlayReason.textContent = winnerReason;
  winnerOverlay.classList.remove("hidden");
  requestAnimationFrame(() => winnerOverlay.classList.add("show"));
}

function isPinkLegendaryWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸žà¸´à¸‡à¸„à¹Œà¹€à¸šà¸­à¸£à¹Œà¸£à¸µà¹ˆà¹€à¸—à¸žà¸‹à¹ˆà¸²") && text.includes("à¸Šà¸™à¸°à¸—à¸±à¸™à¸—à¸µ");
}

function isZeroWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸‹à¸µà¹‚à¸£à¹ˆà¹€à¸—à¸žà¸ˆà¸¸à¸•à¸´à¸¡à¸²à¹€à¸à¸´à¸”") && text.includes("3 à¸„à¸£à¸±à¹‰à¸‡");
}

function isValeskaWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸§à¸²à¹€à¸¥à¸ªà¸à¹‰à¸²à¸œà¸¹à¹‰à¸¡à¸±à¹ˆà¸‡à¸„à¸±à¹ˆà¸‡");
}

function isBethanyWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("\u0e40\u0e1a\u0e18\u0e32\u0e19\u0e35\u0e40\u0e17\u0e1e\u0e2b\u0e25\u0e31\u0e1a") && text.includes("\u0e04\u0e23\u0e1a 3 \u0e04\u0e23\u0e31\u0e49\u0e07");
}
function isDreamWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¹‚à¸ˆà¸œà¸¹à¹‰à¸™à¸µà¹‰à¸¡à¸µà¸„à¸§à¸²à¸¡à¸à¸±à¸™")
    || text.includes("à¹‚à¸ˆà¹€à¸‹à¸Ÿà¸µà¸™à¸à¸³à¸¥à¸±à¸‡à¸«à¸±à¸§à¹€à¸£à¸²à¸°à¸‚à¸“à¸°à¸¡à¸µà¹‚à¸ˆà¸œà¸¹à¹‰à¸™à¸µà¹‰à¸¡à¸µà¸„à¸§à¸²à¸¡à¸à¸±à¸™")
    || (text.includes("à¹‚à¸ˆà¹€à¸‹à¸Ÿà¸µà¸™à¸à¸³à¸¥à¸±à¸‡à¸«à¸±à¸§à¹€à¸£à¸²à¸°") && text.includes("à¸Šà¸™à¸°à¸—à¸±à¸™à¸—à¸µ"));
}

function isJapinkWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("à¸—à¸²à¸¢à¸–à¸¹à¸à¸§à¹ˆà¸²à¹‚à¸ˆà¹€à¸‹à¸Ÿà¸µà¸™à¸à¸³à¸¥à¸±à¸‡à¸«à¸±à¸§à¹€à¸£à¸²à¸°");
}

function showWinnerOverlayContent(winnerNamesText, winnerReason, overlayKey, options = {}) {
  state.winnerOverlayKey = overlayKey;
  if (options.playSound) {
    playSound("victory");
  }
  winnerOverlayTitle.textContent = "เกมจบแล้ว ยินดีด้วย ผู้ชนะคือ";
  renderAnimatedWinnerText(winnerOverlayName, winnerNamesText);
  winnerOverlayReason.textContent = winnerReason;
  winnerOverlay.classList.remove("hidden");
  requestAnimationFrame(() => winnerOverlay.classList.add("show"));
}

function isPinkAssemblyWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("รวบรวมหัว แขน และขา") && text.includes("พิงค์เบอร์รี่");
}

function isPinkLegendaryWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("พิงค์เบอร์รี่เทพซ่า") && text.includes("ชนะทันที");
}

function isZeroWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("ซีโร่เทพจุติมาเกิด") && text.includes("3 ครั้ง");
}

function isValeskaWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("วาเลสก้าผู้มั่งคั่ง");
}

function isBethanyWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("เบธานีเทพหลับ") && text.includes("ครบ 3 ครั้ง");
}

function isDreamWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("โจผู้นี้มีความฝัน")
    || text.includes("โจเซฟีนกำลังหัวเราะขณะมีโจผู้นี้มีความฝัน")
    || (text.includes("โจเซฟีนกำลังหัวเราะ") && text.includes("ชนะทันที"));
}

function isJapinkWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("ทายถูกว่าโจเซฟีนกำลังหัวเราะ");
}

function showWinnerOverlayContent(winnerNamesText, winnerReason, overlayKey, options = {}) {
  state.winnerOverlayKey = overlayKey;
  if (options.playSound) {
    playSound("victory");
  }
  winnerOverlayTitle.textContent = "เกมจบแล้ว ยินดีด้วย ผู้ชนะคือ";
  renderAnimatedWinnerText(winnerOverlayName, winnerNamesText);
  winnerOverlayReason.textContent = winnerReason;
  winnerOverlay.classList.remove("hidden");
  requestAnimationFrame(() => winnerOverlay.classList.add("show"));
}

function parseYouTubeVideoId(input) {
  const text = repairText(input || "").trim();
  if (!text || text === "[ytauto=][/ytauto]") return "";
  const tagMatch = text.match(/\[ytauto=([^\]]+)\]/i);
  const normalizedText = (tagMatch?.[1] || text).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(normalizedText)) {
    return normalizedText;
  }
  try {
    const url = new URL(normalizedText);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/\//g, "").trim();
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[1] || parts[0] || "";
    }
  } catch (_error) {
    return "";
  }
  return "";
}

function ensureYouTubeApiLoaded() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof existingHandler === "function") {
        existingHandler();
      }
      resolve(window.YT);
    };

    const existingScript = document.querySelector("script[data-youtube-api='true']");
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.youtubeApi = "true";
    script.onerror = () => {
      youtubeApiPromise = null;
      reject(new Error("โหลด YouTube API ไม่สำเร็จ"));
    };
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function getPlayerRectByName(roomState, playerName) {
  const target = (roomState.players || []).find((player) => repairText(player.name) === repairText(playerName));
  if (!target) return null;
  return getAnchorRectForPlayer(roomState, target.id);
}

function animateElementFrames(element, keyframes, options) {
  const animation = element.animate(keyframes, options);
  return animation.finished.catch(() => {});
}

function setAssemblyCardPosition(element, x, y, scale = 1) {
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

async function runPinkAssemblyWinnerAnimation(roomState, overlayKey, winnerNames, winnerReason) {
  clearSpecialWinnerAnimation();
  state.specialWinnerAnimationKey = overlayKey;
  assemblyWinArena.innerHTML = "";
  assemblyWinFlash.classList.remove("show");
  assemblyWinLayer.classList.remove("hidden");
  assemblyWinLayer.classList.add("show");

  const boardRect = document.querySelector(".game-board").getBoundingClientRect();
  const sourceRect = getPlayerRectByName(roomState, winnerNames[0]) || boardRect;
  const sourceX = sourceRect.left + (sourceRect.width / 2);
  const sourceY = sourceRect.top + (sourceRect.height / 2);
  const centerX = boardRect.left + (boardRect.width / 2);
  const centerY = boardRect.top + (boardRect.height / 2) + 10;
  const riseTargets = [-280, -140, 0, 140, 280].map((offsetX, index) => ({
    x: centerX + offsetX,
    y: centerY + 86 + ((index % 2) * 16),
  }));
  const formationTargets = {
    card_04: { x: centerX, y: centerY - 180 },
    card_05: { x: centerX - 126, y: centerY - 8 },
    card_06: { x: centerX + 126, y: centerY - 8 },
    card_07: { x: centerX - 96, y: centerY + 170 },
    card_08: { x: centerX + 96, y: centerY + 170 },
  };
  const cardIds = ["card_04", "card_05", "card_06", "card_07", "card_08"];
  const cardElements = cardIds.map((cardId, index) => {
    const card = document.createElement("img");
    card.className = "assembly-win-card";
    card.src = imagePath(cardId);
    card.alt = cardId;
    card.draggable = false;
    card.onerror = fallbackImage;
    setAssemblyCardPosition(card, sourceX, sourceY + 30, 0.78);
    card.style.opacity = "0";
    assemblyWinArena.appendChild(card);
    window.setTimeout(() => card.classList.add("is-visible"), index * 90);
    return card;
  });

  playSound("pinkExodia");

  await Promise.all(cardElements.map((card, index) => animateElementFrames(
    card,
    [
      {
        left: `${sourceX}px`,
        top: `${sourceY + 34}px`,
        transform: "translate(-50%, -50%) scale(0.74)",
        opacity: 0,
      },
      {
        left: `${riseTargets[index].x}px`,
        top: `${riseTargets[index].y}px`,
        transform: "translate(-50%, -50%) scale(1)",
        opacity: 1,
      },
    ],
    {
      duration: 880,
      delay: index * 260,
      easing: "cubic-bezier(0.2, 0.82, 0.18, 1)",
      fill: "forwards",
    },
  )));

  for (let orbitIndex = 0; orbitIndex < 3; orbitIndex += 1) {
    await Promise.all(cardElements.map((card, index) => {
      const radiusX = 168;
      const radiusY = 110;
      const steps = 28;
      const phase = (Math.PI * 2 * index) / cardElements.length;
      const frames = Array.from({ length: steps + 1 }, (_, stepIndex) => {
        const progress = stepIndex / steps;
        const angle = (progress * Math.PI * 2) + phase;
        return {
          left: `${centerX + (Math.cos(angle) * radiusX)}px`,
          top: `${centerY + (Math.sin(angle) * radiusY)}px`,
          transform: "translate(-50%, -50%) scale(1)",
          opacity: 1,
        };
      });
      return animateElementFrames(card, frames, {
        duration: 1180,
        easing: "linear",
        fill: "forwards",
      });
    }));
  }

  await Promise.all(cardElements.map((card, index) => {
    const cardId = cardIds[index];
    const target = formationTargets[cardId];
    const computedStyle = window.getComputedStyle(card);
    return animateElementFrames(
      card,
      [
        {
          left: computedStyle.left,
          top: computedStyle.top,
          transform: "translate(-50%, -50%) scale(1)",
          opacity: 1,
        },
        {
          left: `${target.x}px`,
          top: `${target.y}px`,
          transform: "translate(-50%, -50%) scale(1.02)",
          opacity: 1,
        },
      ],
      {
        duration: 820,
        easing: "cubic-bezier(0.18, 0.86, 0.22, 1)",
        fill: "forwards",
      },
    );
  }));

  assemblyWinFlash.classList.add("show");
  await waitMs(760);
  assemblyWinFlash.classList.remove("show");
  await waitMs(240);

  if (state.specialWinnerAnimationKey !== overlayKey || state.dismissedWinnerOverlayKey === overlayKey) {
    return;
  }

  assemblyWinLayer.classList.remove("show");
  window.setTimeout(() => {
    if (!assemblyWinLayer.classList.contains("show")) {
      assemblyWinLayer.classList.add("hidden");
      assemblyWinArena.innerHTML = "";
    }
  }, 320);

  state.winnerOverlayKey = overlayKey;
  winnerOverlayTitle.textContent = "ขอแสดงความยินดีกับ ผู้ชนะในรอบนี้­";
  renderAnimatedWinnerText(winnerOverlayName, winnerNames.join(", "));
  winnerOverlayReason.textContent = winnerReason;
  winnerOverlay.classList.remove("hidden");
  requestAnimationFrame(() => winnerOverlay.classList.add("show"));
}

async function runSingleCardWinnerAnimation(roomState, overlayKey, winnerNames, winnerReason, cardId, soundName) {
  clearSpecialWinnerAnimation();
  state.specialWinnerAnimationKey = overlayKey;
  assemblyWinArena.innerHTML = "";
  assemblyWinFlash.classList.remove("show");
  assemblyWinLayer.classList.remove("hidden");
  assemblyWinLayer.classList.add("show");

  const boardRect = document.querySelector(".game-board").getBoundingClientRect();
  const sourceRect = getPlayerRectByName(roomState, winnerNames[0]) || boardRect;
  const sourceX = sourceRect.left + (sourceRect.width / 2);
  const sourceY = sourceRect.top + (sourceRect.height / 2);
  const centerX = boardRect.left + (boardRect.width / 2);
  const centerY = boardRect.top + (boardRect.height / 2);

  const card = document.createElement("img");
  card.className = "assembly-win-card assembly-win-card--single";
  card.src = imagePath(cardId);
  card.alt = cardId;
  card.draggable = false;
  card.onerror = fallbackImage;
  setAssemblyCardPosition(card, sourceX, sourceY + 36, 0.76);
  card.style.opacity = "0";
  assemblyWinArena.appendChild(card);
  requestAnimationFrame(() => card.classList.add("is-visible"));

  playSound(soundName);

  await animateElementFrames(
    card,
    [
      {
        left: `${sourceX}px`,
        top: `${sourceY + 38}px`,
        transform: "translate(-50%, -50%) scale(0.76)",
        opacity: 0.05,
        filter: "drop-shadow(0 0 22px rgba(255, 231, 173, 0.38)) drop-shadow(0 0 36px rgba(255, 112, 174, 0.28))",
      },
      {
        left: `${centerX}px`,
        top: `${centerY - 34}px`,
        transform: "translate(-50%, -50%) scale(1.08)",
        opacity: 1,
        filter: "drop-shadow(0 0 26px rgba(255, 244, 194, 0.72)) drop-shadow(0 0 56px rgba(255, 143, 202, 0.5))",
      },
    ],
    {
      duration: 1120,
      easing: "cubic-bezier(0.18, 0.86, 0.22, 1)",
      fill: "forwards",
    },
  );

  await animateElementFrames(
    card,
    [
      {
        left: `${centerX}px`,
        top: `${centerY - 34}px`,
        transform: "translate(-50%, -50%) scale(1.08)",
        opacity: 1,
        filter: "drop-shadow(0 0 26px rgba(255, 244, 194, 0.72)) drop-shadow(0 0 56px rgba(255, 143, 202, 0.5))",
      },
      {
        left: `${centerX}px`,
        top: `${centerY - 20}px`,
        transform: "translate(-50%, -50%) scale(1.66)",
        opacity: 1,
        filter: "drop-shadow(0 0 34px rgba(255, 250, 218, 0.9)) drop-shadow(0 0 84px rgba(255, 171, 214, 0.72))",
      },
    ],
    {
      duration: 840,
      easing: "cubic-bezier(0.2, 0.82, 0.18, 1)",
      fill: "forwards",
    },
  );

  assemblyWinFlash.classList.add("show");
  await waitMs(720);
  assemblyWinFlash.classList.remove("show");
  await waitMs(220);

  if (state.specialWinnerAnimationKey !== overlayKey || state.dismissedWinnerOverlayKey === overlayKey) {
    return;
  }

  assemblyWinLayer.classList.remove("show");
  window.setTimeout(() => {
    if (!assemblyWinLayer.classList.contains("show")) {
      assemblyWinLayer.classList.add("hidden");
      assemblyWinArena.innerHTML = "";
    }
  }, 320);

  showWinnerOverlayContent(winnerNames.join(", "), winnerReason, overlayKey);
}

async function runValeskaWinnerVideo(overlayKey, winnerNames, winnerReason) {
  clearSpecialWinnerAnimation();
  state.specialWinnerAnimationKey = overlayKey;
  videoWinLayer.classList.remove("hidden");
  requestAnimationFrame(() => videoWinLayer.classList.add("show"));

  const videoId = parseYouTubeVideoId(VALESKA_WIN_YOUTUBE_URL);
  if (!videoId) {
    await waitMs(1500);
    if (state.specialWinnerAnimationKey !== overlayKey || state.dismissedWinnerOverlayKey === overlayKey) {
      return;
    }
    videoWinLayer.classList.remove("show");
    window.setTimeout(() => {
      if (!videoWinLayer.classList.contains("show")) {
        videoWinLayer.classList.add("hidden");
      }
    }, 320);
    showWinnerOverlayContent(winnerNames.join(", "), winnerReason, overlayKey);
    return;
  }

  try {
    await ensureYouTubeApiLoaded();
  } catch (_error) {
    await waitMs(1200);
    if (state.specialWinnerAnimationKey !== overlayKey || state.dismissedWinnerOverlayKey === overlayKey) {
      return;
    }
    videoWinLayer.classList.remove("show");
    window.setTimeout(() => {
      if (!videoWinLayer.classList.contains("show")) {
        videoWinLayer.classList.add("hidden");
      }
    }, 320);
    showWinnerOverlayContent(winnerNames.join(", "), winnerReason, overlayKey);
    return;
  }

  const playerState = window.YT?.PlayerState;
  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (state.specialWinnerTimer) {
        clearTimeout(state.specialWinnerTimer);
        state.specialWinnerTimer = null;
      }
      resolve();
    };

    state.specialWinnerTimer = window.setTimeout(finish, 1000 * 60 * 15);
    youtubePlayer = new window.YT.Player(videoWinPlayer, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: (event) => {
          try {
            event.target.playVideo();
          } catch (_error) {
            // ignore autoplay errors
          }
        },
        onStateChange: (event) => {
          if (playerState && event.data === playerState.ENDED) {
            finish();
          }
        },
        onError: () => {
          finish();
        },
      },
    });
  });

  if (youtubePlayer && typeof youtubePlayer.destroy === "function") {
    try {
      youtubePlayer.destroy();
    } catch (_error) {
      // ignore cleanup errors
    }
  }
  youtubePlayer = null;
  videoWinPlayer.innerHTML = "";

  if (state.specialWinnerAnimationKey !== overlayKey || state.dismissedWinnerOverlayKey === overlayKey) {
    return;
  }

  videoWinLayer.classList.remove("show");
  window.setTimeout(() => {
    if (!videoWinLayer.classList.contains("show")) {
      videoWinLayer.classList.add("hidden");
    }
  }, 320);

  showWinnerOverlayContent(winnerNames.join(", "), winnerReason, overlayKey);
}

async function runPosterWinnerScene(overlayKey, winnerNames, winnerReason, imageFileName, soundName) {
  clearSpecialWinnerAnimation();
  state.specialWinnerAnimationKey = overlayKey;

  if (posterWinImage) {
    posterWinImage.src = `/assets/images/${imageFileName}`;
    posterWinImage.alt = winnerReason || "winner scene";
    posterWinImage.onerror = () => {
      posterWinImage.src = "/assets/images/back_card.png";
    };
  }

  posterWinLayer.classList.remove("hidden");
  requestAnimationFrame(() => posterWinLayer.classList.add("show"));
  playSound(soundName);

  await waitMs(10000);

  if (state.specialWinnerAnimationKey !== overlayKey || state.dismissedWinnerOverlayKey === overlayKey) {
    return;
  }

  posterWinLayer.classList.remove("show");
  window.setTimeout(() => {
    if (!posterWinLayer.classList.contains("show")) {
      posterWinLayer.classList.add("hidden");
      if (posterWinImage) {
        posterWinImage.src = "";
      }
    }
  }, 360);

  showWinnerOverlayContent(winnerNames.join(", "), winnerReason, overlayKey);
}

function fallbackImage(event) {
  event.target.src = "/assets/images/back_card.png";
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function isModalOpen(modal) {
  return !!modal && !modal.classList.contains("hidden");
}

function updateChatUnreadUI() {
  if (!chatUnreadBadge || !openChatModalBtn) return;

  const unreadCount = Math.max(0, state.unreadChatCount || 0);
  chatUnreadBadge.textContent = unreadCount > 99 ? "99+" : `${unreadCount}`;
  chatUnreadBadge.classList.toggle("hidden", unreadCount === 0);
  openChatModalBtn.classList.toggle("has-unread", unreadCount > 0);
}

function triggerChatFlash(messageCount = 1) {
  if (!openChatModalBtn) return;

  const flashCount = Math.max(1, Math.min(9, Number(messageCount) || 1));
  openChatModalBtn.style.setProperty("--chat-flash-count", `${flashCount}`);
  openChatModalBtn.classList.remove("chat-flash");
  void openChatModalBtn.offsetWidth;
  openChatModalBtn.classList.add("chat-flash");
}

function markChatAsRead() {
  state.unreadChatCount = 0;
  updateChatUnreadUI();
}

function isPointInsideRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function showTooltipForCard(card, options = {}) {
  const safeCard = normalizeCard(card);
  if (!safeCard) return;

  cardTooltipImage.src = imagePath(safeCard.id);
  cardTooltipImage.alt = safeCard.name;
  cardTooltipImage.onerror = () => {
    cardTooltipImage.src = "/assets/images/back_card.png";
  };
  cardTooltipTitle.textContent = safeCard.name;
  cardTooltipDesc.textContent = safeCard.desc;

  const anchorRect = options.anchorRect || null;
  cardTooltip.style.left = "16px";
  cardTooltip.style.top = "16px";
  const tooltipWidth = Math.min(cardTooltip.offsetWidth || 460, window.innerWidth - 32);
  const tooltipHeight = cardTooltip.offsetHeight || 560;

  let left;
  let top;

  if (typeof options.clientX === "number" && typeof options.clientY === "number") {
    left = Math.min(
      Math.max(16, options.clientX - (tooltipWidth / 2)),
      window.innerWidth - tooltipWidth - 16,
    );
    top = Math.max(16, options.clientY - tooltipHeight - 28);
  } else if (anchorRect) {
    left = Math.min(
      Math.max(16, anchorRect.left + (anchorRect.width / 2) - (tooltipWidth / 2)),
      window.innerWidth - tooltipWidth - 16,
    );
    top = Math.max(16, anchorRect.top - tooltipHeight - 20);
  } else {
    left = Math.max(16, (window.innerWidth - tooltipWidth) / 2);
    top = 24;
  }

  cardTooltip.style.left = `${left}px`;
  cardTooltip.style.top = `${top}px`;
  cardTooltip.classList.add("show");
}

function hideTooltip() {
  cardTooltip.classList.remove("show");
}

function bindHoverTooltip(element, card) {
  const safeCard = normalizeCard(card);
  if (!safeCard) return;

  element.addEventListener("mouseenter", (event) => {
    if (state.drag?.dragging) return;
    showTooltipForCard(safeCard, {
      clientX: event.clientX,
      clientY: event.clientY,
      anchorRect: element.getBoundingClientRect(),
    });
  });

  element.addEventListener("mousemove", (event) => {
    if (state.drag?.dragging) return;
    showTooltipForCard(safeCard, {
      clientX: event.clientX,
      clientY: event.clientY,
      anchorRect: element.getBoundingClientRect(),
    });
  });

  element.addEventListener("mouseleave", () => {
    if (state.drag?.sourceElement === element && !state.drag.dragging) {
      return;
    }
    hideTooltip();
  });
}

function clearHoldTimer() {
  if (!state.drag?.holdTimer) return;
  clearTimeout(state.drag.holdTimer);
  state.drag.holdTimer = null;
}

function cleanupDrag() {
  clearHoldTimer();
  hideTooltip();

  if (state.drag?.ghost) {
    state.drag.ghost.remove();
  }
  if (state.drag?.sourceElement) {
    state.drag.sourceElement.classList.remove("drag-origin", "card-held");
  }

  centerDropZone.classList.remove("drag-ready", "drag-over");
  document.body.classList.remove("dragging-card");
  state.drag = null;
}

function updateDragGhostPosition(clientX, clientY) {
  if (!state.drag?.ghost) return;

  state.drag.ghost.style.left = `${clientX - 54}px`;
  state.drag.ghost.style.top = `${clientY - 78}px`;

  const dropRect = centerDropZone.getBoundingClientRect();
  centerDropZone.classList.toggle("drag-over", isPointInsideRect(clientX, clientY, dropRect));
}

function startDragging(clientX, clientY) {
  if (!state.drag || state.drag.dragging || !state.drag.canPlay) return;

  state.drag.dragging = true;
  hideTooltip();

  const ghost = state.drag.sourceElement.cloneNode(true);
  ghost.className = `card drag-ghost ${state.drag.sourceElement.classList.contains("small") ? "small" : ""}`.trim();
  ghost.draggable = false;
  document.body.appendChild(ghost);
  state.drag.ghost = ghost;

  state.drag.sourceElement.classList.add("drag-origin");
  centerDropZone.classList.add("drag-ready");
  document.body.classList.add("dragging-card");
  updateDragGhostPosition(clientX, clientY);
}

function canPlayCard(roomState, card) {
  if (!roomState || !card) return false;
  if (roomState.roundEnded || roomState.pendingAction || roomState.eliminated) return false;
  if (card.cannotBeUsed) return false;
  return (roomState.myTurn && (!roomState.turnActionTaken || roomState.turnKeepOpen)) || card.id === "card_13";
}

function handleCardPointerDown(event, card, element) {
  if (event.button !== 0) return;
  event.preventDefault();

  const roomState = state.roomState;
  const playable = canPlayCard(roomState, card);
  cleanupDrag();

  state.drag = {
    pointerId: event.pointerId,
    cardId: card.id,
    card,
    sourceElement: element,
    startX: event.clientX,
    startY: event.clientY,
    canPlay: playable,
    dragging: false,
    holdTimer: window.setTimeout(() => {
      if (!state.drag || state.drag.cardId !== card.id || state.drag.dragging) return;
      element.classList.add("card-held");
      showTooltipForCard(card, { anchorRect: element.getBoundingClientRect() });
    }, HOLD_DELAY_MS),
  };
}

function onGlobalPointerMove(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;

  const distance = Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY);
  if (!state.drag.dragging && state.drag.canPlay && distance >= DRAG_THRESHOLD_PX) {
    startDragging(event.clientX, event.clientY);
  }

  if (state.drag.dragging) {
    updateDragGhostPosition(event.clientX, event.clientY);
  }
}

function onGlobalPointerEnd(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;

  const shouldPlay = state.drag.dragging
    && state.drag.canPlay
    && isPointInsideRect(event.clientX, event.clientY, centerDropZone.getBoundingClientRect());
  const cardId = state.drag.cardId;

  cleanupDrag();

  if (shouldPlay) {
    socket.emit("playCard", { roomId, cardId });
  }
}

function createCardImage(card, options = {}) {
  const img = document.createElement("img");
  img.className = `card ${options.small ? "small" : ""}`.trim();
  img.src = imagePath(card.id);
  img.alt = card.name;
  img.draggable = false;
  img.onerror = fallbackImage;
  if (options.tooltip !== false) {
    bindHoverTooltip(img, card);
  }
  return img;
}

function createHandCard(card) {
  const playable = canPlayCard(state.roomState, card);
  const img = createCardImage(card);
  img.classList.add("card-in-hand");
  if (playable) {
    img.classList.add("card-draggable");
  }
  img.addEventListener("dragstart", (event) => event.preventDefault());
  img.addEventListener("pointerdown", (event) => handleCardPointerDown(event, card, img));
  return img;
}

function renderDeck(count) {
  const deckVisual = document.getElementById("deckVisual");
  const deckCount = document.getElementById("deckCount");
  deckVisual.innerHTML = "";

  if (count === 0) {
    deckVisual.innerHTML = '<div class="grave-box"><span class="muted">เดคหมดแล้ว</span></div>';
  } else {
    const layers = Math.max(1, Math.min(8, Math.ceil(count / 5)));
    for (let index = 0; index < layers; index += 1) {
      const layer = document.createElement("div");
      layer.className = "stack-card";
      layer.style.backgroundImage = "url('/assets/images/back_card.png')";
      layer.style.transform = `translate(${index * -2}px, ${index * -2}px)`;
      deckVisual.appendChild(layer);
    }
  }

  deckCount.textContent = `จำนวนการ์ด : ${count} ใบ`;
}

function renderCenterCard(lastPlayedCard) {
  const centerCardBox = document.getElementById("lastPlayedCard");
  centerCardBox.innerHTML = "";

  if (!lastPlayedCard) {
    centerCardBox.innerHTML = '<div class="muted">ยังไม่มีการ์ดถูกใช้งาน</div>';
    return;
  }

  centerCardBox.appendChild(createCardImage(lastPlayedCard));
}

function renderGraveyard(topCard, count) {
  const graveTop = document.getElementById("graveTop");
  const graveCount = document.getElementById("graveCount");
  graveTop.innerHTML = "";
  graveTop.classList.toggle("is-clickable", count > 0);

  if (!topCard) {
    graveTop.innerHTML = '<div class="muted">สุสานยังว่าง</div>';
  } else {
    graveTop.appendChild(createCardImage(topCard));
  }

  graveCount.textContent = `จำนวนการ์ดในสุสาน : ${count} ใบ`;
}

function renderGraveyardModal(cards) {
  state.graveCards = cards || [];
  graveyardModalCount.textContent = `จำนวนการ์ดในสุสาน : ${state.graveCards.length} ใบ`;
  graveyardModalList.innerHTML = "";

  if (!state.graveCards.length) {
    graveyardModalList.innerHTML = '<div class="empty-box">ตอนนี้สุสานยังไม่มีการ์ด</div>';
    return;
  }

  state.graveCards.forEach((card) => {
    const item = document.createElement("div");
    item.className = "modal-card-item";
    bindHoverTooltip(item, card);
    item.appendChild(createCardImage(card, { small: true, tooltip: false }));

    const name = document.createElement("div");
    name.className = "modal-card-name";
    name.textContent = card.name;
    item.appendChild(name);
    graveyardModalList.appendChild(item);
  });
}

function renderOverflowHandModal(cards) {
  state.overflowHandCards = cards || [];
  if (!overflowHandModalCards) return;

  overflowHandModalCards.innerHTML = "";
  if (overflowHandModalTitle) {
    overflowHandModalTitle.textContent = "การ์ดที่ซ่อนอยู่ในมือ";
  }
  if (overflowHandModalDescription) {
    overflowHandModalDescription.textContent = state.overflowHandCards.length
      ? `มีการ์ดที่ซ่อนอยู่ ${state.overflowHandCards.length} ใบ`
      : "ตอนนี้ยังไม่มีการ์ดที่ซ่อนอยู่ในมือ";
  }

  if (!state.overflowHandCards.length) {
    overflowHandModalCards.innerHTML = '<div class="empty-box">ตอนนี้ยังไม่มีการ์ดที่ซ่อนอยู่ในมือ</div>';
    return;
  }

  state.overflowHandCards.forEach((card) => {
    const item = document.createElement("div");
    item.className = "modal-card-item";
    bindHoverTooltip(item, card);
    item.appendChild(createCardImage(card, { small: true, tooltip: false }));

    const name = document.createElement("div");
    name.className = "modal-card-name";
    name.textContent = card.name;
    item.appendChild(name);
    overflowHandModalCards.appendChild(item);
  });
}

function renderLogs(logs) {
  logModalList.innerHTML = "";

  if (!logs.length) {
    logModalList.innerHTML = '<div class="empty-box">ยังไม่มีบันทึกเกม</div>';
    return;
  }

  logs.forEach((message) => {
    const item = document.createElement("div");
    item.className = "log-item";
    item.textContent = message;
    logModalList.appendChild(item);
  });
}

function renderCenterWarning(roomState) {
  if (!roomState.centerWarning) {
    state.lastWarningSoundKey = "";
    centerWarning.classList.add("hidden");
    centerWarning.innerHTML = "";
    return;
  }

  const warningText = repairText(roomState.centerWarning.text || "");
  const warningKey = `${warningText}:${roomState.centerWarning.cyclesLeft || 0}`;
  if (warningText.includes("คนบ้ากำลังหัวเราะ") && state.lastWarningSoundKey !== warningKey) {
    playSound("josephineLaugh");
  }
  state.lastWarningSoundKey = warningKey;

  centerWarning.classList.remove("hidden");
  centerWarning.innerHTML = `
    <strong>${warningText}</strong>
    ${roomState.centerWarning.cyclesLeft ? `<span>เหลือ ${roomState.centerWarning.cyclesLeft} รอบโต๊ะ</span>` : ""}
  `;
}

function renderChatMessages(messages) {
  const nextCount = messages.length;
  const previousCount = state.lastChatCount;
  const chatIsOpen = isModalOpen(chatModal);

  if (nextCount < previousCount) {
    state.unreadChatCount = 0;
  } else if (chatIsOpen) {
    state.unreadChatCount = 0;
  } else if (previousCount > 0 && nextCount > previousCount) {
    const unreadDelta = nextCount - previousCount;
    state.unreadChatCount += unreadDelta;
    triggerChatFlash(unreadDelta);
    playSound("chat");
  }

  state.lastChatCount = nextCount;
  updateChatUnreadUI();
  chatModalList.innerHTML = "";

  if (!messages.length) {
    chatModalList.innerHTML = '<div class="empty-box">ยังไม่มีข้อความในห้อง</div>';
    return;
  }

  messages.forEach((message) => {
    const row = document.createElement("div");
    row.className = `chat-row ${message.system ? "system" : ""}`.trim();

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.innerHTML = `
      <strong>${message.name}</strong>
      <span>${message.time || ""}</span>
    `;

    const text = document.createElement("div");
    text.className = "chat-text";
    text.textContent = message.text;

    row.appendChild(meta);
    row.appendChild(text);
    chatModalList.appendChild(row);
  });

  chatModalList.scrollTop = chatModalList.scrollHeight;
}

function getPendingActionKey(action) {
  if (!action) return "";
  if (action.mode === "select_player") {
    return `${action.mode}:${action.effect}:${(action.options || []).map((option) => option.id).join(",")}`;
  }
  return `${action.mode}:${action.effect}:${(action.availableCards || []).map((card) => card.selectionKey || card.id).join(",")}:${action.minSelections}:${action.maxSelections}`;
}

function isSelectionValid(action) {
  const count = state.selectedCardIds.length;
  return count >= action.minSelections && count <= action.maxSelections;
}

function updateCardSelectionCounter(action) {
  const count = state.selectedCardIds.length;
  if (action.minSelections === action.maxSelections) {
    cardSelectModalCounter.textContent = `เลือกแล้ว ${count} / ${action.maxSelections} ใบ`;
  } else {
    cardSelectModalCounter.textContent = `เลือกแล้ว ${count} ใบ ต้องเลือก ${action.minSelections}-${action.maxSelections} ใบ`;
  }
  confirmCardSelectionBtn.disabled = !isSelectionValid(action);
}

function toggleSelectedCard(cardId) {
  if (!state.pendingAction || state.pendingAction.mode !== "select_cards") return;

  const alreadySelected = state.selectedCardIds.includes(cardId);
  if (alreadySelected) {
    state.selectedCardIds = state.selectedCardIds.filter((selectedId) => selectedId !== cardId);
  } else if (state.selectedCardIds.length < state.pendingAction.maxSelections) {
    state.selectedCardIds = [...state.selectedCardIds, cardId];
  }

  renderCardSelectionAction(state.pendingAction);
}

function renderCardSelectionAction(action) {
  const actionKey = getPendingActionKey(action);
  if (state.pendingActionKey !== actionKey) {
    state.pendingActionKey = actionKey;
    state.selectedCardIds = [];
  }

  cardSelectModalTitle.textContent = action.title;
  cardSelectModalDescription.textContent = action.description;
  cardSelectModalCards.innerHTML = "";

  if (!(action.availableCards || []).length) {
    cardSelectModalCards.innerHTML = '<div class="empty-box">ไม่มีการ์ดให้เลือก</div>';
  } else {
    action.availableCards.forEach((card) => {
      const item = document.createElement("button");
      item.type = "button";
      const selectionId = card.selectionKey || card.id;
      item.className = `selectable-card ${state.selectedCardIds.includes(selectionId) ? "selected" : ""}`.trim();
      item.appendChild(createCardImage(card, { small: true }));

      const name = document.createElement("div");
      name.className = "modal-card-name";
      name.textContent = card.name;
      item.appendChild(name);
      item.addEventListener("click", () => toggleSelectedCard(selectionId));
      cardSelectModalCards.appendChild(item);
    });
  }

  updateCardSelectionCounter(action);
  openModal(cardSelectModal);
}

function renderTargetAction(action) {
  targetModalTitle.textContent = action.title;
  targetModalDescription.textContent = action.description;
  targetModalChoices.innerHTML = "";

  action.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "btn btn-subtle choice-btn";
    button.innerHTML = `
      <strong>${option.name}</strong>
      <span class="muted">เลือกผู้เล่นคนนี้เป็นเป้าหมาย</span>
    `;
    button.addEventListener("click", () => {
      socket.emit("resolveTargetAction", { roomId, targetPlayerId: option.id });
    });
    targetModalChoices.appendChild(button);
  });

  openModal(targetModal);
}

function renderPendingAction(action) {
  state.pendingAction = action || null;

  if (!action) {
    state.pendingActionKey = "";
    state.selectedCardIds = [];
    closeModal(targetModal);
    closeModal(cardSelectModal);
    return;
  }

  if (action.mode === "select_player") {
    closeModal(cardSelectModal);
    renderTargetAction(action);
  } else if (action.mode === "select_cards") {
    closeModal(targetModal);
    renderCardSelectionAction(action);
  }
}

function buildInspectKey(inspectedHand) {
  if (!inspectedHand) return "";
  return `${inspectedHand.targetName}:${inspectedHand.cards.map((card) => card.id).join(",")}`;
}

function renderInspectedHand(inspectedHand) {
  if (!inspectedHand) {
    state.lastInspectKey = "";
    closeModal(inspectModal);
    return;
  }

  inspectModalTitle.textContent = `ดูการ์ดของ ${inspectedHand.targetName}`;
  inspectModalDescription.textContent = `จำนวนการ์ดที่เห็น : ${inspectedHand.cards.length} ใบ`;
  inspectModalCards.innerHTML = "";

  if (!inspectedHand.cards.length) {
    inspectModalCards.innerHTML = '<div class="empty-box">ผู้เล่นคนนี้ไม่มีการ์ดบนมือ</div>';
  } else {
    inspectedHand.cards.forEach((card) => {
      const item = document.createElement("div");
      item.className = "modal-card-item";
      item.appendChild(createCardImage(card, { small: true }));

      const name = document.createElement("div");
      name.className = "modal-card-name";
      name.textContent = card.name;
      item.appendChild(name);
      inspectModalCards.appendChild(item);
    });
  }

  const inspectKey = buildInspectKey(inspectedHand);
  if (inspectKey !== state.lastInspectKey) {
    state.lastInspectKey = inspectKey;
    openModal(inspectModal);
  }
}

function getSlotIdForPlayer(roomState, playerId) {
  const meIndex = roomState.players.findIndex((player) => player.id === socket.id);
  const playerIndex = roomState.players.findIndex((player) => player.id === playerId);
  if (meIndex === -1 || playerIndex === -1) return null;
  return slotIds[(playerIndex - meIndex + 4) % 4];
}

function getAnchorRectForPlayer(roomState, playerId) {
  const slotId = getSlotIdForPlayer(roomState, playerId);
  if (!slotId) return null;
  const slot = document.getElementById(slotId);
  const hand = slot.querySelector(".player-hand");
  const header = slot.querySelector(".player-header");
  return (hand || header || slot).getBoundingClientRect();
}

function spawnFloatingEffect(rect, text, className, options = {}) {
  if (!rect) return;
  const boardRect = document.querySelector(".game-board").getBoundingClientRect();
  const effect = document.createElement("div");
  effect.className = `floating-effect ${className}`.trim();
  effect.textContent = text;
  const durationMs = Math.max(900, Number(options.durationMs) || 1900);

  const centerX = rect.left - boardRect.left + rect.width / 2;
  const centerY = rect.top - boardRect.top + rect.height / 2;

  effect.style.left = `${centerX}px`;
  effect.style.top = `${centerY}px`;
  effectLayer.appendChild(effect);

  requestAnimationFrame(() => effect.classList.add("show"));
  setTimeout(() => {
    effect.classList.remove("show");
    setTimeout(() => effect.remove(), 300);
  }, durationMs);
}

function spawnGraveyardEffect(count) {
  const rect = document.getElementById("graveTop").getBoundingClientRect();
  spawnFloatingEffect(rect, `สุสาน +${count}`, "effect-grave");
}

function getDrawEffectClass(count) {
  if (count >= 6) return "effect-draw effect-draw-purple";
  if (count >= 4) return "effect-draw effect-draw-orange";
  return "effect-draw effect-draw-green";
}

function spawnCenterAnnounce(text, className) {
  const anchor = document.querySelector(".center-card") || document.querySelector(".center-table");
  if (!anchor) return;
  spawnFloatingEffect(anchor.getBoundingClientRect(), text, className);
}

function getEffectSourceRect(effect) {
  if (effect.source === "deck") {
    return document.getElementById("deckVisual")?.getBoundingClientRect() || null;
  }

  if (effect.source === "graveyard") {
    return document.getElementById("graveTop")?.getBoundingClientRect() || null;
  }

  return null;
}

function getEffectCardImage(effect) {
  if (effect.source === "graveyard") {
    return document.querySelector("#graveTop img")?.src || "/assets/images/back_card.png";
  }

  return "/assets/images/back_card.png";
}

function spawnCardTravelEffect(effect, roomState) {
  const sourceRect = getEffectSourceRect(effect);
  const targetRect = getAnchorRectForPlayer(roomState, effect.playerId);
  if (!sourceRect || !targetRect) return;

  const boardRect = document.querySelector(".game-board").getBoundingClientRect();
  const startX = sourceRect.left - boardRect.left + (sourceRect.width / 2);
  const startY = sourceRect.top - boardRect.top + (sourceRect.height / 2);
  const endX = targetRect.left - boardRect.left + (targetRect.width / 2);
  const endY = targetRect.top - boardRect.top + (targetRect.height / 2);
  const sourceImage = getEffectCardImage(effect);
  const travelCount = Math.min(effect.count || 1, 3);
  const effectDelay = Math.max(0, effect.delayMs || 0);

  for (let index = 0; index < travelCount; index += 1) {
    window.setTimeout(() => {
      const card = document.createElement("img");
    card.className = "flying-card";
    card.src = sourceImage;
    card.alt = "การ์ดกำลังบินกลับเข้ามือ";
    card.draggable = false;
    card.onerror = fallbackImage;
    card.style.left = `${startX}px`;
    card.style.top = `${startY}px`;
    effectLayer.appendChild(card);

    const spread = (index - ((travelCount - 1) / 2)) * 18;
    const dx = (endX - startX) + spread;
    const dy = (endY - startY) + (index * 8);
    const startRotate = effect.source === "graveyard" ? -10 : 8;
    const endRotate = effect.source === "graveyard" ? 14 : -12;

    const animation = card.animate(
      [
        {
          transform: `translate(-50%, -50%) translate(0px, 0px) scale(0.96) rotate(${startRotate}deg)`,
          opacity: 0.92,
        },
        {
          transform: `translate(-50%, -50%) translate(${dx * 0.52}px, ${dy * 0.52}px) scale(0.82) rotate(${(startRotate + endRotate) / 2}deg)`,
          opacity: 1,
          offset: 0.6,
        },
        {
          transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.44) rotate(${endRotate}deg)`,
          opacity: 0.04,
        },
      ],
      {
        duration: 540 + (index * 90),
        easing: "cubic-bezier(0.2, 0.82, 0.18, 1)",
        fill: "forwards",
      },
    );

      animation.onfinish = () => card.remove();
    }, effectDelay + (index * 20));
  }
}

function renderEffects(roomState) {
  const effects = roomState.effects || [];

  effects.forEach((effect) => {
    const effectKey = `${roomState.roomId}:${effect.id}`;
    if (state.seenEffectKeys.has(effectKey)) return;
    state.seenEffectKeys.add(effectKey);

    if (effect.type === "draw") {
      const rect = getAnchorRectForPlayer(roomState, effect.playerId);
      const timerId = window.setTimeout(() => {
        const current = Number(state.revealCounts[effect.playerId] || 0);
        setRevealCount(effect.playerId, current + (effect.count || 0));
        if (state.roomState) {
          renderPlayers(state.roomState);
        }
      }, Math.max(0, effect.delayMs || 0) + 420);
      state.revealTimers.push(timerId);
      playSound("cardReceive", effect.count, {
        startDelayMs: effect.delayMs || 0,
        spacingMs: effect.soundSpacingMs || 190,
      });
      if (effect.source === "deck" || effect.source === "graveyard") {
        spawnCardTravelEffect(effect, roomState);
      }
      spawnFloatingEffect(rect, `🃏+${effect.count}`, getDrawEffectClass(effect.count));
      return;
    }

    if (effect.type === "hand_reset") {
      (effect.playerIds || []).forEach((playerId) => setRevealCount(playerId, 0));
      if (state.roomState) {
        renderPlayers(state.roomState);
      }
      return;
    }

    if (effect.type === "skip") {
      const rect = getAnchorRectForPlayer(roomState, effect.playerId);
      if (effect.playerId === socket.id) {
        playSound("stop");
      }
      spawnFloatingEffect(rect, "❌ข้าม", "effect-skip");
      return;
    }

    if (effect.type === "grave") {
      spawnGraveyardEffect(effect.count);
      return;
    }

    if (effect.type === "swap") {
      const rect = document.querySelector(".center-table").getBoundingClientRect();
      const label = effect.allTable ? "🔁 สลับทั้งโต๊ะ" : `🔁 ${repairText(effect.label)}`;
      spawnFloatingEffect(rect, label, "effect-swap");
      return;
    }

    if (effect.type === "reverse") {
      playSound("reverse");
      spawnCenterAnnounce("🔄หมุนๆ", "effect-rotate");
      return;
    }

    if (effect.type === "last_card") {
      playSound("lastCard");
      const rect = getAnchorRectForPlayer(roomState, effect.playerId);
      spawnFloatingEffect(rect, "เอื้อยข่าบ!", "effect-announce");
      return;
    }

    if (effect.type === "announce") {
      const anchor = document.querySelector(".center-card") || document.querySelector(".center-table");
      if (anchor) {
        spawnFloatingEffect(
          anchor.getBoundingClientRect(),
          repairText(effect.text),
          effect.tone || "effect-announce",
          { durationMs: effect.durationMs },
        );
      }
      return;
    }

    if (effect.type === "tag") {
      const rect = getAnchorRectForPlayer(roomState, effect.playerId);
      spawnFloatingEffect(rect, repairText(effect.text), effect.tone || "effect-tag");
    }
  });
}

function showMyTurnBanner() {
  playSound("myTurn");
  myTurnBanner.textContent = "ถึงตาคุณแล้ว";
  myTurnBanner.classList.remove("hidden");
  myTurnBanner.classList.add("show");

  clearTimeout(state.bannerTimer);
  state.bannerTimer = window.setTimeout(() => {
    myTurnBanner.classList.remove("show");
    window.setTimeout(() => myTurnBanner.classList.add("hidden"), 460);
  }, 4000);
}

function createPlayerHeader(player) {
  const header = document.createElement("div");
  header.className = `player-header ${player.isTurn ? "is-turn" : ""} ${player.eliminated ? "is-eliminated" : ""}`.trim();

  const name = document.createElement("strong");
  name.textContent = player.name;
  header.appendChild(name);

  const count = document.createElement("span");
  count.className = "muted";
  count.textContent = `การ์ด ${player.cardCount} ใบ`;
  header.appendChild(count);

  if (player.eliminated) {
    const eliminatedBadge = document.createElement("span");
    eliminatedBadge.className = "status-pill";
    eliminatedBadge.textContent = "ตกรอบ";
    header.appendChild(eliminatedBadge);
  } else if (player.saidLastCard) {
    const saidBadge = document.createElement("span");
    saidBadge.className = "status-pill";
    saidBadge.textContent = "เอื้อยข่าบแล้ว";
    header.appendChild(saidBadge);
  }

  return header;
}

function createBackCardElement() {
  const hidden = document.createElement("img");
  hidden.className = "card small";
  hidden.src = "/assets/images/back_card.png";
  hidden.alt = "การ์ดคว่ำ";
  hidden.draggable = false;
  return hidden;
}

function createOverflowHandStack(cards) {
  const wrapper = document.createElement("div");
  wrapper.className = "hand-overflow";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "hand-overflow-toggle";
  toggle.innerHTML = `<span class="hand-overflow-label">\u0e01\u0e32\u0e23\u0e4c\u0e14\u0e25\u0e49\u0e19\u0e21\u0e37\u0e2d</span><strong>+${cards.length} \u0e43\u0e1a</strong>`;
  toggle.addEventListener("click", () => {
    state.overflowHandOpen = !state.overflowHandOpen;
    renderRoom(state.roomState);
  });
  wrapper.appendChild(toggle);

  if (state.overflowHandOpen) {
    const tray = document.createElement("div");
    tray.className = "hand-overflow-tray";

    const trayHeader = document.createElement("div");
    trayHeader.className = "hand-overflow-tray-header";
    trayHeader.textContent = `\u0e01\u0e32\u0e23\u0e4c\u0e14\u0e17\u0e35\u0e48\u0e25\u0e49\u0e19\u0e21\u0e37\u0e2d ${cards.length} \u0e43\u0e1a`;
    tray.appendChild(trayHeader);

    const trayCards = document.createElement("div");
    trayCards.className = "hand-overflow-tray-cards";
    cards.forEach((card) => {
      const handCard = createHandCard(card);
      handCard.classList.add("card-overflow");
      trayCards.appendChild(handCard);
    });
    tray.appendChild(trayCards);
    wrapper.appendChild(tray);
  }

  return wrapper;
}

function renderPlayers(roomState) {
  slotIds.forEach((slotId) => {
    document.getElementById(slotId).innerHTML = "";
  });

  const meIndex = roomState.players.findIndex((player) => player.id === socket.id);
  if (meIndex === -1) return;

  roomState.players.forEach((player, index) => {
    const slotIndex = (index - meIndex + 4) % 4;
    const slot = document.getElementById(slotIds[slotIndex]);
    const isMe = player.id === socket.id;

    const header = createPlayerHeader(player);
    const hand = document.createElement("div");
    hand.className = `player-hand ${isMe ? "is-own" : ""} ${player.eliminated ? "is-eliminated" : ""}`.trim();
    const visibleCount = getRevealCount(player);

    if (isMe) {
      const visibleHandCards = player.hand.slice(0, Math.min(visibleCount, 10));
      const overflowHandCards = visibleCount > 10 ? player.hand.slice(10, visibleCount) : [];

      visibleHandCards.forEach((card) => {
        hand.appendChild(createHandCard(card));
      });

      if (overflowHandCards.length) {
        hand.classList.add("has-overflow");
        hand.appendChild(createOverflowHandStack(overflowHandCards));
      } else {
        hand.classList.remove("has-overflow");
      }
    } else {
      const visibleBackCount = Math.min(visibleCount, 8);
      for (let count = 0; count < visibleBackCount; count += 1) {
        hand.appendChild(createBackCardElement());
      }
    }

    const overlapCards = isMe
      ? Math.min(10, visibleCount)
      : Math.min(8, Math.max(visibleCount, player.cardCount));
    if (overlapCards >= 5) {
      hand.classList.add("overlap");
      const overlapValue = Math.min(58, Math.max(18, overlapCards * 4));
      hand.style.setProperty("--overlap", `${overlapValue}px`);
    } else {
      hand.classList.remove("overlap");
      hand.style.removeProperty("--overlap");
    }

    slot.appendChild(header);
    slot.appendChild(hand);
  });
}

function updateActionButtons(roomState) {
  const turnStatus = document.getElementById("turnStatus");
  const actionLocked = !!roomState.pendingAction;

  startBtn.style.display = roomState.canStart || roomState.canNextRound ? "inline-flex" : "none";
  startBtn.textContent = roomState.canNextRound ? "เริ่มรอบใหม่" : "เริ่มเกม";

  drawBtn.disabled = !roomState.canDrawCard || actionLocked || roomState.eliminated;

  const shouldShowCallButton = roomState.gameStarted
    && !roomState.roundEnded
    && !roomState.eliminated
    && roomState.myCardCount === 1
    && !roomState.saidLastCard;
  callLastCardBtn.classList.toggle("hidden", !shouldShowCallButton);
  callLastCardBtn.disabled = !shouldShowCallButton || actionLocked;

  if (roomState.roundEnded) {
    turnStatus.textContent = "รอบนี้จบแล้ว";
  } else if (roomState.eliminated) {
    turnStatus.textContent = "คุณตกรอบแล้ว";
  } else if (actionLocked) {
    turnStatus.textContent = "กำลังเลือกเป้าหมายหรือการ์ด";
  } else if (roomState.myTurn) {
    turnStatus.textContent = "ถึงตาคุณแล้ว";
  } else {
    turnStatus.textContent = `กำลังรอ ${roomState.currentTurnName}`;
  }

  turnTicker.textContent = roomState.roundEnded
    ? "รอบนี้จบแล้ว"
    : `ถึงตาของ ${roomState.currentTurnName}`;

  startBtn.onclick = () => {
    if (roomState.canNextRound) {
      socket.emit("nextRound", { roomId });
      return;
    }
    socket.emit("startGame", { roomId });
  };

  drawBtn.onclick = () => socket.emit("drawOne", { roomId });
  callLastCardBtn.onclick = () => {
    socket.emit("sayLastCard", { roomId });
  };
}

function renderWinner(roomState) {
  const winnerBanner = document.getElementById("winnerBanner");
  if (roomState.winnerNames.length) {
    winnerBanner.textContent = `ผู้ชนะรอบนี้: ${roomState.winnerNames.join(", ")}`;
  } else if (roomState.roundEnded) {
    winnerBanner.textContent = "รอบนี้จบแล้ว";
  } else {
    winnerBanner.textContent = "";
  }
}

function hideWinnerOverlay() {
  winnerOverlay.classList.remove("show");
  window.setTimeout(() => {
    if (!winnerOverlay.classList.contains("show")) {
      winnerOverlay.classList.add("hidden");
    }
  }, 420);
}

function renderAnimatedWinnerText(element, text) {
  element.innerHTML = "";
  [...text].forEach((character, index) => {
    const span = document.createElement("span");
    span.className = "winner-letter";
    span.style.animationDelay = `${index * 0.045}s`;
    span.textContent = character === " " ? "\u00A0" : character;
    element.appendChild(span);
  });
}

function isBethanyWinner(reason) {
  const text = repairText(reason || "");
  return text.includes("\u0e40\u0e1a\u0e18\u0e32\u0e19\u0e35\u0e40\u0e17\u0e1e\u0e2b\u0e25\u0e31\u0e1a") && text.includes("\u0e04\u0e23\u0e1a 3 \u0e04\u0e23\u0e31\u0e49\u0e07");
}
function renderWinnerOverlay(roomState) {
  if (!roomState.roundEnded) {
    state.winnerOverlayKey = "";
    state.dismissedWinnerOverlayKey = "";
    clearSpecialWinnerAnimation();
    hideWinnerOverlay();
    return;
  }

  const winnerNames = roomState.winnerNames.length ? roomState.winnerNames.join(", ") : "ไม่มีผู้ชนะ";
  const winnerReason = roomState.winnerReason || roomState.notice || "";
  const overlayKey = `${winnerNames}|${winnerReason}`;

  if (state.dismissedWinnerOverlayKey === overlayKey) {
    return;
  }

  if (isPinkAssemblyWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runPinkAssemblyWinnerAnimation(roomState, overlayKey, roomState.winnerNames, winnerReason);
    }
    return;
  }

  if (isValeskaWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runValeskaWinnerVideo(overlayKey, roomState.winnerNames, winnerReason);
    }
    return;
  }

  if (isPinkLegendaryWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runSingleCardWinnerAnimation(roomState, overlayKey, roomState.winnerNames, winnerReason, "card_01", "pinkLegendaryWin");
    }
    return;
  }

  if (isZeroWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runSingleCardWinnerAnimation(roomState, overlayKey, roomState.winnerNames, winnerReason, "card_03", "zeroWin");
    }
    return;
  }

  if (isBethanyWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runPosterWinnerScene(overlayKey, roomState.winnerNames, winnerReason, "bethwin.png", "bethWin");
    }
    return;
  }

  if (isDreamWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runPosterWinnerScene(overlayKey, roomState.winnerNames, winnerReason, "jowin1.png", "joWin");
    }
    return;
  }

  if (isJapinkWinner(winnerReason)) {
    if (state.specialWinnerAnimationKey !== overlayKey) {
      hideWinnerOverlay();
      runPosterWinnerScene(overlayKey, roomState.winnerNames, winnerReason, "japink.png", "japinkWin");
    }
    return;
  }

  if (state.winnerOverlayKey !== overlayKey) {
    showWinnerOverlayContent(winnerNames, winnerReason, overlayKey, { playSound: true });
  }
}

function renderRoom(rawRoomState) {
  cleanupDrag();

  const previousRoomState = state.roomState;
  const roomState = normalizeRoomState(rawRoomState);
  prepareRevealCounts(roomState, previousRoomState);
  applyImmediateRevealEffects(roomState);
  state.roomState = roomState;

  if (previousRoomState) {
    const latestPlayKey = roomState.lastPlayedCard
      ? `${roomState.lastPlayedCard.id}|${repairText((roomState.logs || [])[0] || "")}`
      : "";
    if (latestPlayKey && latestPlayKey !== state.lastPlayedSoundKey) {
      state.lastPlayedSoundKey = latestPlayKey;
      playSound("cardPlay", 1, { spacingMs: 220 });
    }
  }
  if (!roomState.lastPlayedCard) {
    state.lastPlayedSoundKey = "";
  }
  state.lastLogSnapshot = [...(roomState.logs || [])];

  document.getElementById("roomCode").textContent = `ROOM ID: ${roomState.roomId}`;
  document.getElementById("roundStatus").textContent = roomState.gameStarted ? "เกมเริ่มแล้ว" : "กำลังรอเริ่มเกม";
  document.getElementById("noticeBox").textContent = roomState.notice;

  renderPlayers(roomState);
  renderDeck(roomState.deckCount);
  renderCenterCard(roomState.lastPlayedCard);
  renderGraveyard(roomState.graveTopCard, roomState.graveCount);
  renderGraveyardModal(roomState.graveCards || []);
  const overflowCards = (roomState.players.find((player) => player.id === socket.id)?.hand || []).slice(10);
  state.overflowHandCards = overflowCards;
  if (!overflowCards.length) {
    state.overflowHandOpen = false;
  }
  renderOverflowHandModal(overflowCards);
  renderLogs(roomState.logs || []);
  renderChatMessages(roomState.chatMessages || []);
  renderWinner(roomState);
  renderWinnerOverlay(roomState);
  renderCenterWarning(roomState);
  renderPendingAction(roomState.pendingAction);
  renderInspectedHand(roomState.inspectedHand);
  updateActionButtons(roomState);
  renderEffects(roomState);

  const turnKey = `${roomState.currentTurnName}:${roomState.myTurn}:${roomState.roundEnded}`;
  if (roomState.myTurn && !roomState.roundEnded && state.lastTurnKey !== turnKey) {
    if (previousRoomState && state.lastTurnKey) {
      playSound("turnChange");
    }
    showMyTurnBanner();
  } else if (previousRoomState && !roomState.roundEnded && state.lastTurnKey && state.lastTurnKey !== turnKey) {
    playSound("turnChange");
  }
  state.lastTurnKey = turnKey;
}

socket.on("connect", () => {
  if (!roomId) {
    window.location.href = "/";
    return;
  }
  socket.emit("joinRoom", { roomId, playerName });
});

socket.on("roomState", renderRoom);
socket.on("errorMsg", (message) => {
  playSound("stop");
  alert(repairText(message));
});

window.addEventListener("pointermove", onGlobalPointerMove);
window.addEventListener("pointerup", onGlobalPointerEnd);
window.addEventListener("pointercancel", onGlobalPointerEnd);
window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
window.addEventListener("keydown", unlockAudio, { once: true, capture: true });

hydrateStaticText();
updateChatUnreadUI();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  playSound("click");
});

document.getElementById("graveTop").addEventListener("click", () => {
  if (!state.graveCards.length) return;
  openModal(graveyardModal);
});

document.getElementById("closeGraveyardModalBtn").addEventListener("click", () => closeModal(graveyardModal));
graveyardModal.addEventListener("click", (event) => {
  if (event.target === graveyardModal) closeModal(graveyardModal);
});

if (overflowHandModal) {
  document.getElementById("closeOverflowHandModalBtn").addEventListener("click", () => closeModal(overflowHandModal));
  overflowHandModal.addEventListener("click", (event) => {
    if (event.target === overflowHandModal) closeModal(overflowHandModal);
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!state.overflowHandOpen || !state.roomState) return;
  if (event.target.closest(".hand-overflow")) return;
  state.overflowHandOpen = false;
  renderRoom(state.roomState);
});

document.getElementById("openLogModalBtn").addEventListener("click", () => openModal(logModal));
document.getElementById("closeLogModalBtn").addEventListener("click", () => closeModal(logModal));
logModal.addEventListener("click", (event) => {
  if (event.target === logModal) closeModal(logModal);
});

openChatModalBtn.addEventListener("click", () => {
  openModal(chatModal);
  markChatAsRead();
  chatInput.focus();
});
document.getElementById("closeChatModalBtn").addEventListener("click", () => closeModal(chatModal));
chatModal.addEventListener("click", (event) => {
  if (event.target === chatModal) closeModal(chatModal);
});
openChatModalBtn.addEventListener("animationend", (event) => {
  if (event.animationName === "chatButtonFlash") {
    openChatModalBtn.classList.remove("chat-flash");
  }
});

document.getElementById("openGuideModalBtn").addEventListener("click", () => openModal(guideModal));
document.getElementById("closeGuideModalBtn").addEventListener("click", () => closeModal(guideModal));
guideModal.addEventListener("click", (event) => {
  if (event.target === guideModal) closeModal(guideModal);
});

winnerOverlayContinueBtn.addEventListener("click", () => {
  state.dismissedWinnerOverlayKey = state.winnerOverlayKey;
  clearSpecialWinnerAnimation();
  hideWinnerOverlay();
});

winnerOverlayExitBtn.addEventListener("click", () => {
  window.location.href = "/";
});

document.getElementById("closeTargetModalBtn").addEventListener("click", () => {
  if (!state.pendingAction) closeModal(targetModal);
});
targetModal.addEventListener("click", (event) => {
  if (event.target === targetModal && !state.pendingAction) closeModal(targetModal);
});

document.getElementById("closeInspectModalBtn").addEventListener("click", () => closeModal(inspectModal));
inspectModal.addEventListener("click", (event) => {
  if (event.target === inspectModal) closeModal(inspectModal);
});

document.getElementById("closeCardSelectModalBtn").addEventListener("click", () => {
  if (!state.pendingAction) closeModal(cardSelectModal);
});
cardSelectModal.addEventListener("click", (event) => {
  if (event.target === cardSelectModal && !state.pendingAction) closeModal(cardSelectModal);
});

confirmCardSelectionBtn.addEventListener("click", () => {
  if (!state.pendingAction || state.pendingAction.mode !== "select_cards") return;
  if (!isSelectionValid(state.pendingAction)) return;
  socket.emit("resolveCardSelection", { roomId, selectedCardIds: state.selectedCardIds });
});

function sendChatMessage() {
  const text = String(chatInput.value || "").trim();
  if (!text) return;
  socket.emit("sendChatMessage", { roomId, text });
  chatInput.value = "";
  chatInput.focus();
}

sendChatBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});
