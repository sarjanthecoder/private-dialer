import React, { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, FadeIn, FadeOut,
  cancelAnimation, interpolate,
  useAnimatedStyle, useSharedValue,
  withRepeat, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { Keypad } from '../components/Keypad';
import { RoundAction } from '../components/RoundAction';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';
import type { CallInfo } from '../types';
import { formatDuration } from '../utils/format';

// ── Pulse ring ────────────────────────────────────────────────────────────────
const Pulse = memo(function Pulse({ running }: { running: boolean }) {
  const scale     = useSharedValue(1);
  const isRunning = useSharedValue(running ? 1 : 0);

  useEffect(() => {
    isRunning.value = running ? 1 : 0;
    if (running) {
      scale.value = withRepeat(
        withTiming(1.4, { duration: 1400, easing: Easing.out(Easing.quad) }),
        -1, false,
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 200 });
    }
    return () => { cancelAnimation(scale); };
  }, [running, scale, isRunning]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.4], [isRunning.value === 1 ? 0.5 : 0, 0]),
  }));

  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
});

// ── Call timer ────────────────────────────────────────────────────────────────
const CallTimer = memo(function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = since > 0 ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  return <Text style={styles.status}>{formatDuration(secs)}</Text>;
});

// ── Animated dots ─────────────────────────────────────────────────────────────
const Dots = memo(function Dots({ base }: { base: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 1) % 4), 450);
    return () => clearInterval(id);
  }, []);
  return <Text style={styles.status}>{base}{'.'.repeat(n)}</Text>;
});

// ── SIM badge ────────────────────────────────────────────────────────────────
const SimBadge = memo(function SimBadge({ slot, label }: { slot: number; label: string }) {
  const bg = slot === 1 ? colors.accent : colors.green;
  return (
    <View style={[styles.simBadge, { backgroundColor: bg }]}>
      <Text style={styles.simBadgeText}>{label || `SIM ${slot}`}</Text>
    </View>
  );
});

