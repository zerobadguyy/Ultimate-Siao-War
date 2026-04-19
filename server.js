const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const allCards = require("./cards");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const STATS_PATH = path.join(__dirname, "data", "stats.json");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SUPABASE_STATS = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const MAX_LOGS = 12;
const MAX_CHAT_MESSAGES = 40;
const ASSEMBLY_SET = ["card_04", "card_05", "card_06", "card_07", "card_08"];
const NORMAL_BETHANY_SET = ["card_56", "card_57", "card_58", "card_59", "card_60"];
const BETHANY_ALARM_SET = ["card_61", "card_62", "card_108"];
const BETHANY_WIN_COUNT = 3;
const ZERO_WIN_COUNT = 3;
const VALESKA_WIN_COUNT = 10;
const BASIC_DRAW_SET = ["card_38", "card_39", "card_40", "card_41", "card_42"];
const BASIC_SKIP_SET = ["card_44", "card_45", "card_46", "card_47", "card_48"];
const NEXT_DRAW_SET = ["card_51", "card_52", "card_53", "card_54", "card_55"];
const STEAL_ASSEMBLY_SET = ["card_66", "card_67"];
const SCAN_ASSEMBLY_SET = ["card_68", "card_69"];
const LOVE_STACK_SET = [];
const JOJIG_ALL_SET = ["card_72", "card_73"];
const BIRD_DISCARD_SET = ["card_74", "card_75", "card_76", "card_77", "card_78", "card_79", "card_80"];
const MAGIC_MIRROR_SET = ["card_81", "card_82", "card_83", "card_84", "card_85"];
const LIZARD_SET = ["card_86", "card_87", "card_88", "card_89"];
const BELL_GHOST_SET = ["card_90", "card_91", "card_92", "card_93", "card_94"];
const REVERSE_TIME_SET = ["card_99", "card_100", "card_101", "card_102", "card_103", "card_104"];
const PINKBERRY_SCOPE_SET = ["card_105", "card_109", "card_110", "card_111"];

app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.static(__dirname));

const rooms = {};

function repairText(value) {
  if (typeof value !== "string") return value;
  if (!/[Ã ÃƒÃ¢]/.test(value)) return value;

  let fixed = value;
  for (let count = 0; count < 2; count += 1) {
    try {
      const candidate = Buffer.from(fixed, "latin1").toString("utf8");
      if (!candidate || candidate.includes("ï¿½")) break;
      fixed = candidate;
      if (!/[Ã ÃƒÃ¢]/.test(fixed)) break;
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
      const candidate = Buffer.from(fixed, "latin1").toString("utf8");
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

  const encodeCp1252 = (text) => Buffer.from(
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
      const candidate = encodeCp1252(fixed).toString("utf8");
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

const PINKBERRY_NAME = "พิงค์เบอร์รี่";
const BETHANY_NAME_PATTERN = /เบธานี|เบธานี่/;
const LAST_CARD_DELAY_MS = 5000;

function createPlayerState(id, name) {
  return {
    id,
    name,
    hand: [],
    eliminated: false,
    roundScoreDelta: 0,
    usedCardsTotal: 0,
    usedCard03Count: 0,
    valeskaStartCount: null,
    bethanyReturnCount: 0,
    skipTurns: 0,
    sleepTurns: 0,
    josephineShield: false,
    josephineShieldPendingWin: false,
    turnCardsUsed: 0,
    turnActionTaken: false,
    turnDrewCard: false,
    turnPlayedCard: false,
    turnOverusePenaltyApplied: false,
    turnKeepOpen: false,
    saidLastCard: false,
    linkWinTo: null,
    linkWinLoseTo: null,
    inspectedHand: null,
  };
}

function createRoomState(roomId) {
  return {
    roomId,
    players: [],
    deck: [],
    graveyard: [],
    banished: [],
    centerCard: null,
    gameStarted: false,
    currentTurn: 0,
    roundEnded: false,
    roundActionCount: 0,
    winnerIds: [],
    winnerNames: [],
    winnerReason: "",
    logs: ["สร้างห้องสำเร็จ รอผู้เล่นเข้าร่วม"],
    resolvedScore: false,
    notice: "รอผู้เล่นเข้าห้อง แล้วกดเริ่มเกม",
    chatMessages: [],
    pendingAction: null,
    queuedForcedPlays: [],
    pendingIgnoreEmptyHandForIds: [],
    effectCounter: 0,
    effects: [],
    turnCounter: 0,
    playDirection: 1,
    laughingDisabled: false,
    centerWarning: null,
    pendingTurnAdvance: null,
    timedThreats: {
      josephine: null,
      pinkLaugh: null,
    },
  };
}

function ensureStatsFile() {
  if (!fs.existsSync(STATS_PATH)) {
    fs.writeFileSync(STATS_PATH, JSON.stringify({ players: {} }, null, 2), "utf8");
  }
}

function readStats() {
  ensureStatsFile();
  return JSON.parse(fs.readFileSync(STATS_PATH, "utf8"));
}

function writeStats(stats) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), "utf8");
}

async function fetchSupabase(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return response.json();
}

async function readStatsAsync() {
  if (!USE_SUPABASE_STATS) {
    return readStats();
  }

  const rows = await fetchSupabase("/rest/v1/player_stats?select=name,wins,games,score");
  const players = {};
  (rows || []).forEach((row) => {
    players[row.name] = {
      name: row.name,
      wins: Number(row.wins) || 0,
      games: Number(row.games) || 0,
      score: Number(row.score) || 0,
    };
  });
  return { players };
}

async function updatePlayerStats(name, scoreDelta) {
  if (USE_SUPABASE_STATS) {
    await fetchSupabase("/rest/v1/rpc/record_player_result", {
      method: "POST",
      body: JSON.stringify({
        p_name: name,
        p_win: scoreDelta > 0,
        p_score_delta: scoreDelta,
      }),
    });
    return;
  }

  const stats = readStats();
  if (!stats.players[name]) {
    stats.players[name] = { name, wins: 0, games: 0, score: 0 };
  }

  stats.players[name].games += 1;
  if (scoreDelta > 0) {
    stats.players[name].wins += 1;
  }
  stats.players[name].score += scoreDelta;
  writeStats(stats);
}

app.get("/api/leaderboard", async (_request, response) => {
  try {
    const stats = await readStatsAsync();
    const players = Object.values(stats.players).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name, "th");
    });
    response.json({ players });
  } catch (error) {
    response.status(500).json({ players: [], error: error.message });
  }
});

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function shuffle(cards) {
  const cloned = [...cards];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
}

function addLog(room, message) {
  room.logs.unshift(repairText(message));
  room.logs = room.logs.slice(0, MAX_LOGS);
}

function addChatMessage(room, name, text, system = false) {
  room.chatMessages.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: repairText(name),
    text: repairText(text),
    system,
    time: new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  room.chatMessages = room.chatMessages.slice(-MAX_CHAT_MESSAGES);
}

function buildActionLog(player, card, detail = "") {
  const cardName = typeof card === "string" ? card : card.name;
  return detail ? `${player.name} ใช้การ์ด ${cardName} - ${detail}` : `${player.name} ใช้การ์ด ${cardName}`;
}

function queueEffect(room, effect) {
  room.effectCounter += 1;
  room.effects.push({ id: room.effectCounter, ...effect });
  room.effects = room.effects.slice(-180);
}

function announceCardEffect(room, text, tone = "effect-announce") {
  if (!text) return;
  queueEffect(room, { type: "announce", text: repairText(text), tone });
}

function announceCounterEffect(room, text) {
  if (!text) return;
  queueEffect(room, {
    type: "announce",
    text: repairText(text),
    tone: "effect-counter",
    durationMs: 8000,
  });
}

function queuePlayerTag(room, playerId, text, tone = "effect-tag") {
  if (!playerId || !text) return;
  queueEffect(room, { type: "tag", playerId, text: repairText(text), tone });
}

function refreshLastCardFlag(player) {
  if (player.hand.length !== 1) {
    player.saidLastCard = false;
  }
}

function clearPendingTurnAdvance(room) {
  if (!room?.pendingTurnAdvance) return;
  clearTimeout(room.pendingTurnAdvance.timeoutId);
  room.pendingTurnAdvance = null;
}

function isCardUsable(card) {
  return !!card && !card.cannotBeUsed;
}

function canDiscardFromOwnEffect(card) {
  return !!card && !card.lockedFromManualPlay;
}

function getDiscardSelectableCards(player, sourcePlayerId = null) {
  if (!player) return [];
  if (sourcePlayerId && player.id !== sourcePlayerId) {
    return [...player.hand];
  }
  return player.hand.filter(canDiscardFromOwnEffect);
}

function addCardsToGraveyard(room, cards, options = {}) {
  if (!cards.length) return;
  room.graveyard.unshift(...cards.slice().reverse());
  if (options.animate !== false) {
    queueEffect(room, { type: "grave", count: cards.length });
  }
}

function receiveCards(room, player, cards, options = {}) {
  if (!cards.length) return 0;
  player.hand.push(...cards);
  refreshLastCardFlag(player);
  if (options.animate !== false) {
    queueEffect(room, {
      type: "draw",
      playerId: player.id,
      count: cards.length,
      source: options.source || "hand",
      delayMs: options.delayMs || 0,
      soundSpacingMs: options.soundSpacingMs || 0,
    });
  }
  return cards.length;
}

