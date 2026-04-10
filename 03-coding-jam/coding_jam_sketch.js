// let port; // Serial Communication port
// let connectBtn;

// let sensorVal;
// let circleSize = 50;
// let targetSize = 50; // used for Option 2

// function setup() {
//   createCanvas(windowWidth, windowHeight);
//   port = createSerial(); // creates the Serial Port

//   // Connection helpers
//   connectBtn = createButton("Connect to Arduino");
//   connectBtn.position(20, 20);
//   connectBtn.mousePressed(connectBtnClick);
// }

// function draw() {
//   background(100);
//   ellipse(width / 2, height / 2, circleSize);

//   // Receive data from Arduino
//   if (port.opened()) {
//     sensorVal = port.readUntil("\n");
//     // Only log data that has information, not empty signals
//     if (sensorVal[0]) {
//       // Once you verify data is coming in,
//       // disable logging to improve performance
//       console.log(sensorVal);

//       // OPTION 1:
//       // Update circle's size with sensor's data directly
//       // Reduce delay() value in Ardiuno to get smoother changes

//       // use float() to convert from data from string to number
//       circleSize = float(sensorVal);

//       // OPTION 2:
//       // Update circle's size using lerp() to smoothly change values
//       // This method even works with longer delay() values in Arduino

//       targetSize = float(sensorVal);
//       // last value in lerp() controls speed of change
//       circleSize = lerp(circleSize, targetSize, 0.1);
//     }
//   }
// }

// // DO NOT REMOVE THIS FUNCTION
// function connectBtnClick(e) {
//   // If port is not already open, open on click,
//   // otherwise close the port
//   if (!port.opened()) {
//     port.open(9600); // opens port with Baud Rate of 9600
//     e.target.innerHTML = "Disconnect Arduino";
//     e.target.classList.add("connected");
//   } else {
//     port.close();
//     e.target.innerHTML = "Connect to Arduino";
//     e.target.classList.remove("connected");
//   }
// }

let port;
let connectBtn;

let sensorVal = 0;
let lerpVal = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  port = createSerial();
  connectBtn = createButton("Connect to Arduino");
  connectBtn.position(20, 20);
  connectBtn.mousePressed(connectBtnClick);
  
  background(15); // Initialize background
}

function draw() {
  // --- TRAIL EFFECT ---
  fill(15, 30); // Dark background with low alpha for ghosting
  noStroke();
  rect(0, 0, width, height);

  if (port.opened()) {
    let input = port.readUntil("\n");
    if (input) {
      sensorVal = float(input);
    }
  }

  // Smoothing the sensor data
  lerpVal = lerp(lerpVal, sensorVal, 0.08);

  // --- PULSING LOGIC ---
  // Creates a subtle heartbeat effect using a sine wave
  let pulse = sin(frameCount * 0.1) * 10; 

  // --- MAPPING (Matching your Arduino 2-500cm range) ---
  // Near (2cm) = Big, Spiky, Red
  // Far (500cm) = Small, Round, Cyan
  let morphAmount = map(lerpVal, 2, 500, 1, 0, true);
  let baseSize = map(lerpVal, 2, 500, 450, 100, true);
  let finalSize = baseSize + pulse; // Apply the pulse to the size

  // --- COLOR THRESHOLDS ---
  let shapeColor;
  if (lerpVal < 50) {
    shapeColor = color(255, 20, 50); // Aggressive Red (Too Close)
  } else if (lerpVal < 200) {
    // Blends Yellow to Orange based on distance
    let colorMix = map(lerpVal, 50, 200, 0, 1);
    shapeColor = lerpColor(color(255, 255, 0), color(255, 100, 0), colorMix);
  } else {
    shapeColor = color(0, 200, 255); // Calm Cyan (Safe Distance)
  }

  // --- DRAWING THE SUNBURST ---
  push();
  translate(width / 2, height / 2);
  rotate(frameCount * 0.01); // Slow rotation
  
  fill(shapeColor);
  stroke(255, 100); // Faint white outline for definition
  strokeWeight(1);
  
  drawSunburst(0, 0, finalSize, morphAmount);
  pop();
}

/**
 * Draws a sunburst shape
 * @param {number} morph - 1.0 is deep spikes, 0.0 is a circle
 */
function drawSunburst(x, y, radius, morph) {
  let points = 60; // More points for a denser sunburst
  let angle = TWO_PI / points;
  
  // The inner radius pulls in deeper as the object gets closer
  let innerRadius = radius * map(morph, 0, 1, 1, 0.3);

  beginShape();
  for (let i = 0; i < points; i++) {
    let r = (i % 2 === 0) ? radius : innerRadius;
    let currAngle = i * angle;
    let sx = x + cos(currAngle) * r;
    let sy = y + sin(currAngle) * r;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

function connectBtnClick(e) {
  if (!port.opened()) {
    port.open(9600);
    e.target.innerHTML = "Disconnect Arduino";
  } else {
    port.close();
    e.target.innerHTML = "Connect to Arduino";
  }
}