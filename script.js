const boardEl = document.querySelector("#board");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const pieceButtons = [...document.querySelectorAll(".piece-choice")];
const onlineEls = {
  status: document.querySelector("#onlineStatus"),
  friend: document.querySelector("#friendStatus"),
  create: document.querySelector("#createRoomButton"),
  join: document.querySelector("#joinRoomButton"),
  copy: document.querySelector("#copyLinkButton"),
  leave: document.querySelector("#leaveRoomButton"),
  room: document.querySelector("#roomInput"),
};
const starterButtons = [...document.querySelectorAll(".starter-button")];
const modeButtons = [...document.querySelectorAll(".mode-button")];
const scoreEls = {
  red: document.querySelector("#redWins"),
  blue: document.querySelector("#blueWins"),
};

const countEls = {
  red: {
    large: document.querySelector("#redLargeCount"),
    medium: document.querySelector("#redMediumCount"),
    small: document.querySelector("#redSmallCount"),
  },
  blue: {
    large: document.querySelector("#blueLargeCount"),
    medium: document.querySelector("#blueMediumCount"),
    small: document.querySelector("#blueSmallCount"),
  },
};

const sizeRank = {
  small: 1,
  medium: 2,
  large: 3,
};

const sizeLabel = {
  large: "ใหญ่",
  medium: "กลาง",
  small: "เล็ก",
};

const playerLabel = {
  red: "แดง",
  blue: "น้ำเงิน",
};

const winLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let board;
let turn;
let selectedSize;
let remaining;
let winner;
let winningLine;
let scores = { red: 0, blue: 0 };
let playMode = "normal";
let drawTimer = null;
let online = {
  db: null,
  enabled: false,
  player: "",
  roomId: "",
  roomRef: null,
  connected: { red: false, blue: false },
  syncing: false,
};

function newGame(options = {}) {
  clearDrawTimer();
  board = Array.from({ length: 9 }, () => []);
  turn = options.starter || getStarter();
  selectedSize = "";
  remaining = {
    red: { large: 3, medium: 3, small: 3 },
    blue: { large: 3, medium: 3, small: 3 },
  };
  winner = "";
  winningLine = [];
  render();

  if (!options.skipSync) {
    syncRoom();
  }
}

function createBoard() {
  boardEl.innerHTML = "";

  for (let index = 0; index < 9; index += 1) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.type = "button";
    cell.dataset.index = String(index);
    cell.setAttribute("role", "gridcell");
    cell.addEventListener("click", () => placePiece(index));
    boardEl.append(cell);
  }
}

function placePiece(index) {
  if (!canActNow()) return;
  if (winner || !selectedSize || !canPlace(index, selectedSize, turn)) return;

  board[index].push({ player: turn, size: selectedSize });
  remaining[turn][selectedSize] -= 1;

  const line = getWinningLine(turn);
  if (line) {
    winner = turn;
    winningLine = line;
    scores[turn] += 1;
    render();
    syncRoom();
    return;
  }

  advanceTurn();
  render();
  syncRoom();
}

function canPlace(index, size, player = turn) {
  if (remaining[player][size] <= 0) return false;

  const topPiece = getTopPiece(index);
  if (!topPiece) return true;
  if (topPiece.player === player) return false;

  return sizeRank[size] > sizeRank[topPiece.size];
}

function getTopPiece(index) {
  const stack = board[index];
  return stack.length ? stack[stack.length - 1] : null;
}

function switchTurn() {
  turn = turn === "red" ? "blue" : "red";
  selectedSize = "";
}

function advanceTurn() {
  const nextPlayer = turn === "red" ? "blue" : "red";

  if (playerHasLegalMove(nextPlayer)) {
    turn = nextPlayer;
    selectedSize = "";
    return;
  }

  if (playerHasLegalMove(turn)) {
    selectedSize = "";
    return;
  }

  finishDraw();
}