function getCardSortValue(card) {
  const id = typeof card === "string" ? card : card?.id || "";
  const match = /^card_(\d+)$/.exec(id);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortCardsByFileId(cards) {
  return [...(cards || [])].sort((left, right) => {
    const diff = getCardSortValue(left) - getCardSortValue(right);
    if (diff !== 0) return diff;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
}

function consumeKeepOpenTurn(player) {
  if (!player?.turnKeepOpen) return false;
  player.turnKeepOpen = false;
  return true;
}

function drawCards(room, player, count, options = {}) {
  const drawnCards = [];
  for (let index = 0; index < count; index += 1) {
    if (!room.deck.length) break;
    const randomIndex = Math.floor(Math.random() * room.deck.length);
    drawnCards.push(room.deck.splice(randomIndex, 1)[0]);
  }
  receiveCards(room, player, drawnCards, {
    animate: options.animate,
    source: "deck",
    delayMs: options.delayMs,
    soundSpacingMs: options.soundSpacingMs,
  });
  return drawnCards.length;
}

function drawFromGraveyard(room, player, count, options = {}) {
  const drawnCards = [];
  const excludedCards = new Set(options.excludeCards || []);
  for (let index = 0; index < count; index += 1) {
    const availableIndexes = room.graveyard
      .map((card, graveIndex) => (excludedCards.has(card) ? -1 : graveIndex))
      .filter((graveIndex) => graveIndex >= 0);
    if (!availableIndexes.length) break;
    const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    drawnCards.push(room.graveyard.splice(randomIndex, 1)[0]);
  }
  receiveCards(room, player, drawnCards, {
    animate: options.animate,
    source: "graveyard",
    delayMs: options.delayMs,
    soundSpacingMs: options.soundSpacingMs,
  });
  return drawnCards.length;
}

function getActivePlayers(room) {
  return room.players.filter((player) => !player.eliminated);
}

function getCurrentPlayer(room) {
  const activePlayers = getActivePlayers(room);
  if (!activePlayers.length) return null;
  const candidate = room.players[room.currentTurn];
  if (candidate && !candidate.eliminated) return candidate;
  return activePlayers[0] || null;
}

function getPlayerIndex(room, playerId) {
  return room.players.findIndex((player) => player.id === playerId);
}

function getNextPlayerAfter(room, playerId) {
  const index = getPlayerIndex(room, playerId);
  if (index === -1 || !room.players.length) return null;
  const direction = room.playDirection === -1 ? -1 : 1;

  for (let offset = 1; offset <= room.players.length; offset += 1) {
    const candidate = room.players[(index + (offset * direction) + room.players.length) % room.players.length];
    if (candidate && !candidate.eliminated) {
      return candidate;
    }
  }

  return null;
}

function clearPendingAction(room) {
  room.pendingAction = null;
}

function hasBanishedCard(room, cardId) {
  return room.banished.some((card) => card.id === cardId);
}

function hasAnyBanishedCard(room, cardIds) {
  return cardIds.some((cardId) => hasBanishedCard(room, cardId));
}

function collectIgnoredIds(room, ids = []) {
  if (!ids.length) return;
  room.pendingIgnoreEmptyHandForIds = Array.from(
    new Set([...(room.pendingIgnoreEmptyHandForIds || []), ...ids]),
  );
}

function beginTurn(room, index = room.currentTurn) {
  const player = room.players[index];
  if (!player || player.eliminated) {
    advanceTurn(room);
    return;
  }
  clearPendingTurnAdvance(room);
  room.currentTurn = index;
  clearPendingAction(room);
  player.turnCardsUsed = 0;
  player.turnActionTaken = false;
  player.turnDrewCard = false;
  player.turnPlayedCard = false;
  player.turnOverusePenaltyApplied = false;
  player.turnKeepOpen = false;
  refreshLastCardFlag(player);
  room.notice = `ถึงตาของ ${player.name}`;
}

function applyLastCardPenaltyIfNeeded(room, player) {
  if (!player || room.roundEnded) return;
  if (player.hand.length === 1 && !player.saidLastCard) {
    const penaltyDrawn = drawCards(room, player, 5, { animate: true });
    addLog(room, `${player.name} ไม่ได้กดเอื้อยข่าบ จึงโดนจั่วเพิ่ม ${penaltyDrawn} ใบ`);
    room.notice = `${player.name} โดนลงโทษเพราะไม่ได้กดเอื้อยข่าบ`;
  }
}

function finishAutoCompleteTurn(room, player, reason) {
  if (!room || room.roundEnded || !player) return;
  applyLastCardPenaltyIfNeeded(room, player);
  evaluatePlayers(room, reason || `${player.name} จบเทิร์นอัตโนมัติ`);
  if (room.roundEnded) return;
  room.turnCounter += 1;
  tickTimedThreats(room);
  if (room.roundEnded) return;
  const previousName = player.name;
  advanceTurn(room);
  if (!room.roundEnded && !room.notice.startsWith("ข้ามเทิร์น")) {
    room.notice = `จบเทิร์นของ ${previousName} แล้ว ถึงตาของ ${getCurrentPlayer(room)?.name || "-"}`;
  }
}

function autoCompleteTurn(room, player, reason) {
  if (!room || room.roundEnded || !player) return;
  if (player.hand.length === 1) {
    if (!room.pendingTurnAdvance || room.pendingTurnAdvance.playerId !== player.id) {
      clearPendingTurnAdvance(room);
      room.pendingTurnAdvance = {
        playerId: player.id,
        timeoutId: setTimeout(() => {
          if (!room.pendingTurnAdvance || room.pendingTurnAdvance.playerId !== player.id) return;
          room.pendingTurnAdvance = null;
          finishAutoCompleteTurn(room, player, reason);
          emitRoomState(room.roomId);
        }, LAST_CARD_DELAY_MS),
      };
      room.notice = `รอ ${player.name} กดเอื้อยข่าบภายใน 5 วินาที`;
    }
    return;
  }
  finishAutoCompleteTurn(room, player, reason);
}

function advanceTurn(room) {
  if (!getActivePlayers(room).length) return;
  clearPendingAction(room);
  const direction = room.playDirection === -1 ? -1 : 1;

  let attempts = 0;
  while (attempts <= room.players.length) {
    room.currentTurn = (room.currentTurn + direction + room.players.length) % room.players.length;
    const nextPlayer = room.players[room.currentTurn];
    if (!nextPlayer || nextPlayer.eliminated) {
      attempts += 1;
      continue;
    }

    if (nextPlayer.skipTurns > 0) {
      nextPlayer.skipTurns -= 1;
      queueEffect(room, { type: "skip", playerId: nextPlayer.id });
      addLog(room, `${nextPlayer.name} ถูกข้ามเทิร์น`);
      room.notice = `ข้ามเทิร์นของ ${nextPlayer.name}`;
      room.turnCounter += 1;
      tickTimedThreats(room);
      if (room.roundEnded) return;
      attempts += 1;
      continue;
    }

    if (nextPlayer.sleepTurns > 0) {
      nextPlayer.sleepTurns -= 1;
      queueEffect(room, { type: "skip", playerId: nextPlayer.id });
      addLog(room, `${nextPlayer.name} ยังหลับอยู่ จึงข้ามเทิร์น`);
      room.notice = `${nextPlayer.name} ยังหลับอยู่ จึงข้ามเทิร์น`;
      room.turnCounter += 1;
      tickTimedThreats(room);
      if (room.roundEnded) return;
      attempts += 1;
      continue;
    }

    beginTurn(room, room.currentTurn);
    room.notice = `ถึงตาของ ${nextPlayer.name}`;
    return;
  }

  const fallback = getActivePlayers(room)[0];
  if (fallback) {
    beginTurn(room, getPlayerIndex(room, fallback.id));
  }
}

function returnCardsToDeck(room, cards, options = {}) {
  if (!cards.length) return 0;
  room.deck.push(...cards);
  room.deck = shuffle(room.deck);
  const bethanyReturns = cards.filter((card) => card.id === "card_02").length;
  if (bethanyReturns && options.actor) {
    registerBethanyReturn(room, options.actor, bethanyReturns);
  }
  return bethanyReturns;
}

function dealCardsSequentially(room, players, counts, options = {}) {
  const activePlayers = (players || []).filter((player) => !!player && !player.eliminated);
  if (!activePlayers.length) return 0;

  const normalizedCounts = activePlayers.map((player, index) => {
    const rawCount = Array.isArray(counts)
      ? Number(counts[index]) || 0
      : Number(counts?.[player.id]) || 0;
    return Math.max(0, rawCount);
  });

  const rounds = Math.max(0, ...normalizedCounts);
  const startDelayMs = options.startDelayMs ?? 0;
  const perCardDelayMs = options.perCardDelayMs ?? 190;
  const soundSpacingMs = options.soundSpacingMs ?? 180;
  let distributed = 0;

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    activePlayers.forEach((player, playerIndex) => {
      if (normalizedCounts[playerIndex] <= roundIndex) return;
      if (options.source === "graveyard") {
        drawFromGraveyard(room, player, 1, {
          animate: options.animate,
          delayMs: startDelayMs + (distributed * perCardDelayMs),
          soundSpacingMs,
        });
      } else {
        drawCards(room, player, 1, {
          animate: options.animate,
          delayMs: startDelayMs + (distributed * perCardDelayMs),
          soundSpacingMs,
        });
      }
      distributed += 1;
    });
  }

  return distributed;
}

function chooseRandomStartingPlayer(room) {
  const activePlayers = getActivePlayers(room);
  if (!activePlayers.length) return null;
  const picked = activePlayers[Math.floor(Math.random() * activePlayers.length)];
  room.currentTurn = getPlayerIndex(room, picked.id);
  return picked;
}

function equalDealRemainingDeck(room) {
  const activePlayers = getActivePlayers(room);
  if (!activePlayers.length) return;
  const counts = activePlayers.map(() => 0);
  for (let index = 0; index < room.deck.length; index += 1) {
    counts[index % activePlayers.length] += 1;
  }
  dealCardsSequentially(room, activePlayers, counts, {
    animate: true,
    source: "deck",
    startDelayMs: 120,
    perCardDelayMs: 185,
    soundSpacingMs: 175,
  });
}

function redealSameCounts(room, options = {}) {
  const activePlayers = getActivePlayers(room);
  const counts = activePlayers.map((player) => player.hand.length);
  queueEffect(room, { type: "hand_reset", playerIds: activePlayers.map((player) => player.id) });
  const bethanyReturns = activePlayers.reduce(
    (total, player) => total + player.hand.filter((card) => card.id === "card_02").length,
    0,
  );
  activePlayers.forEach((player) => {
    room.deck.push(...player.hand);
    player.hand = [];
    player.saidLastCard = false;
  });
  room.deck = shuffle(room.deck);
  if (bethanyReturns && options.actor) {
    registerBethanyReturn(room, options.actor, bethanyReturns);
  }
  dealCardsSequentially(room, activePlayers, counts, {
    animate: true,
    source: "deck",
    startDelayMs: 240,
    perCardDelayMs: 210,
    soundSpacingMs: 190,
  });
}

function takeCardsFromHandByIds(player, selectedCardIds) {
  const remainingIds = new Set(selectedCardIds);
  const picked = [];

  player.hand = player.hand.filter((card) => {
    if (remainingIds.has(card.id)) {
      picked.push(card);
      remainingIds.delete(card.id);
      return false;
    }
    return true;
  });

  refreshLastCardFlag(player);
  return picked;
}

function removeFirstCardById(cards, cardId) {
  const index = cards.findIndex((card) => card.id === cardId);
  if (index === -1) return null;
  return cards.splice(index, 1)[0];
}

function removeCardFromPlayerHands(room, cardId) {
  for (const player of room.players) {
    const card = removeFirstCardById(player.hand, cardId);
    if (card) {
      refreshLastCardFlag(player);
      return { card, player, source: "hand" };
    }
  }
  return null;
}

function takeCardFromSources(room, cardId, sources) {
  for (const source of sources) {
    if (source === "hand") {
      const result = removeCardFromPlayerHands(room, cardId);
      if (result) return result;
      continue;
    }

    const collection = room[source];
    if (!Array.isArray(collection)) continue;
    const card = removeFirstCardById(collection, cardId);
    if (card) {
      return { card, source };
    }
  }
  return null;
}

function removeRandomCardFromHand(player) {
  if (!player.hand.length) return null;
  const index = Math.floor(Math.random() * player.hand.length);
  const [card] = player.hand.splice(index, 1);
  refreshLastCardFlag(player);
  return card;
}

function removeRandomUsableCardFromHand(player) {
  const usableIndices = player.hand
    .map((card, index) => (isCardUsable(card) ? index : -1))
    .filter((index) => index !== -1);
  if (!usableIndices.length) return null;
  const index = usableIndices[Math.floor(Math.random() * usableIndices.length)];
  const [card] = player.hand.splice(index, 1);
  refreshLastCardFlag(player);
  return card;
}

function removeFirstMatchingCardFromHand(player, cardIds) {
  const index = player.hand.findIndex((card) => cardIds.includes(card.id));
  if (index === -1) return null;
  const [card] = player.hand.splice(index, 1);
  refreshLastCardFlag(player);
  return card;
}

function isSleepProtected(player) {
  return !!player && player.sleepTurns > 0;
}

function isBethanyCard(card) {
  return !!card && repairText(card.name).includes("เบธานี");
}

function playerHasCard(player, cardId) {
  return player.hand.some((card) => card.id === cardId);
}

function buildUniformScoreDeltas(room, delta) {
  return Object.fromEntries(room.players.map((player) => [player.id, delta]));
}

function buildJosephinePenalty(room) {
  return Object.fromEntries(
    room.players.map((player) => [player.id, player.eliminated ? 0 : (player.josephineShield ? 0 : -1)]),
  );
}

function getDreamShieldWinners(room) {
  return getActivePlayers(room).filter((player) => player.josephineShield);
}

function settleRound(room, config) {
  if (room.roundEnded) return;
  clearPendingTurnAdvance(room);

  const winners = new Set(config.winnerIds || []);
  room.players.forEach((player) => {
    if (player.eliminated) return;
    if (player.linkWinTo && winners.has(player.linkWinTo)) {
      winners.add(player.id);
    }
    if (player.linkWinLoseTo) {
      if (winners.has(player.linkWinLoseTo)) {
        winners.add(player.id);
      } else {
        winners.delete(player.id);
      }
    }
  });

  room.winnerIds = Array.from(winners);
  room.winnerNames = room.players
    .filter((player) => winners.has(player.id))
    .map((player) => player.name);
  room.winnerReason = config.reason || "";
  room.roundEnded = true;
  room.notice = config.reason;
  addLog(room, `จบรอบ: ${config.reason}`);
  clearPendingAction(room);

  if (!room.resolvedScore) {
    const defaultScores = Object.fromEntries(
      room.players.map((player) => [player.id, (winners.has(player.id) ? 1 : 0) + (player.roundScoreDelta || 0)]),
    );
    const scoreDeltas = config.scoreDeltas
      ? Object.fromEntries(
        room.players.map((player) => [
          player.id,
          (defaultScores[player.id] || 0) + (config.scoreDeltas[player.id] || 0),
        ]),
      )
      : defaultScores;

    room.players.forEach((player) => {
      updatePlayerStats(player.name, scoreDeltas[player.id] ?? 0).catch((error) => {
        console.error("updatePlayerStats failed", error);
      });
    });
    room.resolvedScore = true;
  }
}

function setWinners(room, winnerIds, reason, scoreDeltas) {
  settleRound(room, { winnerIds, reason, scoreDeltas });
}

function eliminatePlayer(room, player, reason) {
  if (!player || player.eliminated || room.roundEnded) return;

  player.eliminated = true;
  player.roundScoreDelta -= 1;
  if (player.hand.length) {
    addCardsToGraveyard(room, [...player.hand], { animate: true });
    player.hand = [];
  }
  player.saidLastCard = false;
  addLog(room, `${player.name} แพ้ออกจากรอบ - ${reason}`);
  room.notice = `${player.name} แพ้ออกจากรอบ`;

  const activePlayers = getActivePlayers(room);
  if (activePlayers.length === 1) {
    setWinners(room, [activePlayers[0].id], `${activePlayers[0].name} เหลือเป็นคนสุดท้ายในรอบ`);
    return;
  }

  const currentPlayer = getCurrentPlayer(room);
  if (currentPlayer && currentPlayer.id === player.id) {
    advanceTurn(room);
  }
}

function clearCenterWarning(room) {
  room.centerWarning = null;
}

function updateCenterWarning(room) {
  const josephineThreat = room.timedThreats.josephine;
  if (josephineThreat?.active) {
    room.centerWarning = {
      key: `josephine:${josephineThreat.cyclesLeft}:${josephineThreat.stepCount}`,
      type: "danger",
      text: "คนบ้ากำลังหัวเราะ",
      cyclesLeft: josephineThreat.cyclesLeft,
    };
    return;
  }

  clearCenterWarning(room);
}

function startTimedThreat(room, threatKey, config) {
  if (room.roundEnded) return;
  if (room.timedThreats[threatKey]?.active) return;

  const threatReason = threatKey === "pinkLaugh"
    ? "พี่พิงค์หัวเราะกำลังนับถอยหลัง"
    : threatKey === "josephine"
      ? "คนบ้ากำลังหัวเราะ"
      : config.reason;
  const threatNotice = threatKey === "pinkLaugh"
    ? "พี่พิงค์หัวเราะกำลังนับถอยหลัง 3 รอบโต๊ะ"
    : threatKey === "josephine"
      ? "คนบ้ากำลังหัวเราะ เหลือเวลา 3 รอบโต๊ะ"
      : config.notice;

  room.timedThreats[threatKey] = {
    active: true,
    cyclesLeft: 3,
    stepCount: 0,
    reason: threatReason,
    cancelCardIds: [...config.cancelCardIds],
  };
  addLog(room, threatNotice);
  room.notice = threatNotice;
  updateCenterWarning(room);
}

function cancelTimedThreat(room, threatKey, cancelNotice) {
  const current = room.timedThreats[threatKey];
  if (!current?.active) return;
  room.timedThreats[threatKey] = null;
  if (threatKey === "josephine") {
    room.players.forEach((player) => {
      player.josephineShield = false;
      player.josephineShieldPendingWin = false;
    });
  }
  if (cancelNotice) {
    addLog(room, cancelNotice);
    room.notice = cancelNotice;
  }
  updateCenterWarning(room);
}

function tickTimedThreats(room) {
  if (room.roundEnded) return;

  const threatEntries = [
    {
      key: "josephine",
      failReason: "โจเซฟีนกำลังหัวเราะอยู่ครบ 3 รอบโต๊ะ ทุกคนถูกหัก 1 คะแนน",
      scoreDeltas: buildJosephinePenalty(room),
      cancelIf: () => hasBanishedCard(room, "card_15"),
      cancelNotice: "โจเซฟีนกำลังหัวเราะถูกกำจัดออกจากเกมแล้ว",
    },
    {
      key: "pinkLaugh",
      failReason: "พี่พิงค์หัวเราะอยู่ครบ 3 รอบโต๊ะ ทุกคนถูกหัก 1 คะแนน",
      scoreDeltas: buildJosephinePenalty(room),
      cancelIf: () => hasAnyBanishedCard(room, ["card_15", "card_17", "card_18"]),
      cancelNotice: "หนึ่งในการ์ดของพี่พิงค์หัวเราะถูกกำจัดออกจากเกมแล้ว",
    },
  ];

  threatEntries.forEach((entry) => {
    const threat = room.timedThreats[entry.key];
    if (!threat?.active || room.roundEnded) return;

    if (entry.cancelIf()) {
      cancelTimedThreat(room, entry.key, entry.cancelNotice);
      return;
    }

    threat.stepCount += 1;
    const playersPerCycle = Math.max(1, getActivePlayers(room).length);
    if (threat.stepCount < playersPerCycle) {
      updateCenterWarning(room);
      return;
    }

    threat.stepCount = 0;
    threat.cyclesLeft -= 1;
    if (threat.cyclesLeft > 0) {
      addLog(room, `${threat.reason} เหลืออีก ${threat.cyclesLeft} รอบโต๊ะ`);
      room.notice = `${threat.reason} เหลืออีก ${threat.cyclesLeft} รอบโต๊ะ`;
      updateCenterWarning(room);
      return;
    }

    settleRound(room, {
      winnerIds: entry.key === "josephine" ? getDreamShieldWinners(room).map((player) => player.id) : [],
      reason: entry.failReason,
      scoreDeltas: entry.scoreDeltas,
    });
  });
}

function checkAssemblyWin(player) {
  const handSet = new Set(player.hand.map((card) => card.id));
  return ASSEMBLY_SET.every((cardId) => handSet.has(cardId));
}

function checkSpecialRoundConditions(room) {
  if (room.roundEnded) return true;
  if (room.roundActionCount === 0) return false;

  const activePlayers = getActivePlayers(room);
  const pinkLaughTriggered = activePlayers.some((player) => (
    playerHasCard(player, "card_15")
    && playerHasCard(player, "card_17")
    && playerHasCard(player, "card_18")
  ));

  if (!room.laughingDisabled && pinkLaughTriggered) {
    startTimedThreat(room, "pinkLaugh", {
      reason: "พี่พิงค์หัวเราะกำลังนับถอยหลัง",
      notice: "พี่พิงค์หัวเราะกำลังนับถอยหลัง 3 เทิร์น",
      cancelCardIds: ["card_15", "card_17", "card_18"],
    });
  }

  if ((!pinkLaughTriggered || room.laughingDisabled) && room.timedThreats.pinkLaugh?.active && hasAnyBanishedCard(room, ["card_15", "card_17", "card_18"])) {
    cancelTimedThreat(room, "pinkLaugh", "หนึ่งในการ์ดของพี่พิงค์หัวเราะถูกกำจัดออกจากเกมแล้ว");
  }

  const josephineInHand = activePlayers.some((player) => playerHasCard(player, "card_15"));
  const hasFiveCards = activePlayers.some((player) => player.hand.length === 5);
  const deckOrGraveHasFive = room.deck.length === 5 || room.graveyard.length === 5;
  if (!room.laughingDisabled && josephineInHand && (hasFiveCards || deckOrGraveHasFive)) {
    startTimedThreat(room, "josephine", {
      reason: "โจเซฟีนกำลังหัวเราะกำลังนับถอยหลัง",
      notice: "คนบ้ากำลังหัวเราะ เหลือเวลา 3 เทิร์น",
      cancelCardIds: ["card_15"],
    });
  }

  if ((!josephineInHand || room.laughingDisabled) && room.timedThreats.josephine?.active && hasBanishedCard(room, "card_15")) {
    cancelTimedThreat(room, "josephine", "โจเซฟีนกำลังหัวเราะถูกกำจัดออกจากเกมแล้ว");
  }

  const nokanLosers = activePlayers.filter((player) => (
    playerHasCard(player, "card_49") && player.hand.length < 2
  ));
  if (nokanLosers.length) {
    nokanLosers.forEach((player) => {
      eliminatePlayer(room, player, "ยอดนักสืบโนคันทำงาน เพราะการ์ดบนมือน้อยกว่า 2 ใบ");
    });
    if (room.roundEnded) return true;
  }

  updateCenterWarning(room);
  return false;
}

function getPlayerWinReason(player, options = {}) {
  if (player.eliminated) return null;
  const ignoreIds = new Set(options.ignoreEmptyHandForIds || []);
  if (player.hand.length === 0 && !ignoreIds.has(player.id)) {
    return `${player.name} การ์ดหมดมือก่อน จึงชนะรอบนี้`;
  }
  if (checkAssemblyWin(player)) {
    return `${player.name} รวบรวมหัว แขน และขาพิงค์เบอร์รี่ครบ 5 ใบ`;
  }
  if (player.usedCard03Count >= 3) {
    return `${player.name} ใช้ซีโร่เทพจุติมาเกิดครบ 3 ครั้ง`;
  }
  if (player.valeskaStartCount !== null && player.usedCardsTotal - player.valeskaStartCount >= 10) {
    return `${player.name} ใช้การ์ดครบ 10 ใบหลังจากวาเลสก้าผู้มั่งคั่งทำงาน`;
  }
  return null;
}

function getPlayerWinReason(player, options = {}) {
  if (player.eliminated) return null;
  const ignoreIds = new Set(options.ignoreEmptyHandForIds || []);
  if (player.hand.length === 0 && !ignoreIds.has(player.id)) {
    return `${player.name} การ์ดหมดมือก่อน จึงชนะรอบนี้`;
  }
  if (checkAssemblyWin(player)) {
    return `${player.name} รวบรวมหัว แขน และขาพิงค์เบอร์รี่ครบ 5 ใบ`;
  }
  if (player.usedCard03Count >= ZERO_WIN_COUNT) {
    return `${player.name} ใช้ซีโร่เทพจุติมาเกิดครบ ${ZERO_WIN_COUNT} ครั้ง`;
  }
  if (player.valeskaStartCount !== null && player.usedCardsTotal - player.valeskaStartCount >= VALESKA_WIN_COUNT) {
    return `${player.name} ใช้การ์ดครบ ${VALESKA_WIN_COUNT} ใบหลังจากวาเลสก้าผู้มั่งคั่งทำงาน`;
  }
  return null;
}

function evaluatePlayers(room, notice, options = {}) {
  if (room.roundEnded) return;

  const mergedIgnoreIds = Array.from(new Set([
    ...(room.pendingIgnoreEmptyHandForIds || []),
    ...(options.ignoreEmptyHandForIds || []),
  ]));
  room.pendingIgnoreEmptyHandForIds = [];

  if (checkSpecialRoundConditions(room)) return;

  const winnerIds = [];
  let winnerReason = notice;

  getActivePlayers(room).forEach((player) => {
    const reason = getPlayerWinReason(player, { ignoreEmptyHandForIds: mergedIgnoreIds });
    if (reason) {
      winnerIds.push(player.id);
      if (winnerIds.length === 1) {
        winnerReason = reason;
      }
    }
  });

  if (winnerIds.length) {
    setWinners(room, winnerIds, winnerReason);
    return;
  }

  room.notice = notice;
}

function beginTargetAction(room, actor, card, config) {
  const options = room.players
    .filter((candidate) => !candidate.eliminated)
    .filter((candidate) => config.includeSelf || candidate.id !== actor.id)
    .map((candidate) => ({ id: candidate.id, name: candidate.name }));

  if (!options.length) {
    room.notice = "ไม่มีผู้เล่นให้เลือก";
    return false;
  }

  room.pendingAction = {
    mode: "select_player",
    actorId: actor.id,
    cardId: card.id,
    cardName: card.name,
    effect: config.effect,
    title: config.title,
    description: config.description,
    options,
  };
  room.notice = config.description;
  addLog(room, buildActionLog(actor, card, "กำลังเลือกเป้าหมาย"));
  return true;
}

function beginCardSelectionAction(room, actor, config) {
  const resolvedFilter = typeof config.availableFilter === "function"
    ? config.availableFilter
    : ["discard_selected", "discard_one_and_random_draw"].includes(config.effect)
      ? canDiscardFromOwnEffect
      : null;
  const sourceCards = Array.isArray(config.availableCardsData)
    ? [...config.availableCardsData]
    : typeof resolvedFilter === "function"
      ? actor.hand.filter((card) => resolvedFilter(card, actor, room))
      : actor.hand;
  const availableCards = sourceCards.map((card) => ({ ...card }));
  const availableCardIds = availableCards.map((card) => card.selectionKey || card.id);
  const maxSelections = Math.min(config.maxSelections, availableCards.length);
  const minSelections = Math.min(config.minSelections ?? config.maxSelections, maxSelections);

  if (!maxSelections) {
    room.notice = config.emptyNotice || "ไม่มีการ์ดให้เลือก";
    return false;
  }

  room.pendingAction = {
    mode: "select_cards",
    actorId: actor.id,
    cardId: config.cardId || null,
    cardName: config.cardName || "",
    effect: config.effect,
    title: config.title,
    description: config.description,
    minSelections,
    maxSelections,
    availableCardIds,
    availableCardsData: Array.isArray(config.availableCardsData) ? availableCards : null,
    selectionSource: config.selectionSource || null,
    previewCount: config.previewCount || null,
    targetPlayerId: config.targetPlayerId || null,
    requesterId: config.requesterId || null,
    poolPlayerIds: config.poolPlayerIds ? [...config.poolPlayerIds] : null,
    queue: config.queue ? [...config.queue] : null,
  };
  room.notice = config.description;
  return true;
}

function takeCardsFromSelectionSource(room, actor, action, selectedCardIds) {
  if (!Array.isArray(selectedCardIds) || !selectedCardIds.length) return [];

  if (action.selectionSource === "player_pool") {
    return takeCardsFromPlayerPool(room, selectedCardIds);
  }

  if (action.selectionSource === "deck") {
    return selectedCardIds.map((cardId) => removeFirstCardById(room.deck, cardId)).filter(Boolean);
  }

  if (action.selectionSource === "graveyard") {
    return selectedCardIds.map((cardId) => removeFirstCardById(room.graveyard, cardId)).filter(Boolean);
  }

  if (["custom_pool", "deck_preview"].includes(action.selectionSource) && Array.isArray(action.availableCardsData)) {
    const pool = [...action.availableCardsData];
    const picked = [];
    selectedCardIds.forEach((cardId) => {
      const index = pool.findIndex((card) => (card.selectionKey || card.id) === cardId);
      if (index !== -1) {
        picked.push(pool.splice(index, 1)[0]);
      }
    });
    action.remainingPoolCards = pool;
    return picked;
  }

  return takeCardsFromHandByIds(actor, selectedCardIds);
}

function applyTurnOverusePenalty(room, player) {
  if (player.turnCardsUsed > 10 && !player.turnOverusePenaltyApplied) {
    player.turnOverusePenaltyApplied = true;
    const drawn = drawCards(room, player, 5, { animate: true });
    addLog(room, `${player.name} ใช้การ์ดเกิน 10 ใบในเทิร์นเดียว จึงโดนจั่วเพิ่ม ${drawn} ใบ`);
  }
}

function registerBethanyReturn(room, player, count = 1) {
  if (!count || room.roundEnded) return;
  player.bethanyReturnCount += count;
  const progressText = `${player.name} ทำให้เบธานีเทพหลับกลับเข้าเดคแล้ว ${player.bethanyReturnCount}/${BETHANY_WIN_COUNT} ครั้ง`;
  addLog(room, progressText);
  announceCounterEffect(room, progressText);
  if (player.bethanyReturnCount >= BETHANY_WIN_COUNT) {
    setWinners(room, [player.id], `${player.name} ทำให้เบธานีเทพหลับกลับเข้าเดคครบ ${BETHANY_WIN_COUNT} ครั้ง`);
  }
}

function notifyTrackedCounters(room, player, card) {
  if (!player || room.roundEnded) return;

  if (card.id === "card_03") {
    announceCounterEffect(
      room,
      `ซีโร่เทพจุติมาเกิด ถูก ${player.name} ใช้งานแล้ว ${player.usedCard03Count}/${ZERO_WIN_COUNT} ครั้ง`,
    );
  }

  if (player.valeskaStartCount !== null && card.id !== "card_12") {
    const activeCount = Math.max(0, player.usedCardsTotal - player.valeskaStartCount);
    if (activeCount > 0) {
      announceCounterEffect(
        room,
        `วาเลสก้าผู้มั่งคั่ง ของ ${player.name} กำลังทำงาน ${activeCount}/${VALESKA_WIN_COUNT} รอบ`,
      );
    }
  }
}

function scheduleForcedPlay(room, playerId, card, context) {
  room.queuedForcedPlays.push({ playerId, card, context });
}

function triggerCardPlay(room, actingPlayer, card) {
  actingPlayer.inspectedHand = null;
  room.centerCard = card;
  addCardsToGraveyard(room, [card], { animate: true });
  actingPlayer.usedCardsTotal += 1;
  actingPlayer.turnCardsUsed += 1;
  actingPlayer.turnPlayedCard = true;
  actingPlayer.turnActionTaken = true;
  room.roundActionCount += 1;
  refreshLastCardFlag(actingPlayer);

  if (!actingPlayer.hand.length) {
    const winReason = `${actingPlayer.name} ลงการ์ดใบสุดท้ายหมดมือและชนะทันที`;
    setWinners(room, [actingPlayer.id], winReason);
    return {
      pending: false,
      announceText: winReason,
      actorTagText: "ชนะทันที",
      actorTagTone: "effect-win",
    };
  }

  const effectResult = applyCardEffect(room, actingPlayer, card);
  actingPlayer.turnKeepOpen = !!effectResult.keepTurnOpen;
  notifyTrackedCounters(room, actingPlayer, card);
  applyTurnOverusePenalty(room, actingPlayer);

  const announceText = repairText(effectResult.announceText || `${actingPlayer.name} ใช้การ์ด ${card.name}`);
  announceCardEffect(room, announceText, effectResult.announceTone || "effect-announce");
  queuePlayerTag(room, actingPlayer.id, repairText(effectResult.actorTagText || card.name), effectResult.actorTagTone || "effect-tag");
  (effectResult.targetTags || []).forEach((tag) => {
    queuePlayerTag(room, tag.playerId, tag.text, tag.tone);
  });

  if (!effectResult.pending && !room.roundEnded && card.autoWinOnField) {
    setWinners(room, [actingPlayer.id], `${actingPlayer.name} ครอบครอง ${card.name} บนสนามและชนะทันที`);
  }

  if (effectResult.takeoverTurn && !room.roundEnded) {
    const playerIndex = getPlayerIndex(room, actingPlayer.id);
    if (playerIndex !== -1) {
      room.currentTurn = playerIndex;
      room.notice = `${actingPlayer.name} แย่งเทิร์นสำเร็จ`;
    }
  }

  return effectResult;
}

function processQueuedForcedPlays(room) {
  const ignoredIds = new Set();

  while (room.queuedForcedPlays.length && !room.pendingAction && !room.roundEnded) {
    const nextPlay = room.queuedForcedPlays.shift();
    const player = room.players.find((candidate) => candidate.id === nextPlay.playerId);
    if (!player) continue;

    if (nextPlay.context) {
      addLog(room, `${player.name} ${nextPlay.context} ${nextPlay.card.name}`);
    }

    const result = triggerCardPlay(room, player, nextPlay.card);
    (result.ignoreEmptyHandForIds || []).forEach((id) => ignoredIds.add(id));
    if (result.pending) {
      return { pending: true, ignoreEmptyHandForIds: Array.from(ignoredIds) };
    }
  }

  return { pending: false, ignoreEmptyHandForIds: Array.from(ignoredIds) };
}

function finalizeResolvedAction(room) {
  if (room.roundEnded) return { pending: false };

  const queuedResult = processQueuedForcedPlays(room);
  collectIgnoredIds(room, queuedResult.ignoreEmptyHandForIds || []);

  if (room.roundEnded || queuedResult.pending) {
    return queuedResult;
  }

  evaluatePlayers(room, room.notice);
  return { pending: false };
}

function maybeAutoAdvanceAfterAction(room, actor) {
  if (!room || room.roundEnded || room.pendingAction || !actor) return;
  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.id !== actor.id) return;
  if (actor.turnKeepOpen) return;
  if (!actor.turnActionTaken) return;
  autoCompleteTurn(room, actor);
}

function consumeMirrorCard(room, target) {
  const mirrorCard = removeFirstMatchingCardFromHand(target, MAGIC_MIRROR_SET);
  if (!mirrorCard) return null;
  addCardsToGraveyard(room, [mirrorCard], { animate: true });
  refreshLastCardFlag(target);
  return mirrorCard;
}

function tryReflectTargetedEffect(room, sourcePlayer, targetPlayer, mode, payload = {}) {
  if (!targetPlayer) {
    return { reflected: false, blocked: false };
  }

  if (isSleepProtected(targetPlayer)) {
    return { reflected: false, blocked: true };
  }

  const mirrorCard = consumeMirrorCard(room, targetPlayer);
  if (!mirrorCard) {
    return { reflected: false, blocked: false };
  }

  addLog(room, `${targetPlayer.name} ใช้กระจกวิเศษสะท้อนเอฟเฟกต์กลับไปหา ${sourcePlayer.name}`);
  queuePlayerTag(room, targetPlayer.id, "🔁 สะท้อนกลับ", "effect-swap");

  if (mode === "skip") {
    sourcePlayer.skipTurns += payload.count || 1;
    room.notice = `${sourcePlayer.name} ถูกสะท้อนให้ข้ามเทิร์น`;
    return {
      reflected: true,
      announceText: `${sourcePlayer.name} ถูกสะท้อนให้ข้ามเทิร์น`,
      targetTags: [{ playerId: sourcePlayer.id, text: "❌ข้าม", tone: "effect-skip" }],
    };
  }

  if (mode === "draw_deck") {
    const drawn = drawCards(room, sourcePlayer, payload.count || 0, { animate: true });
    room.notice = `${sourcePlayer.name} จั่วการ์ด ${drawn} ใบ`;
    return {
      reflected: true,
      announceText: `${sourcePlayer.name} จั่วการ์ด ${drawn} ใบ`,
      targetTags: [{ playerId: sourcePlayer.id, text: `🃏+${drawn}`, tone: "effect-draw effect-draw-green" }],
    };
  }

  if (mode === "draw_graveyard") {
    const drawn = drawFromGraveyard(room, sourcePlayer, payload.count || 0, {
      animate: true,
      excludeCards: payload.excludeCards || [],
    });
    room.notice = `${sourcePlayer.name} ถูกสะท้อนให้จั่วการ์ด ${drawn} ใบจากสุสาน`;
    return {
      reflected: true,
      announceText: `${sourcePlayer.name} ถูกสะท้อนให้จั่วการ์ด ${drawn} ใบจากสุสาน`,
      targetTags: [{ playerId: sourcePlayer.id, text: `🃏+${drawn}`, tone: "effect-draw effect-draw-green" }],
    };
  }

  return { reflected: true, blocked: false };
}

function applyBasicDrawCard(room, player, card) {
  const drawn = drawCards(room, player, 1, { animate: true });
  addLog(room, buildActionLog(player, card, `จั่วการ์ดจากเดค ${drawn} ใบ`));
  room.notice = `${player.name} จั่วการ์ด ${drawn} ใบ`;
  return {
    pending: false,
    announceText: `${player.name} จั่วการ์ด ${drawn} ใบ`,
    targetTags: [{ playerId: player.id, text: `🃏+${drawn}`, tone: "effect-draw effect-draw-green" }],
  };
}

function applyRandomPlayAndDiscardAll(room, player, card) {
  const discardedLines = [];

  getActivePlayers(room).forEach((target) => {
    const randomPlayable = removeRandomUsableCardFromHand(target);
    if (randomPlayable) {
      scheduleForcedPlay(room, target.id, randomPlayable, "à¸–à¸¹à¸à¸ªà¸¸à¹ˆà¸¡à¹ƒà¸«à¹‰ใช้");
    }

    const discardedCard = removeRandomCardFromHand(target);
    if (discardedCard) {
      addCardsToGraveyard(room, [discardedCard], { animate: true });
      discardedLines.push(`${target.name} à¸—à¸´à¹‰à¸‡ ${discardedCard.name}`);
    }
  });

  addLog(room, buildActionLog(player, card, "à¸ªà¸¸à¹ˆà¸¡ใช้à¸‡à¸²à¸™à¸à¸²à¸£à¹Œà¸” 1 ใบ à¹à¸¥à¸°à¸ªà¸¸à¹ˆà¸¡à¸—à¸´à¹‰à¸‡à¸¥à¸‡สุสานà¹ƒà¸«à¹‰ทุกคนà¸„à¸™à¸¥à¸° 1 ใบ"));
  if (discardedLines.length) {
    addLog(room, discardedLines.join(" / "));
  }

  room.notice = "à¸—à¸¸à¸à¸„à¸™à¸–à¸¹à¸à¸ªà¸¸à¹ˆà¸¡à¹ƒà¸«à¹‰ใช้การ์ดà¹à¸¥à¸°à¸ªà¸¸à¹ˆà¸¡à¸—à¸´à¹‰à¸‡à¸à¸²à¸£à¹Œà¸”à¸¥à¸‡สุสาน";
  const queuedResult = processQueuedForcedPlays(room);
  return {
    ...queuedResult,
    announceText: "à¹à¸›à¸°à¸¡à¸·à¸­à¸«à¸™à¹ˆà¸­à¸¢à¸žà¸µà¹ˆ",
  };
}

function applySkipNextCard(room, player, card) {
  const target = getNextPlayerAfter(room, player.id);
  if (!target || target.id === player.id) {
    room.notice = "à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™à¸„à¸™à¸–à¸±à¸”à¹„à¸›à¹ƒà¸«à¹‰à¸‚à¹‰à¸²à¸¡à¹€à¸—à¸´à¸£à¹Œà¸™";
    return { pending: false };
  }

  const reflected = tryReflectTargetedEffect(room, player, target, "skip", { count: 1 });
  if (reflected.blocked) {
    addLog(room, buildActionLog(player, card, `${target.name} à¸«à¸¥à¸±à¸šà¸­à¸¢à¸¹à¹ˆ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸šà¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œà¸‚à¹‰à¸²à¸¡à¹€à¸—à¸´à¸£à¹Œà¸™`));
    room.notice = `${target.name} à¸«à¸¥à¸±à¸šà¸­à¸¢à¸¹à¹ˆ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸šà¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œà¸‚à¹‰à¸²à¸¡à¹€à¸—à¸´à¸£à¹Œà¸™`;
    return { pending: false, announceText: `${target.name} à¸à¸±à¸™à¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œà¹„à¸§à¹‰à¹„à¸”à¹‰` };
  }
  if (reflected.reflected) {
    addLog(room, buildActionLog(player, card, `à¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œà¸–à¸¹à¸à¸ªà¸°à¸—à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¹„à¸›à¸«à¸² ${player.name}`));
    return reflected;
  }

  target.skipTurns += 1;
  addLog(room, buildActionLog(player, card, `à¸‚à¹‰à¸²à¸¡à¹€à¸—à¸´à¸£à¹Œà¸™à¸‚à¸­à¸‡ ${target.name}`));
  room.notice = `${target.name} à¸ˆà¸°à¸–à¸¹à¸à¸‚à¹‰à¸²à¸¡à¹€à¸—à¸´à¸£à¹Œà¸™à¸–à¸±à¸”à¹„à¸›`;
  return {
    pending: false,
    announceText: `${target.name} à¸–à¸¹à¸à¸‚à¹‰à¸²à¸¡à¹€à¸—à¸´à¸£à¹Œà¸™`,
    targetTags: [{ playerId: target.id, text: "âŒà¸‚à¹‰à¸²à¸¡", tone: "effect-skip" }],
  };
}

function applyNextPlayerDrawCard(room, player, card) {
  const target = getNextPlayerAfter(room, player.id);
  if (!target || target.id === player.id) {
    room.notice = "à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™à¸„à¸™à¸–à¸±à¸”à¹„à¸›à¹ƒà¸«à¹‰จั่วการ์ด";
    return { pending: false };
  }

  const reflected = tryReflectTargetedEffect(room, player, target, "draw_deck", { count: 2 });
  if (reflected.blocked) {
    addLog(room, buildActionLog(player, card, `${target.name} à¸«à¸¥à¸±à¸šà¸­à¸¢à¸¹à¹ˆ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸šà¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œจั่ว`));
    room.notice = `${target.name} à¸«à¸¥à¸±à¸šà¸­à¸¢à¸¹à¹ˆ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸šà¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œจั่ว`;
    return { pending: false, announceText: `${target.name} à¸à¸±à¸™à¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œจั่วà¹„à¸§à¹‰à¹„à¸”à¹‰` };
  }
  if (reflected.reflected) {
    addLog(room, buildActionLog(player, card, `à¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œจั่วà¸–à¸¹à¸à¸ªà¸°à¸—à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¹„à¸›à¸«à¸² ${player.name}`));
    return reflected;
  }

  const drawn = drawCards(room, target, 2, { animate: true });
  addLog(room, buildActionLog(player, card, `${target.name} จั่วการ์ด ${drawn} ใบจากเดค`));
  room.notice = `${target.name} จั่วการ์ด ${drawn} ใบ`;
  return {
    pending: false,
    announceText: `${target.name} จั่วการ์ด ${drawn} ใบ`,
    targetTags: [{ playerId: target.id, text: `🃏+${drawn}`, tone: "effect-draw effect-draw-green" }],
  };
}

function applyNormalBethany(room, player, card) {
  const extraCards = player.hand.filter((candidate) => NORMAL_BETHANY_SET.includes(candidate.id));
  if (!extraCards.length) {
    addLog(room, buildActionLog(player, card));
    room.notice = `${player.name} ใช้ ${card.name}`;
    return { pending: false };
  }

  player.hand = player.hand.filter((candidate) => !NORMAL_BETHANY_SET.includes(candidate.id));
  refreshLastCardFlag(player);
  addCardsToGraveyard(room, extraCards, { animate: true });
  player.usedCardsTotal += extraCards.length;
  player.turnCardsUsed += extraCards.length;
  room.roundActionCount += extraCards.length;
  applyTurnOverusePenalty(room, player);
  addLog(room, buildActionLog(player, card, `เบธานีธรรมดาอีก ${extraCards.length} ใบถูกใช้ไปพร้อมกัน`));
  room.notice = `${player.name} ใช้เบธานีพร้อมกัน ${extraCards.length + 1} ใบ`;
  return { pending: false };
}

function resolveLoveChain(room, sourcePlayer, targetPlayer, drawCount, card) {
  let currentSource = sourcePlayer;
  let currentTarget = targetPlayer;
  let totalDraw = drawCount;
  let safety = 0;

  while (currentTarget && safety < 20) {
    safety += 1;

    if (isSleepProtected(currentTarget)) {
      addLog(room, `${currentTarget.name} à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ªà¸–à¸²à¸™à¸°à¸«à¸¥à¸±à¸šà¸­à¸¢à¸¹à¹ˆ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸šà¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œจั่ว`);
      currentTarget = getNextPlayerAfter(room, currentTarget.id);
      continue;
    }

    const mirrorCard = removeFirstMatchingCardFromHand(currentTarget, MAGIC_MIRROR_SET);
    if (mirrorCard) {
      addCardsToGraveyard(room, [mirrorCard], { animate: true });
      addLog(room, `${currentTarget.name} ใช้กระจกวิเศษสะท้อนเอฟเฟกต์กลับ`);
      queuePlayerTag(room, currentTarget.id, "🔁 สะท้อนกลับ", "effect-swap");
      const reflectedTarget = currentSource;
      currentSource = currentTarget;
      currentTarget = reflectedTarget;
      continue;
    }

    const stackCard = removeFirstMatchingCardFromHand(currentTarget, LOVE_STACK_SET);
    if (stackCard) {
      addCardsToGraveyard(room, [stackCard], { animate: true });
      totalDraw += 2;
      addLog(room, `${currentTarget.name} à¸ªà¹à¸•à¸„à¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢ à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸›à¹‡à¸™ ${totalDraw} ใบ`);
      queuePlayerTag(room, currentTarget.id, "à¸ªà¹à¸•à¸„ +2", "effect-draw effect-draw-orange");
      currentSource = currentTarget;
      currentTarget = getNextPlayerAfter(room, currentTarget.id);
      continue;
    }

    const drawn = drawCards(room, currentTarget, totalDraw, { animate: true });
    addLog(room, buildActionLog(sourcePlayer, card, `${currentTarget.name} จั่วการ์ด ${drawn} ใบà¸ˆà¸²à¸à¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢`));
    room.notice = `${currentTarget.name} จั่วการ์ด ${drawn} ใบ`;
    return {
      pending: false,
      announceText: `${card.name} ทำงาน ${currentTarget.name} จั่ว ${drawn} ใบ`,
      targetTags: [
        {
          playerId: currentTarget.id,
          text: `🃏+${drawn}`,
          tone: drawn >= 4 ? "effect-draw effect-draw-orange" : "effect-draw effect-draw-green",
        },
      ],
    };
  }

  room.notice = "à¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢à¹ƒà¸«à¹‰à¸¥à¸‡à¹à¸¥à¹‰à¸§";
  return { pending: false, announceText: `${card.name} à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢à¹ƒà¸«à¹‰à¸¥à¸‡` };
}

function resolveLoveChainV2(room, sourcePlayer, targetPlayer, drawCount, card) {
  let currentSource = sourcePlayer;
  let currentTarget = targetPlayer;
  let totalDraw = drawCount;
  let safety = 0;

  while (currentTarget && safety < 20) {
    safety += 1;

    if (isSleepProtected(currentTarget)) {
      addLog(room, `${currentTarget.name} à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸ªà¸–à¸²à¸™à¸°à¸«à¸¥à¸±à¸šà¸­à¸¢à¸¹à¹ˆ à¸ˆà¸¶à¸‡à¹„à¸¡à¹ˆà¸£à¸±à¸šà¹€à¸­à¸Ÿà¹€à¸Ÿà¸à¸•à¹Œจั่ว`);
      currentTarget = getNextPlayerAfter(room, currentTarget.id);
      continue;
    }

    const mirrorCard = removeFirstMatchingCardFromHand(currentTarget, MAGIC_MIRROR_SET);
    if (mirrorCard) {
      addCardsToGraveyard(room, [mirrorCard], { animate: true });
      addLog(room, `${currentTarget.name} ใช้กระจกวิเศษสะท้อนเอฟเฟกต์จั่วกลับไปที่ ${currentSource.name}`);
      queuePlayerTag(room, currentTarget.id, "🔁 สะท้อนกลับ", "effect-swap");
      const reflectedTarget = currentSource;
      currentSource = currentTarget;
      currentTarget = reflectedTarget;
      continue;
    }

    const stackCard = removeFirstMatchingCardFromHand(currentTarget, LOVE_STACK_SET);
    if (stackCard) {
      addCardsToGraveyard(room, [stackCard], { animate: true });
      totalDraw += 2;
      addLog(room, `${currentTarget.name} à¸ªà¹à¸•à¸„à¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢ à¸ªà¹ˆà¸‡à¸•à¹ˆà¸­à¹€à¸›à¹‡à¸™ ${totalDraw} ใบ`);
      queuePlayerTag(
        room,
        currentTarget.id,
        `à¸ªà¹à¸•à¸„ ${totalDraw}`,
        totalDraw >= 6 ? "effect-draw effect-draw-purple" : "effect-draw effect-draw-orange",
      );
      currentSource = currentTarget;
      currentTarget = getNextPlayerAfter(room, currentTarget.id);
      continue;
    }

    const drawn = drawCards(room, currentTarget, totalDraw, { animate: true });
    addLog(room, buildActionLog(sourcePlayer, card, `${currentTarget.name} à¹„à¸¡à¹ˆà¸¡à¸µà¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢à¹„à¸§à¹‰à¸ªà¹à¸•à¸„à¸•à¹ˆà¸­ à¸ˆà¸¶à¸‡à¸•à¹‰à¸­à¸‡จั่วการ์ด ${drawn} ใบจากเดค`));
    room.notice = `${currentTarget.name} à¸£à¸±à¸šà¸ªà¹à¸•à¸„à¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢ ${drawn} ใบ`;
    return {
      pending: false,
      announceText: `${card.name} à¸ªà¹à¸•à¸„ ${drawn} ใบà¹ƒà¸ªà¹ˆ ${currentTarget.name}`,
      targetTags: [
        {
          playerId: currentTarget.id,
          text: `🃏+${drawn}`,
          tone: drawn >= 6
            ? "effect-draw effect-draw-purple"
            : drawn >= 4
              ? "effect-draw effect-draw-orange"
              : "effect-draw effect-draw-green",
        },
      ],
    };
  }

  room.notice = "à¸‰à¸±à¸™à¸£à¸±à¸à¹à¸à¸™à¸°à¹€à¸§à¹‰à¸¢à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢à¹ƒà¸«à¹‰à¸¥à¸‡à¹à¸¥à¹‰à¸§";
  return { pending: false, announceText: `${card.name} à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸›à¹‰à¸²à¸«à¸¡à¸²à¸¢à¹ƒà¸«à¹‰à¸¥à¸‡` };
}

function rotateOtherHands(room, actor) {
  const otherPlayers = getActivePlayers(room).filter((target) => target.id !== actor.id);
  if (otherPlayers.length < 2) return false;

  const rotatedHands = otherPlayers.map((target) => target.hand);
  otherPlayers.forEach((target, index) => {
    target.hand = rotatedHands[(index + 1) % rotatedHands.length];
    refreshLastCardFlag(target);
  });
  queueEffect(room, { type: "swap", allTable: true });
  return true;
}

function buildAssemblyStealPool(room, actor) {
  return sortCardsByFileId(
    room.players.flatMap((candidate) => (
      !candidate.eliminated && candidate.id !== actor.id
        ? candidate.hand
          .filter((heldCard) => ASSEMBLY_SET.includes(heldCard.id))
          .map((heldCard, index) => ({
            ...heldCard,
            selectionKey: `${candidate.id}:${heldCard.id}:${index}`,
            ownerId: candidate.id,
            ownerName: candidate.name,
          }))
        : []
    )),
  );
}

function takeCardsFromPlayerPool(room, selectedKeys) {
  const wanted = new Set(selectedKeys || []);
  const picked = [];
  room.players.forEach((candidate) => {
    if (!wanted.size) return;
    let matchIndex = 0;
    candidate.hand = candidate.hand.filter((heldCard) => {
      const key = `${candidate.id}:${heldCard.id}:${matchIndex}`;
      matchIndex += 1;
      if (!wanted.has(key)) return true;
      wanted.delete(key);
      picked.push({
        ...heldCard,
        ownerId: candidate.id,
        ownerName: candidate.name,
        selectionKey: key,
      });
      return false;
    });
    refreshLastCardFlag(candidate);
  });
  return picked;
}

function findMissingAssemblyPart(room, player) {
  const owned = new Set(player.hand.filter((heldCard) => ASSEMBLY_SET.includes(heldCard.id)).map((heldCard) => heldCard.id));
  const missing = ASSEMBLY_SET.filter((cardId) => !owned.has(cardId));
  const candidates = [];
  missing.forEach((cardId) => {
    room.deck.forEach((deckCard, index) => {
      if (deckCard.id === cardId) candidates.push({ source: "deck", index, card: deckCard });
    });
    room.graveyard.forEach((graveCard, index) => {
      if (graveCard.id === cardId) candidates.push({ source: "graveyard", index, card: graveCard });
    });
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function applyCardEffect(room, player, card) {
  if (BASIC_DRAW_SET.includes(card.id)) {
    return applyBasicDrawCard(room, player, card);
  }

  if (BASIC_SKIP_SET.includes(card.id)) {
    return applySkipNextCard(room, player, card);
  }

  if (NEXT_DRAW_SET.includes(card.id)) {
    return applyNextPlayerDrawCard(room, player, card);
  }

  if (NORMAL_BETHANY_SET.includes(card.id)) {
    return applyNormalBethany(room, player, card);
  }

  if (STEAL_ASSEMBLY_SET.includes(card.id)) {
    return {
      pending: beginCardSelectionAction(room, player, {
        cardId: card.id,
        cardName: card.name,
        effect: "steal_assembly_part",
        title: "ข้อความ 1",
        description: "ข้อความ 2",
        minSelections: 1,
        maxSelections: 1,
        selectionSource: "player_pool",
        availableCardsData: buildAssemblyStealPool(room, player),
        emptyNotice: "ข้อความ3",
      }),
      announceText: `${card.name} ข้อความ4`,
    };
  }

  if (SCAN_ASSEMBLY_SET.includes(card.id)) {
    const found = findMissingAssemblyPart(room, player);
    if (!found) {
      room.notice = "ข้อความ5";
      addLog(room, buildActionLog(player, card, "ข้อความ6"));
      return { pending: false, announceText: `${card.name} ข้อความ7` };
    }

    const picked = found.source === "deck"
      ? room.deck.splice(found.index, 1)[0]
      : room.graveyard.splice(found.index, 1)[0];
    receiveCards(room, player, [picked], { animate: true, source: found.source });
    addLog(room, buildActionLog(player, card, `แสกนหา${picked.name} จาก${found.source === "deck" ? "เดค" : "สุสาน"}`));
    room.notice = `${player.name} ข้อความ10 ${picked.name} ข้อความ11­`;
    return {
      pending: false,
      announceText: `${card.name} ได้รับ ${picked.name}`,
      targetTags: [{ playerId: player.id, text: "🃏+1", tone: "effect-draw effect-draw-green" }],
    };
  }

  if (JOJIG_ALL_SET.includes(card.id)) {
    if (!rotateOtherHands(room, player)) {
      room.notice = "มีผู้เล่นไม่พอสำหรับสลับมือ";
      return { pending: false, announceText: `${card.name} ใช้ไม่ได้ตอนนี้` };
    }
    addLog(room, buildActionLog(player, card, "สลับการ์ดของทุกคน ยกเว้นตัวเอง"));
    room.notice = "เกิดการสลับมือทั้งโต๊ะ";
    return { pending: false, announceText: "สลับทั้งโต๊ะ" };
  }

  if (BIRD_DISCARD_SET.includes(card.id)) {
    return {
      pending: beginCardSelectionAction(room, player, {
        cardId: card.id,
        cardName: card.name,
        effect: "discard_selected",
        title: "เลือกการ์ดลงสุสาน",
        description: "เลือกการ์ดจากมือของคุณ 2 ใบเพื่อลงสุสาน",
        minSelections: 2,
        maxSelections: 2,
        emptyNotice: `${player.name} ไม่มีการ์ดให้ลงสุสาน`,
      }),
      announceText: `${card.name} กำลังเลือกทิ้งการ์ด`,
    };
  }

  if (LIZARD_SET.includes(card.id)) {
    return {
      pending: beginCardSelectionAction(room, player, {
        cardId: card.id,
        cardName: card.name,
        effect: "take_from_deck",
        title: "เลือกการ์ดจากเดคขึ้นมือ­",
        description: "เลือกการ์ด 1 ใบจากเดคขึ้นมือ­",
        minSelections: 1,
        maxSelections: 1,
        selectionSource: "deck",
        availableCardsData: room.deck,
        emptyNotice: "เดคว่าง ไม่มีการ์ดให้เลือก",
      }),
      announceText: `${card.name} เปิดเดคหาการ์ด`,
    };
  }

  if (BELL_GHOST_SET.includes(card.id)) {
    return {
      pending: beginCardSelectionAction(room, player, {
        cardId: card.id,
        cardName: card.name,
        effect: "take_from_graveyard",
        title: "เลือกการ์ดจากสุสานขึ้นมือ­",
        description: "เลือกการ์ด 1 ใบจากสุสานขึ้นมือ­",
        minSelections: 1,
        maxSelections: 1,
        selectionSource: "graveyard",
        availableCardsData: room.graveyard,
        emptyNotice: "สุสานว่าง ไม่มีการ์ดให้เลือก",
      }),
      announceText: `${card.name} เปิดสุสานหาการ์ด`,
    };
  }

  if (REVERSE_TIME_SET.includes(card.id)) {
    room.playDirection *= -1;
    queueEffect(room, { type: "reverse" });
    addLog(room, buildActionLog(player, card, room.playDirection === -1 ? "เปลี่ยนทิศทางเป็นวนขวา" : "เปลี่ยนทิศทางเป็นวนซ้าย"));
    room.notice = room.playDirection === -1 ? "เกมเปลี่ยนเป็นวนขวา" : "เกมเปลี่ยนเป็นวนซ้าย";
    return { pending: false, announceText: room.notice };
  }

  if (PINKBERRY_SCOPE_SET.includes(card.id)) {
    const previewCount = 10;
    const previewCards = room.deck.slice(0, previewCount);
    const pinkberryCards = previewCards.filter((candidate) => repairText(candidate.name).includes("พิงค์เบอร์รี่"));
    if (!pinkberryCards.length) {
      room.deck = shuffle(room.deck);
      room.notice = `${previewCount} ข้อความ13`;
      addLog(room, buildActionLog(player, card, `ข้อความ14 ${previewCount} ใบà¸šà¸™à¸ªà¸¸à¸”`));
      return { pending: false, announceText: "ไม่มีการ์ดพิงค์เบอร์รี่ใน 10 ใบ" };
    }
    return {
      pending: beginCardSelectionAction(room, player, {
        cardId: card.id,
        cardName: card.name,
        effect: "take_from_deck_preview",
        title: "ข้อความ16",
        description: `ข้อความ17” ${previewCount} ใบข้อความ18`,
        minSelections: 1,
        maxSelections: 1,
        selectionSource: "deck_preview",
        availableCardsData: pinkberryCards,
        previewCount,
        emptyNotice: "ข้อความ19",
      }),
      announceText: `${card.name} ข้อความ20`,
    };
  }

  switch (card.id) {
    case "card_03":
      player.usedCard03Count += 1;
      addLog(room, buildActionLog(player, card));
      room.notice = `${player.name} ใช้ ${card.name}`;
      return { pending: false, announceText: `${player.name} ใช้ ${card.name}` };
    case "card_09":
      getActivePlayers(room).forEach((target) => {
        drawCards(room, target, 2, { animate: true });
      });
      addLog(room, buildActionLog(player, card, "ผู้เล่นทุกคนจั่วการ์ดคนละ 2 ใบ"));
      room.notice = "ทุกคนจั่วการ์ดคนละ 2 ใบ";
      return { pending: false, announceText: `${player.name} ใช้ ${card.name}` };
    case "card_10":
      return {
        pending: beginCardSelectionAction(room, player, {
          cardId: card.id,
          cardName: card.name,
          effect: "return_to_deck",
          title: "เลือกการ์ดกลับเข้าเดค",
          description: "เลือกการ์ดจากมือของคุณเพื่อส่งกลับเข้าเดค",
          minSelections: 2,
          maxSelections: 2,
          emptyNotice: `${player.name} ไม่มีการ์ดให้ส่งกลับเข้าเดค`,
        }),
      };
    case "card_11":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "give_two_cards",
          title: "เลือกผู้เล่นที่จะรับการ์ด",
          description: "เลือกผู้เล่น 1 คน แล้วส่งการ์ดของคุณ 2 ใบให้คนนั้น",
        }),
      };
    case "card_12":
      player.valeskaStartCount = player.usedCardsTotal;
      addLog(room, buildActionLog(player, card, "เริ่มนับการ์ดที่ตัวเองใช้จากตอนนี้"));
      room.notice = `${player.name} เปิดเงื่อนไขวาเลสก้าผู้มั่งคั่งแล้ว`;
      return { pending: false, announceText: `${player.name} ใช้ ${card.name}` };
    case "card_13":
      addLog(room, buildActionLog(player, card, "แย่งเทิร์นมาเป็นของตัวเอง"));
      room.notice = `${player.name} แย่งเทิร์นสำเร็จ`;
      return { pending: false, takeoverTurn: true, keepTurnOpen: true };
    case "card_14":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "request_one_card",
          title: "เลือกผู้เล่นที่จะมอบการ์ด",
          description: "เลือกผู้เล่น 1 คน แล้วให้คนนั้นเลือกมอบการ์ด 1 ใบ",
        }),
      };
    case "card_15":
      addLog(room, buildActionLog(player, card, "การ์ดใบนี้ไม่มีเอฟเฟกต์ตอนใช้"));
      room.notice = `${player.name} ใช้ ${card.name}`;
      return { pending: false };
    case "card_16": {
      const result = takeCardFromSources(room, "card_15", ["hand", "graveyard", "deck"]);
      if (!result) {
        room.notice = "ไม่มีโจเซฟีนกำลังหัวเราะให้กำจัด";
        addLog(room, buildActionLog(player, card, "ไม่พบโจเซฟีนกำลังหัวเราะให้กำจัด"));
        return { pending: false };
      }

      room.banished.unshift(result.card);
      const sourceLabel = result.source === "graveyard" ? "สุสาน" : result.source === "deck" ? "เดค" : `มือของ ${result.player.name}`;
      addLog(room, buildActionLog(player, card, `กำจัดโจเซฟีนกำลังหัวเราะออกจาก${sourceLabel}`));
      room.notice = `${player.name} กำจัดโจเซฟีนกำลังหัวเราะออกจากเกม`;
      return { pending: false };
    }
    case "card_17": {
      const result = takeCardFromSources(room, "card_15", ["deck", "graveyard", "banished"]);
      if (!result) {
        room.notice = "ไม่พบโจเซฟีนกำลังหัวเราะให้เรียกกลับ";
        addLog(room, buildActionLog(player, card, "ไม่พบโจเซฟีนกำลังหัวเราะให้เรียกกลับ"));
        return { pending: false };
      }

      receiveCards(room, player, [result.card], { animate: true, source: result.source });
      const sourceLabel = result.source === "graveyard"
        ? "สุสาน"
        : result.source === "banished"
          ? "นอกเกม"
          : "เดค";
      addLog(room, buildActionLog(player, card, `เรียกโจเซฟีนกำลังหัวเราะกลับจาก${sourceLabel}`));
      room.notice = `${player.name} เรียกโจเซฟีนกำลังหัวเราะขึ้นมือ­`;
      return { pending: false };
    }
    case "card_18":
      addLog(room, buildActionLog(player, card, "การ์ดใบนี้ไม่มีเอฟเฟกต์ตอนใช้"));
      room.notice = `${player.name} ใช้ ${card.name}`;
      return { pending: false };
    case "card_19":
      equalDealRemainingDeck(room);
      addLog(room, buildActionLog(player, card, "เฉลี่ยการ์ดจากเดคให้ทุกคนจนเดคหมด"));
      room.notice = "เดคถูกเฉลี่ยแจกให้ทุกคนจนหมด";
      return { pending: false };
    case "card_20": {
      redealSameCounts(room, { actor: player });
      addLog(room, buildActionLog(player, card, "นำการ์ดทุกคนกลับเข้าเดคแล้วแจกใหม่เท่าเดิม"));
      room.notice = "การ์ดทุกคนถูกนำกลับเข้าเดคและแจกใหม่";
      return {
        pending: false,
        ignoreEmptyHandForIds: getActivePlayers(room).map((target) => target.id),
      };
    }
    case "card_21": {
      getActivePlayers(room).forEach((target) => {
        const randomCard = removeRandomUsableCardFromHand(target);
        if (randomCard) {
          scheduleForcedPlay(room, target.id, randomCard, "ถูกสุ่มให้ใช้");
        }
      });
      addLog(room, buildActionLog(player, card, "สุ่มให้ผู้เล่นทุกคนใช้การ์ดคนละ 1 ใบ"));
      room.notice = "ผู้เล่นทุกคนกำลังถูกสุ่มให้ใช้การ์ด";
      return processQueuedForcedPlays(room);
    }
    case "card_22": {
      const drawn = drawCards(room, player, 1, { animate: true });
      addLog(room, buildActionLog(player, card, `จั่วการ์ด ${drawn} ใบ แล้วกำลังเลือกผู้เล่นให้ใช้การ์ด`));
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "force_other_play_one",
          title: "เลือกผู้เล่นที่จะต้องใช้การ์ด",
          description: "เลือกผู้เล่น 1 คน แล้วให้คนนั้นเลือกใช้การ์ด 1 ใบ",
        }),
      };
    }
    case "card_23":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "link_win",
          title: "เลือกผู้เล่นที่จะชนะตาม",
          description: "เลือกผู้เล่น 1 คน ถ้าคนนั้นชนะ คุณจะชนะตาม",
        }),
      };
    case "card_24": {
      getActivePlayers(room).forEach((target) => {
        drawCards(room, target, 1, { animate: true });
      });
      addLog(room, buildActionLog(player, card, "ทุกคนจั่วการ์ด 1 ใบ แล้วคุณจะสุ่มใช้การ์ด 1 ใบ"));
      const randomCard = removeRandomUsableCardFromHand(player);
      if (!randomCard) {
        room.notice = `${player.name} ไม่มีการ์ดให้สุ่มใช้`;
        return { pending: false };
      }

      addLog(room, `${player.name} ถูกสุ่มให้ใช้ ${randomCard.name}`);
      return triggerCardPlay(room, player, randomCard);
    }
    case "card_25":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "borrow_random_effect",
          title: "เลือกผู้เล่นที่จะสุ่มการ์ด",
          description: "เลือกผู้เล่น 1 คน แล้วสุ่มใช้เอฟเฟกต์การ์ด 1 ใบของคนนั้น",
        }),
      };
    case "card_26":
      return {
        pending: beginCardSelectionAction(room, player, {
          cardId: card.id,
          cardName: card.name,
          effect: "discard_selected",
          title: "เลือกการ์ดจากเดคลงสุสาน",
          description: "เลือกการ์ดจากเดค 2 ใบเพื่อลงสุสาน",
          minSelections: 2,
          maxSelections: 2,
          selectionSource: "deck",
          availableCardsData: room.deck,
          emptyNotice: `${player.name} ไม่มีการ์ดในเดคให้เลือก`,
        }),
      };
    case "card_27": {
      const drawn = drawCards(room, player, 2, { animate: true });
      addLog(room, buildActionLog(player, card, `จั่วการ์ด ${drawn} ใบ`));
      room.notice = `${player.name} จั่วการ์ด ${drawn} ใบ`;
      return { pending: false };
    }
    case "card_28":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "link_win_or_lose",
          title: "เลือกผู้เล่นที่จะตามผลแพ้ชนะ",
          description: "เลือกผู้เล่น 1 คน ถ้าคนนั้นชนะหรือแพ้ คุณจะตามผลนั้น",
        }),
      };
    case "card_29":
      return {
        pending: beginCardSelectionAction(room, player, {
          cardId: card.id,
          cardName: card.name,
          effect: "discard_one_and_random_draw",
          title: "เลือกการ์ดลงสุสาน",
          description: "เลือกการ์ดจากมือของคุณ 1 ใบ แล้วจะมีผู้เล่นหนึ่งคนจั่วการ์ด 1 ใบแบบสุ่ม",
          minSelections: 1,
          maxSelections: 1,
          emptyNotice: `${player.name} ไม่มีการ์ดให้ลงสุสาน`,
        }),
      };
    case "card_30":
      return {
        pending: beginCardSelectionAction(room, player, {
          cardId: card.id,
          cardName: card.name,
          effect: "play_selected_then_draw_three",
          title: "เลือกการ์ดเพื่อใช้งาน",
          description: "เลือกการ์ดจากมือของคุณ 1 ใบเพื่อใช้งาน แล้วจั่วการ์ด 3 ใบ",
          minSelections: 1,
          maxSelections: 1,
          availableFilter: isCardUsable,
          emptyNotice: `${player.name} ไม่มีการ์ดให้เลือกใช้งาน`,
        }),
      };
    case "card_31": {
      getActivePlayers(room).forEach((target) => {
        drawCards(room, target, 2, { animate: true });
      });
      addLog(room, buildActionLog(player, card, "ทุกคนจั่วการ์ด 2 ใบ แล้วต้องเลือกทิ้ง 1 ใบ"));
      const discardQueue = getActivePlayers(room)
        .filter((target) => getDiscardSelectableCards(target, player.id).length > 0)
        .map((target) => target.id);

      if (!discardQueue.length) {
        room.notice = "ไม่มีการ์ดให้เลือกทิ้ง";
        return { pending: false };
      }

      const firstPlayerId = discardQueue.shift();
      const firstPlayer = room.players.find((target) => target.id === firstPlayerId);
      const availableCardIds = getDiscardSelectableCards(firstPlayer, player.id).map((selectedCard) => selectedCard.id);
      room.pendingAction = {
        mode: "select_cards",
        actorId: firstPlayerId,
        sourcePlayerId: player.id,
        cardId: card.id,
        cardName: card.name,
        effect: "sequential_discard_many",
        title: "เลือกการ์ดลงสุสาน",
        description: `${firstPlayer.name} ต้องเลือกการ์ด 2 ใบเพื่อลงสุสาน`,
        minSelections: Math.min(2, availableCardIds.length),
        maxSelections: Math.min(2, availableCardIds.length),
        availableCardIds,
        queue: discardQueue,
      };
      room.notice = `${firstPlayer.name} กำลังเลือกทิ้งการ์ด`;
      return { pending: true };
    }
    case "card_32": {
      const target = getNextPlayerAfter(room, player.id);
      if (!target || target.id === player.id) {
        room.notice = "ไม่มีผู้เล่นคนถัดไปให้จั่วการ์ดจากสุสาน";
        return { pending: false };
      }

      const reflected = tryReflectTargetedEffect(room, player, target, "draw_graveyard", {
        count: 2,
        excludeCards: [card],
      });
      if (reflected.blocked) {
        addLog(room, buildActionLog(player, card, `${target.name} ข้อความ21`));
        room.notice = `${target.name} ข้อความ22`;
        return { pending: false, announceText: `${target.name} ข้อความ22` };
      }
      if (reflected.reflected) {
        addLog(room, buildActionLog(player, card, `ข้อความ23 ${player.name}`));
        return reflected;
      }

      const drawn = drawFromGraveyard(room, target, 2, { animate: true, excludeCards: [card] });
      addLog(room, buildActionLog(player, card, `${target.name} (คนถัดไป) จั่วการ์ด ${drawn} ใบจากสุสาน`));
      room.notice = `${target.name} จั่วการ์ด ${drawn} ใบจากสุสาน`;
      return { pending: false };
    }
    case "card_33":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "guess_josephine_holder",
          title: "เลือกผู้เล่นที่คุณจะทาย",
          description: "ทายว่าโจเซฟีนกำลังหัวเราะอยู่ในมือของใคร",
          includeSelf: false,
        }),
      };
    case "card_34":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "swap_hand",
          title: "เลือกผู้เล่นเพื่อสลับการ์ดทั้งมือ­",
          description: "เลือกผู้เล่น 1 คนเพื่อสลับการ์ดทั้งหมดในมือกับคุณ",
        }),
      };
    case "card_35": {
      if (!rotateOtherHands(room, player)) {
        room.notice = "มีผู้เล่นคนอื่นไม่พอสำหรับสลับมือ­";
        addLog(room, buildActionLog(player, card, "มีผู้เล่นไม่พอสำหรับสลับมือ"));
        return { pending: false };
      }

      addLog(room, buildActionLog(player, card, "สลับมือของทุกคนยกเว้นตัวเอง"));
      room.notice = "เกิดการสลับมือทั้งโต๊ะ";
      return { pending: false };
    }
    case "card_36":
      getActivePlayers(room).forEach((target) => {
        drawFromGraveyard(room, target, 2, { animate: true, excludeCards: [card] });
      });
      addLog(room, buildActionLog(player, card, "ผู้เล่นทุกคนจั่วการ์ดจากสุสานคนละ 2 ใบ"));
      room.notice = "ทุกคนจั่วการ์ดจากสุสาน";
      return { pending: false };
    case "card_70":
    case "card_71":
      getActivePlayers(room).forEach((target) => {
        drawCards(room, target, 3, { animate: true });
      });
      addLog(room, buildActionLog(player, card, "ผู้เล่นทุกคนจั่วการ์ด 3 ใบ"));
      room.notice = "ผู้เล่นทุกคนจั่วการ์ด 3 ใบ";
      return { pending: false, announceText: "ผู้เล่นทุกคนจั่วการ์ด 3 ใบ" };
    case "card_37":
      return {
        pending: beginTargetAction(room, player, card, {
          effect: "inspect_hand",
          title: "เลือกผู้เล่นที่ต้องการดูการ์ด",
          description: "เลือกผู้เล่น 1 คน แล้วคุณจะเห็นการ์ดทั้งหมดบนมือของคนนั้น",
        }),
      };
    case "card_43":
      player.josephineShield = true;
      player.josephineShieldPendingWin = true;
      addLog(room, buildActionLog(player, card, "เอฟเฟกต์โจเซฟีนกำลังหัวเราะจะไม่หักคะแนนของตัวเอง"));
      room.notice = `${player.name} เปิดเอฟเฟกต์โจผู้นี้มีความฝันแล้ว`;
      return { pending: false };
    case "card_81":
    case "card_82":
    case "card_83":
    case "card_84":
    case "card_85":
      addLog(room, buildActionLog(player, card, "ข้อความ24"));
      room.notice = `${player.name} \u0e43\u0e0a\u0e49 ${card.name} \u0e41\u0e15\u0e48\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2d\u0e30\u0e44\u0e23\u0e43\u0e2b\u0e49\u0e2a\u0e30\u0e17\u0e49\u0e2d\u0e19`;
      return { pending: false, announceText: `${card.name} \u0e44\u0e23\u0e49\u0e1c\u0e25\u0e43\u0e19\u0e15\u0e2d\u0e19\u0e19\u0e35\u0e49` };
    case "card_49":
      addLog(room, buildActionLog(player, card, "ข้อความ25"));
      room.notice = `${player.name} ใช้ ${card.name}`;
      return { pending: false };
    case "card_50": {
      const result = takeCardFromSources(room, "card_49", ["hand", "graveyard", "deck", "banished"]);
      if (!result) {
        room.notice = "ไม่พบยอดนักสืบโนคันให้กำจัด";
        addLog(room, buildActionLog(player, card, "ไม่พบยอดนักสืบโนคันให้กำจัด"));
        return { pending: false };
      }

      room.banished.unshift(result.card);
      addLog(room, buildActionLog(player, card, "กำจัดยอดนักสืบโนคันออกจากเกม"));
      room.notice = `${player.name} กำจัดยอดนักสืบโนคันออกจากเกม`;
      return { pending: false };
    }
    case "card_63": {
      room.laughingDisabled = true;
      cancelTimedThreat(room, "josephine", "โจเซฟีนกำลังหัวเราะถูกหยุดไว้จนจบเกม");
      cancelTimedThreat(room, "pinkLaugh", "พี่พิงค์หัวเราะถูกหยุดไว้จนจบเกม");
      const banished = removeFirstCardById(room.graveyard, card.id);
      if (banished) room.banished.unshift(banished);
      addLog(room, buildActionLog(player, card, "การ์ดหัวเราะทั้งหมดไร้ผลจนจบเกม"));
      room.notice = "เสียงหัวเราะถูกหยุดไว้จนจบเกม";
      return { pending: false, announceText: "เสียงหัวเราะเงียบลงทั้งเกม" };
    }
    case "card_64": {
      const moved = [...room.graveyard];
      room.graveyard = [];
      returnCardsToDeck(room, moved, { actor: player });
      addLog(room, buildActionLog(player, card, `นำการ์ดในสุสาน ${moved.length} ใบกลับเข้าเดค`));
      room.notice = "การ์ดในสุสานทั้งหมดกลับเข้าเดคแล้ว";
      return { pending: false, announceText: `สุสานกลับเข้าเดค ${moved.length} ใบ` };
    }
    case "card_65": {
      const result = takeCardFromSources(room, "card_02", ["hand", "graveyard", "deck", "banished"]);
      if (!result) {
        room.notice = "ไม่พบเบธานีเทพหลับให้เรียกขึ้นมือ­";
        return { pending: false, announceText: "ไม่พบเบธานีเทพหลับ" };
      }
      receiveCards(room, player, [result.card], { animate: true, source: result.source });
      addLog(room, buildActionLog(player, card, "เรียกเบธานีเทพหลับขึ้นมือ­"));
      room.notice = `${player.name} เรียกเบธานีเทพหลับขึ้นมือ­`;
      return {
        pending: false,
        announceText: "เบธานีเทพหลับกลับขึ้นมือ­",
        targetTags: [{ playerId: player.id, text: "🃏+1", tone: "effect-draw effect-draw-green" }],
      };
    }
    case "card_95": {
      const activePlayers = getActivePlayers(room);
      const collected = [];
      activePlayers.forEach((target) => {
        collected.push(...target.hand);
        target.hand = [];
        target.saidLastCard = false;
      });
      collected.push(...room.graveyard);
      room.graveyard = [];
      queueEffect(room, { type: "hand_reset", playerIds: activePlayers.map((target) => target.id) });
      returnCardsToDeck(room, collected, { actor: player });
      dealCardsSequentially(room, activePlayers, activePlayers.map(() => 5), {
        animate: true,
        source: "deck",
        startDelayMs: 180,
        perCardDelayMs: 210,
        soundSpacingMs: 190,
      });
      collectIgnoredIds(room, activePlayers.map((target) => target.id));
      addLog(room, buildActionLog(player, card, "รีเซ็ตทั้งโต๊ะและแจกใหม่คนละ 5 ใบ"));
      room.notice = "ทุกคนได้รับการ์ดใหม่คนละ 5 ใบ";
      return {
        pending: false,
        ignoreEmptyHandForIds: activePlayers.map((target) => target.id),
        announceText: "รี รี รี แจกใหม่ทั้งโต๊ะ",
      };
    }
    case "card_96": {
      const poolCards = [];
      const poolPlayerIds = [];
      getActivePlayers(room).forEach((target) => {
        const picked = removeRandomCardFromHand(target);
        if (picked) {
          poolCards.push(picked);
          poolPlayerIds.push(target.id);
        }
      });
      if (!poolCards.length) {
        room.notice = "ไม่มีการ์ดในมือให้ส่งเข้าตลาดมืด";
        return { pending: false, announceText: "ตลาดมืดไม่มีของ" };
      }
      return {
        pending: beginCardSelectionAction(room, player, {
          cardId: card.id,
          cardName: card.name,
          effect: "market_pick",
          title: "เลือกการ์ดจากตลาดมืด",
          description: "หยิบการ์ด 1 ใบจากกองกลางก่อนใคร",
          minSelections: 1,
          maxSelections: 1,
          selectionSource: "custom_pool",
          availableCardsData: poolCards,
          poolPlayerIds,
          emptyNotice: "กองตลาดมืดว่าง",
        }),
        announceText: "ตลาดมืดเปิดแล้ว",
      };
    }
    case "card_97":
      return applyRandomPlayAndDiscardAll(room, player, card);
    case "card_98": {
      const toppedUp = [];
      getActivePlayers(room).forEach((target) => {
        if (target.hand.length < 2) {
          const need = Math.max(0, 5 - target.hand.length);
          const drawn = drawCards(room, target, need, { animate: true });
          if (drawn > 0) toppedUp.push(`${target.name} +${drawn}`);
        }
      });
      room.notice = toppedUp.length ? toppedUp.join(", ") : "ไม่มีใครต้องจั่วเพิ่มจากภาษีคนรวย";
      addLog(room, buildActionLog(player, card, toppedUp.length ? toppedUp.join(" / ") : "ไม่มีใครต้องจั่วเพิ่ม"));
      return { pending: false, announceText: toppedUp.length ? "ภาษีคนรวยทำงาน" : "ม่มีใครโดนภาษีคนรวย" };
    }
    case "card_105": {
      const previewCards = room.deck.slice(0, 5);
      const pinkberryCards = previewCards.filter((candidate) => repairText(candidate.name).includes("พิงค์เบอร์รี่"));
      if (!pinkberryCards.length) {
        room.deck = shuffle(room.deck);
        room.notice = "5 ใบบนสุดไม่มีการ์ดพิงค์เบอร์รี่";
        addLog(room, buildActionLog(player, card, "ไม่พบการ์ดพิงค์เบอร์รี่ใน 5 ใบบนสุด"));
        return { pending: false, announceText: "ไม่พบการ์ดพิงค์เบอร์รี่" };
      }
      return {
        pending: beginCardSelectionAction(room, player, {
          cardId: card.id,
          cardName: card.name,
          effect: "take_from_deck_preview",
          title: "เลือกการ์ดพิงค์เบอร์รี่จาก 5 ใบบนสุด",
          description: "หยิบการ์ดพิงค์เบอร์รี่ขึ้นมือได้ 1 ใบ ที่เหลือจะสับคืนเดค",
          minSelections: 1,
          maxSelections: 1,
          selectionSource: "deck_preview",
          availableCardsData: pinkberryCards,
          emptyNotice: "ไม่มีการ์ดพิงค์เบอร์รี่ให้เลือก",
        }),
        announceText: "แว่นขยายเปิดดู 5 ใบบนสุด",
      };
    }
    case "card_106": {
      const returned = removeFirstCardById(room.graveyard, card.id) || card;
      returnCardsToDeck(room, [returned]);
      registerBethanyReturn(room, player, 1);
      addLog(room, buildActionLog(player, card, "ส่งตัวเองกลับเดคและเพิ่มแต้มให้เบธานีเทพหลับ"));
      room.notice = `${player.name} เพิ่มแต้มให้เบธานีเทพหลับ 1 แต้ม`;
      return { pending: false, announceText: "แต้มเบธานีเทพหลับ +1" };
    }
    case "card_107": {
      const dumped = [...player.hand];
      player.hand = [];
      refreshLastCardFlag(player);
      addCardsToGraveyard(room, dumped, { animate: true });
      const drawn = drawCards(room, player, 1, { animate: true });
      collectIgnoredIds(room, [player.id]);
      addLog(room, buildActionLog(player, card, `ทิ้งทั้งมือ­ ${dumped.length} ใบ แล้วจั่วใหม่ ${drawn} ใบ`));
      room.notice = `${player.name} ทิ้งทั้งมือแล้วจั่วใหม่ 1 ใบ`;
      return {
        pending: false,
        ignoreEmptyHandForIds: [player.id],
        announceText: "ชั้นนี่แหล่ะคือเบลลานีย์",
      };
    }
    case "card_61":
    case "card_62":
    case "card_108": {
      const returnedCards = [];
      const handCards = player.hand.filter((candidate) => isBethanyCard(candidate));
      player.hand = player.hand.filter((candidate) => !isBethanyCard(candidate));
      refreshLastCardFlag(player);
      returnedCards.push(...handCards);
      for (let index = room.graveyard.length - 1; index >= 0; index -= 1) {
        if (isBethanyCard(room.graveyard[index])) {
          returnedCards.push(room.graveyard.splice(index, 1)[0]);
        }
      }
      if (returnedCards.length) {
        returnCardsToDeck(room, returnedCards, { actor: player });
      }
      addLog(room, buildActionLog(player, card, `นำการ์ดสายเบธานีกลับเดค ${returnedCards.length} ใบ`));
      room.notice = "การ์ดสายเบธานีกลับเข้าเดคแล้ว";
      return { pending: false, announceText: `เบธานีกลับเดค ${returnedCards.length} ใบ` };
    }
    default:
      addLog(room, buildActionLog(player, card));
      room.notice = `${player.name} ใช้ ${card.name}`;
      return { pending: false };
  }
}

