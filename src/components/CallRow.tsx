import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import type { CallLogEntry, CallLogType } from '../types';
import { formatDuration, formatWhen } from '../utils/format';

type McIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const META: Record<CallLogType, { icon: McIcon; color: string; label: string }> = {
  incoming: { icon: 'phone-incoming', color: colors.accent, label: 'Incoming' },
  outgoing: { icon: 'phone-outgoing', color: colors.green, label: 'Outgoing' },
  missed: { icon: 'phone-missed', color: colors.red, label: 'Missed' },
  rejected: { icon: 'phone-cancel', color: colors.red, label: 'Declined' },
};

export const ROW_HEIGHT = 72;

export const CallRow = memo(function CallRow({ item, onPress }: { item: CallLogEntry; onPress: (e: CallLogEntry) => void }) {
  const m = META[item.type];
  return (
    <Pressable onPress={() => onPress(item)} android_ripple={{ color: 'rgba(255,255,255,0.06)' }} style={styles.row}>
      <View style={styles.icon}><MaterialCommunityIcons name={m.icon} size={20} color={m.color} /></View>
      <View style={styles.mid}>
        <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.sub}>
          {m.label} · {formatWhen(item.date)}{item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ''}
        </Text>
      </View>
      <Ionicons name="call-outline" size={20} color={colors.textDim} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  sub: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 12, marginTop: 3 },
});