function playerHasLegalMove(player) {
  return ["large", "medium", "small"].some((size) => sizeHasLegalMove(player, size));
}

function sizeHasLegalMove(player, size) {
  if (remaining[player][size] <= 0) return false;
  return board.some((_, index) => canPlace(index, size, player));
}

function finishDraw() {
  winner = "draw";
  winningLine = [];
  render();
  syncRoom();
  clearDrawTimer();
  drawTimer = setTimeout(() => {
    newGame();
  }, 1600);
}

function clearDrawTimer() {
  if (!drawTimer) return;
  clearTimeout(drawTimer);
  drawTimer = null;
}

function getWinningLine(player) {
  return winLines.find((line) => line.every((index) => getTopPiece(index)?.player === player));
}

function render() {
  document.body.dataset.turn = turn;

  renderPieces();
  renderBoard();
  renderScores();
  renderMessage();
  renderOnline();
  renderStarter();
}

function renderPieces() {
  pieceButtons.forEach((button) => {
    const player = button.dataset.player;
    const size = button.dataset.size;
    const left = remaining[player][size];
    const isCurrentPlayer = player === turn;
    const isOnlineOwner = !online.enabled || online.player === player;
    const hasLegalMove = sizeHasLegalMove(player, size);
    button.classList.toggle("is-selected", isCurrentPlayer && selectedSize === size);
    button.classList.toggle("is-inactive", !isCurrentPlayer || !isOnlineOwner);
    button.disabled = Boolean(winner) || !isCurrentPlayer || !isOnlineOwner || left <= 0 || !hasLegalMove;
    button.querySelector("strong").textContent = left;
  });
}

function renderBoard() {
  const cells = [...boardEl.children];

  cells.forEach((cell, index) => {
    const topPiece = getTopPiece(index);
    cell.innerHTML = "";
    cell.classList.toggle("is-legal", !winner && Boolean(selectedSize) && canPlace(index, selectedSize, turn));
    cell.classList.toggle("is-win", winningLine.includes(index));
    cell.disabled = Boolean(winner);

    if (topPiece) {
      const disc = document.createElement("span");
      disc.className = `disc ${topPiece.player} ${topPiece.size}`;
      cell.append(disc);
    }

    const label = topPiece
      ? `ช่อง ${index + 1} มี${playerLabel[topPiece.player]}ขนาด${sizeLabel[topPiece.size]}อยู่บนสุด`
      : `ช่อง ${index + 1} ว่าง`;
    cell.setAttribute("aria-label", label);
  });
}

function renderScores() {
  scoreEls.red.textContent = scores.red;
  scoreEls.blue.textContent = scores.blue;
}

function renderMessage() {
  if (winner === "draw") {
    messageEl.textContent = "เสมอ! เริ่มเกมใหม่ให้อัตโนมัติ";
    return;
  }

  if (winner) {
    messageEl.textContent = `${playerLabel[winner]}ชนะ!`;
    return;
  }

  if (online.enabled && online.player !== turn) {
    messageEl.textContent = `รอ${playerLabel[turn]}วาง`;
    return;
  }

  if (!selectedSize) {
    if (!playerHasLegalMove(turn)) {
      messageEl.textContent = `${playerLabel[turn]}ไม่มีช่องให้วาง`;
      return;
    }

    messageEl.textContent = `ตา${playerLabel[turn]}: เลือกขนาดก่อนวาง`;
    return;
  }

  messageEl.textContent = `ตา${playerLabel[turn]}: เลือกวง${sizeLabel[selectedSize]}แล้ววาง`;
}

