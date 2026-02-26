import test from "node:test";
import assert from "node:assert/strict";

import { createGame, placeTurret, resetGame, spawnWave, stepGame, upgradeTurret } from "../src/gameEngine.js";

test("placeTurret consumes credits", () => {
  const game = createGame();
  const turret = placeTurret(game, 0, 0);

  assert.equal(game.turrets.length, 1);
  assert.equal(game.credits, 20);
  assert.equal(turret.level, 1);
});

test("upgradeTurret increases level and stats", () => {
  const game = createGame();
  placeTurret(game, 0, 0);
  const upgraded = upgradeTurret(game, 0, 0);

  assert.equal(upgraded.level, 2);
  assert.equal(upgraded.damage, 2);
  assert.equal(upgraded.range, 2.5);
  assert.equal(game.credits, 8);
});

test("enemy escape reduces base health", () => {
  const game = createGame({ rows: 1, cols: 1 });
  game.enemies.push({ row: 0, col: 0, hp: 3 });

  stepGame(game);
  assert.equal(game.baseHealth, 7);
});

test("turrets damage enemies over steps", () => {
  const game = createGame({ rows: 1, cols: 4 });
  placeTurret(game, 0, 1);
  spawnWave(game, 1);

  stepGame(game);
  stepGame(game);
  stepGame(game);

  assert.equal(game.enemies.length <= 1, true);
  assert.equal(game.tick, 3);
});

test("spawnWave includes armored and faster enemies at later waves", () => {
  const game = createGame({ rows: 2, cols: 5 });
  game.wave = 3;
  spawnWave(game, 4);

  const speedy = game.enemies.some((enemy) => enemy.speed === 2);
  const armored = game.enemies.every((enemy) => Number.isFinite(enemy.armor));
  assert.equal(speedy, true);
  assert.equal(armored, true);
});

test("stepGame reports game over when base health reaches zero", () => {
  const game = createGame({ rows: 1, cols: 1 });
  game.baseHealth = 1;
  game.enemies.push({ id: "e", row: 0, col: 0, hp: 2 });

  const summary = stepGame(game);
  assert.equal(summary.gameOver, true);
  assert.equal(game.gameOver, true);
  assert.equal(game.baseHealth, 0);
});

test("resetGame restores initial state", () => {
  const game = createGame();
  placeTurret(game, 0, 0);
  spawnWave(game, 2);
  stepGame(game);
  resetGame(game);

  assert.equal(game.tick, 0);
  assert.equal(game.wave, 0);
  assert.equal(game.turrets.length, 0);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.credits, 30);
});
