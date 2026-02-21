import * as React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

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
    <View className="bg-white/90 rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between bg-gray-50">
        <View>
          <Text className="font-semibold text-gray-900">{outlet.name}</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {outlet.powerOn ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPowerToggle}
          className={`p-2.5 rounded-xl shadow-md ${
            outlet.powerOn
              ? 'bg-green-500'
              : 'bg-gray-200'
          }`}
          activeOpacity={0.7}
        >
          <Text className={`text-lg ${outlet.powerOn ? 'text-white' : 'text-gray-600'}`}>
            ⏻
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sensor Grid */}
      <View className="p-5">
        <View className="flex-row flex-wrap gap-3">
          <View className="w-[48%]">
            <SensorReading
              icon="🌡️"
              label="Temp"
              value={outlet.powerOn ? `${outlet.temperature.toFixed(1)}°C` : '—'}
              status={outlet.temperature > 40 ? 'danger' : outlet.temperature > 35 ? 'warning' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
          
          <View className="w-[48%]">
            <SensorReading
              icon="⚡"
              label="Current"
              value={outlet.powerOn ? `${outlet.current.toFixed(1)} A` : '—'}
              status={outlet.current > 8 ? 'danger' : outlet.current > 6 ? 'warning' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
          
          <View className="w-[48%]">
            <SensorReading
              icon="💨"
              label="Smoke"
              value={outlet.powerOn ? (outlet.smokeDetected ? 'Detected' : 'Normal') : '—'}
              status={outlet.smokeDetected ? 'danger' : 'normal'}
              disabled={!outlet.powerOn}
            />
          </View>
          
          <View className="w-[48%]">
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
