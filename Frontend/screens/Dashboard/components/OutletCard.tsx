import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Outlet {
  id: number;
  name: string;
  powerOn: boolean;
  temperature: number;
  current: number;
  smokeDetected: boolean;
  waterDetected: boolean;
}

interface OutletCardProps {
  outlet: Outlet;
  onPowerToggle: () => void;
}

interface SensorReadingProps {
  icon: string;
  label: string;
  value: string;
  status: 'normal' | 'warning' | 'danger';
  disabled?: boolean;
}

const SensorReading: React.FC<SensorReadingProps> = ({ 
  icon, 
  label, 
  value, 
  status, 
  disabled 
}) => {
  const statusStyles = {
    normal: 'bg-gray-50 border-gray-200',
    warning: 'bg-yellow-50 border-yellow-300',
    danger: 'bg-red-50 border-red-300',
  };

  const iconStyles = {
    normal: 'text-blue-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  };

  return (
    <View className={`rounded-xl px-3 py-2.5 border ${
      disabled ? 'bg-gray-50 border-gray-200' : statusStyles[status]
    }`}>
      <View className="flex-row items-center gap-2 mb-1.5">
        <Text className={disabled ? 'text-gray-400' : iconStyles[status]}>
          {icon}
        </Text>
        <Text className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
          {label}
        </Text>
      </View>
      <Text className={`text-base font-semibold ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
        {value}
      </Text>
    </View>
  );
};

export const OutletCard: React.FC<OutletCardProps> = ({ outlet, onPowerToggle }) => {
  const hasRisk = outlet.waterDetected || outlet.smokeDetected;
  const hasWarning = outlet.temperature > 40 || outlet.current > 8;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.outletName}>{outlet.name}</Text>
          <Text style={styles.outletState}>
            {outlet.powerOn ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPowerToggle}
          style={[styles.powerButton, outlet.powerOn ? styles.powerOn : styles.powerOff]}
          activeOpacity={0.7}
        >
          <Text style={[styles.powerIcon, outlet.powerOn ? styles.powerIconOn : styles.powerIconOff]}>
            ⏻
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sensor Grid */}
      <View style={styles.sensorWrap}>
        <View style={styles.sensorRow}>
          <View style={styles.sensorCell}>
            <SensorReading
              icon="🌡️"
              label="Temp"
              value={outlet.powerOn ? `${outlet.temperature.toFixed(1)}°C` : '—'}
              status={outlet.temperature > 40 ? 'danger' : outlet.temperature > 35 ? 'warning' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
          
          <View style={styles.sensorCell}>
            <SensorReading
              icon="⚡"
              label="Current"
              value={outlet.powerOn ? `${outlet.current.toFixed(1)} A` : '—'}
              status={outlet.current > 8 ? 'danger' : outlet.current > 6 ? 'warning' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
          
          <View style={styles.sensorCell}>
            <SensorReading
              icon="💨"
              label="Smoke"
              value={outlet.powerOn ? (outlet.smokeDetected ? 'Detected' : 'Normal') : '—'}
              status={outlet.smokeDetected ? 'danger' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
          
          <View style={styles.sensorCell}>
            <SensorReading
              icon="💧"
              label="Water"
              value={outlet.powerOn ? (outlet.waterDetected ? 'Wet' : 'Dry') : '—'}
              status={outlet.waterDetected ? 'danger' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
        </View>

        {/* Alerts */}
        {outlet.powerOn && hasRisk && (
          <View className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <Text className="text-xs font-semibold text-red-700">
              ⚠️ Risk detected - turn off power immediately
            </Text>
          </View>
        )}
        
        {outlet.powerOn && !hasRisk && hasWarning && (
          <View className="mt-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Text className="text-xs font-semibold text-yellow-700">
              ⚠️ Elevated readings detected
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default OutletCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outletName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  outletState: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  powerButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  powerOn: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  powerOff: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  powerIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  powerIconOn: {
    color: '#ffffff',
  },
  powerIconOff: {
    color: '#475569',
  },
  sensorWrap: {
    padding: 16,
  },
  sensorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sensorCell: {
    width: '48%',
  },
});
