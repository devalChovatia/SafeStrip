import * as React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui/card';
import { Button, ButtonText } from '@/components/ui/button';

interface DeviceCardProps {
  name: string;
  workspaceName: string;
  status?: string | null;
  lastSeenAt?: string | null;
  onOpen: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  name,
  workspaceName,
  status,
  lastSeenAt,
  onOpen,
}) => {
  const statusLabel = status ? status.toUpperCase() : 'UNKNOWN';

  return (
    <Card className="p-4 mb-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {workspaceName}
          </Text>
          <Text className="text-slate-900 text-lg font-semibold mt-1">
            {name}
          </Text>
          {lastSeenAt ? (
            <Text className="text-slate-500 text-xs mt-1">
              Last seen {lastSeenAt}
            </Text>
          ) : null}
        </View>
        {status && (
          <View className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
            <Text className="text-[10px] font-semibold text-slate-700">
              {statusLabel}
            </Text>
          </View>
        )}
      </View>

      <Button
        size="sm"
        className="mt-3 self-start"
        onPress={onOpen}
      >
        <ButtonText>View outlets</ButtonText>
      </Button>
    </Card>
  );
};

export default DeviceCard;

