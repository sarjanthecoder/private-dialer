import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import type { CallLogEntry, CallLogType } from '../types';
import { formatDuration, formatWhen } from '../utils/format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const META: Record<CallLogType, { icon: IconName; color: string; label: string }> = {
  incoming: { icon: 'arrow-down',    color: colors.green,  label: 'Incoming' },
  outgoing: { icon: 'arrow-up',      color: colors.accent, label: 'Outgoing' },
  missed:   { icon: 'call',          color: colors.red,    label: 'Missed'   },
  rejected: { icon: 'close-circle',  color: colors.red,    label: 'Declined' },
};

export const ROW_HEIGHT = 74;

interface CallRowProps {
  item: CallLogEntry;
  onPress: (e: CallLogEntry) => void;
  onLongPress?: (e: CallLogEntry) => void;
}

export const CallRow = memo(function CallRow({ item, onPress, onLongPress }: CallRowProps) {
  const m = META[item.type] ?? META.incoming;
  const durText = item.duration > 0 ? formatDuration(item.duration) : (item.type === 'missed' ? 'Missed' : '0s');

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress?.(item)}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={styles.row}
    >
      <View style={[styles.icon, { borderColor: m.color + '40', borderWidth: 1 }]}>
        <Ionicons name={m.icon} size={18} color={m.color} />
      </View>
      <View style={styles.mid}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
          {item.isBlocked && (
            <View style={styles.blockedBadge}>
              <Text style={styles.blockedText}>Blocked</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={styles.sub}>
          {m.label} · {formatWhen(item.date)} · <Text style={{ color: colors.text }}>{durText}</Text>
        </Text>
      </View>
      {onLongPress && (
        <Pressable onPress={() => onLongPress(item)} hitSlop={12} style={styles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textDim} />
        </Pressable>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  sub: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
  blockedBadge: { backgroundColor: 'rgba(255, 69, 58, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.red },
  blockedText: { color: colors.red, fontFamily: fonts.semibold, fontSize: 10 },
  moreBtn: { padding: 6 },
});
