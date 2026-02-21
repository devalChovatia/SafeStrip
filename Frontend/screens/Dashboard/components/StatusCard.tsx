import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusCardProps {
  status: string;
  variant: 'safe' | 'warning' | 'danger' | 'neutral';
  activeCount: number;
  totalCount: number;
}

export const StatusCard: React.FC<StatusCardProps> = ({ 
  status, 
  variant, 
  activeCount, 
  totalCount 
}) => {
  const variantStyles = {
    safe: {
      container: { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' },
      text: { color: '#166534' },
      dot: { backgroundColor: '#22c55e' },
    },
    warning: {
      container: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
      text: { color: '#92400e' },
      dot: { backgroundColor: '#f59e0b' },
    },
    danger: {
      container: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
      text: { color: '#991b1b' },
      dot: { backgroundColor: '#ef4444' },
    },
    neutral: {
      container: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
      text: { color: '#334155' },
      dot: { backgroundColor: '#94a3b8' },
    },
  };

  const styles = variantStyles[variant];

  return (
    <View style={[s.card, styles.container]}>
      <View style={s.headerRow}>
        <View style={s.headerTextWrap}>
          <Text style={[s.kicker, styles.text]}>
            System Status
          </Text>
          <Text style={[s.statusText, styles.text]}>
            {status}
          </Text>
        </View>
        <View style={s.dotWrap}>
          <View style={[s.dot, styles.dot]} />
        </View>
      </View>
      <View style={s.footerRow}>
        <Text style={[s.footerStrong, styles.text]}>
          {activeCount} of {totalCount}
        </Text>
        <Text style={[s.footerText, styles.text]}>
          outlets active
        </Text>
      </View>
    </View>
  );
};

export default StatusCard;

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTextWrap: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  dotWrap: {
    marginLeft: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerStrong: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.9,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.8,
  },
});
