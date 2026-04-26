// DM2008 — Mini Project
// FLAPPY BIRD
// by Tarence & Yong Jun Xiong

/* ----------------- Globals ----------------- */
let bird;
let pipes = [];
let bird_img;
let bg_img;
let jumpsound;
let gameOver_img;
let wowSound;
let bgMusic;

let spawnCounter = 0;
const SPAWN_RATE = 90;
const PIPE_SPEED = 2.5;
const PIPE_GAP = 120;
const PIPE_W = 60;

let score = 0;
let highScore = 0;
let newHighScore = false;

// gameState: "start" | "playing" | "gameover"
let gameState = "start";

/* ----------------- Setup & Draw ----------------- */

function preload() {
  bird_img = loadImage("assets/redbird.png");
  bg_img = loadImage("assets/cropped_bg.png");
  jumpsound = loadSound("assets/whoosh.mp3");
  gameOver_img = loadImage("assets/game_over.png");
  wowSound = loadSound("assets/wow_sound.mp3");
  bgMusic = loadSound("assets/flappy_bg_music.mp3");
}

function setup() {
  createCanvas(480, 640);
  noStroke();

  // load saved high score
  let saved = localStorage.getItem("flappyHighScore");
  if (saved) highScore = int(saved);

  bird = new Bird(120, height / 2);
  pipes.push(new Pipe(width + 40));
}

function draw() {
  image(bg_img, 0, 0, width, height);

  if (gameState === "start") {
    drawStartScreen();
  } else if (gameState === "playing") {
    drawGame();
  } else if (gameState === "gameover") {
    // show frozen world behind the overlay
    for (let p of pipes) p.show();
    bird.show();
    drawGameOverScreen();
  }
}

/* ----------------- Screens ----------------- */

function drawStartScreen() {
  // dark overlay
  fill(0, 0, 0, 130);
  rect(0, 0, width, height);

  textAlign(CENTER);

  // title with a yellow drop shadow (very DIY)
  textSize(54);
  textStyle(BOLD);
  fill(180, 130, 0);
  text("FLAPPY BIRD", width / 2 + 3, height / 3 + 3);
  fill(255, 220, 0);
  text("FLAPPY BIRD", width / 2, height / 3);

  // bird sprite
  imageMode(CENTER);
  image(bird_img, width / 2, height / 2 - 10, 80, 80);
  imageMode(CORNER);

  // instructions
  textStyle(NORMAL);
  fill(255);
  textSize(20);
  text("Press SPACE or UP to play", width / 2, height / 2 + 65);

  // best score
  fill(255, 220, 100);
  textSize(17);
  text("Best: " + highScore, width / 2, height / 2 + 100);

  // footer credit
  fill(180);
  textSize(13);
  text("made by Tarence & Yong Jun Xiong  |  DM2008", width / 2, height - 25);
}

function drawGame() {
  bird.update();

  spawnCounter++;
  if (spawnCounter >= SPAWN_RATE) {
    pipes.push(new Pipe(width + 40));
    spawnCounter = 0;
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].update();
    pipes[i].show();

    if (pipes[i].hits(bird)) {
      triggerGameOver();
      return; // stop processing this frame immediately
    }

    if (!pipes[i].passed && bird.pos.x > pipes[i].x + pipes[i].w) {
      pipes[i].passed = true;
      score++;
    }

    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
    }
  }

  if (bird.pos.y >= height - bird.r) {
    triggerGameOver();
    return;
  }

  bird.show();

  // score with black outline so it shows on any background
  textAlign(CENTER);
  textSize(32);
  stroke(0);
  strokeWeight(3);
  fill(255);
  text(score, width / 2, 50);
  noStroke();
}

