#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "GoulburnBoyz";
const char* password = "americanpie2";
const char* backendBaseUrl = "https://safestrip.onrender.com";

// MQTT
const char* MQTT_HOST     = "79780ac7a4fb4da9bc0a6c5224fbb0cd.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT  = 8883;
const char* MQTT_USER     = "safestrip-local";
const char* MQTT_PASS     = "Safestrip123";

const char* relayDeviceId = "b2c3bd18-1fd6-4a85-b7c5-20e830f86859";
const char* OUTLET_1_ID   = "4c55bc13-ad02-4975-abc7-0b38961eb858";
const char* OUTLET_2_ID   = "d1be7829-615d-454e-a84b-1edc63515bab";
const char* OUTLET_3_ID   = "b7c9d401-63da-4c02-b902-a76086267869";
const char* OUTLET_4_ID   = "a7028180-df37-4794-ba27-74ded6a0e96c";

// Forward declarations (implementations are below the global sensor variables).
void publishSensorsMqtt();

// Sensor pins
const int waterPin = 34;
const int gasPin   = 32;
const int tempPin  = 33;

// Relay pins
#define RELAY_PIN   12
#define RELAY_PIN_2 13
#define RELAY_PIN_3 14
#define RELAY_PIN_4 25

// ADS1115
Adafruit_ADS1115 ads;

WiFiClientSecure wifiTls;
PubSubClient mqtt(wifiTls);
WiFiClientSecure wifiTlsHttp;

// Relay states
bool outlet1Active = false;
bool outlet2Active = false;
bool outlet3Active = false;
bool outlet4Active = false;

// Thresholds
const int waterThreshold = 3000;
const int smokeThreshold = 1000;
const float overheatThreshold = 35.0;
const int currentRawThreshold = 200;
const bool demoOverCurrent = false;

// Timing
unsigned long lastSensorPrint = 0;
unsigned long lastUpload = 0;
unsigned long lastMqttReconnectAttempt = 0;
unsigned long lastRelaySync = 0;
unsigned long lastWiFiReconnectAttempt = 0;

const unsigned long sensorInterval = 1000;         // 1 sec
const unsigned long uploadInterval = 10000;        // 10 sec
const unsigned long mqttReconnectInterval = 3000;  // 3 sec
const unsigned long relaySyncInterval = 5000;      // 5 sec backup sync
const unsigned long wifiReconnectInterval = 5000;  // 5 sec

// Latest sensor values
int waterValue = 0;
bool waterDetected = false;

int smokeValue = 0;
bool smokeDetected = false;

int tempValue = 0;
float temperatureC = 0.0;
bool overheatDetected = false;

int16_t minVal = 0;
int16_t maxVal = 0;
int16_t currentValue = 0;
float currentVoltage = 0.0;
bool overCurrentDetected = false;

void publishSensorMqtt(const char* sensorType, float value, const char* unit, JsonObject raw) {
  if (!mqtt.connected()) return;

  String topic = String("safestrip/device/") + relayDeviceId + "/dashboard";

  StaticJsonDocument<512> doc;
  doc["ev"] = "sensor";
  doc["device_id"] = relayDeviceId;
  doc["sensor_type"] = sensorType;
  doc["value"] = value;
  doc["unit"] = unit;
  doc["raw"] = raw;

  char out[512];
  size_t n = serializeJson(doc, out, sizeof(out));
  if (n == 0) return;

  mqtt.publish(topic.c_str(), out, n);
}

void publishSensorsMqtt() {
  if (!mqtt.connected()) return;

  // WATER
  {
    StaticJsonDocument<128> rawDoc;
    rawDoc["waterDetected"] = waterDetected;
    JsonObject raw = rawDoc.as<JsonObject>();
    publishSensorMqtt("water", (float)waterValue, "analog", raw);
  }

  // TEMP
  {
    StaticJsonDocument<192> rawDoc;
    rawDoc["tempValue"] = tempValue;
    rawDoc["temperatureC"] = temperatureC;
    rawDoc["overheatDetected"] = overheatDetected;
    rawDoc["threshold"] = overheatThreshold;
    JsonObject raw = rawDoc.as<JsonObject>();
    publishSensorMqtt("temp", (float)temperatureC, "C", raw);
  }

  // CURRENT (note: value is ads swing raw, not amps)
  {
    StaticJsonDocument<256> rawDoc;
    rawDoc["currentValue"] = currentValue;
    rawDoc["currentVoltage"] = currentVoltage;
    rawDoc["overCurrentDetected"] = overCurrentDetected;
    rawDoc["threshold"] = currentRawThreshold;
    JsonObject raw = rawDoc.as<JsonObject>();
    publishSensorMqtt("current", (float)currentValue, "ads_raw", raw);
  }

  // SMOKE
  {
    StaticJsonDocument<192> rawDoc;
    rawDoc["smokeDetected"] = smokeDetected;
    rawDoc["threshold"] = smokeThreshold;
    JsonObject raw = rawDoc.as<JsonObject>();
    publishSensorMqtt("smoke", (float)smokeValue, "analog", raw);
  }
}

