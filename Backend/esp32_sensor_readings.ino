#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>


const char* ssid = "BELL508";
const char* password = "493692461512";
const char* backendBaseUrl = "https://safestrip.onrender.com";
// Replace with your device UUID from Supabase
const char* deviceId = "69b69aa2-9177-438a-bab7-cb4f5da4a82e";

const int waterPin = 34;
const int gasPin = 32;
const int tempPin = 33;
const int currentPin = 35;  // Change this if your current sensor uses a different pin

const int waterThreshold = 3000;        // analog below this = water detected
const int smokeThreshold = 1000;        // placeholder threshold for MQ-2
const float overheatThreshold = 60.0;   // LM35 threshold in °C
const int currentRawThreshold = 2600;   // placeholder raw ADC threshold
const bool demoOverCurrent = false;     // set to true during demo if needed




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

  // -------- SMOKE SENSOR --------
  // Read analog value from the smoke sensor
  // The backend supports "smoke" instead of "gas"
  int smokeValue = analogRead(gasPin);
  bool smokeDetected = (smokeValue > smokeThreshold);

  Serial.print("Smoke analog value: ");
  Serial.println(smokeValue);
  if (smokeDetected) {
    Serial.println("Smoke detected");
  } else {
    Serial.println("No smoke detected");
  }

  // -------- TEMP SENSOR --------

int tempValue = analogRead(tempPin);
float voltage = (tempValue / 4095.0) * 3.3;
float temperatureC = voltage * 100.0;   // LM35 = 10mV/°C
bool overheatDetected = (temperatureC > overheatThreshold);


  Serial.print("Temperature raw value: ");
  Serial.println(tempValue);
  Serial.print("Temperature C: ");
  Serial.println(temperatureC);

  if (overheatDetected) {
    Serial.println("Overheat detected");
  } else {
    Serial.println("Temperature normal");
  }

// -------- CURRENT SENSOR --------
// Temporary demo version using raw ADC values only
int currentValue = analogRead(currentPin);
float currentVoltage = (currentValue / 4095.0) * 3.3;

// Safe demo logic:
// - normal mode: compare raw ADC against threshold
// - demo mode: force over-current alert without dangerous testing
bool overCurrentDetected = demoOverCurrent || (currentValue > currentRawThreshold);

Serial.print("Current raw value: ");
Serial.println(currentValue);
Serial.print("Current voltage: ");
Serial.println(currentVoltage);
Serial.print("Over-current detected: ");
Serial.println(overCurrentDetected ? "YES" : "NO");

if (overCurrentDetected) {
  Serial.println("Over-current detected");
} else {
  Serial.println("Current normal");
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


    // -------- TEMPERATURE POST --------
    HTTPClient httpTemp;
    String tempUrl = String(backendBaseUrl) + "/sensor-readings";
    httpTemp.begin(tempUrl);
    httpTemp.addHeader("Content-Type", "application/json");

    String tempJson = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                    + String(q) + "sensor_type" + String(q) + ":" + String(q) + "temp" + String(q) + ","
                    + String(q) + "value" + String(q) + ":" + String(temperatureC) + ","
                    + String(q) + "unit" + String(q) + ":" + String(q) + "C" + String(q) + ","
                    + String(q) + "raw" + String(q) + ":{"
                    + String(q) + "tempValue" + String(q) + ":" + String(tempValue) + ","
                    + String(q) + "temperatureC" + String(q) + ":" + String(temperatureC) + ","
                    + String(q) + "overheatDetected" + String(q) + ":" + (overheatDetected ? "true" : "false") + ","
                    + String(q) + "threshold" + String(q) + ":" + String(overheatThreshold) + "}}";

    int tempCode = httpTemp.POST(tempJson);
    Serial.print("POST /sensor-readings (temp) -> ");
    Serial.println(tempCode);
    httpTemp.end();

    // -------- CURRENT POST --------
HTTPClient httpCurrent;
String currentUrl = String(backendBaseUrl) + "/sensor-readings";
httpCurrent.begin(currentUrl);
httpCurrent.addHeader("Content-Type", "application/json");

// Build JSON payload for current sensor data
String currentJson = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                   + String(q) + "sensor_type" + String(q) + ":" + String(q) + "current" + String(q) + ","
                   + String(q) + "value" + String(q) + ":" + String(currentValue) + ","
                   + String(q) + "unit" + String(q) + ":" + String(q) + "raw_adc" + String(q) + ","
                   + String(q) + "raw" + String(q) + ":{"
                   + String(q) + "currentValue" + String(q) + ":" + String(currentValue) + ","
                   + String(q) + "currentVoltage" + String(q) + ":" + String(currentVoltage) + ","
                   + String(q) + "overCurrentDetected" + String(q) + ":" + (overCurrentDetected ? "true" : "false") + ","
                   + String(q) + "threshold" + String(q) + ":" + String(currentRawThreshold)
                   + "}}";

int currentCode = httpCurrent.POST(currentJson);
Serial.print("POST /sensor-readings (current) -> ");
Serial.println(currentCode);
Serial.println(httpCurrent.getString());
httpCurrent.end();


 // -------- SMOKE POST --------
    HTTPClient httpSmoke;
    String smokeUrl = String(backendBaseUrl) + "/sensor-readings";
    httpSmoke.begin(smokeUrl);
    httpSmoke.addHeader("Content-Type", "application/json");

    String smokeJson = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                    + String(q) + "sensor_type" + String(q) + ":" + String(q) + "smoke" + String(q) + ","
                    + String(q) + "value" + String(q) + ":" + String(smokeValue) + ","
                    + String(q) + "unit" + String(q) + ":" + String(q) + "analog" + String(q) + ","
                    + String(q) + "raw" + String(q) + ":{"
                    + String(q) + "smokeDetected" + String(q) + ":" + (smokeDetected ? "true" : "false") + ","
                    + String(q) + "threshold" + String(q) + ":" + String(smokeThreshold) + "}}";

    int smokeCode = httpSmoke.POST(smokeJson);
    Serial.print("POST /sensor-readings (smoke) -> ");
    Serial.println(smokeCode);
    httpSmoke.end();






  }  else {
    // Print a message if Wi-Fi is disconnected
    Serial.println("WiFi not connected, skipping upload.");
  }
  

  delay(5000);
}
