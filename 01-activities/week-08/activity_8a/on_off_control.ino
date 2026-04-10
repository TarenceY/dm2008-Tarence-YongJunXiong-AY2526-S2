int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);  // LED on
  delay(500);
  digitalWrite(ledPin, LOW);   // LED off
  delay(500);
}