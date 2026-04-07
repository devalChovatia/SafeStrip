import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';

interface Outlet {
  id: number;
  name: string;
  powerOn: boolean;
}

interface OutletCardProps {
  outlet: Outlet;
  onPowerToggle: () => void;
  onRename: (name: string) => void;
  powerDisabled?: boolean;
}

export const OutletCard: React.FC<OutletCardProps> = ({
  outlet,
  onPowerToggle,
  onRename,
  powerDisabled = false,
}) => {
  const [editingName, setEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState(outlet.name);

  React.useEffect(() => {
    setDraftName(outlet.name);
  }, [outlet.name]);

  const saveName = () => {
    const next = draftName.trim() || outlet.name;
    if (next === outlet.name) {
      setEditingName(false);
      return;
    }
    onRename(next);
    setEditingName(false);
  };
  const statePillClass = outlet.powerOn
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-slate-100 border-slate-200 text-slate-600';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {editingName ? (
            <View style={styles.renameWrap}>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Outlet name"
                placeholderTextColor="#94a3b8"
                style={styles.renameInput}
                onSubmitEditing={saveName}
              />
              <TouchableOpacity onPress={saveName} style={styles.renameButton}>
                <Text style={styles.renameButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={styles.outletName}>{outlet.name}</Text>
              <TouchableOpacity onPress={() => setEditingName(true)}>
                <Text style={styles.editText}>Rename</Text>
              </TouchableOpacity>
            </View>
          )}
          <View className={`mt-1 self-start rounded-full border px-2.5 py-1 ${statePillClass}`}>
            <Text className={`text-[10px] font-semibold ${outlet.powerOn ? 'text-emerald-700' : 'text-slate-600'}`}>
              {outlet.powerOn ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={powerDisabled ? undefined : onPowerToggle}
          disabled={powerDisabled}
          style={[
            styles.powerButton,
            outlet.powerOn ? styles.powerOn : styles.powerOff,
            powerDisabled && styles.powerDisabled,
          ]}
          activeOpacity={powerDisabled ? 1 : 0.7}
        >
          <Text style={[styles.powerIcon, outlet.powerOn ? styles.powerIconOn : styles.powerIconOff]}>
            ⏻
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OutletCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outletName: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  renameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 150,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  renameButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  renameButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  outletState: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  powerButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  powerOn: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  powerOff: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  powerDisabled: {
    opacity: 0.6,
  },
  powerIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  powerIconOn: {
    color: '#ffffff',
  },
  powerIconOff: {
    color: '#475569',
  },
});
