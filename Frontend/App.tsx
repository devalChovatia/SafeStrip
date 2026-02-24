import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistGate } from 'redux-persist/integration/react';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import Auth from '@/components/Auth';
import { useSupabaseAuthSync } from '@/hooks/useSupabaseAuthSync';
import { store, persistor, useAppSelector } from '@/store';
import { DashboardScreen } from '@/screens/Dashboard';
import { SettingsScreen } from '@/screens/Settings/SettingsScreen';

import '@/global.css';

type AuthenticatedScreen = 'dashboard' | 'settings';

function AppContent() {
  const session = useAppSelector((state) => state.auth.session);
  const initialized = useAppSelector((state) => state.auth.initialized);
  const [screen, setScreen] = React.useState<AuthenticatedScreen>('dashboard');

  useSupabaseAuthSync();

  // When user signs out, reset to dashboard so next sign-in shows dashboard, not settings
  React.useEffect(() => {
    if (!session) setScreen('dashboard');
  }, [session]);

  const headerBg = '#0f172a'; // slate-900, matches dashboard/settings header

  if (!initialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="light" backgroundColor={headerBg} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <Auth />
        <StatusBar style="light" backgroundColor={headerBg} />
      </>
    );
  }

  if (screen === 'settings') {
    return (
      <>
        <SettingsScreen onBack={() => setScreen('dashboard')} />
        <StatusBar style="light" backgroundColor={headerBg} />
      </>
    );
  }

  return (
    <>
      <DashboardScreen onOpenSettings={() => setScreen('settings')} />
      <StatusBar style="light" backgroundColor={headerBg} />
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <GluestackUIProvider mode="dark">
            <AppContent />
          </GluestackUIProvider>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
  },
});
