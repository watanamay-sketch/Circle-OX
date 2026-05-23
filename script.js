const boardEl = document.querySelector("#board");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const pieceButtons = [...document.querySelectorAll(".piece-choice")];
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

function newGame() {
  board = Array.from({ length: 9 }, () => []);
  turn = "red";
  selectedSize = "large";
  remaining = {
    red: { large: 3, medium: 3, small: 3 },
    blue: { large: 3, medium: 3, small: 3 },
  };
  winner = "";
  winningLine = [];
  render();
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
  if (winner || !canPlace(index, selectedSize)) return;

  board[index].push({ player: turn, size: selectedSize });
  remaining[turn][selectedSize] -= 1;

  const line = getWinningLine(turn);
  if (line) {
    winner = turn;
    winningLine = line;
    scores[turn] += 1;
    render();
    return;
  }

  switchTurn();
  render();
}

function canPlace(index, size) {
  if (remaining[turn][size] <= 0) return false;

  const topPiece = getTopPiece(index);
  if (!topPiece) return true;

  return sizeRank[size] > sizeRank[topPiece.size];
}

function getTopPiece(index) {
  const stack = board[index];
  return stack.length ? stack[stack.length - 1] : null;
}

function switchTurn() {
  turn = turn === "red" ? "blue" : "red";
  selectedSize = getFirstAvailableSize(turn);
}

function getFirstAvailableSize(player) {
  return ["large", "medium", "small"].find((size) => remaining[player][size] > 0) || "small";
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
}

function renderPieces() {
  pieceButtons.forEach((button) => {
    const size = button.dataset.size;
    const left = remaining[turn][size];
    button.classList.toggle("is-selected", selectedSize === size);
    button.disabled = Boolean(winner) || left <= 0;
    button.querySelector("strong").textContent = left;
  });
}

function renderBoard() {
  const cells = [...boardEl.children];

  cells.forEach((cell, index) => {
    const topPiece = getTopPiece(index);
    cell.innerHTML = "";
    cell.classList.toggle("is-legal", !winner && canPlace(index, selectedSize));
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
  if (winner) {
    messageEl.textContent = `${playerLabel[winner]}ชนะ!`;
    return;
  }

  messageEl.textContent = `ตา${playerLabel[turn]}: เลือกวง${sizeLabel[selectedSize]}แล้ววาง`;
}

pieceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const size = button.dataset.size;
    if (remaining[turn][size] <= 0 || winner) return;
    selectedSize = size;
    render();
  });
});

resetButton.addEventListener("click", newGame);
createBoard();
newGame();
