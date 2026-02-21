import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const DashboardHeader: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>🛡️</Text>
        </View>
        <Text style={styles.title}>SafeStrip</Text>
      </View>
    </View>
  );
};

export default DashboardHeader;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
