import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardHeader } from './components/DashboardHeader';
import { StatusCard } from './components/StatusCard';
import { OutletCard } from './components/OutletCard';

interface Outlet {
  id: number;
  name: string;
  powerOn: boolean;
  temperature: number;
  current: number;
  smokeDetected: boolean;
  waterDetected: boolean;
}

export const DashboardScreen: React.FC = () => {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Mock data for 4 outlets with individual sensors
  const [outlets, setOutlets] = useState<Outlet[]>([
    {
      id: 1,
      name: 'Outlet 1',
      powerOn: true,
      temperature: 24.5,
      current: 2.3,
      smokeDetected: false,
      waterDetected: false,
    },
    {
      id: 2,
      name: 'Outlet 2',
      powerOn: true,
      temperature: 26.8,
      current: 4.1,
      smokeDetected: false,
      waterDetected: false,
    },
    {
      id: 3,
      name: 'Outlet 3',
      powerOn: false,
      temperature: 23.2,
      current: 0,
      smokeDetected: false,
      waterDetected: false,
    },
    {
      id: 4,
      name: 'Outlet 4',
      powerOn: true,
      temperature: 25.1,
      current: 1.8,
      smokeDetected: false,
      waterDetected: false,
    },
  ]);

  // Simulate live sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOutlets((prev) =>
        prev.map((outlet) => ({
          ...outlet,
          temperature: outlet.powerOn
            ? Math.max(
                20,
                Math.min(
                  45,
                  outlet.temperature + (Math.random() - 0.5) * 0.3
                )
              )
            : outlet.temperature,
          current: outlet.powerOn
            ? Math.max(
                0,
                Math.min(10, outlet.current + (Math.random() - 0.5) * 0.1)
              )
            : 0,
        }))
      );
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Determine overall system status
  const getSystemStatus = () => {
    const activeOutlets = outlets.filter((o) => o.powerOn);

    if (activeOutlets.length === 0) {
      return {
        status: 'All Power Off',
        variant: 'neutral' as const,
      };
    }

    const hasRisk = activeOutlets.some(
      (o) => o.waterDetected || o.smokeDetected
    );
    if (hasRisk) {
      return {
        status: '⚠️ Risk Detected',
        variant: 'danger' as const,
      };
    }

    const hasWarning = activeOutlets.some(
      (o) => o.temperature > 40 || o.current > 8
    );
    if (hasWarning) {
      return {
        status: '⚠️ Warning',
        variant: 'warning' as const,
      };
    }

    return {
      status: 'All Systems Safe',
      variant: 'safe' as const,
    };
  };

  const systemStatus = getSystemStatus();

  const handlePowerToggle = (outletId: number) => {
    setOutlets((prev) =>
      prev.map((outlet) =>
        outlet.id === outletId
          ? { ...outlet, powerOn: !outlet.powerOn }
          : outlet
      )
    );
  };

  const getTimeSinceUpdate = () => {
    const seconds = Math.floor(
      (Date.now() - lastUpdate.getTime()) / 1000
    );
    return `Updated ${seconds} seconds ago`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <DashboardHeader />

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={styles.content}>
            <StatusCard
              status={systemStatus.status}
              variant={systemStatus.variant}
              activeCount={outlets.filter((o) => o.powerOn).length}
              totalCount={outlets.length}
            />

            <View style={styles.outletsWrap}>
              <Text style={styles.sectionTitle}>
                Power Outlets
              </Text>
              {outlets.map((outlet) => (
                <OutletCard
                  key={outlet.id}
                  outlet={outlet}
                  onPowerToggle={() => handlePowerToggle(outlet.id)}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {getTimeSinceUpdate()}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  outletsWrap: {
    gap: 12,
  },
  sectionTitle: {
    paddingHorizontal: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  footerText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
});
