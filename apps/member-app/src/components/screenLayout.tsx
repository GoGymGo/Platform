import type { ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { TerminalText } from '@/components/cyber';
import {
  colors,
  fontFamilies,
  fontSizes,
  spacing
} from '@/constants/theme';

type BrandAccent = 'amber' | 'cyan' | 'green' | 'pink' | 'red';

type BrandScreenHeaderProps = {
  accessory?: ReactNode;
  accent?: BrandAccent;
  description?: ReactNode;
  eyebrow?: ReactNode;
  style?: StyleProp<ViewStyle>;
  title: ReactNode;
};

const accentBorderStyles: Record<BrandAccent, ViewStyle> = {
  amber: { borderLeftColor: colors.amber },
  cyan: { borderLeftColor: colors.cyan },
  green: { borderLeftColor: colors.green },
  pink: { borderLeftColor: colors.pink },
  red: { borderLeftColor: colors.statusError }
};

export function BrandScreenHeader({
  accessory,
  accent = 'cyan',
  description,
  eyebrow,
  style,
  title
}: BrandScreenHeaderProps) {
  const { width } = useWindowDimensions();
  const compact = Boolean(accessory) && width <= 340;

  return (
    <View style={[styles.header, accentBorderStyles[accent], style]}>
      {eyebrow ? (
        <TerminalText tone={accent} variant="label">
          {eyebrow}
        </TerminalText>
      ) : null}
      <View style={[styles.titleRow, compact ? styles.titleRowCompact : null]}>
        <TerminalText
          style={[styles.title, compact ? styles.titleCompact : null]}
          tone="text"
          variant="title"
        >
          {title}
        </TerminalText>
        {accessory ? (
          compact ? <View style={styles.accessoryCompact}>{accessory}</View> : accessory
        ) : null}
      </View>
      {description ? (
        <TerminalText
          style={styles.description}
          tone="muted"
          uppercase={false}
          variant="body"
        >
          {description}
        </TerminalText>
      ) : null}
    </View>
  );
}

export const brandScreenStyles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.transparent
  },
  tabContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.transparent
  },
  section: {
    gap: spacing.md
  },
  separatedSection: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle
  }
});

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingLeft: 14,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2
  },
  titleRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  titleRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm
  },
  title: {
    minWidth: 0,
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34
  },
  titleCompact: {
    width: '100%',
    flex: 0,
    fontSize: fontSizes.titleXl,
    lineHeight: 31
  },
  accessoryCompact: {
    alignSelf: 'flex-end'
  },
  description: {
    maxWidth: 420,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24
  }
});
