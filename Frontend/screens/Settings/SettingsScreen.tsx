import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearAuth } from '@/store/slices/authSlice';
import { supabase } from '@/lib/supabase';
import { Button, ButtonText, ButtonSpinner } from '@/components/ui/button';
import { fetchProfile, upsertProfile, type Profile } from '@/services/api/profilesApi';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.auth.user);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);

  const hasDisplayName = Boolean(profile?.display_name?.trim());
  const displayLabel =
    profile?.display_name?.trim() ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    null;

  useEffect(() => {
    if (!user?.id) return;
    fetchProfile(user.id).then(setProfile).catch(() => setProfile(null));
  }, [user?.id]);

  async function saveDisplayName() {
    if (!user?.id || !displayNameInput.trim()) return;
    setDisplayNameSaving(true);
    try {
      const updated = await upsertProfile(user.id, displayNameInput.trim());
      setProfile(updated);
      setDisplayNameModalOpen(false);
      setDisplayNameInput('');
    } catch {
      // Could add error state
    } finally {
      setDisplayNameSaving(false);
    }
  }

  function openDisplayNameModal() {
    setDisplayNameInput(profile?.display_name?.trim() ?? '');
    setDisplayNameModalOpen(true);
  }

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
        {/* Profile */}
        <View className="mb-6">
          <Text className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-3 px-1">
            Profile
          </Text>
          <View className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <View className="p-4 flex-row items-center gap-4">
              <View className="h-14 w-14 rounded-full bg-slate-300 items-center justify-center">
                <Ionicons name="person" size={28} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-800 font-semibold text-base">
                  {displayLabel ?? 'User'}
                </Text>
                <Text className="text-slate-500 text-sm mt-0.5" numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
              </View>
              <Pressable
                onPress={openDisplayNameModal}
                className="py-2 px-3 rounded-lg active:bg-slate-100"
              >
                <Text className="text-[#2563eb] font-semibold text-sm">
                  {hasDisplayName ? 'Edit' : 'Set name'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Modal
            visible={displayNameModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setDisplayNameModalOpen(false)}
          >
            <View className="flex-1 bg-black/40 items-center justify-center px-6">
              <View className="w-full rounded-2xl bg-white border border-slate-200 p-5">
                <Text className="text-slate-900 text-base font-semibold mb-2">
                  {hasDisplayName ? 'Edit display name' : 'Set display name'}
                </Text>
                <TextInput
                  placeholder="Display name"
                  placeholderTextColor="#9ca3af"
                  value={displayNameInput}
                  onChangeText={setDisplayNameInput}
                  className="border border-slate-300 rounded-lg px-3 py-3 text-slate-900 text-base mb-4"
                />
                <View className="flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setDisplayNameModalOpen(false)}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    onPress={saveDisplayName}
                    disabled={!displayNameInput.trim() || displayNameSaving}
                  >
                    {displayNameSaving ? (
                      <ButtonSpinner />
                    ) : (
                      <ButtonText>Save</ButtonText>
                    )}
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        </View>

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
