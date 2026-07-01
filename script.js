/**
 * Fruit Merge 2048
 * A 2048-style puzzle game with fruit tiles.
 */

const GRID_SIZE = 4;
const WIN_VALUE = 2048;

// Fruit definitions: value → emoji, name, and tile color
const FRUITS = {
  1:    { emoji: "🫐", name: "Blueberry",   color: "#7b8cde" },
  2:    { emoji: "🍓", name: "Strawberry",  color: "#f06292" },
  4:    { emoji: "🍊", name: "Orange",      color: "#ff9800" },
  8:    { emoji: "🍎", name: "Apple",       color: "#e53935" },
  16:   { emoji: "🍐", name: "Pear",        color: "#cddc39" },
  32:   { emoji: "🍑", name: "Peach",       color: "#ffab91" },
  64:   { emoji: "🍍", name: "Pineapple",   color: "#ffca28" },
  128:  { emoji: "🥥", name: "Coconut",     color: "#a1887f" },
  256:  { emoji: "🥭", name: "Mango",       color: "#ffb300" },
  512:  { emoji: "🍉", name: "Watermelon",  color: "#66bb6a" },
  1024: { emoji: "🐉", name: "Dragon Fruit", color: "#ce93d8" },
  2048: { emoji: "👑", name: "Golden Fruit", color: "#ffd54f" },
};

// Ordered merge chain for advancing values
const MERGE_CHAIN = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

// Game state
let board = [];
let score = 0;
let gameOver = false;
let hasWon = false;

// Animation hints for the next render
let newTilePos = null;
let mergedPositions = new Set();

// DOM references
const boardEl = document.getElementById("game-board");
const scoreEl = document.getElementById("score");
const messageOverlay = document.getElementById("message-overlay");
const messageText = document.getElementById("message-text");
const restartBtn = document.getElementById("restart-btn");
const messageRestartBtn = document.getElementById("message-restart-btn");
const muteBtn = document.getElementById("mute-btn");

let isMuted = localStorage.getItem("fruit_2048_muted") === "true";

// Touch and Mouse tracking for swipe gestures
let touchStartX = 0;
let touchStartY = 0;
let isMouseDown = false;
let mouseStartX = 0;
let mouseStartY = 0;

/**
 * Create an empty 4x4 board.
 */
function createEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

/**
 * Return the next fruit value after merging, or the same value if max reached.
 */
function getMergedValue(value) {
  const index = MERGE_CHAIN.indexOf(value);
  if (index === -1 || index === MERGE_CHAIN.length - 1) return value;
  return MERGE_CHAIN[index + 1];
}

/**
 * Set up a fresh game: reset state, spawn two tiles, and render.
 */
function initializeGame() {
  board = createEmptyBoard();
  score = 0;
  gameOver = false;
  hasWon = false;
  newTilePos = null;
  mergedPositions = new Set();
  hideMessage();
  updateMuteButtonUI();
  cleanupConfetti();
  boardEl.classList.remove("game-board-gameover");

  addRandomTile();
  addRandomTile();
  renderBoard();
  updateScore();
}

/**
 * Draw the grid cells and fruit tiles on the board.
 */
function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;

      const value = board[row][col];
      if (value !== 0) {
        const tile = createTileElement(value, row, col);
        cell.appendChild(tile);

        // If this tile was just merged, trigger the juice splash and ripple impact animations!
        const posKey = `${row},${col}`;
        if (mergedPositions.has(posKey)) {
          const color = FRUITS[value].color;
          // Run on next animation frame so tiles are fully mounted
          requestAnimationFrame(() => {
            spawnJuiceSplash(cell, color);
            spawnMergeRipple(cell, color);
          });
        }
      }

      boardEl.appendChild(cell);
    }
  }
}

/**
 * Build a single fruit tile DOM element with styling and animation classes.
 */
