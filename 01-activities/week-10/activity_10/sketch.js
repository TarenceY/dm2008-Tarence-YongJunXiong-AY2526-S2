let colorBtn, sizeSlider, shapeSelect, rotateSlider;
let shapeColor;
let x, y;
let offsetX, offsetY;
let dragging = false;

function setup() {
  createCanvas(640, 400);
  noStroke();
  textFont("Helvetica, Arial, sans-serif");
  angleMode(DEGREES);

  // starting color
  shapeColor = color(random(255), random(255), random(255));

  // Button: change color
  colorBtn = createButton("Change Color");
  colorBtn.position(16, 16);
  colorBtn.mousePressed(randomShapeColor);
  
  function randomShapeColor() {
    shapeColor = color(random(255), random(255), random(255));
  }

  x = width * 0.65;
  y = height * 0.5;

  // Slider: controls size
  createP("Size").position(0, 50).style("margin", "4px 0 0 16px");
  sizeSlider = createSlider(20, 220, 100, 1);
  sizeSlider.position(15, 70);

  // Dropdown: choose shape
  createP("Shape").position(0, 100).style("margin", "8px 0 0 16px");
  shapeSelect = createSelect();
  shapeSelect.position(16, 130);
  shapeSelect.option("ellipse");
  shapeSelect.option("rect");
  shapeSelect.option("triangle");
  
  createP("Rotate Clockwise").position(0, 150).style("margin", "8px 0 0 16px");
  rotateSlider = createSlider(0, 180);
  rotateSlider.position(16,180)
  
}

function draw() {
  background(240);

  push();
  translate(x, y);
  let s = sizeSlider.value();
  let r = rotateSlider.value();

  rotate(r);

  fill(shapeColor);

  // draw chosen shape
  let choice = shapeSelect.value();
  if (choice === "ellipse") {
    ellipse(0, 0, s, s);
  } else if (choice === "rect") {
    rectMode(CENTER);
    rect(0, 0, s, s);
  } else if (choice === "triangle") {
    triangle(-s * 0.6, s * 0.5, 0, -s * 0.6, s * 0.6, s * 0.5);
  }
  pop();
}

function mousePressed() {
  let s = sizeSlider.value();
  let r = rotateSlider.value();
  let dx = mouseX - x;
  let dy = mouseY - y;
  let lx = dx * cos(-r) - dy * sin(-r);
  let ly = dx * sin(-r) + dy * cos(-r);

  let choice = shapeSelect.value();
  let hit = choice === "ellipse" ? sqrt(lx*lx + ly*ly) < s/2
          : choice === "rect"    ? abs(lx) < s/2 && abs(ly) < s/2
          : abs(lx) < s*0.6 && ly > -s*0.6 && ly < s*0.5;

  if (hit) { dragging = true; offsetX = x - mouseX; offsetY = y - mouseY; }
}

function mouseDragged() {
  if (dragging) { x = mouseX + offsetX; y = mouseY + offsetY; }
}

function mouseReleased() {
  dragging = false; 
}