function resolvePlayerTargetAction(room, actor, target) {
  const action = room.pendingAction;
  if (!action) return;

  switch (action.effect) {
    case "link_win":
      actor.linkWinTo = target.id;
      addLog(room, buildActionLog(actor, action.cardName, `ถ้า ${target.name} ชนะ คุณจะชนะตาม`));
      room.notice = `${actor.name} จะชนะตาม ${target.name}`;
      clearPendingAction(room);
      return;
    case "link_win_or_lose":
      actor.linkWinLoseTo = target.id;
      addLog(room, buildActionLog(actor, action.cardName, `จะตามผลแพ้ชนะของ‡ ${target.name}`));
      room.notice = `${actor.name} จะตามผลของ ${target.name}`;
      clearPendingAction(room);
      return;
    case "swap_hand": {
      if (isSleepProtected(target)) {
        room.notice = `${target.name} อยู่ในสถานะหลับอยู่ จึงไม่สามารถถูกสลับการ์ดได้`;
        clearPendingAction(room);
        return;
      }
      const actorHand = actor.hand;
      actor.hand = target.hand;
      target.hand = actorHand;
      refreshLastCardFlag(actor);
      refreshLastCardFlag(target);
      queueEffect(room, { type: "swap", label: `${actor.name} ↔ ${target.name}` });
      addLog(room, buildActionLog(actor, action.cardName, `สลับการ์ดทั้งมือกับ ${target.name}`));
      room.notice = `${actor.name} สลับมือกับ ${target.name} แล้ว`;
      clearPendingAction(room);
      return;
    }
    case "inspect_hand":
      actor.inspectedHand = {
        targetName: target.name,
        cards: [...target.hand],
      };
      addLog(room, buildActionLog(actor, action.cardName, `เปิดดูการ์ดบนมือของ ${target.name}`));
      room.notice = `${actor.name} เปิดดูการ์ดบนมือของ ${target.name}`;
      clearPendingAction(room);
      return;
    case "give_two_cards":
      if (!beginCardSelectionAction(room, actor, {
        cardId: action.cardId,
        cardName: action.cardName,
        effect: "give_selected_to_target",
        title: `เลือกการ์ดเพื่อส่งให้ ${target.name}`,
        description: `เลือกการ์ดจากมือของคุณเพื่อส่งให้ ${target.name}`,
        minSelections: 2,
        maxSelections: 2,
        targetPlayerId: target.id,
        emptyNotice: `${actor.name} ไม่มีการ์ดให้ส่ง`,
      })) {
        clearPendingAction(room);
      }
      return;
    case "request_one_card":
      if (!beginCardSelectionAction(room, target, {
        cardId: action.cardId,
        cardName: action.cardName,
        effect: "give_one_to_requester",
        title: `เลือกการ์ด 1 ใบส่งให้ ${actor.name}`,
        description: `${actor.name} ใช้การ์ด ${action.cardName} ให้คุณเลือกมอบการ์ด 1 ใบ`,
        minSelections: 1,
        maxSelections: 1,
        requesterId: actor.id,
        emptyNotice: `${target.name} ไม่มีการ์ดให้มอ`,
      })) {
        clearPendingAction(room);
      }
      return;
    case "force_other_play_one":
      if (!beginCardSelectionAction(room, target, {
        cardId: action.cardId,
        cardName: action.cardName,
        effect: "forced_play_one_card",
        title: "เลือกการ์ด 1 ใบเพื่อใช้งาน",
        description: `${actor.name} ใช้การ์ด ${action.cardName} ให้คุณเลือกการ์ด 1 ใบเพื่อใช้งาน`,
        minSelections: 1,
        maxSelections: 1,
        availableFilter: isCardUsable,
        emptyNotice: `${target.name} ไม่มีการ์ดให้ใช้งาน`,
      })) {
        clearPendingAction(room);
      }
      return;
    case "borrow_random_effect": {
      clearPendingAction(room);
      const randomCard = removeRandomUsableCardFromHand(target);
      if (!randomCard) {
        room.notice = `${target.name} ไม่มีการ์ดให้สุ่ม`;
        addLog(room, buildActionLog(actor, action.cardName, `${target.name} ไม่มีการ์ดให้สุ่ม`));
        return;
      }

      addLog(room, buildActionLog(actor, action.cardName, `สุ่มใช้เอฟเฟกต์ ${randomCard.name} จากมือของ ${target.name}`));
      const result = triggerCardPlay(room, actor, randomCard);
      collectIgnoredIds(room, result.ignoreEmptyHandForIds || []);
      return;
    }
    case "guess_josephine_holder":
      clearPendingAction(room);
      if (playerHasCard(target, "card_15")) {
        settleRound(room, {
          winnerIds: [actor.id],
          reason: `${actor.name} ทายถูกว่าโจเซฟีนกำลังหัวเราะอยู่กับ ${target.name}`,
        });
      } else {
        addLog(room, buildActionLog(actor, action.cardName, `ทายผิดว่า ${target.name} ถือโจเซฟีนกำลังหัวเราะ`));
        room.notice = `${actor.name} ทายผิด`;
      }
      return;
    default:
      clearPendingAction(room);
  }
}

