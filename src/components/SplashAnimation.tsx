import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const ICON = require('../../assets/icon.png') as ImageSourcePropType;

// Pink/magenta palette matching the new icon
const C = {
  pink:     '#FF006E',
  magenta:  '#E91E8C',
  rose:     '#FF4DA6',
  pinkSoft: 'rgba(255, 0, 110, 0.55)',
  magSoft:  'rgba(233, 30, 140, 0.45)',
  white:    'rgba(255, 255, 255, 0.34)',
};

interface RingProps { size: number; color: string; delay: number; duration: number }

const GlowRing = memo(function GlowRing({ size, color, delay, duration }: RingProps) {
  const scale   = useSharedValue(0.55);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const durIn  = Math.round(duration * 0.35);
    const durOut = Math.round(duration * 0.65);
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.65, { duration: durIn,  easing: Easing.out(Easing.quad) }),
      withTiming(0,    { duration: durOut, easing: Easing.in(Easing.quad) }),
    ), -1, false));
    scale.value = withDelay(delay, withRepeat(
      withTiming(1.75, { duration, easing: Easing.out(Easing.cubic) }), -1, false,
    ));
    return () => { cancelAnimation(opacity); cancelAnimation(scale); };
  }, [delay, duration, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[
      styles.ring,
      { width: size, height: size, borderRadius: size / 2, borderColor: color },
      animStyle,
    ]} />
  );
});

interface ParticleProps { angle: number; radius: number; size: number; color: string; delay: number }

const Particle = memo(function Particle({ angle, radius, size, color, delay }: ParticleProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 350,  easing: Easing.in(Easing.quad) }),
    ), -1, false));
    return () => { cancelAnimation(progress); };
  }, [delay, progress]);

  const animStyle = useAnimatedStyle(() => {
    const r = interpolate(progress.value, [0, 1], [24, radius]);
    return {
      transform: [
        { translateX: Math.cos(angle) * r },
        { translateY: Math.sin(angle) * r },
        { scale: interpolate(progress.value, [0, 0.4, 1], [0.4, 1.15, 0.3]) },
      ],
      opacity: interpolate(progress.value, [0, 0.2, 0.75, 1], [0, 0.95, 0.65, 0]),
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[
      styles.particle,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      animStyle,
    ]} />
  );
});

