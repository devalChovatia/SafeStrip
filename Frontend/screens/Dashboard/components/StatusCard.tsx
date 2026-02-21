import * as React from 'react';
import { View, Text } from 'react-native';

interface StatusCardProps {
  status: string;
  variant: 'safe' | 'warning' | 'danger' | 'neutral';
  activeCount: number;
  totalCount: number;
}

export const StatusCard: React.FC<StatusCardProps> = ({ 
  status, 
  variant, 
  activeCount, 
  totalCount 
}) => {
  const variantStyles = {
    safe: {
      container: 'bg-green-50 border-green-200',
      text: 'text-green-800',
      dot: 'bg-green-500',
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      dot: 'bg-yellow-500',
    },
    danger: {
      container: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      dot: 'bg-red-500',
    },
    neutral: {
      container: 'bg-gray-50 border-gray-200',
      text: 'text-gray-700',
      dot: 'bg-gray-400',
    },
  };

  const styles = variantStyles[variant];

  return (
    <View className={`rounded-2xl border-2 p-6 shadow-lg ${styles.container}`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className={`text-sm font-medium opacity-70 mb-1 ${styles.text}`}>
            System Status
          </Text>
          <Text className={`text-2xl font-bold ${styles.text}`}>
            {status}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className={`w-4 h-4 rounded-full ${styles.dot} shadow-md`} />
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className={`text-sm font-medium opacity-75 ${styles.text}`}>
          {activeCount} of {totalCount}
        </Text>
        <Text className={`text-sm opacity-75 ${styles.text}`}>
          outlets active
        </Text>
      </View>
    </View>
  );
};

export default StatusCard;
