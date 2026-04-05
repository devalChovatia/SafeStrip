#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "BELL508";
const char* password = "493692461512";
const char* backendBaseUrl = "https://safestrip.onrender.com";
const char* deviceId = "69b69aa2-9177-438a-bab7-cb4f5da4a82e";

// MQTT
const char* MQTT_HOST     = "79780ac7a4fb4da9bc0a6c5224fbb0cd.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT  = 8883;
const char* MQTT_USER     = "safestrip-local";
const char* MQTT_PASS     = "Safestrip123";

const char* relayDeviceId = "b2c3bd18-1fd6-4a85-b7c5-20e830f86859";
const char* OUTLET_1_ID = "4c55bc13-ad02-4975-abc7-0b38961eb858";
const char* OUTLET_2_ID = "d1be7829-615d-454e-a84b-1edc63515bab";
#outletid
const char* OUTLET_3_ID = "PUT_OUTLET_3_ID_HERE";
const char* OUTLET_4_ID = "PUT_OUTLET_4_ID_HERE";

const int waterPin = 34;
const int gasPin = 32;
const int tempPin = 33;

// Relay pins
#define RELAY_PIN   12
#define RELAY_PIN_2 13
#define RELAY_PIN_3 14
#define RELAY_PIN_4 25

// ADS1115 object
Adafruit_ADS1115 ads;

WiFiClientSecure wifiTls;
PubSubClient mqtt(wifiTls);

bool outlet1Active = false;
bool outlet2Active = false;
bool outlet3Active = false;
bool outlet4Active = false;

const int waterThreshold = 3000;
const int smokeThreshold = 1000;
const float overheatThreshold = 35.0; //change to raw value above 400

// Placeholder threshold for current from ADS1115
const int currentRawThreshold = 200;   // adjust after testing
const bool demoOverCurrent = false;

void applyRelayStates() {
  digitalWrite(RELAY_PIN,   outlet1Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_2, outlet2Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_3, outlet3Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_4, outlet4Active ? LOW : HIGH);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  (void)topic;
  if (length == 0 || length > 512) return;

  char buf[512];
  memcpy(buf, payload, length);
  buf[length] = '\0';

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, buf)) return;

  const char* ev = doc["ev"];
  if (!ev || strcmp(ev, "outlet") != 0) return;

  const char* id = doc["id"];
  if (!id) return;
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

  uint8_t mac[6];
  WiFi.macAddress(mac);
  char clientId[28];
  snprintf(clientId, sizeof(clientId), "safestrip-%02x%02x%02x%02x",
           mac[2], mac[3], mac[4], mac[5]);

  if (!mqtt.connect(clientId, MQTT_USER, MQTT_PASS)) {
    Serial.print("MQTT connect failed, state=");
    Serial.println(mqtt.state());
    return false;
  }

  if (!mqtt.subscribe(topic.c_str())) {
    Serial.println("MQTT subscribe failed");
    mqtt.disconnect();
    return false;
  }

  Serial.println("MQTT connected & subscribed");
  return true;
}

/** Single GET at boot so relays match DB before any new MQTT messages (optional). */
bool syncOutletsFromHttpOnce() {
  String url = String(backendBaseUrl) + "/api/device-outlets?device_id=" + relayDeviceId;
  HTTPClient http;
  http.begin(url);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.print("Boot HTTP sync failed: ");
    Serial.println(code);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, payload) || !doc.is<JsonArray>()) return false;

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

  if (found1 && found2 && found3 && found4) {
    applyRelayStates();
    Serial.println("Boot: synced relays from HTTP");
  }
  return found1 && found2 && found3 && found4;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("hello");

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(RELAY_PIN_2, OUTPUT);
  pinMode(RELAY_PIN_3, OUTPUT);
  pinMode(RELAY_PIN_4, OUTPUT);

  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(RELAY_PIN_2, HIGH);
  digitalWrite(RELAY_PIN_3, HIGH);
  digitalWrite(RELAY_PIN_4, HIGH);

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

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");

  syncOutletsFromHttpOnce();

  if (!connectMqtt()) {
    Serial.println("Will retry MQTT in loop");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    delay(500);
    return;
  }

  if (!mqtt.connected()) {
    delay(1000);
    connectMqtt();
  } else {
    mqtt.loop();
  }

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