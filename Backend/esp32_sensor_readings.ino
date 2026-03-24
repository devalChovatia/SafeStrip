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
const int humidityPin = 36;  // Change this if your current sensor uses a different pin

const int waterThreshold = 3000;  // analog below this = water detected (adjust as needed)
const int gasThreshold = 1000;
const int overheatThreshold = 300;

const float currentThreshold = 5.0;  // Placeholder current threshold in Amps
const float humidityThreshold = 60.0;  // Placeholder current threshold in Amps



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

//    // -------- GAS SENSOR --------
//   int gasValue = analogRead(gasPin);
//   bool gasDetected = (gasValue > gasThreshold);
//
//   Serial.print("Gas analog value: ");
//   Serial.println(gasValue);
//   if (gasDetected) {
//     Serial.println("Gas detected");
//   } else {
//     Serial.println("No gas Detected");
//   }
  // -------- SMOKE SENSOR --------
  // Read analog value from the smoke sensor
  // The backend supports "smoke" instead of "gas"
  int gasValue = analogRead(gasPin);
  bool smokeDetected = (gasValue > smokeThreshold);

  Serial.print("Smoke analog value: ");
  Serial.println(gasValue);
  if (smokeDetected) {
    Serial.println("Smoke detected");
  } else {
    Serial.println("No smoke detected");
  }

  // -------- TEMP SENSOR --------

   int tempRaw = analogRead(tempPin);
   float temperatureC = (tempRaw / 4095.0) * 100.0;   // depend on the model of temp sensor we have
  int tempValue =analogRead(tempPin);
  float temperatureC =(tempValue / 4095.0) * 100.0; 
  bool overheatDetected = (tempValue > overheatThreshold);



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
  // Read analog value from the current sensor
  int currentValue = analogRead(currentPin);

  // Placeholder conversion from raw ADC value to current in Amps
  // Update this formula later according to your actual sensor model
  float currentA = (currentValue / 4095.0) * 10.0;
  bool overCurrentDetected = (currentA > currentThreshold);

  Serial.print("Current raw value: ");
  Serial.println(currentValue);
  Serial.print("Current A: ");
  Serial.println(currentA);

  if (overCurrentDetected) {
    Serial.println("Over-current detected");
  } else {
    Serial.println("Current normal");
  }

  // -------- HUMIDITY SENSOR --------
  // Read analog value from the humidity sensor
  int humidityValue = analogRead(humidityPin);

  // Placeholder conversion from raw ADC value to humidity percentage
  // Update this formula later according to your actual sensor model
  float humidityPercent = (humidityValue / 4095.0) * 100.0;
  bool highHumidityDetected = (humidityPercent > humidityThreshold);

  Serial.print("Humidity raw value: ");
  Serial.println(humidityValue);
  Serial.print("Humidity %: ");
  Serial.println(humidityPercent);

  if (highHumidityDetected) {
    Serial.println("High humidity detected");
  } else {
    Serial.println("Humidity normal");
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
    httpCurrent.begin(client, currentUrl);
    httpCurrent.addHeader("Content-Type", "application/json");

    // Build JSON payload for current sensor data
    String currentJson = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                       + String(q) + "sensor_type" + String(q) + ":" + String(q) + "current" + String(q) + ","
                       + String(q) + "value" + String(q) + ":" + String(currentA) + ","
                       + String(q) + "unit" + String(q) + ":" + String(q) + "A" + String(q) + ","
                       + String(q) + "raw" + String(q) + ":{"
                       + String(q) + "currentValue" + String(q) + ":" + String(currentValue) + ","
                       + String(q) + "currentA" + String(q) + ":" + String(currentA) + ","
                       + String(q) + "overCurrentDetected" + String(q) + ":" + (overCurrentDetected ? "true" : "false") + ","
                       + String(q) + "threshold" + String(q) + ":" + String(currentThreshold)
                       + "}}";

    int currentCode = httpCurrent.POST(currentJson);
    Serial.print("POST /sensor-readings (current) -> ");
    Serial.println(currentCode);
    Serial.println(httpCurrent.getString());
    httpCurrent.end();

    // -------- HUMIDITY POST --------
    HTTPClient httpHumidity;
    String humidityUrl = String(backendBaseUrl) + "/sensor-readings";
    httpHumidity.begin(client, humidityUrl);
    httpHumidity.addHeader("Content-Type", "application/json");

    // Build JSON payload for humidity sensor data
    String humidityJson = String("{") + String(q) + "device_id" + String(q) + ":" + String(q) + deviceId + String(q) + ","
                        + String(q) + "sensor_type" + String(q) + ":" + String(q) + "humidity" + String(q) + ","
                        + String(q) + "value" + String(q) + ":" + String(humidityPercent) + ","
                        + String(q) + "unit" + String(q) + ":" + String(q) + "%" + String(q) + ","
                        + String(q) + "raw" + String(q) + ":{"
                        + String(q) + "humidityValue" + String(q) + ":" + String(humidityValue) + ","
                        + String(q) + "humidityPercent" + String(q) + ":" + String(humidityPercent) + ","
                        + String(q) + "highHumidityDetected" + String(q) + ":" + (highHumidityDetected ? "true" : "false") + ","
                        + String(q) + "threshold" + String(q) + ":" + String(humidityThreshold)
                        + "}}";

    int humidityCode = httpHumidity.POST(humidityJson);
    Serial.print("POST /sensor-readings (humidity) -> ");
    Serial.println(humidityCode);
    Serial.println(httpHumidity.getString());
    httpHumidity.end();





  }  else {
    // Print a message if Wi-Fi is disconnected
    Serial.println("WiFi not connected, skipping upload.");
  }
  

  delay(5000);
}
