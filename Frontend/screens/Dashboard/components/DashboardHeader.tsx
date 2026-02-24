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
  return (
    <View className="flex-row items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3.5">
      <View className="flex-row items-center gap-2.5">
        <View className="w-9 h-9 rounded-xl bg-[#2563eb] items-center justify-center">
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
        <Text className="text-slate-50 text-[22px] font-bold tracking-wide">
          SafeStrip
        </Text>
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
  );
};

export default DashboardHeader;
