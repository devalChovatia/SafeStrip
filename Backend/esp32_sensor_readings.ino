#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <ArduinoJson.h>

// ==========================
// WiFi + Backend Config
// ==========================
const char* ssid = "BELL508";
const char* password = "493692461512";
const char* backendBaseUrl = "https://safestrip.onrender.com";

// Sensor-reporting device ID
const char* sensorDeviceId = "69b69aa2-9177-438a-bab7-cb4f5da4a82e";

// Relay-control device ID
const char* relayDeviceId = "b2c3bd18-1fd6-4a85-b7c5-20e830f86859";

// Outlet IDs from backend
const char* OUTLET_1_ID = "4c55bc13-ad02-4975-abc7-0b38961eb858";
const char* OUTLET_2_ID = "d1be7829-615d-454e-a84b-1edc63515bab";

// Add these only if your backend actually has outlet 3 and 4
const char* OUTLET_3_ID = "";
const char* OUTLET_4_ID = "";

// ==========================
// Sensor Pins
// ==========================
const int waterPin = 34;
const int gasPin   = 32;
const int tempPin  = 33;

// ==========================
// Relay Pins
// ==========================
#define RELAY1_PIN 13
#define RELAY2_PIN 12
#define RELAY3_PIN 14
#define RELAY4_PIN 25

// ==========================
// ADS1115
// ==========================
Adafruit_ADS1115 ads;

// ==========================
// Thresholds
// ==========================
const int waterThreshold = 3000;
const int smokeThreshold = 1000;
const float overheatThreshold = 35.0;
const int currentRawThreshold = 200;
const bool demoOverCurrent = false;

// ==========================
// Timing
// ==========================
const unsigned long SENSOR_UPLOAD_INTERVAL_MS = 5000;
const unsigned long RELAY_POLL_INTERVAL_MS    = 3000;

unsigned long lastSensorUpload = 0;
unsigned long lastRelayPoll = 0;

// ==========================
// WiFi Connect
// ==========================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed");
  }
}

// ==========================
// Relay Helpers
// ==========================
// Active LOW relays:
// LOW  = ON
// HIGH = OFF

void setAllRelaysOff() {
  digitalWrite(RELAY1_PIN, HIGH);
  digitalWrite(RELAY2_PIN, HIGH);
  digitalWrite(RELAY3_PIN, HIGH);
  digitalWrite(RELAY4_PIN, HIGH);
}

void applyRelayStates(bool outlet1Active, bool outlet2Active, bool outlet3Active, bool outlet4Active) {
  digitalWrite(RELAY1_PIN, outlet1Active ? LOW : HIGH);
  digitalWrite(RELAY2_PIN, outlet2Active ? LOW : HIGH);
  digitalWrite(RELAY3_PIN, outlet3Active ? LOW : HIGH);
  digitalWrite(RELAY4_PIN, outlet4Active ? LOW : HIGH);
}

// Fetches outlet states from backend.
// If you only have 2 outlets in backend, relay 3 and 4 stay OFF.
bool fetchOutletsForDevice(bool& outlet1Active, bool& outlet2Active, bool& outlet3Active, bool& outlet4Active) {
  String url = String(backendBaseUrl) + "/api/device-outlets?device_id=" + relayDeviceId;

  HTTPClient http;
  http.begin(url);

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.print("Relay fetch HTTP error: ");
    Serial.println(httpCode);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<1024> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.print("Relay JSON error: ");
    Serial.println(err.c_str());
    return false;
  }

  if (!doc.is<JsonArray>()) {
    Serial.println("Relay response is not a JSON array");
    return false;
  }

  JsonArray arr = doc.as<JsonArray>();

  bool found1 = false;
  bool found2 = false;
  bool found3 = false;
  bool found4 = false;

  // defaults
  outlet1Active = false;
  outlet2Active = false;
  outlet3Active = false;
  outlet4Active = false;

  for (JsonObject obj : arr) {
    const char* id = obj["id"];
    bool is_active = obj["is_active"] | false;

    if (!id) continue;

    if (strlen(OUTLET_1_ID) > 0 && strcmp(id, OUTLET_1_ID) == 0) {
      outlet1Active = is_active;
      found1 = true;
    } 
    else if (strlen(OUTLET_2_ID) > 0 && strcmp(id, OUTLET_2_ID) == 0) {
      outlet2Active = is_active;
      found2 = true;
    }
    else if (strlen(OUTLET_3_ID) > 0 && strcmp(id, OUTLET_3_ID) == 0) {
      outlet3Active = is_active;
      found3 = true;
    }
    else if (strlen(OUTLET_4_ID) > 0 && strcmp(id, OUTLET_4_ID) == 0) {
      outlet4Active = is_active;
      found4 = true;
    }
  }

  // If outlet 3 and 4 IDs are blank, that's okay.
  bool outlet3Configured = strlen(OUTLET_3_ID) > 0;
  bool outlet4Configured = strlen(OUTLET_4_ID) > 0;

  if (!found1 || !found2) {
    Serial.println("Did not find outlet 1 and/or outlet 2 in response");
  }

  if (outlet3Configured && !found3) {
    Serial.println("Did not find outlet 3 in response");
  }

  if (outlet4Configured && !found4) {
    Serial.println("Did not find outlet 4 in response");
  }

  return found1 && found2 && (!outlet3Configured || found3) && (!outlet4Configured || found4);
}