function continueSequentialDiscard(room, action) {
  while (action.queue && action.queue.length) {
    const nextPlayerId = action.queue.shift();
    const nextPlayer = room.players.find((player) => player.id === nextPlayerId);
    const availableCards = getDiscardSelectableCards(nextPlayer, action.sourcePlayerId);
    if (!nextPlayer || !availableCards.length) {
      continue;
    }

    room.pendingAction = {
      ...action,
      actorId: nextPlayerId,
      availableCardIds: availableCards.map((card) => card.id),
      description: `${nextPlayer.name} ต้องเลือกการ์ด 2 ใบเพื่อลงสุสาน`,
      queue: [...action.queue],
    };
    room.notice = `${nextPlayer.name} กำลังเลือกทิ้งการ์ด`;
    return true;
  }

  room.notice = "ทุกคนเลือกทิ้งการ์ดเรียบร้อยแล้ว";
  return false;
}

function resolveCardSelectionAction(room, actor, selectedCardIds) {
  const action = room.pendingAction;
  if (!action) return;

  const cards = takeCardsFromSelectionSource(room, actor, action, selectedCardIds);
  clearPendingAction(room);

  switch (action.effect) {
    case "return_to_deck":
      returnCardsToDeck(room, cards, { actor });
      addLog(room, buildActionLog(actor, action.cardName, `ส่งการ์ด ${cards.length} ใบกลับเข้าเดค`));
      room.notice = `${actor.name} ส่งการ์ดกลับเข้าเดคแล้ว`;
      return;
    case "discard_selected":
      addCardsToGraveyard(room, cards, { animate: true });
      addLog(room, buildActionLog(actor, action.cardName, `ส่งการ์ด ${cards.length} ใบลงสุสาน`));
      room.notice = `${actor.name} ส่งการ์ดลงสุสานแล้ว`;
      return;
    case "give_selected_to_target": {
      const target = room.players.find((player) => player.id === action.targetPlayerId);
      if (!target) {
        room.notice = "ไม่พบผู้เล่นเป้าหมาย";
        return;
      }

      receiveCards(room, target, cards, { animate: true, source: "gift" });
      addLog(room, buildActionLog(actor, action.cardName, `ใส่งการ์ด ${cards.length} ใบให้ ${target.name}`));
      room.notice = `${actor.name} ส่งการ์ดให้ ${target.name} แล้ว`;
      return;
    }
    case "give_one_to_requester": {
      const requester = room.players.find((player) => player.id === action.requesterId);
      if (!requester) {
        room.notice = "ไม่พบผู้เล่นที่ขอการ์ด";
        return;
      }

      receiveCards(room, requester, cards, { animate: true, source: "gift" });
      addLog(room, `${actor.name} มอบการ์ด 1 ใบให้ ${requester.name}`);
      room.notice = `${actor.name} มอบการ์ดให้ ${requester.name} แล้ว`;
      return;
    }
    case "discard_one_and_random_draw": {
      addCardsToGraveyard(room, cards, { animate: true });
      const candidates = getActivePlayers(room);
      if (!candidates.length) {
        room.notice = `${actor.name} ส่งการ์ดลงสุสานแล้ว`;
        return;
      }

      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const drawn = drawCards(room, target, 1, { animate: true });
      addLog(room, buildActionLog(actor, action.cardName, `${target.name} จั่วการ์ด ${drawn} ใบแบบสุ่ม`));
      room.notice = `${target.name} ถูกสุ่มจั่วการ์ด ${drawn} ใบ`;
      return;
    }
    case "sequential_discard_one":
      addCardsToGraveyard(room, cards, { animate: true });
      addLog(room, `${actor.name} เลือกทิ้งการ์ด 1 ใบ`);
      continueSequentialDiscard(room, action);
      return;
    case "sequential_discard_many":
      addCardsToGraveyard(room, cards, { animate: true });
      addLog(room, `${actor.name} เลือกทิ้งการ์ด ${cards.length} ใบ`);
      continueSequentialDiscard(room, action);
      return;
    case "take_from_deck":
    case "take_from_graveyard":
      receiveCards(room, actor, cards, { animate: true, source: action.selectionSource || "deck" });
      addLog(room, buildActionLog(actor, action.cardName, `หยิบการ์ด ${cards.length} ใบขึ้นมือ­`));
      room.notice = `${actor.name} หยิบการ์ดขึ้นมือแล้ว`;
      return;
    case "steal_assembly_part": {
      const pickedCard = cards[0];
      if (!pickedCard) {
        room.notice = "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e01\u0e32\u0e23\u0e4c\u0e14\u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01";
        return;
      }
      receiveCards(room, actor, [{ id: pickedCard.id, name: pickedCard.name, desc: pickedCard.desc }], { animate: true, source: "gift" });
      addLog(room, buildActionLog(actor, action.cardName, `\u0e41\u0e22\u0e48\u0e07 ${pickedCard.name} \u0e21\u0e32\u0e08\u0e32\u0e01 ${pickedCard.ownerName}`));
      room.notice = `${actor.name} \u0e41\u0e22\u0e48\u0e07 ${pickedCard.name} \u0e21\u0e32\u0e44\u0e14\u0e49\u0e41\u0e25\u0e49\u0e27`;
      return;
    }
    case "take_from_deck_preview":
    case "take_pinkberry_from_preview": {
      const previewCards = room.deck.splice(0, Math.min(action.previewCount || 5, room.deck.length));
      const selectedIds = new Set(cards.map((card) => card.id));
      const pickedCards = previewCards.filter((candidate) => selectedIds.has(candidate.id));
      const remainingCards = previewCards.filter((candidate) => !selectedIds.has(candidate.id));
      receiveCards(room, actor, pickedCards, { animate: true, source: "deck" });
      room.deck.push(...remainingCards);
      room.deck = shuffle(room.deck);
      addLog(room, buildActionLog(actor, action.cardName, `หยิบการ์ดพิงค์เบอร์รี่ ${pickedCards.length} ใบขึ้นมือ­`));
      room.notice = `${actor.name} หยิบการ์ดพิงค์เบอร์รี่ขึ้นมือแล้ว`;
      return;
    }
    case "market_pick": {
      receiveCards(room, actor, cards, { animate: true, source: "gift" });
      const remainingPool = action.remainingPoolCards || [];
      const recipients = getActivePlayers(room).filter((player) => player.id !== actor.id && (action.poolPlayerIds || []).includes(player.id));
      const shuffledPool = shuffle(remainingPool);
      recipients.forEach((recipient, index) => {
        if (index < shuffledPool.length) {
          receiveCards(room, recipient, [shuffledPool[index]], { animate: true, source: "gift" });
        }
      });
      addLog(room, buildActionLog(actor, action.cardName, "เลือกการ์ดจากตลาดมืดก่อน แล้วแจกที่เหลือคืนคนอื่น"));
      room.notice = `${actor.name} จัดสรรการ์ดจากตลาดมืดแล้ว`;
      return;
    }
    case "play_selected_then_draw_three": {
      const selectedCard = cards[0];
      if (!selectedCard) {
        room.notice = "ไม่พบการ์ดที่เลือก";
        return;
      }

      addLog(room, buildActionLog(actor, action.cardName, `เลือกใช้ ${selectedCard.name} แล้วจะจั่ว 3 ใบ`));
      const effectResult = triggerCardPlay(room, actor, selectedCard);
      collectIgnoredIds(room, effectResult.ignoreEmptyHandForIds || []);
      if (!room.roundEnded) {
        const drawn = drawCards(room, actor, 3, { animate: true });
        addLog(room, `${actor.name} จั่วการ์ดเพิ่ม ${drawn} ใบจาก ${action.cardName}`);
        room.notice = `${actor.name} จั่วการ์ดเพิ่ม ${drawn} ใบ`;
      }
      return;
    }
    case "forced_play_one_card": {
      const selectedCard = cards[0];
      if (!selectedCard) {
        room.notice = "ไม่พบการ์ดที่เลือก";
        return;
      }

      addLog(room, `${actor.name} ถูกบังคับให้ใช้ ${selectedCard.name}`);
      const effectResult = triggerCardPlay(room, actor, selectedCard);
      collectIgnoredIds(room, effectResult.ignoreEmptyHandForIds || []);
      return;
    }
    default:
      room.notice = "ไม่พบเอฟเฟกต์การเลือกการ์ด";
  }
}