function renderOnline() {
  const configured = isFirebaseConfigured();
  const playerText = online.player ? `คุณเป็น${playerLabel[online.player]}` : "";
  onlineEls.status.textContent = online.enabled
    ? `ห้อง ${online.roomId} · ${playerText}`
    : getOfflineStatus(configured);

  if (online.enabled) {
    const friend = online.player === "red" ? "blue" : "red";
    onlineEls.friend.textContent = online.connected[friend]
      ? `${playerLabel[friend]}เข้าห้องแล้ว`
      : `รอ${playerLabel[friend]}เข้าห้อง`;
  } else {
    onlineEls.friend.textContent = "ยังไม่ได้สร้างห้อง";
  }

  onlineEls.copy.disabled = !online.enabled;
  onlineEls.leave.disabled = !online.enabled;
  modeButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.playMode === playMode);
  });
}

function getOfflineStatus(configured) {
  if (playMode === "face") return "โหมดต่อหน้า · ผลัดกันเล่นเครื่องเดียว";
  if (!configured) return "เล่นปกติ · ใส่ Firebase config ก่อนใช้ห้องออนไลน์";
  return "เล่นปกติ · เล่นเครื่องเดียวหรือสร้างห้องออนไลน์";
}

function renderStarter() {
  starterButtons.forEach((button) => {
    const starter = button.dataset.starter;
    const canChange = !online.enabled || online.player === "red";
    button.classList.toggle("is-selected", starter === getStarter());
    button.disabled = Boolean(winner) || !canChange || hasAnyPiece();
  });
}

function canActNow() {
  return !online.enabled || online.player === turn;
}

function getSyncedState() {
  return {
    cells: encodeBoard(),
    turn,
    remaining,
    winner,
    winningLine,
    scores,
    starter: getStarter(),
    updatedAt: Date.now(),
  };
}

function applySyncedState(state) {
  if (!state) return;

  online.syncing = true;
  board = state.cells ? decodeBoard(state.cells) : normalizeBoard(state.board);
  turn = state.turn || "red";
  remaining = state.remaining || {
    red: { large: 3, medium: 3, small: 3 },
    blue: { large: 3, medium: 3, small: 3 },
  };
  winner = state.winner || "";
  winningLine = state.winningLine || [];
  scores = state.scores || { red: 0, blue: 0 };
  document.body.dataset.starter = state.starter || "red";
  selectedSize = "";
  render();
  online.syncing = false;
}

function getStarter() {
  return document.body.dataset.starter || "red";
}

function setStarter(starter) {
  if (winner || hasAnyPiece()) return;
  if (online.enabled && online.player !== "red") return;

  document.body.dataset.starter = starter;
  turn = starter;
  selectedSize = "";
  render();
  syncRoom();
}

function hasAnyPiece() {
  return board.some((stack) => stack.length > 0);
}

function encodeBoard() {
  return board.map((stack) => stack.map((piece) => `${piece.player}:${piece.size}`).join("|"));
}

function decodeBoard(cells) {
  return Array.from({ length: 9 }, (_, index) => {
    const cell = cells[index] || "";
    if (!cell) return [];

    return cell.split("|").map((value) => {
      const [player, size] = value.split(":");
      return { player, size };
    });
  });
}

function normalizeBoard(nextBoard) {
  return Array.from({ length: 9 }, (_, index) => {
    const stack = nextBoard?.[index];
    if (!stack) return [];

    return Array.isArray(stack) ? stack.filter(Boolean) : Object.values(stack).filter(Boolean);
  });
}

function isFirebaseConfigured() {
  return Boolean(window.CIRCLE_OX_FIREBASE_CONFIG && window.firebase?.database);
}

function setupFirebase() {
  if (online.db) return true;

  if (!isFirebaseConfigured()) {
    alert("ยังไม่ได้ใส่ Firebase config ในไฟล์ firebase-config.js");
    renderOnline();
    return false;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(window.CIRCLE_OX_FIREBASE_CONFIG);
  }

  online.db = firebase.database();
  return true;
}

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function createRoom() {
  if (!setupFirebase()) return;

  leaveRoom(false);
  playMode = "online";
  online.enabled = true;
  online.player = "red";
  online.roomId = makeRoomId();
  online.roomRef = online.db.ref(`rooms/${online.roomId}`);
  online.connected = { red: true, blue: false };
  newGame({ skipSync: true, starter: getStarter() });
  await online.roomRef.set({
    createdAt: Date.now(),
    red: true,
    blue: false,
    state: getSyncedState(),
  });
  listenRoom();
  writeRoomToUrl();
  render();
}