// ==========================
// POST Helper
// ==========================
void postSensorReading(const String& sensorType, const String& value, const String& unit, const String& rawJson) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping upload.");
    return;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/sensor-readings";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"device_id\":\"" + String(sensorDeviceId) + "\",";
  json += "\"sensor_type\":\"" + sensorType + "\",";
  json += "\"value\":" + value + ",";
  json += "\"unit\":\"" + unit + "\",";
  json += "\"raw\":" + rawJson;
  json += "}";

  int httpCode = http.POST(json);

  Serial.print("POST /sensor-readings (");
  Serial.print(sensorType);
  Serial.print(") -> ");
  Serial.println(httpCode);

  String response = http.getString();
  if (response.length() > 0) {
    Serial.println(response);
  }

  http.end();
}

// ==========================
// Sensor Read + Upload
// ==========================
void readAndUploadSensors() {
  // -------- WATER SENSOR --------
  int waterValue = analogRead(waterPin);
  bool waterDetected = (waterValue < waterThreshold);

  Serial.print("Water Analog value: ");
  Serial.println(waterValue);
  Serial.println(waterDetected ? "Water detected" : "Dry");

  // -------- SMOKE SENSOR --------
  int smokeValue = analogRead(gasPin);
  bool smokeDetected = (smokeValue > smokeThreshold);

  Serial.print("Smoke analog value: ");
  Serial.println(smokeValue);
  Serial.println(smokeDetected ? "Smoke detected" : "No smoke detected");

  // -------- TEMP SENSOR --------
  int tempValue = analogRead(tempPin);
  float voltage = (tempValue / 4095.0f) * 3.3f;
  float temperatureC = voltage * 100.0f;   // LM35 = 10mV/°C
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

  // -------- Upload water --------
  postSensorReading(
    "water",
    String(waterValue),
    "analog",
    String("{\"waterDetected\":") + (waterDetected ? "true" : "false") + "}"
  );

  // -------- Upload temp --------
  postSensorReading(
    "temp",
    String(temperatureC, 2),
    "C",
    String("{\"tempValue\":") + tempValue +
    ",\"temperatureC\":" + String(temperatureC, 2) +
    ",\"overheatDetected\":" + (overheatDetected ? "true" : "false") +
    ",\"threshold\":" + String(overheatThreshold, 2) + "}"
  );

  // -------- Upload current --------
  postSensorReading(
    "current",
    String(currentValue),
    "ads_raw",
    String("{\"currentValue\":") + currentValue +
    ",\"currentVoltage\":" + String(currentVoltage, 4) +
    ",\"overCurrentDetected\":" + (overCurrentDetected ? "true" : "false") +
    ",\"threshold\":" + String(currentRawThreshold) + "}"
  );

  // -------- Upload smoke --------
  postSensorReading(
    "smoke",
    String(smokeValue),
    "analog",
    String("{\"smokeDetected\":") + (smokeDetected ? "true" : "false") +
    ",\"threshold\":" + String(smokeThreshold) + "}"
  );
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Booting combined SafeStrip controller...");

  // Relay init
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(RELAY3_PIN, OUTPUT);
  pinMode(RELAY4_PIN, OUTPUT);
  setAllRelaysOff();

  // I2C + ADS1115 init
  Wire.begin(26, 27);
  delay(100);

  Serial.println("Scanning I2C...");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Found device at 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
    }
  }

  if (!ads.begin(0x48, &Wire)) {
    Serial.println("Failed to initialize ADS1115!");
    while (1);
  }

  ads.setGain(GAIN_TWOTHIRDS);
  Serial.println("ADS1115 initialized.");

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long now = millis();

  // -------- Poll relay states --------
  if (now - lastRelayPoll >= RELAY_POLL_INTERVAL_MS) {
    lastRelayPoll = now;

    if (WiFi.status() == WL_CONNECTED) {
      bool outlet1Active = false;
      bool outlet2Active = false;
      bool outlet3Active = false;
      bool outlet4Active = false;

      bool ok = fetchOutletsForDevice(outlet1Active, outlet2Active, outlet3Active, outlet4Active);

      if (ok) {
        applyRelayStates(outlet1Active, outlet2Active, outlet3Active, outlet4Active);

        Serial.print("Outlet1: ");
        Serial.print(outlet1Active);
        Serial.print(" | Outlet2: ");
        Serial.print(outlet2Active);
        Serial.print(" | Outlet3: ");
        Serial.print(outlet3Active);
        Serial.print(" | Outlet4: ");
        Serial.println(outlet4Active);
      } else {
        Serial.println("Failed to fetch outlet states");
        // Optional: leave current states as-is
      }
    }
  }

  // -------- Upload sensors --------
  if (now - lastSensorUpload >= SENSOR_UPLOAD_INTERVAL_MS) {
    lastSensorUpload = now;
    readAndUploadSensors();
  }
}