function playerSummaryFor(room, targetId) {
  return room.players.map((player, index) => ({
    id: player.id,
    name: player.name,
    cardCount: player.hand.length,
    isTurn: room.gameStarted && index === room.currentTurn && !room.roundEnded && !player.eliminated,
    eliminated: player.eliminated,
    saidLastCard: player.saidLastCard,
    hand: player.id === targetId ? player.hand : undefined,
  }));
}

function pendingActionFor(room, targetId) {
  if (!room.pendingAction) return null;
  if (room.pendingAction.actorId !== targetId) return null;

  if (room.pendingAction.mode === "select_player") {
    return {
      mode: "select_player",
      effect: room.pendingAction.effect,
      title: repairText(room.pendingAction.title),
      description: repairText(room.pendingAction.description),
      options: room.pendingAction.options,
    };
  }

  const actor = room.players.find((player) => player.id === targetId);
  const availableCards = Array.isArray(room.pendingAction.availableCardsData)
    ? room.pendingAction.availableCardsData
    : !actor
      ? []
      : Array.isArray(room.pendingAction.availableCardIds)
        ? actor.hand.filter((card) => room.pendingAction.availableCardIds.includes(card.id))
        : actor.hand;
  const sortedAvailableCards = ["deck", "graveyard", "deck_preview", "player_pool"].includes(room.pendingAction.selectionSource)
    ? sortCardsByFileId(availableCards)
    : availableCards;
  return {
    mode: "select_cards",
    effect: room.pendingAction.effect,
    title: repairText(room.pendingAction.title),
    description: repairText(room.pendingAction.description),
    minSelections: room.pendingAction.minSelections,
    maxSelections: room.pendingAction.maxSelections,
    selectionSource: room.pendingAction.selectionSource || null,
    availableCards: sortedAvailableCards,
  };
}

function emitRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach((target) => {
    const me = room.players.find((player) => player.id === target.id);
    const myTurn = room.gameStarted && getCurrentPlayer(room)?.id === target.id && !room.roundEnded && !me.eliminated;
    io.to(target.id).emit("roomState", {
      roomId,
      players: playerSummaryFor(room, target.id),
      deckCount: room.deck.length,
      graveCount: room.graveyard.length,
      graveTopCard: room.graveyard[0] || null,
      graveCards: room.graveyard,
      lastPlayedCard: room.centerCard,
      logs: room.logs.map(repairText),
      gameStarted: room.gameStarted,
      canStart: room.players[0]?.id === target.id && !room.gameStarted && room.players.length >= 2,
      canNextRound: room.players[0]?.id === target.id && room.gameStarted && room.roundEnded && room.players.length >= 2,
      canDrawCard: myTurn && !room.pendingAction && (!me.turnActionTaken || !!me.turnKeepOpen),
      canEndTurn: false,
      turnActionTaken: !!me.turnActionTaken,
      turnKeepOpen: !!me.turnKeepOpen,
      currentTurnName: getCurrentPlayer(room)?.name || "-",
      myTurn,
      myCardCount: me.hand.length,
      eliminated: me.eliminated,
      saidLastCard: me.saidLastCard,
      roundEnded: room.roundEnded,
      winnerNames: room.winnerNames,
      winnerReason: repairText(room.winnerReason),
      notice: repairText(room.notice),
      chatMessages: (room.chatMessages || []).map((message) => ({
        ...message,
        name: repairText(message.name),
        text: repairText(message.text),
      })),
      pendingAction: pendingActionFor(room, target.id),
      inspectedHand: me.inspectedHand || null,
      effects: room.effects,
      centerWarning: room.centerWarning
        ? { ...room.centerWarning, text: repairText(room.centerWarning.text) }
        : null,
    });
  });
}

