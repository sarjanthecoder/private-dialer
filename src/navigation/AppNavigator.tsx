import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactsScreen } from '../screens/ContactsScreen';
import { DialerScreen } from '../screens/DialerScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { colors } from '../theme';
import type { TabKey } from '../types';
import { TabBar } from './TabBar';

export function AppNavigator() {
  const [tab, setTab] = useState<TabKey>('dialer');
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        {tab === 'dialer'   && <DialerScreen />}
        {tab === 'contacts' && <ContactsScreen />}
        {tab === 'history'  && <HistoryScreen />}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg }, body: { flex: 1 } });