function createTileElement(value, row, col) {
  const fruit = FRUITS[value];
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.style.backgroundColor = fruit.color;
  tile.style.color = value >= 8 ? "#fff" : "#4a3728";

  // Apply appear / merge animations
  const posKey = `${row},${col}`;
  if (newTilePos && newTilePos.row === row && newTilePos.col === col) {
    tile.classList.add("tile-new");
  }
  if (mergedPositions.has(posKey)) {
    tile.classList.add("tile-merged");
  }
  if (value === WIN_VALUE) {
    tile.classList.add("tile-golden-glow");
  }

  const emoji = document.createElement("span");
  emoji.className = "tile-emoji";
  emoji.textContent = fruit.emoji;

  const name = document.createElement("span");
  name.className = "tile-name";
  name.textContent = fruit.name;

  tile.appendChild(emoji);
  tile.appendChild(name);
  return tile;
}

/**
 * Spawns dynamic juice splash particles from the center of a cell.
 * @param {HTMLElement} cell
 * @param {string} color
 */
function spawnJuiceSplash(cell, color) {
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "juice-particle";

    // Random size between 6px and 12px
    const size = Math.random() * 6 + 6;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;

    // Center the particle initially in the cell
    particle.style.left = "50%";
    particle.style.top = "50%";
    particle.style.marginLeft = `-${size / 2}px`;
    particle.style.marginTop = `-${size / 2}px`;

    // Random angle and distance for trajectory
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 35 + 35; // 35px to 70px distance
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);

    cell.appendChild(particle);

    // Clean up particle after animation completes
    setTimeout(() => {
      particle.remove();
    }, 500);
  }
}

/**
 * Spawns an expanding colored impact ripple inside a cell.
 * @param {HTMLElement} cell
 * @param {string} color
 */
function spawnMergeRipple(cell, color) {
  const ripple = document.createElement("div");
  ripple.className = "merge-ripple";
  ripple.style.setProperty("--ripple-color", color);
  
  cell.appendChild(ripple);

  // Clean up ripple after animation completes
  setTimeout(() => {
    ripple.remove();
  }, 400);
}

/**
 * Update the mute button emoji/label based on the state.
 */
function updateMuteButtonUI() {
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  muteBtn.setAttribute("aria-label", isMuted ? "Unmute sound" : "Mute sound");
}

/**
 * Toggle the mute state and save to localStorage.
 */
function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem("fruit_2048_muted", isMuted);
  updateMuteButtonUI();

  // Play a quick chime to confirm unmute
  if (!isMuted) {
    SoundEffects.playMerge();
  }
}

// Web Audio API Synthesized Sound Effects
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

const SoundEffects = {
  playSlide() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  },

  playMerge() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();

      // Juicy/bubble pop sound: 2 quick sine wave sweeps
      // Pop 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(240, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.08);

      gain1.gain.setValueAtTime(0.18, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.08);

      // Pop 2 (slightly delayed and higher pitch for that juicy bubble feel)
      setTimeout(() => {
        if (isMuted) return;
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(380, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.08);

          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.08);
        } catch (e) {}
      }, 50);
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  },

  playWin() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 major arpeggio
      notes.forEach((freq, index) => {
        setTimeout(() => {
          if (isMuted) return;
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch (e) {}
        }, index * 100);
      });
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  },

  playGameOver() {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      const notes = [220.00, 207.65, 196.00, 164.81]; // A3, G#3, G3, E3 sad falling progression
      notes.forEach((freq, index) => {
        setTimeout(() => {
          if (isMuted) return;
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(freq - 20, ctx.currentTime + 0.25);

            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.25);
          } catch (e) {}
        }, index * 150);
      });
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  }
};

// Keep track of active confetti elements for cleanup
let activeConfetti = [];

/**
 * Spawns a screen-wide falling confetti shower.
 */
function spawnConfetti() {
  cleanupConfetti();

  const confettiColors = ["#7b8cde", "#f06292", "#ff9800", "#e53935", "#cddc39", "#ffab91", "#ffca28", "#ffd54f"];
  const particleCount = 75;

  for (let i = 0; i < particleCount; i++) {
    const confettiPiece = document.createElement("div");
    confettiPiece.className = "confetti";

    // Random style configurations
    const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    const leftPos = Math.random() * 100; // Left percentage
    const width = Math.random() * 6 + 6; // Width 6px-12px
    const height = Math.random() * 8 + 6; // Height 6px-14px
    const fallDuration = Math.random() * 2 + 2.5; // Fall duration 2.5s-4.5s
    const delay = Math.random() * 1.5; // Delay 0s-1.5s
    const isRound = Math.random() > 0.5;

    confettiPiece.style.backgroundColor = color;
    confettiPiece.style.left = `${leftPos}vw`;
    confettiPiece.style.width = `${width}px`;
    confettiPiece.style.height = `${height}px`;
    confettiPiece.style.animationDelay = `${delay}s`;
    confettiPiece.style.setProperty("--fall-duration", `${fallDuration}s`);
    if (isRound) {
      confettiPiece.style.borderRadius = "50%";
    }

    document.body.appendChild(confettiPiece);
    activeConfetti.push(confettiPiece);

    // Individual cleanup once offscreen
    setTimeout(() => {
      confettiPiece.remove();
      activeConfetti = activeConfetti.filter(p => p !== confettiPiece);
    }, (fallDuration + delay) * 1000 + 100);
  }
}

