import { type Href, useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  View,
  type ViewStyle
} from 'react-native';

import { TerminalText } from '@/components/cyber';
import { colors, spacing } from '@/constants/theme';

export type CompetitionHubSection =
  | 'rankings'
  | 'challenge'
  | 'winners'
  | 'rewards';

const sections: readonly {
  key: CompetitionHubSection;
  label: string;
  route: Href;
}[] = [
  { key: 'rankings', label: 'OVERVIEW', route: '/leaderboard' },
  { key: 'challenge', label: 'CHALLENGE', route: '/squad' },
  { key: 'winners', label: 'WINNERS', route: '/winners-circle' },
  { key: 'rewards', label: 'REWARDS', route: '/leaderboard/rewards' }
];

export function CompetitionHubNav({
  active,
  style
}: {
  active: CompetitionHubSection;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width <= 340;

  return (
    <View accessibilityRole="tablist" style={[styles.container, style]}>
      {sections.map((section) => {
        const selected = section.key === active;

        return (
          <Pressable
            aria-selected={selected}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={section.key}
            onPress={() => {
              if (!selected) {
                router.replace(section.route);
              }
            }}
            style={({ pressed }) => [
              styles.tab,
              selected ? styles.tabSelected : null,
              pressed ? styles.tabPressed : null
            ]}
          >
            <TerminalText
              numberOfLines={1}
              style={[styles.label, compact ? styles.labelCompact : null]}
              tone={selected ? 'cyan' : 'dim'}
              variant="micro"
            >
              {section.label}
            </TerminalText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    zIndex: 10,
    paddingTop: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    backgroundColor: colors.panelAlpha84
  },
  tab: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabSelected: {
    borderBottomColor: colors.cyan,
    backgroundColor: colors.surfaceCyanFaint
  },
  tabPressed: {
    opacity: 0.72
  },
  label: {
    width: '100%',
    textAlign: 'center'
  },
  labelCompact: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.4
  }
});