function drawGameOverScreen() {
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  imageMode(CENTER);
  image(gameOver_img, width / 2, height / 2 - 90, width * 0.75, height / 4.5);
  imageMode(CORNER);

  textAlign(CENTER);
  textStyle(NORMAL);

  fill(255);
  textSize(26);
  text("Score: " + score, width / 2, height / 2 + 5);

  fill(255, 220, 0);
  textSize(22);
  text("Best: " + highScore, width / 2, height / 2 + 40);

  // new high score flash
  if (newHighScore) {
    fill(255, 80, 80);
    textSize(28);
    textStyle(BOLD);
    text("NEW HIGH SCORE!!!", width / 2, height / 2 + 82);
    textStyle(NORMAL);
  }

  fill(200);
  textSize(19);
  text("R  — restart", width / 2, height / 2 + 130);
  text("SPACE  — back to title", width / 2, height / 2 + 158);
}

/* ----------------- Game logic ----------------- */

function triggerGameOver() {
  gameState = "gameover";
  newHighScore = false;

  if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();

  if (wowSound && wowSound.isLoaded()) {
    wowSound.play();
  }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("flappyHighScore", highScore);
    newHighScore = true;
  }
}

function resetGame() {
  score = 0;
  newHighScore = false;
  pipes = [];
  spawnCounter = 0;
  bird = new Bird(120, height / 2);
  pipes.push(new Pipe(width + 40));
  imageMode(CORNER);
}

/* ----------------- Input ----------------- */

function keyPressed() {
  if (gameState === "start") {
    if (key === " " || keyCode === UP_ARROW) {
      if (bgMusic && bgMusic.isLoaded() && !bgMusic.isPlaying()) bgMusic.loop();
      gameState = "playing";
    }
  } else if (gameState === "playing") {
    if (key === " " || keyCode === UP_ARROW) {
      bird.flap();
      jumpsound.play();
    }
  } else if (gameState === "gameover") {
    if (key === "r" || key === "R") {
      resetGame();
      if (bgMusic && bgMusic.isLoaded()) bgMusic.loop();
      gameState = "playing";
    }
    if (key === " ") {
      resetGame();
      if (bgMusic && bgMusic.isLoaded()) bgMusic.loop();
      gameState = "start";
    }
  }
}

/* ----------------- Classes ----------------- */

class Bird {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.r = 16;
    this.gravity = 0.45;
    this.flapStrength = -8.0;
  }

  applyForce(fy) {
    this.acc.y += fy;
  }

  flap() {
    this.vel.y = this.flapStrength;
  }

  update() {
    this.applyForce(this.gravity);
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);

    if (this.pos.y < this.r) {
      this.pos.y = this.r;
      this.vel.y = 0;
    }
    if (this.pos.y > height - this.r) {
      this.pos.y = height - this.r;
      this.vel.y = 0;
    }
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    // tilt up when flapping, nose-dive when falling
    let angle = constrain(this.vel.y * 0.08, -0.5, 1.2);
    rotate(angle);
    imageMode(CENTER);
    image(bird_img, 0, 0, this.r * 3, this.r * 3);
    pop();
  }
}

class Pipe {
  constructor(x) {
    this.x = x;
    this.w = PIPE_W;
    this.speed = PIPE_SPEED;

    const margin = 40;
    const gapY = random(margin, height - margin - PIPE_GAP);
    this.top = gapY;
    this.bottom = gapY + PIPE_GAP;
    this.passed = false;
  }

  update() {
    this.x -= this.speed;
  }

  show() {
    fill(120, 200, 160);
    rect(this.x, 0, this.w, this.top);
    rect(this.x, this.bottom, this.w, height - this.bottom);
  }

  offscreen() {
    return this.x + this.w < 0;
  }

  hits(bird) {
    const withinX =
      bird.pos.x + bird.r > this.x && bird.pos.x - bird.r < this.x + this.w;
    const aboveGap = bird.pos.y - bird.r < this.top;
    const belowGap = bird.pos.y + bird.r > this.bottom;
    return withinX && (aboveGap || belowGap);
  }
}
