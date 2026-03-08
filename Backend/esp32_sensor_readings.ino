#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "BELL508";
const char* password = "493692461512";
const char* backendBaseUrl = "https://safestrip.onrender.com";
// Replace with your device UUID from Supabase
const char* deviceId = "69b69aa2-9177-438a-bab7-cb4f5da4a82e";

const int waterPin = 34;
const int gasPin = 32;
const int waterThreshold = 3000;  // analog below this = water detected (adjust as needed)
const int gasThreshold = 800;

void setup() {
  Serial.begin(115200);
  // WiFi.begin(ssid, password);
  // Serial.print("Connecting to WiFi");
  // while (WiFi.status() != WL_CONNECTED) {
  //   delay(500);
  //   Serial.print(".");
  // }
  Serial.println("\nConnected!");
  // Serial.print("IP Address: ");
  // Serial.println(WiFi.localIP());
}

void loop() {
  // -------- WATER SENSOR --------
  int value = analogRead(waterPin);
  bool waterDetected = (value < waterThreshold);
  Serial.print("Water Analog value: ");
  Serial.println(value);
  if (waterDetected) {
    Serial.println("Water detected");
  } else {
    Serial.println("Dry");
  }

   // -------- GAS SENSOR --------
  int gasValue = analogRead(gasPin);
  bool gasDetected = (gasValue > gasThreshold);

  Serial.print("Gas analog value: ");
  Serial.println(gasValue);
  if (gasDetected) {
    Serial.println("Gas detected");
  } else {
    Serial.println("No gas Detected");
  }

  Serial.println("-----------------------------");

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(backendBaseUrl) + "/sensor-readings";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    // Build JSON without " or \" in source (use quote variable)
    char q = char(34);
    String json = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                  + String(q) + "sensor_type" + String(q) + ":" + String(q) + "water" + String(q) + ","
                  + String(q) + "value" + String(q) + ":" + String(value) + ","
                  + String(q) + "unit" + String(q) + ":" + String(q) + "analog" + String(q) + ","
                  + String(q) + "raw" + String(q) + ":{" + String(q) + "waterDetected" + String(q) + ":"
                  + (waterDetected ? "true" : "false") + "}}";

    int httpCode = http.POST(json);
    Serial.print("POST /sensor-readings (water) -> ");
    Serial.println(httpCode);
    http.end();

    // GAS JSON: TODO
    // HTTPClient httpGas;

    // String gasJson = String("{") +
    //   String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + "," +
    //   String(q) + "sensor_type" + String(q) + ":" + String(q) + "gas" + String(q) + "," +
    //   String(q) + "value" + String(q) + ":" + String(gasValue) + "," +
    //   String(q) + "unit" + String(q) + ":" + String(q) + "analog" + String(q) + "}";

    // httpGas.begin(String(backendBaseUrl) + "/sensor-readings");
    // httpGas.addHeader("Content-Type", "application/json");

    // int gasCode = httpGas.POST(gasJson);

    // Serial.print("POST gas -> ");
    // Serial.println(gasCode);

    // httpGas.end();
  }
  

  delay(2000);
}
