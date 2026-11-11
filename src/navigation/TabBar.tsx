import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import type { TabKey } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const TABS: { key: TabKey; label: string; icon: IconName; activeIcon: IconName }[] = [
  { key: 'dialer',   label: 'Keypad',   icon: 'keypad-outline',   activeIcon: 'keypad' },
  { key: 'contacts', label: 'Contacts', icon: 'people-outline',   activeIcon: 'people' },
  { key: 'history',  label: 'Recents',  icon: 'time-outline',     activeIcon: 'time'   },
];

export const TabBar = memo(function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.tab} android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: true }}>
            <Ionicons name={on ? t.activeIcon : t.icon} size={22} color={on ? colors.accent : colors.textDim} />
            <Text style={[styles.label, on && { color: colors.accent }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { color: colors.textDim, fontFamily: fonts.medium, fontSize: 11 },
});
