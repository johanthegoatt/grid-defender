import { createGame, placeTurret, resetGame, spawnWave, stepGame, upgradeTurret } from "./src/gameEngine.js";

const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const feedEl = document.getElementById("feed");
const spawnBtn = document.getElementById("spawn");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");
const tickBtn = document.getElementById("tick");
const resetBtn = document.getElementById("reset");
const waveSizeInput = document.getElementById("wave-size");
const simSpeedSelect = document.getElementById("sim-speed");

const CELL = 64;
const state = createGame({ rows: 6, cols: 10 });
let loopId = 0;
const feed = [];

function pushFeed(message) {
  feed.unshift(`${new Date().toLocaleTimeString()} | ${message}`);
  if (feed.length > 8) {
    feed.length = 8;
  }

  feedEl.innerHTML = "";
  for (const row of feed) {
    const item = document.createElement("li");
    item.textContent = row;
    feedEl.append(item);
  }
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(30,37,46,0.15)";
  for (let r = 0; r <= state.rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(state.cols * CELL, r * CELL);
    ctx.stroke();
  }

  for (let c = 0; c <= state.cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, state.rows * CELL);
    ctx.stroke();
  }
}

function drawTurrets() {
  for (const turret of state.turrets) {
    ctx.fillStyle = "#2f6f58";
    ctx.fillRect(turret.col * CELL + 14, turret.row * CELL + 14, CELL - 28, CELL - 28);

    ctx.fillStyle = "#dbe5dd";
    ctx.font = "12px Consolas";
    ctx.fillText(`T${turret.level}`, turret.col * CELL + 22, turret.row * CELL + 38);
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.fillStyle = "#c54837";
    ctx.beginPath();
    ctx.arc(enemy.col * CELL + CELL / 2, enemy.row * CELL + CELL / 2, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "10px Consolas";
    ctx.fillText(
      `${Math.ceil(enemy.hp)}/${enemy.armor}`,
      enemy.col * CELL + CELL / 2 - 14,
      enemy.row * CELL + CELL / 2 + 4
    );
  }
}

function render() {
  drawGrid();
  drawTurrets();
  drawEnemies();
  const mode = loopId ? "Auto" : "Manual";
  const gameState = state.gameOver ? "GAME OVER" : "ACTIVE";
  statusEl.textContent = `Tick ${state.tick} | Wave ${state.wave} | Base ${state.baseHealth} HP | Credits ${state.credits} | Kills ${state.kills} | Escaped ${state.escaped} | Enemies ${state.enemies.length} | ${mode} | ${gameState}`;
}

function stopLoop() {
  if (!loopId) return;
  window.clearInterval(loopId);
  loopId = 0;
}

function doStep() {
  const summary = stepGame(state);
  if (summary.defeated || summary.escaped) {
    pushFeed(`Step summary -> defeated ${summary.defeated}, escaped ${summary.escaped}, hits ${summary.hits}`);
  }

  if (summary.gameOver) {
    stopLoop();
    pushFeed("Base destroyed. Reset to start over.");
  }
  render();
}

function startLoop() {
  if (loopId || state.gameOver) return;
  const speed = Math.max(120, Number(simSpeedSelect.value) || 550);
  loopId = window.setInterval(doStep, speed);
  pushFeed(`Auto simulation started at ${speed}ms/tick.`);
  render();
}

function pauseLoop() {
  if (!loopId) return;
  stopLoop();
  pushFeed("Simulation paused.");
  render();
}

function spawnSelectedWave() {
  const size = Math.max(1, Math.min(12, Number(waveSizeInput.value) || 4));
  spawnWave(state, size);
  pushFeed(`Spawned wave ${state.wave} (${size} enemies).`);
  render();
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);

  try {
    const hasTurret = state.turrets.some((turret) => turret.row === row && turret.col === col);
    if (event.shiftKey && hasTurret) {
      const upgraded = upgradeTurret(state, row, col);
      pushFeed(`Upgraded turret to level ${upgraded.level} at row ${row}, col ${col}.`);
    } else {
      placeTurret(state, row, col);
      pushFeed(`Placed turret at row ${row}, col ${col}.`);
    }
    render();
  } catch {
    pushFeed(`Action failed at row ${row}, col ${col}.`);
  }
});

spawnBtn.addEventListener("click", spawnSelectedWave);

tickBtn.addEventListener("click", doStep);
playBtn.addEventListener("click", startLoop);
pauseBtn.addEventListener("click", pauseLoop);
simSpeedSelect.addEventListener("change", () => {
  if (!loopId) return;
  pauseLoop();
  startLoop();
});

resetBtn.addEventListener("click", () => {
  stopLoop();
  resetGame(state);
  feed.length = 0;
  pushFeed("Game reset.");
  render();
});

pushFeed("Tip: Click to place turrets. Shift+Click an existing turret tile to upgrade.");
render();
