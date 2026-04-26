# Unimpressed Blob
### DM2008 Final Project — Tarence Yong Jun Xiong

---

## Project Overview

**Unimpressed Blob** is an interactive pixel-art creature rendered in a Minecraft-inspired square style. It is based on the gaming meme character Talking Ben — a character famous for being completely uninterested in everything happening around it. The creature reacts to physical force input via an Arduino force sensor, cycling through a series of emotional states depending on how and how often it is hit.

The core concept is deliberate irony: the harder you try to get a reaction, the less it seems to care — until eventually it reaches a breaking point.

---

## Hardware Setup

- **Arduino Uno** with a force-resistive sensor on pin `A0`
- Wiring: force sensor leg to 5V, other leg to A0, with a 10kΩ pull-down resistor between A0 and GND (voltage divider)
- Arduino sends raw analog readings over Serial at 20 Hz (every 50ms)
- **Classification is handled in p5.js**, not Arduino — thresholds can be adjusted without re-uploading firmware

```
Raw value < 3    → none (resting / no contact)
Raw value 3–19   → light tap
Raw value 20+    → hard press
```

---

## System Architecture

The project is organised into four classes plus a main `draw()` loop.

### `Blob` (main creature)
The central class. Manages:
- **State machine** — 10 distinct states with timed auto-transitions
- **Punch physics** — horizontal spring, vertical knockback with gravity, squash & stretch
- **Throw physics** — drag, velocity sampling, wall bounce (AI-assisted)
- **All drawing** via sub-methods `_drawBody()`, `_drawHead()`, `_drawBrows()`, `_drawMouth()`
- **Two skins** — Minecraft Villager and John Pork (pig character)

### `Eye`
Handles independent per-eye blink animation. Each eye has a randomised blink timer so the two eyes never blink in perfect sync. Blink shape changes depending on Blob's current state (squint, X-eyes, tear drop, etc.).

### `ComboTracker`
Maintains a rolling buffer of press inputs (`L` or `H`) within a 5-second time window. When the tail of the buffer matches a target sequence, it fires and clears itself. The combo sequence is `L L L H L L`.

### `Particle`
A lightweight effect class supporting five types: `zzz` (sleep bubbles), `heart`, `spark` (impact flash), `chicken` (food), and `medplus` (revive cross). All drawn with `rect()` to stay consistent with the pixel-art aesthetic.

---

## State Machine

The creature moves through states based on input and time:

```
unimpressed  ←──────────────────────────────────────────────┐
     │                                                       │
     │ any punch                                             │
     ▼                                                       │
  annoyed  ──(90 frames)──────────────────────────────────► │
     │                                                       │
     │ 5 rapid presses within 1.5s                          │
     ▼                                                       │
 overwhelmed  ──(4000ms)─────────────────────────────────► │
                                                             │
unimpressed ──(20s no input)──► asleep                      │
asleep ──(any punch)──────────► unimpressed                 │
                                                             │
combo L L L H L L ──► reluctant_dance ──(3s)──► embarrassed ──(2s)──► │
                                                             │
K key ──► dead  ──(R key)──► reviving ──(angle/pos settled)──► │
F key ──► eating (chewing anim, chicken shrinks) ──(130 frames)──► │
```

---

## Inputs

| Input | Action |
|-------|--------|
| Force sensor (light, 3–19) | Light punch → annoyed, small knockback |
| Force sensor (hard, 20+) | Hard punch → annoyed, big knockback + sparks |
| 5 rapid presses in 1.5s | Overwhelmed state + shout sound |
| Combo: L L L H L L (within 5s) | Triggers reluctant dance |
| `K` key | Kill / death state |
| `R` key | Revive (only from dead state) |
| `F` key | Feed (eating state) |
| `P` key | Cycle skin (Villager ↔ John Pork) |
| Mouse drag + release | Throw the blob — bounces off walls |

---

## Aesthetic Decisions

**Visual language:** Everything is drawn with `rect()` — no curves, no images. This was a deliberate choice inspired by Minecraft's blocky aesthetic, which also made the pixel art more manageable to code. The sprite uses a 12P × 12P head and 8P × 8P body where `P = 12` screen pixels per art pixel, giving a large, readable character at any screen size.

**Colour palettes:**
- *Villager skin:* warm browns, muted green robe with shadow, off-white eyes — familiar, approachable
- *John Pork skin:* pink pig face, floppy ears, pig snout with nostrils, dark hoodie — an internet meme character reinterpreted in the same pixel grid

**Expressiveness through facial components:** Rather than animating the whole sprite, all emotional communication is carried by the brows, mouth, and eyes alone — mirroring how cartoons convey emotion with minimal shapes. The "unimpressed" default is deliberately flat: half-lidded eyes, perfectly horizontal brows, a straight line for a mouth.

**Sound design:** Each state transition has a matching sound. Light taps get a soft punch; hard hits get a heavier impact. The "overwhelmed" state fires a shout. Dance triggers a short music clip. Death, revive, and pain-on-wall-bounce each have their own audio. The pain sound is decoded via the Web Audio API and clipped to the loudest 0.4 seconds automatically.