/**
 * Removes all active confetti elements from the DOM.
 */
function cleanupConfetti() {
  activeConfetti.forEach(piece => piece.remove());
  activeConfetti = [];
}


/**
 * Update the score display in the header.
 */
function updateScore() {
  scoreEl.textContent = score;
}

/**
 * Merge a single row (left direction). Returns merged row and score gained.
 */
function mergeRow(row) {
  // Slide non-zero tiles to the left
  const filtered = row.filter((val) => val !== 0);
  const merged = [];
  let scoreGain = 0;
  const mergeFlags = [];

  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const newValue = getMergedValue(filtered[i]);
      merged.push(newValue);
      scoreGain += newValue;
      mergeFlags.push(true);
      i += 2;
    } else {
      merged.push(filtered[i]);
      mergeFlags.push(false);
      i += 1;
    }
  }

  // Pad with zeros to maintain row length
  while (merged.length < GRID_SIZE) {
    merged.push(0);
    mergeFlags.push(false);
  }

  return { row: merged, scoreGain, mergeFlags };
}

/**
 * Reverse a row or column array (used for right/down moves).
 */
function reverseArray(arr) {
  return [...arr].reverse();
}

/**
 * Extract a column from the board as an array.
 */
function getColumn(colIndex) {
  return board.map((row) => row[colIndex]);
}

/**
 * Write a column back into the board.
 */
function setColumn(colIndex, column) {
  for (let row = 0; row < GRID_SIZE; row++) {
    board[row][colIndex] = column[row];
  }
}

/**
 * Check whether two boards differ (a move actually changed something).
 */
function boardsAreEqual(a, b) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/**
 * Process a move in the given direction. Spawns a tile if the board changed.
 * @param {"up"|"down"|"left"|"right"} direction
 */
function move(direction) {
  if (gameOver) return;

  const previousBoard = board.map((row) => [...row]);
  let totalScoreGain = 0;
  mergedPositions = new Set();

  if (direction === "left" || direction === "right") {
    for (let row = 0; row < GRID_SIZE; row++) {
      let currentRow = [...board[row]];
      if (direction === "right") currentRow = reverseArray(currentRow);

      const { row: mergedRow, scoreGain, mergeFlags } = mergeRow(currentRow);
      totalScoreGain += scoreGain;

      // Track merged tile positions for animation
      for (let j = 0; j < mergedRow.length; j++) {
        if (mergeFlags[j]) {
          const actualCol = direction === "right" ? GRID_SIZE - 1 - j : j;
          mergedPositions.add(`${row},${actualCol}`);
        }
      }

      board[row] = direction === "right" ? reverseArray(mergedRow) : mergedRow;
    }
  } else {
    // up or down — process each column
    for (let col = 0; col < GRID_SIZE; col++) {
      let currentCol = getColumn(col);
      if (direction === "down") currentCol = reverseArray(currentCol);

      const { row: mergedCol, scoreGain, mergeFlags } = mergeRow(currentCol);
      totalScoreGain += scoreGain;

      for (let j = 0; j < mergedCol.length; j++) {
        if (mergeFlags[j]) {
          const actualRow = direction === "down" ? GRID_SIZE - 1 - j : j;
          mergedPositions.add(`${actualRow},${col}`);
        }
      }

      const finalCol = direction === "down" ? reverseArray(mergedCol) : mergedCol;
      setColumn(col, finalCol);
    }
  }

  // Ignore invalid moves (board unchanged)
  if (boardsAreEqual(previousBoard, board)) return;

  score += totalScoreGain;
  updateScore();

  // Play appropriate sound effect
  if (mergedPositions.size > 0) {
    SoundEffects.playMerge();
  } else {
    SoundEffects.playSlide();
  }

  addRandomTile();
  renderBoard();
  checkWin();
  checkGameOver();
}

