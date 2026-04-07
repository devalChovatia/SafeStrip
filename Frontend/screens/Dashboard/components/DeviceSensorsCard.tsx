import * as React from "react";
import { View, Text, StyleSheet } from "react-native";

export type DeviceSensors = {
  temperature: number | null;
  current: number | null;
  currentUnit: string;
  smokeValue: number | null;
  smokeUnit: string;
  smokeDetected: boolean;
  waterDetected: boolean;
  overheatWarning: boolean;
  currentWarning: boolean;
};

type SensorReadingProps = {
  icon: string;
  label: string;
  value: string;
  status: "normal" | "warning" | "danger";
};

const SensorReading: React.FC<SensorReadingProps> = ({ icon, label, value, status }) => {
  const statusStyles = {
    normal: "bg-gray-50 border-gray-200",
    warning: "bg-yellow-50 border-yellow-300",
    danger: "bg-red-50 border-red-300",
  } as const;

  const iconStyles = {
    normal: "text-blue-600",
    warning: "text-yellow-600",
    danger: "text-red-600",
  } as const;

  return (
    <View className={`rounded-xl px-3 py-2.5 border ${statusStyles[status]}`}>
      <View className="flex-row items-center gap-2 mb-1.5">
        <Text className={iconStyles[status]}>{icon}</Text>
        <Text className="text-xs font-medium text-gray-600">{label}</Text>
      </View>
      <Text className="text-base font-semibold text-gray-900">{value}</Text>
    </View>
  );
};

const formatCurrent = (amps: number, unit: string) => {
  // If backend/device reports in amps, display small values as milliamps for readability.
  if (unit.trim().toLowerCase() === "a" && Math.abs(amps) < 1) {
    const ma = amps * 1000;
    const absMa = Math.abs(ma);
    const decimals = absMa >= 100 ? 0 : absMa >= 10 ? 1 : 2;
    return `${ma.toFixed(decimals)} mA`;
  }

  return `${amps.toFixed(1)} ${unit}`;
};

export const DeviceSensorsCard: React.FC<{ sensors: DeviceSensors }> = ({ sensors }) => {
  const hasRisk = sensors.waterDetected || sensors.smokeDetected;
  const hasWarning = sensors.overheatWarning || sensors.currentWarning;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Sensors</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <SensorReading
              icon="🌡️"
              label="Temp"
              value={sensors.temperature != null ? `${sensors.temperature.toFixed(1)}°C` : "—"}
              status={
                sensors.overheatWarning
                  ? "danger"
                  : sensors.temperature != null && sensors.temperature > 35
                    ? "warning"
                    : "normal"
              }
            />
          </View>

          <View style={styles.cell}>
            <SensorReading
              icon="⚡"
              label="Current"
              value={
                sensors.current != null ? formatCurrent(sensors.current, sensors.currentUnit) : "—"
              }
              status={sensors.currentWarning ? "danger" : "normal"}
            />
          </View>

          <View style={styles.cell}>
            <SensorReading
              icon="💨"
              label="Smoke"
              value={
                sensors.smokeValue != null
                  ? `${sensors.smokeValue.toFixed(0)} ${sensors.smokeUnit}`
                  : "—"
              }
              status={sensors.smokeDetected ? "danger" : "normal"}
            />
          </View>

          <View style={styles.cell}>
            <SensorReading
              icon="💧"
              label="Water"
              value={sensors.waterDetected ? "Wet" : "Dry"}
              status={sensors.waterDetected ? "danger" : "normal"}
            />
          </View>
        </View>

        {hasRisk && (
          <View className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <Text className="text-xs font-semibold text-red-700">
              ⚠️ Risk detected - turn off power immediately
            </Text>
          </View>
        )}

        {!hasRisk && hasWarning && (
          <View className="mt-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Text className="text-xs font-semibold text-yellow-700">⚠️ Elevated readings detected</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  body: {
    padding: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cell: {
    width: "48%",
  },
});

