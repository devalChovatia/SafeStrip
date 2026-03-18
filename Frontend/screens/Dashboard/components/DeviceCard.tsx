import * as React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/card';
import { Button, ButtonText } from '@/components/ui/button';

interface DeviceCardProps {
  name: string;
  workspaceName: string;
  status?: string | null;
  lastSeenAt?: string | null;
  outletsCount?: number;
  powerUsageW?: number;
  onOpen: () => void;
  onDelete?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  name,
  workspaceName,
  status,
  lastSeenAt,
  outletsCount = 4,
  powerUsageW,
  onOpen,
  onDelete,
}) => {
  const normalized = (status ?? '').toLowerCase();
  const isOnline = normalized === 'online' || normalized === 'active';
  const isWarning = normalized === 'warning' || normalized === 'danger';

  const statusLabel = isWarning ? 'Warning' : isOnline ? 'Active' : 'Inactive';
  const statusPillClass = isWarning
    ? 'bg-rose-600 text-white'
    : isOnline
      ? 'bg-slate-900 text-white'
      : 'bg-slate-200 text-slate-700';

  const leftIndicator = isWarning
    ? { icon: '!', iconColor: 'text-amber-500', bg: 'bg-amber-100' }
    : isOnline
      ? { icon: '✓', iconColor: 'text-emerald-500', bg: 'bg-emerald-100' }
      : { icon: '✕', iconColor: 'text-slate-400', bg: 'bg-slate-200' };

  return (
    <Card className="p-5 mb-3 border-slate-300 bg-white rounded-2xl">
      <View className="gap-3">
        <View className="flex-row items-center flex-1 gap-3">
          <View className={`h-9 w-9 rounded-full items-center justify-center ${leftIndicator.bg}`}>
            <Text className={`text-base font-bold ${leftIndicator.iconColor}`}>{leftIndicator.icon}</Text>
          </View>

          <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-[1px]">
              {workspaceName}
            </Text>
            <Text className="text-slate-900 text-[20px] leading-[26px] font-semibold mt-0.5" numberOfLines={2}>
              {name}
            </Text>

            <View className="flex-row items-center mt-2 gap-2">
              <Text className="text-slate-600 text-base font-medium">{outletsCount} outlets</Text>
              {powerUsageW != null ? (
                <>
                  <Text className="text-slate-300 text-base">•</Text>
                  <Text className="text-slate-600 text-base font-medium">{powerUsageW}W</Text>
                </>
              ) : null}
            </View>
            {lastSeenAt ? (
              <Text className="text-slate-400 text-xs mt-1">Last seen {lastSeenAt}</Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center justify-end gap-2 flex-wrap">
          <View className={`rounded-2xl px-3 py-1 ${statusPillClass}`}>
            <Text className="text-sm font-semibold">{statusLabel}</Text>
          </View>

          <Button
            size="sm"
            className="rounded-2xl bg-slate-950 border border-slate-950 px-4 py-1.5"
            onPress={onOpen}
          >
            <ButtonText className="text-white text-sm font-semibold">
              View Outlets
            </ButtonText>
          </Button>

          {onDelete ? (
            <Pressable onPress={onDelete} className="p-2 rounded-xl active:bg-slate-100" hitSlop={6}>
              <Ionicons name="trash-outline" size={22} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
};

export default DeviceCard;