function resetRound(room) {
  room.deck = shuffle(allCards);
  room.graveyard = [];
  room.banished = [];
  room.centerCard = null;
  room.currentTurn = 0;
  room.roundEnded = false;
  room.roundActionCount = 0;
  room.winnerIds = [];
  room.winnerNames = [];
  room.winnerReason = "";
  clearPendingTurnAdvance(room);
  room.resolvedScore = false;
      room.logs = ["เริ่มรอบใหม่ แจกการ์ดคนละ 5 ใบ"];
      room.notice = "กำลังสุ่มผู้เล่นคนแรก";
  room.pendingAction = null;
  room.queuedForcedPlays = [];
  room.pendingIgnoreEmptyHandForIds = [];
  room.effects = [];
  room.turnCounter = 0;
  room.playDirection = 1;
  room.laughingDisabled = false;
  room.centerWarning = null;
  room.timedThreats = {
    josephine: null,
    pinkLaugh: null,
  };

  room.players.forEach((player) => {
    player.hand = [];
    player.eliminated = false;
    player.roundScoreDelta = 0;
    player.usedCardsTotal = 0;
    player.usedCard03Count = 0;
    player.valeskaStartCount = null;
    player.bethanyReturnCount = 0;
    player.skipTurns = 0;
    player.sleepTurns = 0;
    player.josephineShield = false;
    player.josephineShieldPendingWin = false;
    player.turnCardsUsed = 0;
    player.turnActionTaken = false;
    player.turnDrewCard = false;
    player.turnPlayedCard = false;
    player.turnOverusePenaltyApplied = false;
    player.turnKeepOpen = false;
    player.saidLastCard = false;
    player.linkWinTo = null;
    player.linkWinLoseTo = null;
    player.inspectedHand = null;
  });

  const activePlayers = getActivePlayers(room);
  dealCardsSequentially(room, activePlayers, activePlayers.map(() => 5), {
    animate: true,
    source: "deck",
    startDelayMs: 180,
    perCardDelayMs: 220,
    soundSpacingMs: 190,
  });
  const firstPlayer = chooseRandomStartingPlayer(room);
  beginTurn(room, room.currentTurn);
  if (firstPlayer) {
    const firstNotice = `${firstPlayer.name} ได้เริ่มเป็นคนแรก`;
    addLog(room, firstNotice);
    room.notice = firstNotice;
    announceCardEffect(room, firstNotice, "effect-announce");
  }
}

