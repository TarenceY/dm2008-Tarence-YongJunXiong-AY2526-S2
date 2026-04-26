// ── Unimpressed Blob ────────────────────────────────────────────────────────
// DM2008 Final Project
//
// A Minecraft villager-style pixel art creature that reacts to force sensor
// input via Arduino serial. It is extremely unimpressed. Always.
//
// Arduino sends: rawValue,pressType (none/light/hard) at ~20hz
// Force sensor on A0: raw 50-400 = light tap, 401+ = hard press
//
// States: unimpressed → annoyed → overwhelmed → asleep
//         combo (L,L,H) → reluctant_dance → embarrassed → unimpressed

let port; // do not remove or rename port
let serialData;

const sndLight  = new Audio('assets/light_punch.mp3');
const sndHeavy  = new Audio('assets/heavy_punch.mp3');
const sndDead   = new Audio('assets/dead_sound.mp3');
const sndRevive = new Audio('assets/revive_sound.m4a');
const sndShout  = new Audio('assets/shout_sound.mp3');
const sndDance  = new Audio('assets/dance_music.mp3');
const _allSounds = [sndLight, sndHeavy, sndDead, sndRevive, sndShout, sndDance];

const bgMusic = new Audio('assets/final_proj_bg.mp3');
bgMusic.loop   = true;
bgMusic.volume = 0.4;

// Pain sound — decoded via Web Audio API so we can find + clip the loudest part
let _painBuffer    = null;
let _painStartSec  = 0;    // start of loudest region (seconds)
let _painClipSec   = 0.4;  // how many seconds to play
let _painAudioCtx  = null;

function _initPainAudio() {
  _painAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  fetch('assets/pain_sound.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => _painAudioCtx.decodeAudioData(buf))
    .then(decoded => {
      _painBuffer = decoded;
      const ch  = decoded.getChannelData(0);
      const sr  = decoded.sampleRate;
      const win = Math.floor(sr * 0.1); // 100 ms analysis window
      let maxRMS = 0;
      for (let i = 0; i + win < ch.length; i += Math.floor(win / 2)) {
        let sq = 0;
        for (let j = 0; j < win; j++) sq += ch[i + j] * ch[i + j];
        const rms = Math.sqrt(sq / win);
        if (rms > maxRMS) {
          maxRMS = rms;
          // start clip slightly before the peak window
          _painStartSec = Math.max(0, (i - win) / sr);
        }
      }
    })
    .catch(() => {});
}

function playPainSound() {
  if (!_painBuffer || !_painAudioCtx) return;
  try {
    if (_painAudioCtx.state === 'suspended') _painAudioCtx.resume();
    const src = _painAudioCtx.createBufferSource();
    src.buffer = _painBuffer;
    src.connect(_painAudioCtx.destination);
    src.start(0, _painStartSec, _painClipSec);
  } catch (e) {}
}
let _audioUnlocked = false;

function _unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  _allSounds.forEach(s => { s.play().then(() => s.pause()).catch(() => {}); });
  bgMusic.play().catch(() => {});
}

document.addEventListener('keydown', _unlockAudio, { once: false });
document.addEventListener('mousedown', _unlockAudio, { once: false });

function playSound(snd) {
  snd.currentTime = 0;
  snd.play().catch(() => {});
}

let blob;
let combo;
let particles = [];

let lastRaw = 0;
let lastPressType = 'none'; // what the Arduino is currently reporting
let prevPressType = 'none'; // for edge detection (holding ≠ spamming)
let lastRawLog = []; // rolling history of raw values for the graph
const LOG_LEN = 80; // how many samples to keep in the graph
let lastSerialRaw = ''; // the exact string received from Arduino (for debugging)
let hitCount = 0;      // total times handleInput actually fired

// each "art pixel" = P screen pixels. change this to scale the sprite.
const P = 12;

// colour palette — Minecraft villager inspired
const C = {
  dark:  '#3D1F00', // outlines / pupils
  skin:  '#C8A078', // face, hands
  green: '#2D6B2D', // robe
  dkgrn: '#1A4D1A', // robe shadow
  wht:   '#F0EDD8', // eye whites
  pupil: '#1A1A1A', // pupils
  blush: '#E07070', // embarrassed cheeks
  nose:  '#A88060', // slightly darker than skin
};

// colour palette — John Pork skin
const C2 = {
  dark:   '#3D1F00', // outlines (same)
  skin:   '#F2B8B8', // pink pig face
  hoodie: '#4A4A70', // dark grey-blue hoodie
  dkhood: '#333355', // hoodie shadow
  wht:    '#F0EDD8', // eye whites (same)
  pupil:  '#1A1A1A', // pupils (same)
  snout:  '#E89090', // pig snout
  ear:    '#C07878', // floppy pig ears
  blush:  '#E07070', // embarrassed cheeks (same)
};

const NUM_SKINS = 2;

function setup() {
  createCanvas(windowWidth, windowHeight);
  port = createSerial();
  noStroke();

  blob  = new Blob(width / 2, height / 2);
  combo = new ComboTracker();
  _initPainAudio();
}

