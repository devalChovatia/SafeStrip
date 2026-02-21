import * as React from 'react';
import { View, Text } from 'react-native';

export const DashboardHeader: React.FC = () => {
  return (
    <View className="bg-white/80 border-b border-gray-200/50 px-4 py-5">
      <View className="flex-row items-center justify-center gap-2.5">
        <View className="items-center justify-center w-9 h-9 bg-blue-500 rounded-xl shadow-md">
          <Text className="text-white text-lg">🛡️</Text>
        </View>
        <Text className="text-xl font-semibold text-gray-900">
          SafeStrip
        </Text>
      </View>
    </View>
  );
};

export default DashboardHeader;
