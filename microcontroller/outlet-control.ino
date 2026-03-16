#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define RELAY_PIN   4   // GPIO connected to IN1
#define RELAY_PIN_2 5   // GPIO connected to IN2

// WiFi + API config
const char* WIFI_SSID     = "";
const char* WIFI_PASSWORD = "";
const char* BASE_URL      = "https://safestrip.onrender.com";

// Device + outlet IDs in DB (demostrip)
const char* DEVICE_ID   = "b2c3bd18-1fd6-4a85-b7c5-20e830f86859";
const char* OUTLET_1_ID = "4c55bc13-ad02-4975-abc7-0b38961eb858";
const char* OUTLET_2_ID = "d1be7829-615d-454e-a84b-1edc63515bab";

// How often to poll (ms)
const unsigned long POLL_INTERVAL_MS = 3000;
unsigned long lastPoll = 0;

// Fetch both outlets in one call: /api/device-outlets?device_id=...
bool fetchOutletsForDevice(bool& outlet1Active, bool& outlet2Active) {
  String url = String(BASE_URL) + "/api/device-outlets?device_id=" + DEVICE_ID;

  HTTPClient http;
  http.begin(url);  // for HTTPS with self‑signed / shared certs you may need http.setInsecure();
  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_OK) {
    Serial.print("HTTP error: ");
    Serial.println(httpCode);
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  // Expecting JSON array:
  // [
  //   { "id": "...", "device_id": "...", "is_active": true, "outlet_name": "outlet 1" },
  //   { "id": "...", "device_id": "...", "is_active": false, "outlet_name": "outlet 2" }
  // ]
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.print("JSON error: ");
    Serial.println(err.c_str());
    return false;
  }

  if (!doc.is<JsonArray>()) {
    Serial.println("JSON is not an array");
    return false;
  }

  JsonArray arr = doc.as<JsonArray>();
  bool found1 = false;
  bool found2 = false;

  for (JsonObject obj : arr) {
    const char* id = obj["id"];
    bool is_active = obj["is_active"] | false;

    if (!id) continue;

    if (strcmp(id, OUTLET_1_ID) == 0) {
      outlet1Active = is_active;
      found1 = true;
    } else if (strcmp(id, OUTLET_2_ID) == 0) {
      outlet2Active = is_active;
      found2 = true;
    }
  }

  if (!found1 || !found2) {
    Serial.println("Did not find both outlet IDs in response");
  }

  return found1 && found2;
}

void applyRelayStates(bool outlet1Active, bool outlet2Active) {
  // Active LOW relays: LOW = ON, HIGH = OFF
  digitalWrite(RELAY_PIN,   outlet1Active ? LOW : HIGH);
  digitalWrite(RELAY_PIN_2, outlet2Active ? LOW : HIGH);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Booting SafeStrip relay controller...");

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(RELAY_PIN_2, OUTPUT);

  // Default OFF (relays inactive)
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(RELAY_PIN_2, HIGH);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    // Optionally try reconnect logic here
    return;
  }

  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;

    bool outlet1Active = false;
    bool outlet2Active = false;

    bool ok = fetchOutletsForDevice(outlet1Active, outlet2Active);

    if (ok) {
      applyRelayStates(outlet1Active, outlet2Active);

      Serial.print("Outlet 1 active: ");
      Serial.print(outlet1Active);
      Serial.print(" | Outlet 2 active: ");
      Serial.println(outlet2Active);
    } else {
      Serial.println("Failed to fetch outlet states");
    }
  }
}