function draw() {
  background('#1a1a2e');

  // ── Read serial data from Arduino ─────────────────────────────────────────
  // Arduino now sends just the raw number. We classify here so thresholds
  // can be changed without re-uploading the Arduino sketch.
  if (port.opened()) {
    serialData = port.readUntil('\n');
    if (serialData && serialData.length > 0) {
      lastSerialRaw = serialData;
      let raw = int(serialData.trim());
      if (serialData.trim().length > 0) {
        lastRaw = raw;
        lastRawLog.push(raw);
        if (lastRawLog.length > LOG_LEN) lastRawLog.shift();

        // classify here — change these numbers without touching Arduino
        let ptype = 'none';
        if (raw >= 20)  ptype = 'hard';
        else if (raw >= 3) ptype = 'light';
        lastPressType = ptype;

        // rising edge only
        if ((ptype === 'light' || ptype === 'hard') && ptype !== prevPressType) {
          let code = ptype === 'light' ? 'L' : 'H';
          combo.record(code);
          blob.handleInput(ptype);
          if (combo.checkCombo(['L', 'L', 'L', 'H', 'L', 'L'])) {
            blob.triggerDance();
          }
        }
        prevPressType = ptype;
      }
    }
  }

  // ── Particles (draw behind blob) ──────────────────────────────────────────
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  // ── Main creature ─────────────────────────────────────────────────────────
  blob.update();
  blob.draw();

  // ── Debug panel ───────────────────────────────────────────────────────────
  drawDebugPanel();
}

// ── Debug panel — shows sensor status and combo buffer ────────────────────
function drawDebugPanel() {
  let px = 16;
  let py = height - 210;
  let panelW = 310;
  let panelH = 200;

  noStroke();
  fill(0, 0, 0, 170);
  rect(px - 8, py - 8, panelW, panelH, 6);

  textFont('monospace');
  textSize(11);

  // ── connection status
  if (!port.opened()) {
    fill(255, 80, 80);
    text('SERIAL: not connected', px, py + 10);
    fill(180, 180, 180);
    text('state: ' + blob.state, px, py + 28);
    return;
  }

  fill(80, 220, 100);
  text('SERIAL: connected', px, py + 10);

  // ── raw string from Arduino (most useful for diagnosing problems)
  let displayStr = lastSerialRaw.length > 0
    ? JSON.stringify(lastSerialRaw)   // shows \r \n etc
    : '(nothing yet)';
  fill(180, 180, 180);
  text('raw:    ' + displayStr, px, py + 26);

  // ── parsed values
  let typeColor = lastPressType === 'hard'  ? color(255, 100, 80) :
                  lastPressType === 'light' ? color(255, 215, 60) :
                                              color(140, 140, 140);
  fill(typeColor);
  text('parsed: ' + lastRaw + '  → ' + lastPressType, px, py + 42);

  // ── thresholds
  fill(100, 100, 100);
  text('thresholds: <3 none | 3-19 light | 20+ hard', px, py + 58);

  // ── punch diagnostics
  fill(100, 220, 220);
  text('hits:   ' + hitCount + '   punchOffset: ' + nf(blob.punchOffset, 1, 1), px, py + 74);

  // ── blob state + combo buffer
  fill(180, 180, 255);
  text('state:  ' + blob.state, px, py + 90);

  let comboStr = combo.presses.map(p => p.type).join(' ');
  fill(255, 200, 80);
  text('combo:  [' + (comboStr || '—') + ']   need: L L L H L L', px, py + 106);

  // ── rolling graph
  let gx = px;
  let gy = py + 120;
  let gw = panelW - 16;
  let gh = 38;

  fill(25, 25, 35);
  rect(gx, gy, gw, gh, 3);

  // threshold lines on graph
  strokeWeight(1);
  stroke(255, 215, 60, 70);
  let lightY = map(3,  0, 60, gy + gh, gy);
  line(gx, lightY, gx + gw, lightY);
  stroke(255, 100, 80, 70);
  let hardY = map(20, 0, 60, gy + gh, gy);
  line(gx, hardY, gx + gw, hardY);
  noStroke();

  // bars
  let barW = gw / LOG_LEN;
  for (let i = 0; i < lastRawLog.length; i++) {
    let v = lastRawLog[i];
    let col = v >= 20 ? color(255, 100, 80) :
              v >= 3  ? color(255, 215, 60)  :
                        color(70, 70, 100);
    fill(col);
    let bh = map(v, 0, 60, 0, gh); // scale to 0-60 so small values are visible
    rect(gx + i * barW, gy + gh - bh, max(1, barW - 1), bh);
  }

  noStroke();
}

// DO NOT REMOVE THIS FUNCTION
function connectBtnClicked() {
  if (!port.opened()) {
    port.open(9600);
  } else {
    port.close();
  }
}

// keep blob centred when window is resized
function windowResized() {
  if (blob) {
    blob.x = width / 2;
    blob.y = height / 2;
    blob.homeX = width / 2;
    blob.homeY = height / 2;
  }
}

function keyPressed() {
  if (key === 'k' || key === 'K') blob.triggerShot();
  if (key === 'r' || key === 'R') blob.triggerRevive();
  if (key === 'f' || key === 'F') blob.triggerFeed();
  if (key === 'p' || key === 'P') blob.skinIdx = (blob.skinIdx + 1) % NUM_SKINS;
}

function mousePressed() {
  if (blob && blob.containsPoint(mouseX, mouseY)) blob.startDrag(mouseX, mouseY);
}

function mouseDragged() {
  if (blob && blob.isDragging) blob.drag(mouseX, mouseY);
}

function mouseReleased() {
  if (blob && blob.isDragging) blob.release();
}

// ════════════════════════════════════════════════════════════════════════════
//  EYE — animates blinking independently of the other eye
// ════════════════════════════════════════════════════════════════════════════

