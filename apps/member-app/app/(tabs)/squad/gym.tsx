import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useCompetitionRegion } from '@/state/competitionRegion';

export default function GymCompetitionScreen() {
  const router = useRouter();
  const { competitionRegion } = useCompetitionRegion();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <CyberButtonOutline
            label="BACK"
            onPress={() => goBackOrReplace(router, '/squad')}
            style={styles.backButton}
          />
          <View style={styles.headerCopy}>
            <TerminalText tone="dim" variant="label">
              PARTNER GYM
            </TerminalText>
            <TerminalText glow style={styles.headerTitle} tone="cyan" variant="title">
              GYM COMPETITION
            </TerminalText>
          </View>
        </View>

        <HUDBorderBox style={styles.unavailableCard} tone="muted">
          <TerminalText glow tone="cyan" variant="label">
            PARTNER GYMS AREN&apos;T AVAILABLE IN {competitionRegion.label} YET
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Verified gym competitions and QR check-ins will appear here when
            participating locations are ready.
          </TerminalText>
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  backButton: {
    width: 96,
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  headerCopy: {
    flex: 1
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  unavailableCard: {
    gap: spacing.sm,
    padding: spacing.xl
  }
});
