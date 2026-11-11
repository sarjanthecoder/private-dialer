import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeypadButton } from './KeypadButton';

const ROWS: [string, string][][] = [
  [['1', ''], ['2', 'ABC'], ['3', 'DEF']],
  [['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO']],
  [['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']],
  [['*', ''], ['0', '+'], ['#', '']],
];

export const Keypad = memo(function Keypad({ onPress, plusOnZeroLong = false }: { onPress: (d: string) => void; plusOnZeroLong?: boolean }) {
  const onLong = React.useCallback(() => onPress('+'), [onPress]);
  return (
    <View style={styles.grid}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map(([d, s]) => (
            <KeypadButton key={d} digit={d} sub={s} onPress={onPress} onLongPress={plusOnZeroLong && d === '0' ? onLong : undefined} />
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 22 },
});
