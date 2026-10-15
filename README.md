# Grid Defender

## Description
Grid Defender is a local browser strategy project where you place turrets on a grid to defend your base from wave-based enemies.

## Features
- Tile-based turret placement with credit economy and three turrets: a cheap gun, a long-range sniper that fires every other tick, and frost, which does no damage but slows what it hits
- Wave spawning with per-tick enemy movement
- Turret range and damage simulation; turrets skip enemies already killed that tick
- Tap a turret to see its reach, upgrade it or sell it for 70% of what it cost
- Hover an empty tile to preview where a new turret would reach
- Taps land on the right tile on any screen size
- Base health loss when enemies escape
- Canvas-rendered game board with manual and auto simulation modes
- Adjustable simulation speed and wave size controls
- Event feed with combat summaries (hits, defeated, escaped)
- Game-over handling and full reset flow
- The board is saved in the browser after every move, so a reload or a closed tab picks up where you were

## Run
```bash
cd grid-defender
npm run dev
```
Open the URL `npm run dev` prints.

## Test
```bash
cd grid-defender
npm test
```

## Project Structure
```text
grid-defender/
  index.html
  styles.css
  app.js
  src/
    gameEngine.js
  tests/
    gameEngine.test.js
  package.json
  README.md
```
