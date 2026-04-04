#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

const char* ssid = "BELL508";
const char* password = "493692461512";
const char* backendBaseUrl = "https://safestrip.onrender.com";
const char* deviceId = "69b69aa2-9177-438a-bab7-cb4f5da4a82e";

const int waterPin = 34;
const int gasPin = 32;
const int tempPin = 33;

// ADS1115 object
Adafruit_ADS1115 ads;

const int waterThreshold = 3000;
const int smokeThreshold = 1000;
const float overheatThreshold = 35.0; //change to raw value above 400

// Placeholder threshold for current from ADS1115
const int currentRawThreshold = 200;   // adjust after testing
const bool demoOverCurrent = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
   Serial.println("hello");
  // Custom I2C pins
   Wire.begin(26, 27);
  delay(100);
Serial.println("Scanning I2C...");
for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
        Serial.print("Found device at 0x");
        Serial.println(addr, HEX);
    }
}
  if (!ads.begin(0x48, &Wire)) {
    Serial.println("Failed to initialize ADS1115!");
    while (1);
  }

  ads.setGain(GAIN_TWOTHIRDS);

  Serial.println("ADS1115 initialized.");

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
  Serial.println(waterDetected ? "Water detected" : "Dry");

  // -------- SMOKE SENSOR --------
  int smokeValue = analogRead(gasPin);
  bool smokeDetected = (smokeValue > smokeThreshold);

  Serial.print("Smoke analog value: ");
  Serial.println(smokeValue);
  Serial.println(smokeDetected ? "Smoke detected" : "No smoke detected");

  // -------- TEMP SENSOR --------
  int tempValue = analogRead(tempPin);
  float voltage = (tempValue / 4095.0) * 3.3;
  float temperatureC = voltage * 100.0;   // LM35 = 10mV/°C
  bool overheatDetected = (temperatureC > overheatThreshold);

  Serial.print("Temperature raw value: ");
  Serial.println(tempValue);
  Serial.print("Temperature C: ");
  Serial.println(temperatureC);
  Serial.println(overheatDetected ? "Overheat detected" : "Temperature normal");

// -------- CURRENT SENSOR via ADS1115 --------
int16_t minVal = 32767;
int16_t maxVal = -32768;

for (int i = 0; i < 500; i++) {
  int16_t sample = ads.readADC_SingleEnded(0);
  if (sample < minVal) minVal = sample;
  if (sample > maxVal) maxVal = sample;
}

float minVoltage = minVal * 0.1875f / 1000.0f;
float maxVoltage = maxVal * 0.1875f / 1000.0f;

// use the signal swing as your "current activity" value
int16_t currentValue = maxVal - minVal;
float currentVoltage = maxVoltage - minVoltage;

bool overCurrentDetected = demoOverCurrent || (currentValue > currentRawThreshold);

Serial.print("Min ADC: ");
Serial.print(minVal);
Serial.print(" | Max ADC: ");
Serial.print(maxVal);
Serial.print(" | Swing ADC: ");
Serial.println(currentValue);

Serial.print("Min V: ");
Serial.print(minVoltage, 4);
Serial.print(" | Max V: ");
Serial.print(maxVoltage, 4);
Serial.print(" | Swing V: ");
Serial.println(currentVoltage, 4);

Serial.print("Over-current detected: ");
Serial.println(overCurrentDetected ? "YES" : "NO");

  Serial.println("-----------------------------");

  if (WiFi.status() == WL_CONNECTED) {
    char q = char(34);

    // -------- WATER POST --------
    HTTPClient http;
    String url = String(backendBaseUrl) + "/sensor-readings";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

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

    String currentJson = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                       + String(q) + "sensor_type" + String(q) + ":" + String(q) + "current" + String(q) + ","
                       + String(q) + "value" + String(q) + ":" + String(currentValue) + ","
                       + String(q) + "unit" + String(q) + ":" + String(q) + "ads_raw" + String(q) + ","
                       + String(q) + "raw" + String(q) + ":{"
                       + String(q) + "currentValue" + String(q) + ":" + String(currentValue) + ","
                       + String(q) + "currentVoltage" + String(q) + ":" + String(currentVoltage, 4) + ","
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

  } else {
    Serial.println("WiFi not connected, skipping upload.");
  }

  delay(5000);
}

// #include <Wire.h>

// void setup() {
//   Serial.begin(115200);
//   delay(1000);
//   Serial.println("I2C scan starting");
//   Wire.begin(26, 27);
// }

// void loop() {
//   int found = 0;
//   Serial.println("Scanning...");

//   for (byte addr = 1; addr < 127; addr++) {
//     Wire.beginTransmission(addr);
//     if (Wire.endTransmission() == 0) {
//       Serial.print("Found device at 0x");
//       if (addr < 16) Serial.print("0");
//       Serial.println(addr, HEX);
//       found++;
//     }
//   }

//   if (found == 0) {
//     Serial.println("No I2C devices found");
//   }

//   delay(3000);
// }