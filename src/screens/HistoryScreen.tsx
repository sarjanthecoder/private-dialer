import React, { useCallback } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CallRow, ROW_HEIGHT } from '../components/CallRow';
import { useCallLog } from '../hooks/useCallLog';
import { Dialer } from '../services/dialer';
import { colors, fonts } from '../theme';
import type { CallLogEntry } from '../types';

const keyExtractor = (i: CallLogEntry) => i.id;
const getItemLayout = (_: unknown, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index });

export function HistoryScreen() {
  const { items, error, loading, refresh } = useCallLog();

  const callBack = useCallback((e: CallLogEntry) => {
    const p = e.isPrivate ? Dialer.callPrivate() : Dialer.dial(e.number);
    p.catch((err: Error) => Alert.alert('Call failed', err.message));
  }, []);
  const render = useCallback(({ item }: { item: CallLogEntry }) => <CallRow item={item} onPress={callBack} />, [callBack]);

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.root}>
      <Text style={styles.title}>Recents</Text>
      {error ? <Text style={styles.empty}>{error}</Text> : null}
      <FlatList
        data={items}
        renderItem={render}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        initialNumToRender={12}
        windowSize={7}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={!error && !loading ? <Text style={styles.empty}>No calls yet</Text> : null}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 28, paddingHorizontal: 20, paddingBottom: 8 },
  empty: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 14, paddingHorizontal: 20, paddingVertical: 12 },
});