class Eye {
  constructor() {
    this.openness   = 1.0;
    this.blinkTimer = floor(random(150, 380)); // frames until next blink
    this.isBlinking = false;
    this.blinkF     = 0; // frame within current blink animation
  }

  update() {
    if (!this.isBlinking) {
      this.blinkTimer--;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        this.blinkF     = 0;
      }
    } else {
      this.blinkF++;
      if (this.blinkF <= 6) {
        // closing
        this.openness = map(this.blinkF, 0, 6, 1.0, 0.0);
      } else if (this.blinkF <= 12) {
        // reopening
        this.openness = map(this.blinkF, 6, 12, 0.0, 1.0);
      } else {
        // done blinking — schedule next one
        this.isBlinking = false;
        this.openness   = 1.0;
        this.blinkTimer = floor(random(150, 450));
      }
    }
  }

  // draws this eye. eye box = 2P × 2P, top-left at (ex, ey)
  draw(ex, ey, blobState) {

    if (blobState === 'overwhelmed') {
      // x_x
      fill(C.dark);
      let h = P * 0.45;
      rect(ex,         ey,         h, h);
      rect(ex + P*1.5, ey,         h, h);
      rect(ex + P*0.8, ey + P*0.8, h, h);
      rect(ex,         ey + P*1.5, h, h);
      rect(ex + P*1.5, ey + P*1.5, h, h);
      return;
    }

    if (blobState === 'dead' || blobState === 'reviving') {
      // x_x with a cross shape (bigger, more dramatic)
      fill(C.dark);
      let h = P * 0.5;
      rect(ex,         ey,         h, h);
      rect(ex + P*1.5, ey,         h, h);
      rect(ex + P*0.8, ey + P*0.8, h, h);
      rect(ex,         ey + P*1.5, h, h);
      rect(ex + P*1.5, ey + P*1.5, h, h);
      return;
    }

    if (blobState === 'hurt') {
      fill(C.dark);
      rect(ex,           ey + P * 1.1, P * 2,   P * 0.5); // tight shut line
      rect(ex + P * 0.2, ey + P * 0.6, P * 0.6, P * 0.25); // crinkle left
      rect(ex + P * 1.2, ey + P * 0.6, P * 0.6, P * 0.25); // crinkle right
      // tear drop
      fill(100, 160, 255, 200);
      rect(ex + P * 0.8, ey + P * 1.6, P * 0.4, P * 0.8);
      return;
    }

    if (blobState === 'eating') {
      // happy squint — thin horizontal line
      fill(C.wht);
      rect(ex, ey + P * 0.9, P * 2, P * 0.8);
      fill(C.pupil);
      rect(ex + P * 0.3, ey + P * 1.1, P * 1.4, P * 0.4);
      return;
    }

    if (blobState === 'asleep') {
      fill(C.dark);
      rect(ex, ey + P, P * 2, P * 0.3); // just a thin closed line
      return;
    }

    // normal: white fills from the bottom up based on openness
    // this gives a heavy-lidded unimpressed look at low openness values
    let eyeH = max(2, P * 2 * this.openness);
    fill(C.wht);
    rect(ex, ey + P * 2 - eyeH, P * 2, eyeH);

    if (this.openness > 0.35) {
      fill(C.pupil);
      rect(ex + P * 0.4, ey + P * 2 - eyeH * 0.65, P * 1.2, eyeH * 0.5);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  COMBO TRACKER — records press history and detects sequences
// ════════════════════════════════════════════════════════════════════════════

class ComboTracker {
  constructor() {
    this.presses  = []; // array of { type: 'L'|'H', time }
    this.windowMs = 5000; // 2 second window
  }

  record(type) {
    this.presses.push({ type, time: millis() });
    this._prune();
  }

  _prune() {
    let cutoff = millis() - this.windowMs;
    this.presses = this.presses.filter(p => p.time > cutoff);
  }

  // returns true (and clears buffer) if the last N presses match seq
  checkCombo(seq) {
    this._prune();
    if (this.presses.length < seq.length) return false;

    let tail    = this.presses.slice(-seq.length);
    let matched = tail.every((p, i) => p.type === seq[i]);
    if (matched) {
      this.presses = [];
      return true;
    }
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  PARTICLE — floating zzz, hearts, or sparks drawn with rect()
// ════════════════════════════════════════════════════════════════════════════

class Particle {
  constructor(x, y, type) {
    this.x     = x;
    this.y     = y;
    this.type  = type; // 'zzz' | 'heart' | 'spark'
    this.alpha = 240;
    this.sz    = random(0.7, 1.4); // slight size variation between particles

    if (type === 'zzz') {
      this.vx = random(-0.4, 0.4);
      this.vy = random(-1.1, -0.5);
    } else if (type === 'heart') {
      this.vx = random(-0.8, 0.8);
      this.vy = random(-1.4, -0.7);
    } else if (type === 'chicken') {
      this.vx = random(-1.2, 1.2);
      this.vy = random(-2.5, -1.0);
    } else if (type === 'medplus') {
      this.sz = random(1.0, 1.6);
      this.vx = 0; // caller sets velocity after construction
      this.vy = 0;
    } else { // spark
      let ang = random(TWO_PI);
      let spd = random(2.5, 5);
      this.vx = cos(ang) * spd;
      this.vy = sin(ang) * spd;
    }
  }

  update() {
    this.x     += this.vx;
    this.y     += this.vy;
    this.alpha -= (this.type === 'spark') ? 10 : (this.type === 'chicken') ? 1.5 : (this.type === 'medplus') ? 5 : 2.5;
  }

  isDead() { return this.alpha <= 0; }

  draw() {
    let a = max(0, this.alpha);
    let s = ceil(this.sz * P * 0.5); // 1 art-pixel for this particle

    push();
    translate(this.x, this.y);

    if (this.type === 'zzz') {
      fill(255, 255, 255, a);
      rect(0,     0,   s*3, s); // top bar  ─
      rect(s*2,   s,   s,   s); // diagonal ╲
      rect(s,     s*2, s,   s); //          ╲
      rect(0,     s*3, s*3, s); // bot bar  ─

    } else if (this.type === 'heart') {
      fill(230, 80, 130, a);
      rect(s,   0,   s,   s);   rect(s*3, 0, s, s); // two bumps
      rect(0,   s,   s*5, s);   // wide middle row
      rect(s,   s*2, s*3, s);   // narrowing
      rect(s*2, s*3, s,   s);   // tip

    } else if (this.type === 'chicken') {
      // pixel-art Minecraft chicken
      fill(240, 240, 220, a);   // white body
      rect(s,   s*3, s*4, s*3); // body
      rect(s*2, s,   s*2, s*2); // head
      fill(200, 40, 40, a);     // red comb
      rect(s*2, 0,   s,   s);
      rect(s*3, 0,   s,   s*0.7);
      fill(240, 180, 0, a);     // yellow beak
      rect(s*4, s*1.5, s, s*0.7);
      fill(240, 180, 0, a);     // legs
      rect(s*1.5, s*6, s*0.7, s);
      rect(s*3,   s*6, s*0.7, s);
      fill(200, 200, 190, a);   // wing
      rect(s*1.5, s*3.5, s*2, s*1.5);

    } else if (this.type === 'medplus') {
      fill(220, 40, 40, a);
      let b = ceil(s * 1.1);
      rect(-b * 2, -b * 0.5, b * 4, b);  // horizontal bar
      rect(-b * 0.5, -b * 2, b, b * 4);  // vertical bar

    } else { // spark
      fill(255, 210, 30, a);
      rect(0, 0, s*2, s*2);
    }

    pop();
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  BLOB — the main creature. very unimpressed. please stop touching it.
//
//  Sprite layout (origin = top-left of sprite):
//    rows  0–11  : head (12P wide × 12P tall)
//    rows 12–19  : body (8P wide, offset x+2P) + arms (2P each side)
//  Centered via translate(x - 6P, y - 10P)
// ════════════════════════════════════════════════════════════════════════════

class Blob {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    this.state        = 'unimpressed';
    this.stateTimer   = 0;
    this.stateStartMs = millis();
    this.lastInputTime = millis();
    this.skinIdx      = 0;

    // rapid-press tracking
    this.rapidCount    = 0;
    this.rapidWinStart = millis();

    // animation offsets
    this.shakeX  = 0;
    this.bounceY = 0;
    this.danceF  = 0;

    // punch physics
    this.punchOffset    = 0;   // horizontal slide
    this.punchVelocity  = 0;
    this.punchOffsetY   = 0;   // vertical knockback
    this.punchVelocityY = 0;
    this.punchAngle     = 0;   // slight rotation tilt
    this.punchAngleVel  = 0;
    this.squashX        = 1.0; // squash & stretch
    this.squashY        = 1.0;

    this.leftEye  = new Eye();
    this.rightEye = new Eye();
    // offset right eye so they don't blink in sync
    this.rightEye.blinkTimer += floor(random(40, 90));

    this.zzzTimer = 0;

    // dead / revive
    this.deadOffsetY   = 0;
    this.deadVelocityY = 0;
    this.deadAngle     = 0;
    this.deadAngleTarget = 0;
    this.deadDir       = 1;
    this.deadY         = 0; // vertical slide toward bottom on death
    this.deadYTarget   = 0;

    // throw / bounce
    this.homeX         = x;
    this.homeY         = y;
    this.throwVX       = 0;
    this.throwVY       = 0;
    this.isDragging    = false;
    this.isThrown      = false;
    this.lastThrowTime = 0;
    this.mouseHistory  = [];
    this.dragOffX      = 0;
    this.dragOffY      = 0;
  }

  handleInput(pressType) {
    this.lastInputTime = millis();

    // ignore inputs during these states (but NOT asleep — punches should wake it)
    if (['overwhelmed', 'reluctant_dance', 'embarrassed', 'dead', 'reviving'].includes(this.state)) {
      return;
    }

    if (this.state === 'asleep') {
      // reset rapid count so waking up doesn't accidentally count toward overwhelmed
      this.rapidCount    = 0;
      this.rapidWinStart = millis();
    } else {
      // rapid mashing check — 5 presses within 1.5s = overwhelmed
      let now = millis();
      if (now - this.rapidWinStart > 1500) {
        this.rapidCount    = 0;
        this.rapidWinStart = now;
      }
      this.rapidCount++;
      if (this.rapidCount >= 5) {
        this._setState('overwhelmed');
        this.rapidCount = 0;
        sndShout.currentTime = 0;
        sndShout.play().catch(() => {});
        setTimeout(() => sndShout.pause(), 4000);
        return;
      }
    }

    hitCount++;

    // punch physics — runs whether waking from sleep or already awake
    let dir = random() > 0.5 ? 1 : -1;
    if (pressType === 'hard') {
      playSound(sndHeavy);
      this.punchVelocity  = dir * random(90, 130);
      this.punchVelocityY = random(-22, -15);      // knocked upward
      this.punchAngleVel  = dir * random(0.06, 0.12);
      this.squashX = 0.65; this.squashY = 1.4;    // squash on impact
      for (let i = 0; i < 6; i++) {
        particles.push(new Particle(this.x, this.y - P * 4, 'spark'));
      }
    } else {
      playSound(sndLight);
      this.punchVelocity  = dir * random(40, 60);
      this.punchVelocityY = random(-8, -4);
      this.punchAngleVel  = dir * random(0.02, 0.05);
      this.squashX = 0.85; this.squashY = 1.15;
    }

    this._setState('annoyed');
  }

  triggerShot() {
    if (['dead', 'reviving'].includes(this.state)) return;
    playSound(sndDead);
    this._setState('dead');
    this.deadDir         = random() > 0.5 ? 1 : -1;
    this.deadAngleTarget = HALF_PI * this.deadDir;
    // target Y: slide down so character rests just above the bottom edge
    // when rotated 90°, character extends 6P vertically from centre
    this.deadYTarget = (height - 6 * P - 16) - this.y;
    for (let i = 0; i < 10; i++) {
      particles.push(new Particle(this.x + random(-20, 20), this.y - P * 4, 'spark'));
    }
  }

  triggerRevive() {
    if (this.state !== 'dead') return;
    playSound(sndRevive);
    this._setState('reviving');
  }

  _spawnMedParticles() {
    for (let i = 0; i < 10; i++) {
      let angle = random(TWO_PI);
      let dist  = random(120, 260);
      let px    = this.x + cos(angle) * dist;
      let py    = this.y + sin(angle) * dist;
      let p     = new Particle(px, py, 'medplus');
      let dx    = this.x - px;
      let dy    = this.y - py;
      let mag   = sqrt(dx * dx + dy * dy);
      p.vx = (dx / mag) * random(4, 7);
      p.vy = (dy / mag) * random(4, 7);
      particles.push(p);
    }
  }

  triggerFeed() {
    if (['dead', 'reviving'].includes(this.state)) return;
    this._setState('eating');
    // a few feather puffs as it starts munching
    for (let i = 0; i < 5; i++) {
      particles.push(new Particle(this.x + random(-30, 30), this.y - P * 4, 'spark'));
    }
  }

  triggerDance() {
    if (['asleep', 'overwhelmed', 'dead', 'reviving'].includes(this.state)) return;
    this._setState('reluctant_dance');
    sndDance.currentTime = 0;
    sndDance.play().catch(() => {});
    setTimeout(() => sndDance.pause(), 4000);
  }

  _setState(s) {
    this.state          = s;
    this.stateTimer     = 0;
    this.stateStartMs   = millis();
    this.danceF         = 0;
    this.zzzTimer       = 0;
    if (s !== 'dead' && s !== 'reviving') {
      this.deadAngle       = 0;
      this.deadAngleTarget = 0;
      this.deadOffsetY     = 0;
      this.deadVelocityY   = 0;
      this.deadY           = 0;
      this.deadYTarget     = 0;
    }
  }

  update() {
    this.stateTimer++;
    let now = millis();

    // blinking only happens in calm states
    if (this.state === 'unimpressed' || this.state === 'annoyed') {
      this.leftEye.update();
      this.rightEye.update();
    }

    // auto state transitions
    if (this.state === 'annoyed'          && this.stateTimer > 90)  this._setState('unimpressed');
    if (this.state === 'hurt'             && millis() - this.stateStartMs > 800) this._setState('unimpressed');
    if (this.state === 'overwhelmed'      && millis() - this.stateStartMs > 4000) this._setState('unimpressed');
    if (this.state === 'reluctant_dance'  && millis() - this.stateStartMs > 3000) this._setState('embarrassed');
    if (this.state === 'embarrassed'      && millis() - this.stateStartMs > 2000) this._setState('unimpressed');
    if (this.state === 'eating'           && this.stateTimer > 130) this._setState('unimpressed');

    // fall asleep after 10 seconds of no input
    if ((this.state === 'unimpressed' || this.state === 'annoyed') &&
        now - this.lastInputTime > 20000) {
      this._setState('asleep');
    }

    // horizontal spring
    this.punchVelocity += -this.punchOffset * 0.12;
    this.punchVelocity *= 0.85;
    this.punchOffset   += this.punchVelocity;
    if (abs(this.punchOffset) < 0.5 && abs(this.punchVelocity) < 0.5) {
      this.punchOffset = 0; this.punchVelocity = 0;
    }

    // vertical knockback + gravity
    this.punchVelocityY += 1.6;
    this.punchOffsetY   += this.punchVelocityY;
    if (this.punchOffsetY >= 0) {
      this.punchOffsetY = 0;
      if (this.punchVelocityY > 4) {
        // landing: squash then stretch
        this.squashX = 1.4; this.squashY = 0.65;
        this.punchVelocityY *= -0.22; // tiny bounce
      } else {
        this.punchVelocityY = 0;
      }
    }

    // squash & stretch spring back to 1.0
    this.squashX += (1.0 - this.squashX) * 0.18;
    this.squashY += (1.0 - this.squashY) * 0.18;

    // rotation tilt springs back to upright
    this.punchAngleVel *= 0.88;
    this.punchAngle    += this.punchAngleVel;
    this.punchAngle    *= 0.9;

    // throw / bounce physics
    if (this.isThrown && !this.isDragging) {
      this.x += this.throwVX;
      this.y += this.throwVY;
      this.throwVX *= 0.985;
      this.throwVY *= 0.985;

      const hw = 6 * P, hh = 10 * P;
      let hitH = false, hitV = false;
      if (this.x < hw)          { this.x = hw;          this.throwVX =  abs(this.throwVX) * 0.8; hitH = true; }
      if (this.x > width - hw)  { this.x = width - hw;  this.throwVX = -abs(this.throwVX) * 0.8; hitH = true; }
      if (this.y < hh)          { this.y = hh;           this.throwVY =  abs(this.throwVY) * 0.8; hitV = true; }
      if (this.y > height - hh) { this.y = height - hh; this.throwVY = -abs(this.throwVY) * 0.8; hitV = true; }

      if (hitH || hitV) {
        this.lastThrowTime = millis();
        playPainSound();
        // directional squash on impact
        if      (hitH && !hitV) { this.squashX = 0.45; this.squashY = 1.5;  }
        else if (hitV && !hitH) { this.squashX = 1.5;  this.squashY = 0.45; }
        else                    { this.squashX = 0.6;  this.squashY = 0.6;  }
        // impact sparks burst
        for (let i = 0; i < 14; i++) {
          particles.push(new Particle(this.x, this.y, 'spark'));
        }
        if (!['dead', 'reviving', 'overwhelmed'].includes(this.state)) this._setState('hurt');
      }

      // return home after 5 seconds of no throwing or bouncing
      if (millis() - this.lastThrowTime > 5000) {
        this.x = lerp(this.x, this.homeX, 0.05);
        this.y = lerp(this.y, this.homeY, 0.05);
        if (dist(this.x, this.y, this.homeX, this.homeY) < 1) {
          this.x = this.homeX; this.y = this.homeY;
          this.throwVX = 0;    this.throwVY = 0;
          this.isThrown = false;
        }
      }
    }

    // dead: fall sideways and slide to bottom of screen
    if (this.state === 'dead') {
      this.deadAngle = lerp(this.deadAngle, this.deadAngleTarget, 0.06);
      this.deadY     = lerp(this.deadY, this.deadYTarget, 0.05);
    }

    // reviving: angel float back up to original position
    if (this.state === 'reviving') {
      this.deadAngle = lerp(this.deadAngle, 0, 0.07);
      this.deadY     = lerp(this.deadY, 0, 0.06);
      // angel particles — hearts and sparks drifting upward
      if (frameCount % 12 === 0) {
        particles.push(new Particle(this.x + random(-30, 30), this.y + this.deadY, 'heart'));
      }
      if (frameCount % 8 === 0) {
        particles.push(new Particle(this.x + random(-40, 40), this.y + this.deadY, 'spark'));
      }
      if (abs(this.deadAngle) < 0.05 && abs(this.deadY) < 1) {
        this.deadAngle = 0;
        this.deadY     = 0;
        this._setState('unimpressed');
      }
    }

    // shake offset during overwhelmed state
    this.shakeX = (this.state === 'overwhelmed') ? random(-3, 3) : 0;

    // sparks flying while overwhelmed
    if (this.state === 'overwhelmed' && frameCount % 7 === 0) {
      particles.push(new Particle(
        this.x + random(-30, 30),
        this.y + random(-40, 20),
        'spark'
      ));
    }

    // bouncing + hearts during dance
    if (this.state === 'reluctant_dance') {
      this.danceF++;
      this.bounceY = sin(this.danceF * 0.22) * 8;
      if (frameCount % 24 === 0) {
        particles.push(new Particle(
          this.x + random(-40, 40),
          this.y - P * 8,
          'heart'
        ));
      }
    } else if (this.state === 'eating') {
      this.danceF++;
      this.bounceY = sin(this.danceF * 0.35) * 4;
    } else {
      this.bounceY = 0;
    }

    // zzz particles while sleeping (roughly every 2 seconds)
    if (this.state === 'asleep') {
      this.zzzTimer++;
      if (this.zzzTimer > 115) {
        this.zzzTimer = 0;
        particles.push(new Particle(
          this.x + P * 3 + random(-4, 4),
          this.y - P * 7,
          'zzz'
        ));
      }
    }
  }

  draw() {
    push();
    // translate to sprite centre so rotate/scale pivot looks natural
    translate(
      this.x + this.shakeX + this.punchOffset,
      this.y + this.bounceY + this.punchOffsetY + this.deadY
    );
    rotate(this.punchAngle + this.deadAngle);
    scale(this.squashX, this.squashY);
    // now shift to sprite top-left to draw
    translate(-6 * P, -10 * P);
    this._drawBody();
    this._drawHead();
    pop();
  }

  containsPoint(mx, my) {
    return mx > this.x - 6 * P && mx < this.x + 6 * P &&
           my > this.y - 10 * P && my < this.y + 10 * P;
  }

  startDrag(mx, my) {
    this.isDragging   = true;
    this.isThrown     = false;
    this.throwVX      = 0;
    this.throwVY      = 0;
    this.mouseHistory = [];
    this.dragOffX     = this.x - mx;
    this.dragOffY     = this.y - my;
  }

  drag(mx, my) {
    this.x = mx + this.dragOffX;
    this.y = my + this.dragOffY;
    this.mouseHistory.push({ x: this.x, y: this.y, t: millis() });
    if (this.mouseHistory.length > 6) this.mouseHistory.shift();
  }

  release() {
    this.isDragging    = false;
    this.isThrown      = true;
    this.lastThrowTime = millis();
    if (this.mouseHistory.length >= 2) {
      let a  = this.mouseHistory[0];
      let b  = this.mouseHistory[this.mouseHistory.length - 1];
      let dt = max(16, b.t - a.t) / 1000;
      this.throwVX = constrain((b.x - a.x) / dt, -30, 30);
      this.throwVY = constrain((b.y - a.y) / dt, -30, 30);
    }
  }

  _drawBody() {
    if (this.skinIdx === 1) {
      // John Pork — dark hoodie
      fill(C2.hoodie);
      rect(0,       12 * P, 2 * P, 5 * P);
      rect(10 * P,  12 * P, 2 * P, 5 * P);
      fill(C2.skin);
      rect(0,       16 * P, 2 * P, P);
      rect(10 * P,  16 * P, 2 * P, P);
      fill(C2.dark);
      rect(2 * P, 12 * P, 8 * P, 8 * P);
      fill(C2.hoodie);
      rect(3 * P, 13 * P, 6 * P, 6 * P);
      fill(C2.dkhood);
      rect(3 * P, 13 * P, P, 6 * P);
      rect(8 * P, 13 * P, P, 6 * P);
      return;
    }

    // arms (2P × 5P each side of body)
    fill(C.green);
    rect(0,       12 * P, 2 * P, 5 * P);
    rect(10 * P,  12 * P, 2 * P, 5 * P);

    // tiny skin-coloured hands at the bottom of each arm
    fill(C.skin);
    rect(0,       16 * P, 2 * P, P);
    rect(10 * P,  16 * P, 2 * P, P);

    // body: dark outline then green fill with side shading
    fill(C.dark);
    rect(2 * P, 12 * P, 8 * P, 8 * P);
    fill(C.green);
    rect(3 * P, 13 * P, 6 * P, 6 * P);
    fill(C.dkgrn);
    rect(3 * P, 13 * P, P, 6 * P); // left shadow
    rect(8 * P, 13 * P, P, 6 * P); // right shadow
  }

  _drawHead() {
    if (this.skinIdx === 1) {
      this._drawHeadJohnPork();
      return;
    }

    // head: dark outline then skin fill
    fill(C.dark);
    rect(0, 0, 12 * P, 12 * P);
    fill(C.skin);
    rect(P, P, 10 * P, 10 * P);

    // big chunky nose — the defining feature
    fill(C.nose);
    rect(4 * P, 5 * P, 4 * P, 3 * P);
    fill(C.dark);
    rect(4 * P, 8 * P, 4 * P, P * 0.4); // shadow underneath

    // eyes
    this.leftEye.draw( 2 * P, 3 * P, this.state);
    this.rightEye.draw(8 * P, 3 * P, this.state);

    this._drawBrows();
    this._drawMouth();

    // chicken held at mouth while eating
    if (this.state === 'eating') this._drawChicken();

    // blush marks only when embarrassed
    if (this.state === 'embarrassed') {
      fill(C.blush);
      rect(P,     7 * P, 2 * P, P); // left cheek
      rect(9 * P, 7 * P, 2 * P, P); // right cheek
    }
  }

  _drawHeadJohnPork() {
    // floppy pig ears (behind head outline)
    fill(C2.ear);
    rect(-P,    P, 2 * P, 3 * P); // left ear
    rect(11 * P, P, 2 * P, 3 * P); // right ear

    // head outline + pink face
    fill(C2.dark);
    rect(0, 0, 12 * P, 12 * P);
    fill(C2.skin);
    rect(P, P, 10 * P, 10 * P);

    // pig snout (replaces rectangular nose)
    fill(C2.snout);
    rect(3 * P, 5 * P, 6 * P, 4 * P);
    // highlight for roundness
    fill('#F5C8C8');
    rect(3.5 * P, 5.5 * P, 2 * P, P * 0.4);
    // nostrils
    fill(C2.dark);
    rect(4 * P,   6.5 * P, P, P);
    rect(7 * P,   6.5 * P, P, P);

    // eyes (reuse existing eye logic)
    this.leftEye.draw( 2 * P, 3 * P, this.state);
    this.rightEye.draw(8 * P, 3 * P, this.state);

    this._drawBrows();
    this._drawMouth();

    if (this.state === 'eating') this._drawChicken();

    if (this.state === 'embarrassed') {
      fill(C2.blush);
      rect(P,     7 * P, 2 * P, P);
      rect(9 * P, 7 * P, 2 * P, P);
    }
  }

  _drawChicken() {
    let sc = constrain(map(this.stateTimer, 0, 120, 1.0, 0.0), 0, 1);
    if (sc < 0.05) return;
    let s = max(1, ceil(P * 0.55 * sc));
    let cx = 9 * P;
    let cy = 7 * P;

    fill(240, 240, 220);
    rect(cx + s,   cy + s*3, s*4, s*3); // body
    rect(cx + s*2, cy + s,   s*2, s*2); // head
    fill(200, 40, 40);
    rect(cx + s*2, cy,         s,   s);     // comb
    fill(240, 180, 0);
    rect(cx + s*4, cy + s*1.5, s,   s*0.7); // beak
    rect(cx + s*1.5, cy + s*6, s*0.7, s);   // left leg
    rect(cx + s*3,   cy + s*6, s*0.7, s);   // right leg
    fill(200, 200, 190);
    rect(cx + s*1.5, cy + s*3.5, s*2, s*1.5); // wing
  }

  _drawBrows() {
    fill(C.dark);

    if (this.state === 'annoyed' || this.state === 'overwhelmed') {
      // angry V-shape: outer ends higher, inner ends drop toward nose
      rect(P,      2 * P,   P, P * 0.5);
      rect(2 * P,  2.5 * P, P, P * 0.5);
      rect(3 * P,  3 * P,   P, P * 0.5);

      rect(8 * P,  3 * P,   P, P * 0.5);
      rect(9 * P,  2.5 * P, P, P * 0.5);
      rect(10 * P, 2 * P,   P, P * 0.5);

    } else if (this.state === 'hurt') {
      // inner corners raised — pain / worry expression
      rect(P,      3.5 * P, P, P * 0.5);   // left outer (low)
      rect(2 * P,  2.8 * P, P, P * 0.5);
      rect(3 * P,  2.2 * P, P, P * 0.5);   // left inner (high)
      rect(8 * P,  2.2 * P, P, P * 0.5);   // right inner (high)
      rect(9 * P,  2.8 * P, P, P * 0.5);
      rect(10 * P, 3.5 * P, P, P * 0.5);   // right outer (low)

    } else if (this.state === 'asleep' || this.state === 'dead' || this.state === 'reviving') {
      // lowered, relaxed/drooped brows
      rect(P,     3.5 * P, 3 * P, P * 0.5);
      rect(8 * P, 3.5 * P, 3 * P, P * 0.5);

    } else if (this.state === 'eating') {
      // slightly raised — pleasantly surprised
      rect(P,     1.5 * P, 3 * P, P * 0.5);
      rect(8 * P, 1.5 * P, 3 * P, P * 0.5);

    } else {
      // flat. thoroughly unimpressed brows.
      rect(P,     2 * P, 3 * P, P * 0.5);
      rect(8 * P, 2 * P, 3 * P, P * 0.5);
    }
  }

  _drawMouth() {
    fill(C.dark);

    if (this.state === 'unimpressed' || this.state === 'embarrassed') {
      if (this.skinIdx === 1) {
        // John Pork's signature wide grin
        rect(2 * P,   9.5 * P, P,     P * 0.5); // left corner (lower)
        rect(3 * P,   9 * P,   6 * P, P * 0.5); // smile arc
        rect(9 * P,   9.5 * P, P,     P * 0.5); // right corner (lower)
        fill(C2.wht);
        rect(4 * P,   9.5 * P, 4 * P, P * 0.45); // teeth
        fill(C.dark);
      } else {
        // perfectly flat line. don't talk to it.
        rect(3 * P, 9 * P, 6 * P, P * 0.5);
      }

    } else if (this.state === 'hurt') {
      // wide grimace — stretched mouth, clenched teeth showing
      rect(2 * P,   8.6 * P, 8 * P,   P * 0.45); // upper lip
      rect(2 * P,   9.8 * P, 8 * P,   P * 0.45); // lower lip
      rect(2 * P,   8.6 * P, P * 0.4, P * 1.6);  // left corner pull
      rect(9.6 * P, 8.6 * P, P * 0.4, P * 1.6);  // right corner pull
      fill(C.wht);
      rect(2.5 * P, 9.05 * P, 7 * P,  P * 0.65); // clenched teeth

    } else if (this.state === 'annoyed') {
      // slight frown — centre drops
      rect(3 * P,     9 * P,     2 * P, P * 0.5);
      rect(5 * P,     9.5 * P,   2 * P, P * 0.5);
      rect(7 * P,     9 * P,     2 * P, P * 0.5);

    } else if (this.state === 'overwhelmed') {
      // O mouth — shocked into silence
      rect(4 * P,     8.5 * P, 4 * P,   P * 0.5);          // top
      rect(4 * P,     10 * P,  4 * P,   P * 0.5);          // bottom
      rect(4 * P,     8.5 * P, P * 0.5, 2 * P);            // left wall
      rect(7.5 * P,   8.5 * P, P * 0.5, 2 * P);            // right wall

    } else if (this.state === 'asleep') {
      // small, slightly open
      rect(4 * P, 9.5 * P, 4 * P, P * 0.4);

    } else if (this.state === 'reluctant_dance') {
      // begrudging almost-smile. it's fighting it.
      rect(3 * P, 9.5 * P, 2 * P, P * 0.5); // left — low
      rect(5 * P, 9 * P,   2 * P, P * 0.5); // centre — lifted
      rect(7 * P, 9.5 * P, 2 * P, P * 0.5); // right — low

    } else if (this.state === 'dead' || this.state === 'reviving') {
      // flat drooped — tongue out
      rect(3 * P, 9 * P, 6 * P, P * 0.5);   // flat upper lip
      fill('#E07070');
      rect(4 * P, 9.5 * P, 2 * P, P * 0.8); // little tongue hanging out

    } else if (this.state === 'eating') {
      let mouthOpen = (this.stateTimer % 18) < 9;
      if (mouthOpen) {
        rect(3 * P,   8.5 * P, 6 * P,   P * 0.5); // top lip
        rect(3 * P,   10 * P,  6 * P,   P * 0.5); // bottom lip
        rect(3 * P,   8.5 * P, P * 0.5, 2 * P);   // left wall
        rect(8.5 * P, 8.5 * P, P * 0.5, 2 * P);   // right wall
      } else {
        rect(3 * P, 9 * P, 6 * P, P * 0.5);        // closed chew
      }
    }
  }
}
