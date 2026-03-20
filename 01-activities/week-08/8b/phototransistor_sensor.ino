const int lightPin = A1;

void setup() { 
	Serial.begin(9600); 
}

void loop() {
    int luxVal = analogRead(lightPin); // 0..1023, higher = brighter
    Serial.println(luxVal);
    delay(100);
}