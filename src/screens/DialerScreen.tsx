import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AppState, FlatList, Linking, Modal, Pressable,
  StyleSheet, Text, View, ListRenderItemInfo,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { Keypad } from '../components/Keypad';
import { RoundAction } from '../components/RoundAction';
import { useContacts } from '../hooks/useContacts';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';
import type { Contact, SimInfo } from '../types';

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

  const press     = useCallback((d: string) => setDigits((p) => (p.length < 20 ? p + d : p)), []);
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

  const { contacts } = useContacts();

  // Find matching contacts when digits are dialed (T9 name match + number match)
  const matches = useMemo(() => {
    if (!digits || isPrivate) return [];
    const clean = digits.replace(/\D/g, '');
    if (!clean) return [];

    const t9: Record<string, string> = {
      '2': '[abc]', '3': '[def]', '4': '[ghi]', '5': '[jkl]',
      '6': '[mno]', '7': '[pqrs]', '8': '[tuv]', '9': '[wxyz]'
    };
    const t9Pattern = clean.split('').map((d) => t9[d] || d).join('');
    let t9Regex: RegExp | null = null;
    try { t9Regex = new RegExp(t9Pattern, 'i'); } catch {}

    const list = contacts.filter((c) => {
      const cleanNum = c.number.replace(/\D/g, '');
      const numMatch = cleanNum.includes(clean);
      const nameMatch = t9Regex ? t9Regex.test(c.name) : false;
      return numMatch || nameMatch;
    });

    // Sort: exact startsWith number > startsWith name > contains
    return list.sort((a, b) => {
      const aNum = a.number.replace(/\D/g, '');
      const bNum = b.number.replace(/\D/g, '');
      if (aNum.startsWith(clean) && !bNum.startsWith(clean)) return -1;
      if (!aNum.startsWith(clean) && bNum.startsWith(clean)) return 1;
      return a.name.localeCompare(b.name);
    }).slice(0, 8);
  }, [digits, isPrivate, contacts]);

  const fail = useCallback((e: unknown) =>
    Alert.alert('Call info', (e as Error)?.message ?? 'Unable to place call'), []);

  const makeDefault = useCallback(async () => {
    try {
      const ok = await Dialer.requestDefaultDialer();
      if (!ok) {
        Alert.alert(
          'Allow Restricted Settings',
          'On Android 13/14/15, sideloaded apps need one permission:\n\n1. Open Settings -> Apps -> RootAccess Dialer\n2. Tap the 3 dots (⋮) in the top-right corner\n3. Tap "Allow restricted settings"\n4. Come back and tap "Set as default phone app"!',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch {
      Alert.alert(
        'Allow Restricted Settings',
        'On Android 13/14/15, sideloaded apps need one permission:\n\n1. Open Settings -> Apps -> RootAccess Dialer\n2. Tap the 3 dots (⋮) in the top-right corner\n3. Tap "Allow restricted settings"\n4. Come back and tap "Set as default phone app"!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, []);

  const doCall = useCallback((numberToCall: string, simId?: string) => {
    Dialer.dial(numberToCall, simId).then(() => setDigits('')).catch(fail);
  }, [fail]);

  const call = useCallback(() => {
    if (!digits) return;
    if (sims.length >= 2) {
      setPendingCall(digits);
      setShowSimPick(true);
    } else {
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

  const renderMatchItem = useCallback(({ item }: ListRenderItemInfo<Contact>) => (
    <Animated.View entering={FadeInDown.duration(150)}>
      <Pressable
        onPress={() => setDigits(item.number)}
        style={styles.matchCard}
        android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      >
        <Avatar size={38} photoUri={item.photoUri} name={item.name} />
        <View style={styles.matchTextWrap}>
          <Text style={styles.matchName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.matchNumber} numberOfLines={1}>{item.number}</Text>
        </View>
        <Pressable
          onPress={() => doCall(item.number, sims[0]?.id)}
          style={styles.matchCallBtn}
          hitSlop={12}
        >
          <Ionicons name="call" size={17} color={colors.green} />
        </Pressable>
      </Pressable>
    </Animated.View>
  ), [doCall, sims]);

  const keyExtractor = useCallback((item: Contact) => item.id + item.number, []);

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
      {/* Top Banner if not default */}
      {!isDefault && (
        <Pressable onPress={makeDefault} style={styles.banner}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
          <Text style={styles.bannerText}>Tap to set as default phone app</Text>
        </Pressable>
      )}

      {/* Dual SIM indicator strip */}
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

      {/* Upper Area: Matched contacts scroll list above keypad */}
      <View style={styles.matchContainer}>
        {matches.length > 0 ? (
          <FlatList
            data={matches}
            renderItem={renderMatchItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.matchListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : null}
      </View>

      {/* Bottom Area: Digits display + Keypad + Call row */}
      <View style={styles.bottomKeypadContainer}>
        {/* Display Bar */}
        <View style={styles.display}>
          {identity ? (
            <>
              <Text style={styles.identity} numberOfLines={1} adjustsFontSizeToFit>{identity}</Text>
              {isPrivate && <Text style={styles.hint}>Private contact</Text>}
            </>
          ) : (
            <View style={styles.digitsRow}>
              <Text style={styles.digits} numberOfLines={1} adjustsFontSizeToFit>{digits}</Text>
            </View>
          )}
        </View>

        {/* Dialpad */}
        <Keypad onPress={press} plusOnZeroLong />

        {/* Call and Delete Action Row */}
        <View style={styles.bottom}>
          <View style={styles.side} />
          <RoundAction icon="call" size={72} bg={colors.green} iconColor="#04130A" onPress={call} />
          <View style={styles.side}>
            {digits.length > 0 && (
              <Pressable
                style={styles.backspaceBtn}
                onPress={backspace}
                onLongPress={clear}
                hitSlop={14}
                android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: true }}
              >
                <Ionicons name="backspace-outline" size={26} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>
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
  root:          { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 8 },
  banner:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 8, marginHorizontal: 8 },
  bannerText:    { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 12 },
  simStrip:      { flexDirection: 'row', gap: 8, marginBottom: 6, justifyContent: 'center' },
  simChip:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  simChipText:   { fontFamily: fonts.medium, fontSize: 11 },
  // Upper match container
  matchContainer: { flex: 1, width: '100%' },
  matchListContent: { paddingVertical: 4, gap: 6 },
  matchCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
  matchTextWrap: { flex: 1 },
  matchName:     { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  matchNumber:   { color: colors.textDim, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  matchCallBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,255,100,0.12)', alignItems: 'center', justifyContent: 'center' },
  // Bottom Keypad Container (anchored at bottom)
  bottomKeypadContainer: { alignItems: 'center', paddingBottom: 10 },
  display:       { height: 60, width: '100%', alignItems: 'center', justifyContent: 'center' },
  digitsRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  digits:        { color: colors.text, fontFamily: fonts.medium, fontSize: 36, letterSpacing: 1 },
  identity:      { color: colors.text, fontFamily: fonts.semibold, fontSize: 24 },
  hint:          { color: colors.accent, fontFamily: fonts.medium, fontSize: 11, marginTop: 2, letterSpacing: 1 },
  // Bottom call button row
  bottom:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 78 * 3 + 44, marginTop: 12 },
  side:          { width: 78, height: 72, alignItems: 'center', justifyContent: 'center' },
  backspaceBtn:  { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
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