/**
 * Place a random Blueberry (1) or Strawberry (2) in an empty cell.
 */
function addRandomTile() {
  const emptyCells = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) return;

  const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[row][col] = Math.random() < 0.9 ? 1 : 2;
  newTilePos = { row, col };
}

/**
 * Return true if any adjacent tiles can merge or any cell is empty.
 */
function canMove() {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const value = board[row][col];

      if (value === 0) return true;

      // Check right neighbor
      if (col + 1 < GRID_SIZE && board[row][col + 1] === value) return true;
      // Check bottom neighbor
      if (row + 1 < GRID_SIZE && board[row + 1][col] === value) return true;
    }
  }
  return false;
}

/**
 * End the game if no moves remain.
 */
function checkGameOver() {
  if (!canMove()) {
    gameOver = true;
    showMessage("Game Over");
    boardEl.classList.add("game-board-gameover");
    SoundEffects.playGameOver();
  }
}

/**
 * Show a win message when the Golden Fruit (2048) is reached.
 */
function checkWin() {
  if (hasWon) return;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === WIN_VALUE) {
        hasWon = true;
        showMessage("You Win! 🎉");
        spawnConfetti();
        SoundEffects.playWin();
        return;
      }
    }
  }
}

/**
 * Display the overlay message.
 */
function showMessage(text) {
  messageText.textContent = text;
  messageOverlay.classList.remove("hidden");
}

/**
 * Hide the overlay message.
 */
function hideMessage() {
  messageOverlay.classList.add("hidden");
}

/**
 * Reset and start a new game.
 */
function restartGame() {
  initializeGame();
}

/**
 * Map arrow keys to move directions.
 */
function handleKeyboardInput(event) {
  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  const direction = keyMap[event.key];
  if (!direction) return;

  event.preventDefault();
  move(direction);
}

/**
 * Detect swipe direction from touch start/end coordinates.
 */
function handleTouchInput(event) {
  if (event.type === "touchstart") {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    return;
  }

  if (event.type === "touchend") {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    const minSwipe = 30;

    if (Math.abs(deltaX) < minSwipe && Math.abs(deltaY) < minSwipe) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX > 0 ? "right" : "left");
    } else {
      move(deltaY > 0 ? "down" : "up");
    }
  }
}

/**
 * Handle mouse down to initiate swipe.
 */
function handleMouseDown(event) {
  if (event.button !== 0) return; // Only left clicks
  event.preventDefault(); // Prevent text selection and native drag behaviors
  isMouseDown = true;
  mouseStartX = event.clientX;
  mouseStartY = event.clientY;
}

/**
 * Handle mouse up to calculate swipe distance and direction.
 */
function handleMouseUp(event) {
  if (!isMouseDown) return;
  isMouseDown = false;

  const deltaX = event.clientX - mouseStartX;
  const deltaY = event.clientY - mouseStartY;
  const minSwipe = 30;

  if (Math.abs(deltaX) < minSwipe && Math.abs(deltaY) < minSwipe) return;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    move(deltaX > 0 ? "right" : "left");
  } else {
    move(deltaY > 0 ? "down" : "up");
  }
}

/**
 * Handle mouse move to reset swipe tracking if left button is released outside window.
 */
function handleMouseMove(event) {
  if (!isMouseDown) return;
  // If left mouse button is not pressed, cancel swipe tracking
  if (event.buttons !== 1) {
    isMouseDown = false;
  }
}

// --- Event listeners ---

document.addEventListener("keydown", handleKeyboardInput);
boardEl.addEventListener("touchstart", handleTouchInput, { passive: true });
boardEl.addEventListener("touchend", handleTouchInput, { passive: true });
boardEl.addEventListener("mousedown", handleMouseDown);
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("mouseup", handleMouseUp);
restartBtn.addEventListener("click", restartGame);
messageRestartBtn.addEventListener("click", restartGame);
muteBtn.addEventListener("click", toggleMute);

// Start the game
initializeGame();
