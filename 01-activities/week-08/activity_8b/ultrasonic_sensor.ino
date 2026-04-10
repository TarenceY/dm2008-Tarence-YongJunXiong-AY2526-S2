const int ultraPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int duration = analogRead(ultraPin);          // 0..1023
  float distanceCM = (duration * 520.0) / 1023.0; // per DFRobot
  // Optional clamp if you like
  if (distanceCM < 2) distanceCM = 2;
  if (distanceCM > 500) distanceCM = 500;

  Serial.print("Distance: ");
  Serial.print(distanceCM, 1);
  Serial.println(" cm");
  delay(100);
}