function removePlayer(socketId) {
  Object.keys(rooms).forEach((roomId) => {
    const room = rooms[roomId];
    const index = room.players.findIndex((player) => player.id === socketId);
    if (index === -1) return;

    const [player] = room.players.splice(index, 1);
    addChatMessage(room, "ระบบ", `${player.name} ออกจากห้อง`, true);
    addLog(room, `${player.name} ออกจากห้อง`);
    if (room.pendingTurnAdvance?.playerId === socketId) {
      clearPendingTurnAdvance(room);
    }

    if (!room.players.length) {
      delete rooms[roomId];
      return;
    }

    if (index < room.currentTurn) {
      room.currentTurn -= 1;
    } else if (index === room.currentTurn) {
      if (room.currentTurn >= room.players.length) {
        room.currentTurn = 0;
      }
      if (!room.roundEnded) {
        beginTurn(room, room.currentTurn);
      }
    }

    if (room.pendingAction) {
      if (room.pendingAction.mode === "select_player") {
        room.pendingAction.options = room.pendingAction.options.filter((option) => option.id !== socketId);
      }
      if (room.pendingAction.queue) {
        room.pendingAction.queue = room.pendingAction.queue.filter((playerId) => playerId !== socketId);
      }
      if (room.pendingAction.actorId === socketId || (room.pendingAction.mode === "select_player" && !room.pendingAction.options.length)) {
        clearPendingAction(room);
        room.notice = "ยกเลิกการเลือก เพราะมีผู้เล่นออกจากห้อง";
      }
    }

    room.queuedForcedPlays = room.queuedForcedPlays.filter((entry) => entry.playerId !== socketId);

    if (room.gameStarted && !room.roundEnded && room.players.length === 1) {
      setWinners(room, [room.players[0].id], `${room.players[0].name} เหลืออยู่คนเดียวในห้อง`);
    }

    emitRoomState(roomId);
  });
}

io.on("connection", (socket) => {
  socket.on("createRoom", () => {
    let roomId = randomRoomId();
    while (rooms[roomId]) roomId = randomRoomId();
    rooms[roomId] = createRoomState(roomId);
    socket.emit("roomCreated", { roomId });
  });

  socket.on("joinRoom", ({ roomId, playerName }) => {
    const normalizedRoomId = String(roomId || "").trim().toUpperCase();
    const normalizedName = String(playerName || "").trim();
    const room = rooms[normalizedRoomId];

    if (!room) return socket.emit("errorMsg", "ไม่พบห้องนี้ กรุณาตรวจสอบ Room ID");
    if (!normalizedName) return socket.emit("errorMsg", "กรุณาตั้งชื่อก่อนเข้าห้อง");
    if (room.gameStarted) return socket.emit("errorMsg", "เกมห้องนี้เริ่มไปแล้ว");
    if (room.players.length >= 4) return socket.emit("errorMsg", "ห้องนี้เต็มแล้ว");
    if (room.players.some((player) => player.name === normalizedName)) {
      return socket.emit("errorMsg", "ชื่อนี้ถูกใช้ในห้องแล้ว");
    }

    socket.join(normalizedRoomId);
    room.players.push(createPlayerState(socket.id, normalizedName));
    addLog(room, `${normalizedName} เข้าร่วมห้อง`);
    addChatMessage(room, "ระบบ", `${normalizedName} เข้าร่วมห้อง`, true);
    room.notice = "รอให้ผู้เล่นพร้อมแล้วกดเริ่มเกม";
    emitRoomState(normalizedRoomId);
  });

  socket.on("sendChatMessage", ({ roomId, text }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((candidate) => candidate.id === socket.id);
    if (!player) return;

    const messageText = String(text || "").trim().slice(0, 240);
    if (!messageText) return;

    addChatMessage(room, player.name, messageText);
    emitRoomState(roomId);
  });

  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.players[0]?.id !== socket.id) {
      return socket.emit("errorMsg", "มีเพียงโฮสต์ที่เริ่มเกมได้");
    }
    if (room.players.length < 2) {
      return socket.emit("errorMsg", "ต้องมีผู้เล่นอย่างน้อย 2 คน");
    }

    room.gameStarted = true;
    resetRound(room);
    evaluatePlayers(room, room.notice);
    emitRoomState(roomId);
  });

  socket.on("nextRound", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.players[0]?.id !== socket.id) {
      return socket.emit("errorMsg", "มีเพียงโฮสต์ที่เริ่มรอบใหม่ได้");
    }
    if (!room.gameStarted || !room.roundEnded) return;

    resetRound(room);
    evaluatePlayers(room, room.notice);
    emitRoomState(roomId);
  });

  socket.on("sayLastCard", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.roundEnded) return;

    const player = room.players.find((candidate) => candidate.id === socket.id);
    if (!player) return;
    if (player.eliminated) {
      return socket.emit("errorMsg", "คุณแพ้ออกจากรอบนี้แล้ว");
    }
    if (player.hand.length !== 1) {
      return socket.emit("errorMsg", "ปุ่มเอื้อยข่าบกดได้ตอนเหลือการ์ด 1 ใบเท่านั้น");
    }

    player.saidLastCard = true;
    addLog(room, `${player.name} ตะโกนว่า เอื้อยข่าบ`);
    room.notice = room.pendingTurnAdvance?.playerId === player.id
      ? `${player.name} กดเอื้อยข่าบแล้ว รอเปลี่ยนเทิร์น`
      : `${player.name} กดเอื้อยข่าบแล้ว`;
    queueEffect(room, { type: "last_card", playerId: player.id });
    emitRoomState(roomId);
  });

  socket.on("drawOne", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.roundEnded) return;
    if (room.pendingAction) return socket.emit("errorMsg", "ต้องเลือกให้เสร็จก่อน");

    const player = getCurrentPlayer(room);
    if (!player || player.id !== socket.id) {
      return socket.emit("errorMsg", "ยังไม่ถึงเทิร์นของคุณ");
    }
    const usingExtraAction = consumeKeepOpenTurn(player);
    if (player.turnActionTaken && !usingExtraAction) {
      return socket.emit("errorMsg", "เทิร์นนี้คุณจั่วหรือใช้การ์ดไปแล้ว");
    }

    const drawn = drawCards(room, player, 1, { animate: true });
    player.turnActionTaken = true;
    player.turnDrewCard = true;
    room.roundActionCount += 1;
    addLog(room, drawn
      ? `${player.name} เลือกจั่วการ์ด 1 ใบจากกองเดค`
      : `${player.name} เลือกจั่วการ์ด แต่กองเดคหมดแล้ว`);
    room.notice = drawn
      ? `${player.name} จั่วการ์ด 1 ใบแล้ว`
      : `${player.name} พยายามจั่วการ์ด แต่กองเดคหมด`;
    evaluatePlayers(room, room.notice);
    maybeAutoAdvanceAfterAction(room, player);
    emitRoomState(roomId);
  });

  socket.on("playCard", ({ roomId, cardId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted || room.roundEnded) return;
    if (room.pendingAction) return socket.emit("errorMsg", "ต้องเลือกให้เสร็จก่อน");

    const currentPlayer = getCurrentPlayer(room);
    const player = room.players.find((candidate) => candidate.id === socket.id);
    if (!player) return;
    if (player.eliminated) {
      return socket.emit("errorMsg", "คุณแพ้ออกจากรอบนี้แล้ว");
    }

    const cardIndex = player.hand.findIndex((card) => card.id === cardId);
    if (cardIndex === -1) {
      return socket.emit("errorMsg", "ไม่พบการ์ดใบนี้ในมือ");
    }

    const previewCard = player.hand[cardIndex];
    const isInterruptCard = previewCard?.id === "card_13";
    if (!currentPlayer || (currentPlayer.id !== socket.id && !isInterruptCard)) {
      return socket.emit("errorMsg", "ยังไม่ถึงเทิร์นของคุณ");
    }
    const usingExtraAction = currentPlayer.id === socket.id && consumeKeepOpenTurn(player);
    if (currentPlayer.id === socket.id && player.turnActionTaken && !usingExtraAction && !isInterruptCard) {
      return socket.emit("errorMsg", "เทิร์นนี้คุณจั่วหรือใช้การ์ดไปแล้ว ให้กดจบเทิร์น");
    }

    const [card] = player.hand.splice(cardIndex, 1);
    if (card.lockedFromManualPlay || card.cannotBeUsed) {
      player.hand.push(card);
      return socket.emit("errorMsg", "การ์ดใบนี้ใช้งานเองไม่ได้");
    }

    refreshLastCardFlag(player);
    const effectResult = triggerCardPlay(room, player, card);
    collectIgnoredIds(room, effectResult.ignoreEmptyHandForIds || []);

    if (!effectResult.pending) {
      finalizeResolvedAction(room);
      maybeAutoAdvanceAfterAction(room, player);
    }

    emitRoomState(roomId);
  });

  socket.on("resolveTargetAction", ({ roomId, targetPlayerId }) => {
    const room = rooms[roomId];
    if (!room || !room.pendingAction || room.pendingAction.mode !== "select_player" || room.roundEnded) return;

    const actor = room.players.find((player) => player.id === socket.id);
    if (!actor || room.pendingAction.actorId !== actor.id) {
      return socket.emit("errorMsg", "คุณไม่มีสิทธิ์เลือกเป้าหมายตอนนี้");
    }

    const allowed = room.pendingAction.options.some((option) => option.id === targetPlayerId);
    if (!allowed) return socket.emit("errorMsg", "ผู้เล่นที่เลือกไม่ถูกต้อง");

    const target = room.players.find((player) => player.id === targetPlayerId);
    if (!target) return socket.emit("errorMsg", "ไม่พบผู้เล่นเป้าหมาย");

    resolvePlayerTargetAction(room, actor, target);
    if (!room.pendingAction && !room.roundEnded) {
      finalizeResolvedAction(room);
      maybeAutoAdvanceAfterAction(room, actor);
    }

    emitRoomState(roomId);
  });

  socket.on("resolveCardSelection", ({ roomId, selectedCardIds }) => {
    const room = rooms[roomId];
    if (!room || !room.pendingAction || room.pendingAction.mode !== "select_cards" || room.roundEnded) return;

    const actor = room.players.find((player) => player.id === socket.id);
    if (!actor || room.pendingAction.actorId !== actor.id) {
      return socket.emit("errorMsg", "คุณไม่มีสิทธิ์เลือกการ์ดตอนนี้");
    }

    const uniqueSelected = Array.from(new Set(selectedCardIds || []));
    if (uniqueSelected.length < room.pendingAction.minSelections || uniqueSelected.length > room.pendingAction.maxSelections) {
      return socket.emit("errorMsg", "จำนวนการ์ดที่เลือกไม่ถูกต้อง");
    }

    const availableIds = new Set(
      room.pendingAction.availableCardIds
      || (room.pendingAction.availableCardsData || []).map((card) => card.selectionKey || card.id)
      || actor.hand.map((card) => card.id),
    );
    const valid = uniqueSelected.every((cardId) => availableIds.has(cardId));
    if (!valid) return socket.emit("errorMsg", "มีการ์ดที่เลือกไม่อยู่ในมือ");

    resolveCardSelectionAction(room, actor, uniqueSelected);
    if (!room.pendingAction && !room.roundEnded) {
      finalizeResolvedAction(room);
      maybeAutoAdvanceAfterAction(room, actor);
    }

    emitRoomState(roomId);
  });

  socket.on("disconnect", () => removePlayer(socket.id));
});

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => {
  ensureStatsFile();
  console.log(`Server running on http://localhost:${PORT}`);
});