export const SplashAnimation = memo(function SplashAnimation({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finish = useCallback(() => { onDoneRef.current(); }, []);

  const iconScale      = useSharedValue(0.3);
  const iconOpacity    = useSharedValue(0);
  const iconFloat      = useSharedValue(0);
  const auraPulse      = useSharedValue(0.85);
  const orbitDeg       = useSharedValue(0);
  const shimmerX       = useSharedValue(-160);
  const textOpacity    = useSharedValue(0);
  const textY          = useSharedValue(18);
  const containerOpacity = useSharedValue(1);
  const containerScale   = useSharedValue(1);

  useEffect(() => {
    // 1. Hero icon — spring pop-in
    iconOpacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
    iconScale.value   = withSpring(1, { damping: 11, stiffness: 145, mass: 0.85 });

    // 2. Floating breath
    iconFloat.value = withDelay(450, withRepeat(withSequence(
      withTiming(-7, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      withTiming(0,  { duration: 1100, easing: Easing.inOut(Easing.sin) }),
    ), -1, false));

    // 3. Ambient halo pulse
    auraPulse.value = withRepeat(withSequence(
      withTiming(1.2,  { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.85, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
    ), -1, true);

    // 4. Orbit spin
    orbitDeg.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }), -1, false,
    );

    // 5. Glass shimmer sweep (once at 600ms, then loop)
    const sweep = () => {
      shimmerX.value = -160;
      shimmerX.value = withTiming(220, { duration: 820, easing: Easing.inOut(Easing.quad) });
    };
    sweep();
    const sweepLoop = setInterval(sweep, 3200);

    // 6. Brand reveal at 700ms
    textOpacity.value = withDelay(700, withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) }));
    textY.value       = withDelay(700, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));

    // 7. Exit: scale-out + fade at 2600ms, then fire onDone
    const exitTimer = setTimeout(() => {
      containerScale.value   = withTiming(1.07, { duration: 320, easing: Easing.in(Easing.quad) });
      containerOpacity.value = withTiming(0,    { duration: 320, easing: Easing.in(Easing.quad) },
        (fin) => { if (fin) runOnJS(finish)(); }
      );
    }, 2600);

    return () => {
      clearInterval(sweepLoop);
      clearTimeout(exitTimer);
      cancelAnimation(iconScale);  cancelAnimation(iconOpacity);
      cancelAnimation(iconFloat);  cancelAnimation(auraPulse);
      cancelAnimation(orbitDeg);   cancelAnimation(shimmerX);
      cancelAnimation(textOpacity); cancelAnimation(textY);
      cancelAnimation(containerOpacity); cancelAnimation(containerScale);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity:   iconOpacity.value,
    transform: [{ scale: iconScale.value }, { translateY: iconFloat.value }],
  }));
  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraPulse.value }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitDeg.value}deg` }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity:   textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity:   containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const particles = useMemo(() =>
    Array.from({ length: 16 }, (_, i) => ({
      angle:  (i / 16) * Math.PI * 2,
      radius: 115 + (i % 3) * 28,
      size:   3 + (i % 4) * 1.5,
      color:  i % 3 === 0 ? C.pink : i % 3 === 1 ? C.rose : C.magenta,
      delay:  220 + i * 60,
    })),
  []);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={['#140008', '#050507', '#17000D']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center} pointerEvents="none">
        {/* Dual pink/magenta ambient halos */}
        <Animated.View style={[styles.auraPink,    auraStyle]} />
        <Animated.View style={[styles.auraMagenta, auraStyle]} />

        {/* Expanding shockwave rings */}
        <GlowRing size={300} color={C.pinkSoft}             delay={0}   duration={2200} />
        <GlowRing size={230} color={C.magSoft}              delay={380} duration={1900} />
        <GlowRing size={175} color="rgba(255,77,166,0.60)"  delay={720} duration={1650} />

        {/* Rotating orbital arcs */}
        <Animated.View style={[styles.orbitWrap, orbitStyle]}>
          <View style={styles.orbitArcPink} />
          <View style={styles.orbitArcMag} />
        </Animated.View>

        {/* Radiating particles */}
        {particles.map((p, i) => <Particle key={i} {...p} />)}

        {/* Hero App Icon + shimmer */}
        <Animated.View style={[styles.iconShadow, iconStyle]}>
          <Image source={ICON} style={styles.icon} resizeMode="cover" />
          <Animated.View style={[styles.shimmerWrap, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', C.white, 'transparent']}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={styles.shimmerGrad}
            />
          </Animated.View>
        </Animated.View>

        {/* Brand text */}
        <Animated.View style={[styles.brandWrap, titleStyle]}>
          <Text style={styles.brandTitle}>ROOTACCESS</Text>
          <Text style={styles.brandSub}>PRIVATE DIALER</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container:    { ...StyleSheet.absoluteFillObject, zIndex: 999, backgroundColor: '#050507' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  auraPink:     { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,0,110,0.13)', transform: [{ translateX: -22 }, { translateY: -16 }] },
  auraMagenta:  { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(233,30,140,0.12)', transform: [{ translateX: 22  }, { translateY: 16  }] },
  ring:         { position: 'absolute', borderWidth: 1.5 },
  orbitWrap:    { position: 'absolute', width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
  orbitArcPink: { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: 'transparent', borderTopColor: 'rgba(255,0,110,0.80)', borderLeftColor: 'rgba(255,0,110,0.22)' },
  orbitArcMag:  { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: 'transparent', borderBottomColor: 'rgba(233,30,140,0.80)', borderRightColor: 'rgba(233,30,140,0.22)' },
  particle:     { position: 'absolute' },
  iconShadow:   { shadowColor: C.pink, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 38, elevation: 32, borderRadius: 34, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,100,180,0.25)' },
  icon:         { width: 132, height: 132, borderRadius: 34 },
  shimmerWrap:  { position: 'absolute', top: -30, bottom: -30, width: 64 },
  shimmerGrad:  { flex: 1 },
  brandWrap:    { position: 'absolute', bottom: '18%', alignItems: 'center' },
  brandTitle:   { color: '#F5F0F3', fontSize: 18, fontWeight: '700', letterSpacing: 6 },
  brandSub:     { color: C.rose, fontSize: 11, fontWeight: '600', letterSpacing: 4, marginTop: 8, opacity: 0.85 },
});
