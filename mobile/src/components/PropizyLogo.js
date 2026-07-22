import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

const LOGO = require('../../assets/propizy-logo.png');

const SIZES = {
  sm: { height: 28, word: 16, gap: 8 },
  md: { height: 36, word: 20, gap: 10 },
  lg: { height: 48, word: 28, gap: 12 },
};

/**
 * @param {'dark'|'light'} variant - dark = navy logo on light bg; light = white logo on dark bg
 */
export default function PropizyLogo({ size = 'md', variant = 'dark', showWordmark = true }) {
  const s = SIZES[size] || SIZES.md;
  const onDark = variant === 'light';
  const wordColor = onDark ? colors.white : colors.primary;

  return (
    <View style={[styles.row, { gap: s.gap }]}>
      <Image
        source={LOGO}
        style={{
          height: s.height,
          width: s.height * (562 / 330),
          resizeMode: 'contain',
          tintColor: onDark ? colors.white : undefined,
        }}
      />
      {showWordmark ? (
        <Text style={[styles.word, { fontSize: s.word, color: wordColor }]}>Propizy</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { fontWeight: '700', letterSpacing: -0.5 },
});
