import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  size?: number;
  bg?: string;
  iconColor?: string;
  label?: string;
  rotate?: number;
  onPress: () => void;
}

export const RoundAction = memo(function RoundAction({
  icon, size = 72, bg = colors.surfaceStrong, iconColor = colors.text, label, rotate = 0, onPress,
}: Props) {
  const scale = useSharedValue(1);
  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .onBegin(() => { scale.value = withTiming(0.9, { duration: 70 }); })
        .onFinalize(() => { scale.value = withSpring(1, { damping: 12, stiffness: 280 }); })
        .onEnd((_e, ok) => { if (ok) runOnJS(onPress)(); }),
    [onPress, scale]
  );
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, style]}>
          <Ionicons name={icon} size={size * 0.4} color={iconColor} style={{ transform: [{ rotate: `${rotate}deg` }] }} />
        </Animated.View>
      </GestureDetector>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  label: { marginTop: 8, color: colors.textDim, fontFamily: fonts.medium, fontSize: 12 },
});
