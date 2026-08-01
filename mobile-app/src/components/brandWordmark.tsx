import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { colors, fontFamilies, fontSizes, textGlow } from '@/constants/theme';

type GoGymGoWordmarkProps = {
  compact?: boolean;
  style?: StyleProp<TextStyle>;
};

export function GoGymGoWordmark({ compact = false, style }: GoGymGoWordmarkProps) {
  return (
    <Text
      accessibilityLabel="GoGymGo"
      allowFontScaling
      maxFontSizeMultiplier={1.5}
      style={[styles.wordmark, compact ? styles.compact : null, style]}
    >
      <Text style={styles.cyan}>GO</Text>
      <Text style={styles.pink}>GYM</Text>
      <Text style={styles.cyan}>GO</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.logo,
    lineHeight: 58,
    letterSpacing: 1.2
  },
  compact: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 0.7
  },
  cyan: {
    color: colors.cyan,
    ...textGlow.cyan
  },
  pink: {
    color: colors.pink,
    ...textGlow.pink
  }
});
