import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { store } from '@/store';
import { DashboardScreen } from '@/screens/Dashboard';
import '@/global.css';
import React from 'react';

export default function App() {
  return (
    <Provider store={store}>
      <GluestackUIProvider mode="dark">
        <StatusBar style="light" />
        <DashboardScreen />
      </GluestackUIProvider>
    </Provider>
  );
}
