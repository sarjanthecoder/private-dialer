import React, { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppNavigator } from './src/navigation/AppNavigator';
import { CallScreen } from './src/screens/CallScreen';
import { SplashAnimation } from './src/components/SplashAnimation';
import { useCall } from './src/hooks/useCall';
import { Dialer, requestRuntimePermissions } from './src/services/dialer';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  // Safety net: never stall on font loading if offline or font loader errors
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const call = useCall();

  useEffect(() => {
    const fontTimer = setTimeout(() => setFontsTimedOut(true), 1500);
    // Guarantee splash always dismisses even if animation callbacks are skipped
    const splashTimer = setTimeout(() => setSplashDone(true), 4000);
    return () => {
      clearTimeout(fontTimer);
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    void Dialer.setHighRefreshRate().catch(() => { /* no-op */ });
    void requestRuntimePermissions().catch(() => { /* no-op */ });
  }, []);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);
  const fontsReady = fontsLoaded || Boolean(fontError) || fontsTimedOut;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {fontsReady ? <AppNavigator /> : null}
        {fontsReady && call.state !== 'idle' ? <CallScreen call={call} /> : null}
        {!splashDone ? <SplashAnimation onDone={handleSplashDone} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
