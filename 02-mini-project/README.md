# DM2008 Mini Project — Flappy Bird

**by Tarence & Yong Jun Xiong**

A Flappy Bird clone built with [p5.js](https://p5js.org/) for DM2008.

---

## How to Play

1. Open `DM2008_Mini_Project_(Flappy_Bird)_draft_copy_2026_04_26_08_37_43/index.html` in a browser
2. Press **SPACE** or **UP ARROW** to start
3. Flap through the pipes without hitting them
4. Press **R** to restart after game over, or **SPACE** to return to the title screen

---

## Features

- **Start screen** — title screen with your best score before the game begins
- **Bird rotation** — the bird tilts up when flapping and nose-dives when falling
- **Scoring** — score increases each time you pass a pipe
- **High score** — best score is saved in `localStorage` and persists between sessions
- **Sound effects** — flap sound on jump, wow sound on game over
- **Game over screen** — shows your score, best score, and a "NEW HIGH SCORE" banner if you beat your record

---

## Assets

| File | Description |
|---|---|
| `assets/redbird.png` | Bird sprite |
| `assets/bg.png` | Original background image |
| `assets/cropped_bg.png` | Cropped/scrolling background used in-game |
| `assets/game_over.png` | Game over image |
| `assets/whoosh.mp3` | Flap sound |
| `assets/wow_sound.mp3` | Game over sound |

---

## Controls

| Key | Action |
|---|---|
| SPACE / UP | Flap / Start game |
| R | Restart after game over |
| SPACE | Return to title screen after game over |