**Particles:** Sleep emits `zzz` glyphs. Dance spawns hearts. Hard punches and wall bounces produce yellow sparks. The revive sequence floats hearts upward. Each type is pixel-art consistent — drawn with `rect()` in the same 12px grid.

---

## Development Iteration

### Early State Machine
The initial version had a simpler state machine with fewer states. The overwhelmed and reluctant_dance states were added in later iterations once the basic punch-and-react loop was working.

### Combo Design
The original combo trigger was shorter and triggered too easily during normal use — it activated accidentally during regular punching sessions. The sequence was lengthened and rebalanced to `L L L H L L`: a deliberate mix of light and hard inputs that requires the user to intentionally vary their technique. This made the payoff feel earned rather than accidental.

### Force Threshold Tuning
The threshold between light and hard presses was originally handled on the Arduino side. During testing with the real force sensor, this made adjusting thresholds require a firmware re-upload each time. The classification logic was moved entirely into p5.js so calibration could happen during the same session. The value of 20 was settled on after physical testing — below 20, inputs reliably registered as light taps; 20 and above consistently corresponded to deliberate hard presses.

### Throw Mechanic
Mouse drag-and-throw was added as an additional interaction layer with AI assistance (both the drag offset calculation and the wall-bounce physics). The blob samples the last 6 mouse positions on release to calculate throw velocity, then bounces off all four walls with damping, triggering a squash effect and pain sound on each impact.

### Second Skin
The Villager skin came first. John Pork was added later as an alternate skin accessible via the `P` key. Since the face structure (brows, eyes, mouth) is shared between skins, the second skin only required overriding the nose/snout area and body colours — a good test of how modular the drawing code had become.

### Eating State
The feeding interaction was a planned feature that made it into the final build. Pressing `F` triggers the eating state: the blob's eyes squint into a happy expression, its brows raise slightly, and it bobs up and down while chewing. A pixel-art Minecraft chicken appears at the side of its mouth and visually shrinks over 130 frames as it gets eaten — the chicken is drawn entirely with `rect()` to match the overall aesthetic. The mouth alternates between open and closed every 9 frames to sell the chewing action. After 130 frames the blob returns to its baseline unimpressed state.

### What Did Not Make It
The original plan included a projectile mechanic where food items could be physically thrown at the blob. That throwing-food interaction was cut for time — what shipped instead is the direct `F` key trigger, which still delivers the full eating animation without the throwing layer.

---

## Reflection

### A) Concept & Intent
Unimpressed Blob is a punching toy built around a character that refuses to be impressed. The experience I wanted to create was one of escalating provocation — the user hits harder and more repeatedly trying to get a genuine reaction, but the blob stays indifferent until pushed far enough. The inspiration was Talking Ben, a mobile game character famous for ignoring the player. The Minecraft visual style was chosen because its blocky geometry maps directly to code — every facial expression is a handful of rectangles.

### B) Interaction Logic
The primary input is an Arduino force sensor that distinguishes light taps from hard presses based on raw analog value (threshold: 20). The sensor sends raw readings at 20 Hz; p5.js classifies them on the fly. Secondary inputs include keyboard shortcuts for death, revive, feed, and skin change, and mouse drag-and-release for throwing. Each input type triggers a different Blob method, affecting physics velocity, state transitions, and particle effects.

### C) Technical Structure
The project uses four classes: `Blob` (the creature, state machine, all physics and drawing), `Eye` (independent blink animation per eye), `ComboTracker` (rolling input buffer with time window), and `Particle` (pooled effect objects). The main `draw()` loop reads serial data, calls `blob.update()` and `blob.draw()`, and iterates the particle array. All drawing uses `rect()` exclusively to stay consistent with the pixel-art style.

### D) Behavior Over Time
The system has significant temporal depth. The creature falls asleep after 20 seconds of inactivity and must be woken by a punch. It escalates from unimpressed → annoyed → overwhelmed based on input rate. The combo system requires a specific sequence of light and hard inputs within a 5-second window, rewarding patient, deliberate interaction with the dance state. After dancing, embarrassment follows automatically before returning to baseline. Death and revive are persistent states that only exit through user action.

### E) Aesthetic Decisions
Every visual element uses `rect()` — no ellipses, images, or curves. The 12-pixel grid per art pixel gives the character weight and readability at full-screen size. Sound reinforces each state: separate audio clips for light hits, heavy hits, overwhelmed shouts, dance music, death, revive, and wall-bounce pain. The pain sound is automatically clipped to its loudest 0.4 seconds. Particle types (zzz, hearts, sparks, pixel chicken) are each built from rectangles and fit the overall blocky language. The two skins share the same emotional expression system — only the cosmetic layer differs — keeping the aesthetic coherent across both.

### F) Iteration & Challenges
The most significant challenge was the combo detection timing. An earlier version triggered the combo too easily — short sequences activated during normal punching. The solution involved two changes: lengthening the sequence to six inputs (`L L L H L L`) and adding a rising-edge check so holding a press down does not keep registering as new inputs. The time window was also extended to 5 seconds to give users a realistic chance to complete the sequence intentionally. The force threshold was moved from Arduino firmware to p5.js mid-development after realising that re-uploading to adjust sensitivity during testing was too slow — having it in JavaScript meant thresholds could be changed and tested in the same browser session without touching the hardware.
