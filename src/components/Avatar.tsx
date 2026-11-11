import React, { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

interface AvatarProps {
  size?: number;
  photoUri?: string | null;
  name?: string;
}

export const Avatar = memo(function Avatar({ size = 96, photoUri, name }: AvatarProps) {
  if (photoUri) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 1, borderColor: colors.accentSoft }}>
        <Image
          source={{ uri: photoUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Show initials if name is provided
  const initials = name
    ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : null;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 1, borderColor: colors.accentSoft }}>
      <LinearGradient colors={['#1B2B4D', '#0A0F1E']} style={styles.fill}>
        {initials ? (
          <Text style={{ fontSize: size * 0.36, color: '#fff', fontWeight: '600' }}>{initials}</Text>
        ) : (
          <Text style={{ fontSize: size * 0.42 }}>📞</Text>
        )}
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({ fill: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
