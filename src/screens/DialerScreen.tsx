import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Keypad } from '../components/Keypad';
import { RoundAction } from '../components/RoundAction';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';

export function DialerScreen() {
  const [digits,    setDigits]    = useState('');
  const [identity,  setIdentity]  = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isDefault, setIsDefault] = useState(true);

  const press     = useCallback((d: string) => setDigits((p) => (p.length < 20 ? p + d : p)), []);
  const backspace  = useCallback(() => setDigits((p) => p.slice(0, -1)), []);
  const clear      = useCallback(() => setDigits(''), []);

  // Resolve typed digits to a contact name (or private contact display name).
  // The private number is NEVER returned to JS — only the display name or null.
  useEffect(() => {
    let live = true;
    if (!digits) { setIdentity(null); setIsPrivate(false); return; }
    Dialer.resolveInput(digits)
      .then((n) => {
        if (!live) return;
        if (n) { setIdentity(n); setIsPrivate(true); }
        else   { setIdentity(null); setIsPrivate(false); }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [digits]);

  useEffect(() => {
    const check = () => Dialer.isDefaultDialer().then(setIsDefault).catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, []);

  const fail       = useCallback((e: unknown) => Alert.alert('Call failed', (e as Error)?.message ?? 'Unable to place call'), []);
  const call       = useCallback(() => {
    if (!digits) return;
    Dialer.dial(digits).then(() => setDigits('')).catch(fail);
  }, [digits, fail]);
  const makeDefault = useCallback(() => { Dialer.requestDefaultDialer().catch(fail); }, [fail]);

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
      {!isDefault && (
        <Pressable onPress={makeDefault} style={styles.banner}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <Text style={styles.bannerText}>Set as default phone app to enable the premium call screens</Text>
        </Pressable>
      )}

      <View style={styles.display}>
        {identity ? (
          <>
            <Text style={styles.identity} numberOfLines={1} adjustsFontSizeToFit>{identity}</Text>
            {isPrivate && <Text style={styles.hint}>Private contact</Text>}
          </>
        ) : (
          <Text style={styles.digits} numberOfLines={1} adjustsFontSizeToFit>{digits}</Text>
        )}
      </View>

      <Keypad onPress={press} plusOnZeroLong />

      <View style={styles.bottom}>
        <View style={styles.side} />
        <RoundAction icon="call" size={72} bg={colors.green} iconColor="#04130A" onPress={call} />
        <Pressable style={styles.side} onPress={backspace} onLongPress={clear} hitSlop={16}>
          {digits.length > 0 && <Ionicons name="backspace-outline" size={28} color={colors.textDim} />}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
  banner:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 12, alignSelf: 'stretch' },
  bannerText: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 12 },
  display:    { height: 96, width: '100%', alignItems: 'center', justifyContent: 'center' },
  digits:     { color: colors.text, fontFamily: fonts.medium, fontSize: 40, letterSpacing: 1 },
  identity:   { color: colors.text, fontFamily: fonts.semibold, fontSize: 26 },
  hint:       { color: colors.accent, fontFamily: fonts.medium, fontSize: 12, marginTop: 4, letterSpacing: 1 },
  bottom:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 78 * 3 + 44, marginTop: 20 },
  side:       { width: 78, height: 72, alignItems: 'center', justifyContent: 'center' },
});
