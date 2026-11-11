import React, { memo, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors, fonts } from '../theme';

interface Props {
  digit: string;
  sub?: string;
  onPress: (d: string) => void;
  onLongPress?: (d: string) => void;
}

export const KeypadButton = memo(function KeypadButton({ digit, sub, onPress, onLongPress }: Props) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .onBegin(() => { scale.value = withTiming(0.9, { duration: 70 }); glow.value = withTiming(1, { duration: 70 }); })
      .onFinalize(() => { scale.value = withSpring(1, { damping: 12, stiffness: 260 }); glow.value = withTiming(0, { duration: 240 }); })
      .onEnd((_e, ok) => { if (ok) runOnJS(onPress)(digit); });
    if (!onLongPress) return tap;
    const long = Gesture.LongPress().minDuration(380).onStart(() => { runOnJS(onLongPress)(digit); });
    return Gesture.Exclusive(long, tap);
  }, [digit, onPress, onLongPress, scale, glow]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(glow.value, [0, 1], [colors.surface, colors.accentSoft]),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.btn, style]}>
        <Text style={styles.digit}>{digit}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  btn: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  digit: { color: colors.text, fontFamily: fonts.medium, fontSize: 30, lineHeight: 34 },
  sub: { color: colors.textDim, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 2, marginTop: -2 },
});
