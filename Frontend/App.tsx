import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistGate } from 'redux-persist/integration/react';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import Auth from '@/components/Auth';
import { useSupabaseAuthSync } from '@/hooks/useSupabaseAuthSync';
import { store, persistor, useAppDispatch, useAppSelector } from '@/store';
import { clearAuth } from '@/store/slices/authSlice';
import { supabase } from '@/lib/supabase';
import { DashboardScreen } from '@/screens/Dashboard';

import '@/global.css';

function AppContent() {
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const initialized = useAppSelector((state) => state.auth.initialized);

  useSupabaseAuthSync();

  async function signOut() {
    await supabase.auth.signOut();
    dispatch(clearAuth());
  }

  if (!initialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <Auth />
        <StatusBar style="light" />
      </>
    );
  }

  // Show your signed-in UI (or swap to <DashboardScreen /> if you prefer)
  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Signed in as {session.user?.email}</Text>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.signOutButton, { marginTop: 12 }]}
        onPress={() => {
          // Optional: show dashboard screen instead of this page
          // If you want dashboard always, replace this whole return with <DashboardScreen />
        }}
      >
        <Text style={styles.signOutText}>Go to Dashboard (optional)</Text>
      </TouchableOpacity>

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <GluestackUIProvider mode="dark">
            {/* If you want Dashboard only when logged in, AppContent should decide */}
            <AppContent />
            {/* If you want dashboard ALWAYS (not recommended), use:
                <DashboardScreen />
            */}
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
  welcomeText: {
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 16,
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  signOutText: {
    color: '#f8fafc',
    fontSize: 16,
  },
});