// ── Main CallScreen ───────────────────────────────────────────────────────────
export function CallScreen({ call }: { call: CallInfo }) {
  const [showPad,    setShowPad]    = useState(false);
  const [typed,      setTyped]      = useState('');
  const [onHold,     setOnHold]     = useState(false);
  const [recording,  setRecording]  = useState(false);

  useEffect(() => {
    if (call.state === 'idle')     { setShowPad(false); setTyped(''); setOnHold(false); }
    if (call.state === 'holding')  setOnHold(true);
    if (call.state === 'active')   setOnHold(false);
    // Auto-stop recording when call ends
    if (call.state === 'idle' && recording) {
      Dialer.stopRecording().then(() => setRecording(false)).catch(() => setRecording(false));
    }
  }, [call.state]);

  const answer        = useCallback(() => Dialer.answer(), []);
  const reject        = useCallback(() => Dialer.reject(), []);
  const hangup        = useCallback(() => Dialer.hangup(), []);
  const toggleMute    = useCallback(() => Dialer.setMuted(!call.muted),    [call.muted]);
  const toggleSpeaker = useCallback(() => Dialer.setSpeaker(!call.speaker), [call.speaker]);
  const togglePad     = useCallback(() => setShowPad((v) => !v), []);
  const toggleHold    = useCallback(() => {
    if (onHold) { Dialer.unhold(); setOnHold(false); }
    else        { Dialer.hold();   setOnHold(true);  }
  }, [onHold]);
  const merge = useCallback(() => Dialer.merge(), []);
  const dtmf  = useCallback((d: string) => {
    Dialer.sendDtmf(d);
    setTyped((t) => (t + d).slice(-18));
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      await Dialer.stopRecording();
      setRecording(false);
    } else {
      await Dialer.startRecording(call.displayName ?? 'call');
      setRecording(true);
    }
  }, [recording, call.displayName]);

  const ringing  = call.state === 'ringing';
  const pulsing  = ringing || call.state === 'dialing';
  const isActive = call.state === 'active' || call.state === 'holding';

  let status: React.ReactNode;
  if (ringing)                       status = <Text style={styles.status}>Incoming call</Text>;
  else if (call.state === 'dialing') status = <Dots base="Calling" />;
  else if (call.state === 'active')  status = <CallTimer since={call.connectTime} />;
  else if (call.state === 'holding') status = <Text style={styles.status}>On hold</Text>;
  else                               status = <Text style={styles.status}>Call ended</Text>;

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={styles.overlay}>
      <LinearGradient colors={['#0B1530', '#050507', '#050507']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          {/* SIM badge — shows which SIM this call is on */}
          {call.simSlot !== null && (
            <SimBadge slot={call.simSlot} label={call.simLabel ?? `SIM ${call.simSlot}`} />
          )}

          <View style={styles.avatarWrap}>
            <Pulse running={pulsing} />
            <Avatar size={120} photoUri={call.photoUri} name={call.isPrivate ? undefined : call.displayName} />
          </View>
          <Text style={styles.name} numberOfLines={2}>{call.displayName}</Text>
          {status}
          {call.heldCallName ? (
            <Text style={styles.heldLabel}>On hold: {call.heldCallName}</Text>
          ) : null}
        </View>

        {showPad && !ringing ? (
          <View style={styles.padWrap}>
            <Text style={styles.typed} numberOfLines={1}>{typed}</Text>
            <Keypad onPress={dtmf} />
          </View>
        ) : null}

        {ringing ? (
          <View style={styles.rowBetween}>
            <RoundAction icon="call" size={78} bg={colors.red}   iconColor="#fff"     rotate={135} label="Decline" onPress={reject} />
            <RoundAction icon="call" size={78} bg={colors.green} iconColor="#04130A"               label="Accept"  onPress={answer} />
          </View>
        ) : (
          <View style={styles.controls}>
            {/* Grid Row 1: Mute, Keypad, Speaker */}
            <View style={styles.rowBetween}>
              <RoundAction
                icon={call.muted ? 'mic-off' : 'mic'}
                bg={call.muted ? colors.text : colors.surfaceStrong}
                iconColor={call.muted ? '#000' : colors.text}
                label="Mute"
                onPress={toggleMute}
              />
              <RoundAction
                icon="keypad"
                bg={showPad ? colors.text : colors.surfaceStrong}
                iconColor={showPad ? '#000' : colors.text}
                label="Keypad"
                onPress={togglePad}
              />
              <RoundAction
                icon={call.speaker ? 'volume-high' : 'volume-medium'}
                bg={call.speaker ? colors.text : colors.surfaceStrong}
                iconColor={call.speaker ? '#000' : colors.text}
                label="Speaker"
                onPress={toggleSpeaker}
              />
            </View>

            {/* Grid Row 2: Hold, Merge, Add call */}
            <View style={styles.rowBetween}>
              <RoundAction
                icon={onHold ? 'play' : 'pause'}
                bg={onHold ? colors.accent : colors.surfaceStrong}
                iconColor={onHold ? '#000' : colors.text}
                label={onHold ? 'Resume' : 'Hold'}
                onPress={toggleHold}
              />
              <RoundAction
                icon="git-merge"
                bg={call.canMerge ? colors.accent : colors.surfaceStrong}
                iconColor={call.canMerge ? '#000' : colors.text}
                disabled={!call.canMerge}
                label="Merge"
                onPress={merge}
              />
              <RoundAction
                icon="person-add"
                bg={colors.surfaceStrong}
                iconColor={colors.text}
                label="Add call"
                onPress={togglePad}
              />
            </View>

            {/* Row 3: Recording indicator + Record button */}
            <View style={styles.rowBetween}>
              <View style={styles.recIndicator}>
                {recording && (
                  <>
                    <Animated.View style={[styles.recDot]} />
                    <Text style={styles.recLabel}>REC</Text>
                  </>
                )}
              </View>
              <RoundAction
                icon={recording ? 'stop-circle' : 'radio-button-on'}
                bg={recording ? colors.red : colors.surfaceStrong}
                iconColor={recording ? '#fff' : colors.red}
                label={recording ? 'Stop Rec' : 'Record'}
                onPress={toggleRecording}
              />
              <View style={styles.recIndicator} />
            </View>

            {/* Bottom: Centered Big Red End Call */}
            <View style={styles.hangupWrap}>
              <RoundAction icon="call" size={78} bg={colors.red} iconColor="#fff" rotate={135} onPress={hangup} />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, zIndex: 100 },
  safe:         { flex: 1, justifyContent: 'space-between', paddingHorizontal: 32, paddingBottom: 32 },
  top:          { alignItems: 'center', paddingTop: 36 },
  avatarWrap:   { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ring:         { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: colors.accent },
  name:         { color: colors.text, fontFamily: fonts.semibold, fontSize: 28, marginTop: 22, textAlign: 'center' },
  status:       { color: colors.textDim, fontFamily: fonts.medium, fontSize: 16, marginTop: 10, minHeight: 22 },
  heldLabel:    { color: colors.accent, fontFamily: fonts.medium, fontSize: 13, marginTop: 6 },
  simBadge:     { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 4 },
  simBadgeText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5 },
  padWrap:      { alignItems: 'center', gap: 14 },
  typed:        { color: colors.text, fontFamily: fonts.medium, fontSize: 24, minHeight: 32 },
  controls:     { alignItems: 'center', gap: 28 },
  rowBetween:   { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', alignItems: 'center' },
  hangupWrap:   { marginTop: 12, alignItems: 'center' },
  placeholder:  { width: 64, height: 64 },
  recIndicator: { width: 72, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  recDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
  recLabel:     { color: colors.red, fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1 },
});
