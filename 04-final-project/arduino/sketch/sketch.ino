// DM2008 Final Project — Unimpressed Blob
//
// Just sends the raw force sensor reading over Serial at 20hz.
// All threshold classification (light/hard) is handled in p5.js.
//
// Wire: one leg of force sensor to 5V, other leg to A0.
// Put a 10kΩ resistor between A0 and GND (voltage divider).

const int SENSOR_PIN = A0;
unsigned long lastSend = 0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  if (millis() - lastSend >= 50) {
    Serial.println(analogRead(SENSOR_PIN));
    lastSend = millis();
  }
}
