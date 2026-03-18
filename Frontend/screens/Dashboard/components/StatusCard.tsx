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
      badge: { backgroundColor: '#dcfce7' },
      icon: '🛡️',
    },
    warning: {
      container: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
      text: { color: '#92400e' },
      dot: { backgroundColor: '#f59e0b' },
      badge: { backgroundColor: '#fef3c7' },
      icon: '⚠️',
    },
    danger: {
      container: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
      text: { color: '#991b1b' },
      dot: { backgroundColor: '#ef4444' },
      badge: { backgroundColor: '#fee2e2' },
      icon: '🚨',
    },
    neutral: {
      container: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
      text: { color: '#334155' },
      dot: { backgroundColor: '#94a3b8' },
      badge: { backgroundColor: '#e2e8f0' },
      icon: '⏸️',
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
          <Text style={[s.subText, styles.text]}>
            Real-time safety health across connected outlets
          </Text>
        </View>
        <View style={[s.dotWrap, styles.badge]}>
          <Text style={s.badgeIcon}>{styles.icon}</Text>
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
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 28,
  },
  subText: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.78,
  },
  dotWrap: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    fontSize: 13,
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
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
    opacity: 0.95,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.8,
  },
});
