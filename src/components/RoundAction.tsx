import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
  disabled?: boolean;
  onPress: () => void;
}

export const RoundAction = memo(function RoundAction({
  icon, size = 68, bg = colors.surfaceStrong, iconColor, label, rotate = 0, disabled = false, onPress,
}: Props) {
  const scale = useSharedValue(1);

  const finalColor = iconColor ?? (bg === colors.text || bg === '#fff' || bg === '#FFFFFF' ? '#000000' : colors.text);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.wrap}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 15, stiffness: 350 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 350 }); }}
        hitSlop={8}
      >
        <Animated.View style={[
          styles.btn,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: disabled ? 0.35 : 1 },
          style
        ]}>
          <Ionicons
            name={icon}
            size={Math.round(size * 0.42)}
            color={finalColor}
            style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
          />
        </Animated.View>
      </Pressable>
      {label ? <Text style={[styles.label, disabled && { opacity: 0.4 }]}>{label}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', minWidth: 72 },
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  label: { marginTop: 8, color: colors.textDim, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center' },
});
