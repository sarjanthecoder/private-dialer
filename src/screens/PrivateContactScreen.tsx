import React, { useCallback, useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Avatar } from '../components/Avatar';
import { CallRow } from '../components/CallRow';
import { RoundAction } from '../components/RoundAction';
import { PRIVATE_DISPLAY_NAME } from '../constants';
import { useCallLog } from '../hooks/useCallLog';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';

export function PrivateContactScreen() {
  const { items, error } = useCallLog();
  const recent = useMemo(() => items.filter((i) => i.isPrivate).slice(0, 6), [items]);
  const call = useCallback(() => {
    Dialer.callPrivate().catch((e: Error) => Alert.alert('Call failed', e.message));
  }, []);
  const noop = useCallback(() => call(), [call]);

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
      <View style={styles.hero}>
        <Avatar size={112} />
        <Text style={styles.name}>{PRIVATE_DISPLAY_NAME}</Text>
        <Text style={styles.tag}>Private contact</Text>
        <View style={{ marginTop: 22 }}>
          <RoundAction icon="call" size={68} bg={colors.green} iconColor="#04130A" onPress={call} />
        </View>
      </View>

      <Text style={styles.section}>RECENT CALLS</Text>
      {error ? <Text style={styles.empty}>{error}</Text> : null}
      {!error && recent.length === 0 ? <Text style={styles.empty}>No calls yet</Text> : null}
      {recent.map((r) => <CallRow key={r.id} item={r} onPress={noop} />)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 24, paddingHorizontal: 24 },
  name: { color: colors.text, fontFamily: fonts.semibold, fontSize: 24, marginTop: 18, textAlign: 'center' },
  tag: { color: colors.accent, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.5, marginTop: 6 },
  section: { color: colors.textDim, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 2, paddingHorizontal: 20, marginBottom: 6 },
  empty: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 14, paddingHorizontal: 20, paddingVertical: 12 },
});
