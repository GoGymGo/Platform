import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthStatusNotice, AuthTextField } from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { SponsorRail } from '@/components/sponsor';
import { colors, spacing } from '@/constants/theme';
import {
  decideBcRegionReview,
  listPendingBcRegionReviews,
  type BcRegionReview
} from '@/services/operatorRegionReviews';
import { useApi } from '@/state/api';
import { useProfile } from '@/state/profile';

const operatorRoles = new Set(['admin', 'fraud_operator', 'operator']);

export default function RegionReviewsScreen() {
  const router = useRouter();
  const { api } = useApi();
  const { roles } = useProfile();
  const isOperator = roles.some((role) => operatorRoles.has(role));
  const [reviews, setReviews] = useState<BcRegionReview[]>([]);
  const [reason, setReason] = useState('BC demo eligibility reviewed by operator.');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();

  const load = useCallback(async () => {
    if (!isOperator) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(undefined);
    try {
      setReviews(await listPendingBcRegionReviews(api));
    } catch {
      setMessage('THE BC REVIEW QUEUE COULD NOT BE LOADED.');
    } finally {
      setLoading(false);
    }
  }, [api, isOperator]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function decide(review: BcRegionReview, decision: 'approved' | 'rejected') {
    if (reason.trim().length < 8) {
      setMessage('ENTER A REVIEW REASON OF AT LEAST 8 CHARACTERS.');
      return;
    }
    setBusyId(review.id);
    setMessage(undefined);
    try {
      await decideBcRegionReview(api, review.id, decision, reason);
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setMessage(`BC SUBMISSION ${decision.toUpperCase()}.`);
    } catch {
      setMessage('THE REVIEW DECISION COULD NOT BE SAVED. REFRESH AND TRY AGAIN.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScreenContainer>
      <SponsorRail compact />
      <ScreenScrollView contentContainerStyle={styles.content}>
        <CyberButtonOutline label="<- PROFILE" onPress={() => router.replace('/profile')} />
        <TerminalText glow tone="cyan" variant="title">
          BC REGION REVIEWS
        </TerminalText>
        <TerminalText tone="muted" uppercase={false} variant="body">
          Review only eligibility status. Exact coordinates and postal evidence are not shown here.
        </TerminalText>

        {!isOperator ? (
          <AuthStatusNotice message="AN OPERATOR ROLE IS REQUIRED FOR THIS SCREEN." tone="red" />
        ) : (
          <>
            <AuthTextField
              label="OPERATOR DECISION REASON"
              maxLength={500}
              onChangeText={setReason}
              value={reason}
            />
            <CyberButtonOutline
              disabled={loading}
              label={loading ? 'LOADING...' : 'REFRESH QUEUE'}
              onPress={() => void load()}
            />
            {!loading && reviews.length === 0 ? (
              <HUDBorderBox style={styles.card} tone="muted">
                <TerminalText tone="green" variant="label">
                  NO PENDING BC SUBMISSIONS
                </TerminalText>
              </HUDBorderBox>
            ) : null}
            {reviews.map((review) => (
              <HUDBorderBox key={review.id} style={styles.card} tone="cyan">
                <TerminalText tone="cyan" variant="label">
                  {review.regionCode}
                </TerminalText>
                <TerminalText tone="muted" uppercase={false} variant="caption">
                  Submitted {new Date(review.createdAt).toLocaleString()}
                </TerminalText>
                <TerminalText tone="dim" variant="micro">
                  METHOD // {review.verificationMethod.replaceAll('_', ' ')}
                </TerminalText>
                <TerminalText tone="dim" variant="micro">
                  {review.id}
                </TerminalText>
                <View style={styles.actions}>
                  <CyberButtonPrimary
                    disabled={busyId !== null}
                    label="APPROVE"
                    onPress={() => void decide(review, 'approved')}
                    style={styles.action}
                  />
                  <CyberButtonOutline
                    disabled={busyId !== null}
                    label="REJECT"
                    onPress={() => void decide(review, 'rejected')}
                    style={styles.action}
                    tone="red"
                  />
                </View>
              </HUDBorderBox>
            ))}
          </>
        )}
        {message ? <AuthStatusNotice message={message} tone="amber" /> : null}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  action: {
    flex: 1
  }
});