void applyRelayStates() {
  // Active LOW relay board
  digitalWrite(RELAY_PIN,   outlet1Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_2, outlet2Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_3, outlet3Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_4, outlet4Active ? LOW : HIGH);

  Serial.print("Relays applied -> ");
  Serial.print("1:");
  Serial.print(outlet1Active ? "ON " : "OFF ");
  Serial.print("2:");
  Serial.print(outlet2Active ? "ON " : "OFF ");
  Serial.print("3:");
  Serial.print(outlet3Active ? "ON " : "OFF ");
  Serial.print("4:");
  Serial.println(outlet4Active ? "ON" : "OFF");
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (length == 0 || length > 512) {
    Serial.println("MQTT payload invalid length");
    return;
  }

  char buf[513];
  memcpy(buf, payload, length);
  buf[length] = '\0';

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, buf);
  if (err) {
    Serial.print("MQTT JSON parse failed: ");
    Serial.println(err.c_str());
    return;
  }

  const char* ev = doc["ev"];
  if (!ev || strcmp(ev, "outlet") != 0) {
    // Ignore sensor (and other) events on this device subscription topic.
    return;
  }

  // Only outlet commands are logged verbosely.
  Serial.print("MQTT outlet cmd on topic: ");
  Serial.println(topic);

  const char* id = doc["id"];
  if (!id) {
    Serial.println("MQTT missing outlet id");
    return;
  }

  bool is_active = doc["is_active"] | false;

  if (strcmp(id, OUTLET_1_ID) == 0) {
    outlet1Active = is_active;
  } else if (strcmp(id, OUTLET_2_ID) == 0) {
    outlet2Active = is_active;
  } else if (strcmp(id, OUTLET_3_ID) == 0) {
    outlet3Active = is_active;
  } else if (strcmp(id, OUTLET_4_ID) == 0) {
    outlet4Active = is_active;
  } else {
    Serial.println("MQTT outlet id not recognized");
    return;
  }

  applyRelayStates();

  Serial.print("Outlet MQTT: ");
  Serial.print(id);
  Serial.print(" -> ");
  Serial.println(is_active ? "ON" : "OFF");
}

bool connectMqtt() {
  String topic = String("safestrip/device/") + relayDeviceId + "/dashboard";

  wifiTls.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);

  uint8_t mac[6];
  WiFi.macAddress(mac);

  char clientId[32];
  snprintf(clientId, sizeof(clientId), "safestrip-%02x%02x%02x%02x",
           mac[2], mac[3], mac[4], mac[5]);

  Serial.print("Connecting MQTT as client: ");
  Serial.println(clientId);

  if (!mqtt.connect(clientId, MQTT_USER, MQTT_PASS)) {
    Serial.print("MQTT connect failed, state=");
    Serial.println(mqtt.state());
    return false;
  }

  Serial.println("MQTT connected");

  if (!mqtt.subscribe(topic.c_str())) {
    Serial.println("MQTT subscribe failed");
    mqtt.disconnect();
    return false;
  }

  Serial.print("Subscribed to: ");
  Serial.println(topic);

  return true;
}

bool syncOutletsFromHttpOnce() {
  String url = String(backendBaseUrl) + "/api/device-outlets?device_id=" + relayDeviceId;
  HTTPClient http;

  Serial.print("HTTP relay sync -> ");
  Serial.println(url);

  wifiTlsHttp.setInsecure();
  http.begin(wifiTlsHttp, url);
  int code = http.GET();

  if (code != HTTP_CODE_OK) {
    Serial.print("Relay sync failed, code: ");
    Serial.println(code);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<1024> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err || !doc.is<JsonArray>()) {
    Serial.println("Relay sync JSON parse failed");
    return false;
  }

  bool found1 = false, found2 = false, found3 = false, found4 = false;

  for (JsonObject obj : doc.as<JsonArray>()) {
    const char* id = obj["id"];
    if (!id) continue;

    bool is_active = obj["is_active"] | false;

    if (strcmp(id, OUTLET_1_ID) == 0) {
      outlet1Active = is_active;
      found1 = true;
    } else if (strcmp(id, OUTLET_2_ID) == 0) {
      outlet2Active = is_active;
      found2 = true;
    } else if (strcmp(id, OUTLET_3_ID) == 0) {
      outlet3Active = is_active;
      found3 = true;
    } else if (strcmp(id, OUTLET_4_ID) == 0) {
      outlet4Active = is_active;
      found4 = true;
    }
  }

  applyRelayStates();
  Serial.println("Relay states synced from HTTP");

  return found1 && found2 && found3 && found4;
}

void connectWiFiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWiFiReconnectAttempt < wifiReconnectInterval) return;
  lastWiFiReconnectAttempt = now;

  Serial.println("WiFi disconnected. Reconnecting...");
  WiFi.disconnect();
  WiFi.begin(ssid, password);
}

void readSensors() {
  // WATER
  waterValue = analogRead(waterPin);
  waterDetected = (waterValue > waterThreshold);

  // SMOKE
  smokeValue = analogRead(gasPin);
  smokeDetected = (smokeValue > smokeThreshold);

  // TEMP
  tempValue = analogRead(tempPin);
  float voltage = (tempValue / 4095.0f) * 3.3f;
  temperatureC = voltage * 100.0f;   // LM35 assumption
  overheatDetected = (temperatureC > overheatThreshold);

  // CURRENT via ADS1115
  minVal = 32767;
  maxVal = -32768;

  for (int i = 0; i < 100; i++) {
    mqtt.loop(); // keep MQTT responsive during ADC sampling
    int16_t sample = ads.readADC_SingleEnded(0);
    if (sample < minVal) minVal = sample;
    if (sample > maxVal) maxVal = sample;
  }

  float minVoltage = minVal * 0.1875f / 1000.0f;
  float maxVoltage = maxVal * 0.1875f / 1000.0f;

  currentValue = maxVal - minVal;
  currentVoltage = maxVoltage - minVoltage;
  overCurrentDetected = demoOverCurrent || (currentValue > currentRawThreshold);

  // Serial.print("Water Analog value: ");
  // Serial.println(waterValue);
  // Serial.println(waterDetected ? "Water detected" : "Dry");

  Serial.print("Smoke analog value: ");
  Serial.println(smokeValue);
  Serial.println(smokeDetected ? "Smoke detected" : "No smoke detected");

  // Serial.print("Temperature raw value: ");
  // Serial.println(tempValue);
  // Serial.print("Temperature C: ");
  // Serial.println(temperatureC);
  // Serial.println(overheatDetected ? "Overheat detected" : "Temperature normal");

  // Serial.print("Min ADC: ");
  // Serial.print(minVal);
  // Serial.print(" | Max ADC: ");
  // Serial.print(maxVal);
  // Serial.print(" | Swing ADC: ");
  // Serial.println(currentValue);

  // Serial.print("Min V: ");
  // Serial.print(minVoltage, 4);
  // Serial.print(" | Max V: ");
  // Serial.print(maxVoltage, 4);
  // Serial.print(" | Swing V: ");
  // Serial.println(currentVoltage, 4);

  // Serial.print("Over-current detected: ");
  // Serial.println(overCurrentDetected ? "YES" : "NO");

  // Serial.println("-----------------------------");

  // Real-time updates to the app over MQTT (sensorInterval cadence).
  publishSensorsMqtt();
}

