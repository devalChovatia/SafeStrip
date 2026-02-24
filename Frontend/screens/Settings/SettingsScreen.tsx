import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch } from '@/store';
import { clearAuth } from '@/store/slices/authSlice';
import { supabase } from '@/lib/supabase';
import { Button, ButtonText } from '@/components/ui/button';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  async function signOut() {
    await supabase.auth.signOut();
    dispatch(clearAuth());
  }

  return (
    <View className="flex-1 bg-slate-900">
      <View style={{ paddingTop: insets.top }} className="flex-1">
        {/* Header with explicit back button (icon + label so it's always visible) */}
        <View className="flex-row items-center bg-slate-900 border-b border-slate-700 px-4 py-3">
        <Pressable
          onPress={onBack}
          className="flex-row items-center gap-2 py-2 pr-2 rounded-lg active:bg-slate-800"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Back to dashboard"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={26} color="#f8fafc" />
          <Text className="text-slate-50 text-base font-semibold">Back</Text>
        </Pressable>
        <Text className="text-slate-50 text-xl font-bold flex-1 text-center">
          Settings
        </Text>
        <View className="w-20" />
        </View>

        <ScrollView
          className="flex-1 bg-slate-100"
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
        <View className="mb-6">
          <Text className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-3 px-1">
            Account
          </Text>
          <View className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <View className="p-4 border-b border-slate-100">
              <Text className="text-slate-800 font-semibold text-base">Sign out</Text>
              <Text className="text-slate-500 text-sm mt-0.5">
                Sign out of your account on this device.
              </Text>
            </View>
            <View className="p-4">
              <Button
                action="negative"
                size="md"
                onPress={signOut}
                className="bg-red-500 active:bg-red-600 rounded-lg"
              >
                <ButtonText className="text-white font-semibold">Sign out</ButtonText>
              </Button>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-3 px-1">
            App
          </Text>
          <View className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <View className="p-4">
              <Text className="text-slate-800 font-semibold text-base">SafeStrip</Text>
              <Text className="text-slate-500 text-sm mt-0.5">
                Power strip monitoring and safety.
              </Text>
            </View>
          </View>
        </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default SettingsScreen;