async function joinRoom(roomId = onlineEls.room.value.trim().toUpperCase()) {
  if (!setupFirebase()) return;
  if (!roomId) {
    alert("ใส่รหัสห้องก่อน");
    return;
  }

  const nextRef = online.db.ref(`rooms/${roomId}`);
  const snapshot = await nextRef.once("value");
  if (!snapshot.exists()) {
    alert("ไม่พบห้องนี้");
    return;
  }

  leaveRoom(false);
  playMode = "online";
  online.enabled = true;
  online.player = "blue";
  online.roomId = roomId;
  online.roomRef = nextRef;
  online.connected = { red: true, blue: true };
  await online.roomRef.update({ blue: true });
  listenRoom();
  writeRoomToUrl();
  render();
}

function listenRoom() {
  if (!online.roomRef) return;

  online.roomRef.child("state").on("value", (snapshot) => {
    applySyncedState(snapshot.val());
  });
  online.roomRef.on("value", (snapshot) => {
    const value = snapshot.val() || {};
    online.connected = { red: Boolean(value.red), blue: Boolean(value.blue) };
    renderOnline();
    renderStarter();
  });
}

function syncRoom() {
  if (!online.enabled || !online.roomRef || online.syncing) return;
  online.roomRef.child("state").set(getSyncedState());
}

function leaveRoom(updateUrl = true) {
  if (online.roomRef) {
    online.roomRef.child("state").off();
    online.roomRef.off("value");
  }

  online.enabled = false;
  online.player = "";
  online.roomId = "";
  online.roomRef = null;
  online.connected = { red: false, blue: false };
  onlineEls.room.value = "";

  if (updateUrl) {
    if (playMode === "online") playMode = "normal";
    history.replaceState(null, "", location.pathname);
    render();
  }
}

function setPlayMode(nextMode) {
  if (nextMode === "online") {
    createRoom();
    return;
  }

  playMode = nextMode;
  leaveRoom(false);
  history.replaceState(null, "", location.pathname);
  newGame({ skipSync: true, starter: getStarter() });
}

async function copyRoomLink() {
  if (!online.enabled) return;

  const url = new URL(location.href);
  url.searchParams.set("room", online.roomId);
  await navigator.clipboard.writeText(url.href);
  onlineEls.status.textContent = `คัดลอกลิงก์ห้อง ${online.roomId} แล้ว`;
}

function writeRoomToUrl() {
  const url = new URL(location.href);
  url.searchParams.set("room", online.roomId);
  history.replaceState(null, "", url);
  onlineEls.room.value = online.roomId;
}

pieceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!canActNow()) return;
    if (button.dataset.player !== turn) return;

    const size = button.dataset.size;
    if (remaining[turn][size] <= 0 || winner) return;
    selectedSize = size;
    render();
  });
});

resetButton.addEventListener("click", newGame);
modeButtons.forEach((button) => {
  button.addEventListener("click", () => setPlayMode(button.dataset.playMode));
});
starterButtons.forEach((button) => {
  button.addEventListener("click", () => setStarter(button.dataset.starter));
});
onlineEls.join.addEventListener("click", () => joinRoom());
onlineEls.copy.addEventListener("click", copyRoomLink);
onlineEls.leave.addEventListener("click", () => leaveRoom());
createBoard();
newGame();

const roomFromUrl = new URLSearchParams(location.search).get("room");
if (roomFromUrl && isFirebaseConfigured()) {
  joinRoom(roomFromUrl.toUpperCase());
}