void uploadSensors() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping upload.");
    return;
  }

  wifiTlsHttp.setInsecure();
  String url = String(backendBaseUrl) + "/sensor-readings";
  char q = char(34);

  // Sensor readings are device-wide for now (no per-outlet sensor_id assignment).

  // WATER
  {
    HTTPClient http;
    http.begin(wifiTlsHttp, url);
    http.addHeader("Content-Type", "application/json");

    String json = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + relayDeviceId + String(q) + ","
                + String(q) + "sensor_type" + String(q) + ":" + String(q) + "water" + String(q) + ","
                + String(q) + "value" + String(q) + ":" + String(waterValue) + ","
                + String(q) + "unit" + String(q) + ":" + String(q) + "analog" + String(q) + ","
                + String(q) + "raw" + String(q) + ":{"
                + String(q) + "waterDetected" + String(q) + ":" + (waterDetected ? "true" : "false")
                + "}}";

    int code = http.POST(json);
    Serial.print("POST /sensor-readings (water) -> ");
    Serial.println(code);
    http.end();
  }

  mqtt.loop();

  // TEMP
  {
    HTTPClient http;
    http.begin(wifiTlsHttp, url);
    http.addHeader("Content-Type", "application/json");

    String json = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + relayDeviceId + String(q) + ","
                + String(q) + "sensor_type" + String(q) + ":" + String(q) + "temp" + String(q) + ","
                + String(q) + "value" + String(q) + ":" + String(temperatureC, 2) + ","
                + String(q) + "unit" + String(q) + ":" + String(q) + "C" + String(q) + ","
                + String(q) + "raw" + String(q) + ":{"
                + String(q) + "tempValue" + String(q) + ":" + String(tempValue) + ","
                + String(q) + "temperatureC" + String(q) + ":" + String(temperatureC, 2) + ","
                + String(q) + "overheatDetected" + String(q) + ":" + (overheatDetected ? "true" : "false") + ","
                + String(q) + "threshold" + String(q) + ":" + String(overheatThreshold, 2)
                + "}}";

    int code = http.POST(json);
    Serial.print("POST /sensor-readings (temp) -> ");
    Serial.println(code);
    http.end();
  }

  mqtt.loop();

  // CURRENT
  {
    HTTPClient http;
    http.begin(wifiTlsHttp, url);
    http.addHeader("Content-Type", "application/json");

    String json = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + relayDeviceId + String(q) + ","
                + String(q) + "sensor_type" + String(q) + ":" + String(q) + "current" + String(q) + ","
                + String(q) + "value" + String(q) + ":" + String(currentValue) + ","
                + String(q) + "unit" + String(q) + ":" + String(q) + "ads_raw" + String(q) + ","
                + String(q) + "raw" + String(q) + ":{"
                + String(q) + "currentValue" + String(q) + ":" + String(currentValue) + ","
                + String(q) + "currentVoltage" + String(q) + ":" + String(currentVoltage, 4) + ","
                + String(q) + "overCurrentDetected" + String(q) + ":" + (overCurrentDetected ? "true" : "false") + ","
                + String(q) + "threshold" + String(q) + ":" + String(currentRawThreshold)
                + "}}";

    int code = http.POST(json);
    Serial.print("POST /sensor-readings (current) -> ");
    Serial.println(code);
    http.end();
  }

  mqtt.loop();

  // SMOKE
  {
    HTTPClient http;
    http.begin(wifiTlsHttp, url);
    http.addHeader("Content-Type", "application/json");

    String json = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + relayDeviceId + String(q) + ","
                + String(q) + "sensor_type" + String(q) + ":" + String(q) + "smoke" + String(q) + ","
                + String(q) + "value" + String(q) + ":" + String(smokeValue) + ","
                + String(q) + "unit" + String(q) + ":" + String(q) + "analog" + String(q) + ","
                + String(q) + "raw" + String(q) + ":{"
                + String(q) + "smokeDetected" + String(q) + ":" + (smokeDetected ? "true" : "false") + ","
                + String(q) + "threshold" + String(q) + ":" + String(smokeThreshold)
                + "}}";

    int code = http.POST(json);
    Serial.print("POST /sensor-readings (smoke) -> ");
    Serial.println(code);
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("hello");

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(RELAY_PIN_2, OUTPUT);
  pinMode(RELAY_PIN_3, OUTPUT);
  pinMode(RELAY_PIN_4, OUTPUT);

  // Relay OFF initially (active LOW board)
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(RELAY_PIN_2, HIGH);
  digitalWrite(RELAY_PIN_3, HIGH);
  digitalWrite(RELAY_PIN_4, HIGH);

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
    while (1) {
      delay(1000);
    }
  }

  ads.setGain(GAIN_TWOTHIRDS);
  Serial.println("ADS1115 initialized.");

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");

  syncOutletsFromHttpOnce();

  if (!connectMqtt()) {
    Serial.println("Initial MQTT connect failed. Will retry in loop.");
  }
}

void loop() {
  connectWiFiIfNeeded();

  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) {
      unsigned long now = millis();
      if (now - lastMqttReconnectAttempt >= mqttReconnectInterval) {
        lastMqttReconnectAttempt = now;
        Serial.println("Attempting MQTT reconnect...");
        connectMqtt();
      }
    } else {
      mqtt.loop();
    }
  }

  // Keep MQTT responsive
  mqtt.loop();

  unsigned long now = millis();

  // Read and print sensors every 1 second
  if (now - lastSensorPrint >= sensorInterval) {
    lastSensorPrint = now;
    readSensors();
  }

  // Upload sensors every 10 seconds
  if (now - lastUpload >= uploadInterval) {
    lastUpload = now;
    uploadSensors();
  }

  // Backup relay sync every 5 seconds
  if (now - lastRelaySync >= relaySyncInterval) {
    lastRelaySync = now;
    syncOutletsFromHttpOnce();
  }

  delay(20);
}