import * as React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button, ButtonIcon } from '@/components/ui/button';
import { SettingsIcon } from '@/components/ui/icon';

interface DashboardHeaderProps {
  onSettingsPress?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onSettingsPress,
}) => {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View className="bg-slate-900 border-b border-slate-800 px-4 pt-3.5 pb-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="w-10 h-10 rounded-xl bg-[#2563eb] items-center justify-center shadow-sm shadow-blue-500/40">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M13 2L4 14h6l-3 8 10-12h-6l3-8z"
                fill="white"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View>
            <Text className="text-slate-50 text-[22px] font-bold tracking-wide">
              SafeStrip
            </Text>
            <Text className="text-slate-400 text-xs -mt-0.5">
              Safety overview · {today}
            </Text>
          </View>
        </View>
        {onSettingsPress ? (
          <Button
            variant="link"
            size="sm"
            onPress={onSettingsPress}
            className="p-1 min-w-0"
            accessibilityLabel="Open settings"
          >
            <ButtonIcon as={SettingsIcon} size="xl" className="text-slate-100" />
          </Button>
        ) : null}
      </View>
      <Text className="text-slate-300 text-xs mt-3">
        Monitor rooms, devices, and live outlet risks in one place.
      </Text>
    </View>
  );
};

export default DashboardHeader;
