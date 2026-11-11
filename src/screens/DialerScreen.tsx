import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AppState, Modal, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Keypad } from '../components/Keypad';
import { RoundAction } from '../components/RoundAction';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';
import type { SimInfo } from '../types';

// ── Lightweight SIM picker bottom sheet ────────────────────────────────────────
const SimPicker = memo(function SimPicker({
  visible,
  sims,
  onPick,
  onCancel,
}: {
  visible: boolean;
  sims: SimInfo[];
  onPick: (sim: SimInfo) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.simOverlay} onPress={onCancel} />
      <View style={styles.simSheet}>
        <View style={styles.simHandle} />
        <Text style={styles.simTitle}>Choose SIM</Text>
        {sims.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onPick(s)}
            style={styles.simRow}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <View style={[styles.simBadge, { backgroundColor: s.slot === 0 ? colors.accent : colors.green }]}>
              <Text style={styles.simBadgeText}>SIM {s.displaySlot}</Text>
            </View>
            <Text style={styles.simLabel}>{s.label}</Text>
            <Ionicons name="call" size={18} color={colors.textDim} />
          </Pressable>
        ))}
        <Pressable onPress={onCancel} style={styles.simCancel}>
          <Text style={styles.simCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
});

export function DialerScreen() {
  const [digits,       setDigits]       = useState('');
  const [identity,     setIdentity]     = useState<string | null>(null);
  const [isPrivate,    setIsPrivate]    = useState(false);
  const [isDefault,    setIsDefault]    = useState(true);
  const [sims,         setSims]         = useState<SimInfo[]>([]);
  const [showSimPick,  setShowSimPick]  = useState(false);
  const [pendingCall,  setPendingCall]  = useState('');

  const press    = useCallback((d: string) => setDigits((p) => (p.length < 20 ? p + d : p)), []);
  const backspace = useCallback(() => setDigits((p) => p.slice(0, -1)), []);
  const clear     = useCallback(() => setDigits(''), []);

  // Resolve private contact name
  useEffect(() => {
    let live = true;
    if (!digits) { setIdentity(null); setIsPrivate(false); return; }
    Dialer.resolveInput(digits)
      .then((n) => { if (!live) return; setIdentity(n); setIsPrivate(!!n); })
      .catch(() => {});
    return () => { live = false; };
  }, [digits]);

  // Check default + load SIMs
  useEffect(() => {
    const checkDefault = () => Dialer.isDefaultDialer().then(setIsDefault).catch(() => {});
    checkDefault();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkDefault(); });
    Dialer.getSims().then(setSims).catch(() => {});
    return () => sub.remove();
  }, []);

  const fail = useCallback((e: unknown) =>
    Alert.alert('Call failed', (e as Error)?.message ?? 'Unable to place call'), []);

  const makeDefault = useCallback(() => { Dialer.requestDefaultDialer().catch(fail); }, [fail]);

  const doCall = useCallback((digits: string, simId?: string) => {
    Dialer.dial(digits, simId).then(() => setDigits('')).catch(fail);
  }, [fail]);

  const call = useCallback(() => {
    if (!digits) return;
    if (sims.length >= 2) {
      // Dual SIM — ask which SIM
      setPendingCall(digits);
      setShowSimPick(true);
    } else {
      // Single SIM or unknown — dial directly
      doCall(digits, sims[0]?.id);
    }
  }, [digits, sims, doCall]);

  const pickSim = useCallback((sim: SimInfo) => {
    setShowSimPick(false);
    doCall(pendingCall, sim.id);
    setPendingCall('');
  }, [pendingCall, doCall]);

  const cancelSim = useCallback(() => {
    setShowSimPick(false);
    setPendingCall('');
  }, []);

  const simCount = useMemo(() => sims.length, [sims]);

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
      {!isDefault && (
        <Pressable onPress={makeDefault} style={styles.banner}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <Text style={styles.bannerText}>Tap to set as default phone app</Text>
        </Pressable>
      )}

      {/* SIM indicator strip when dual SIM */}
      {simCount >= 2 && (
        <View style={styles.simStrip}>
          {sims.map((s) => (
            <View key={s.id} style={[styles.simChip, { borderColor: s.slot === 0 ? colors.accent : colors.green }]}>
              <Text style={[styles.simChipText, { color: s.slot === 0 ? colors.accent : colors.green }]}>
                SIM {s.displaySlot}
              </Text>
            </View>
          ))}
        </View>
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

      <SimPicker
        visible={showSimPick}
        sims={sims}
        onPick={pickSim}
        onCancel={cancelSim}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
  banner:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 8, alignSelf: 'stretch' },
  bannerText:    { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 12 },
  simStrip:      { flexDirection: 'row', gap: 8, marginBottom: 6 },
  simChip:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  simChipText:   { fontFamily: fonts.medium, fontSize: 11 },
  display:       { height: 90, width: '100%', alignItems: 'center', justifyContent: 'center' },
  digits:        { color: colors.text, fontFamily: fonts.medium, fontSize: 40, letterSpacing: 1 },
  identity:      { color: colors.text, fontFamily: fonts.semibold, fontSize: 26 },
  hint:          { color: colors.accent, fontFamily: fonts.medium, fontSize: 11, marginTop: 3, letterSpacing: 1 },
  bottom:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 78 * 3 + 44, marginTop: 16 },
  side:          { width: 78, height: 72, alignItems: 'center', justifyContent: 'center' },
  // SIM picker modal
  simOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  simSheet:      { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderColor: colors.border },
  simHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  simTitle:      { color: colors.text, fontFamily: fonts.semibold, fontSize: 18, marginBottom: 16 },
  simRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderRadius: 12 },
  simBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, minWidth: 52, alignItems: 'center' },
  simBadgeText:  { color: '#fff', fontFamily: fonts.semibold, fontSize: 13 },
  simLabel:      { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  simCancel:     { marginTop: 8, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.bg },
  simCancelText: { color: colors.textDim, fontFamily: fonts.medium, fontSize: 15 },
});
