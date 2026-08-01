import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthStatusNotice } from '@/components/auth';
import { CyberButtonPrimary, HUDBorderBox, TerminalText } from '@/components/cyber';
import { LegalConsentCheckbox, LegalDocumentLinks } from '@/components/legal';
import { spacing } from '@/constants/theme';
import {
  useCurrentLegalDocuments,
  useLegalReceiptStatus,
  useRecordLegalReceipt
} from '@/data/accountReadinessHooks';

export function AccountLegalAgreement({
  jurisdictionCode,
  onComplete
}: {
  jurisdictionCode: string;
  onComplete: () => void;
}) {
  const legalDocuments = useCurrentLegalDocuments(jurisdictionCode);
  const legalReceipt = useLegalReceiptStatus(jurisdictionCode);
  const recordLegalReceipt = useRecordLegalReceipt();
  const [acceptedBundleSha256, setAcceptedBundleSha256] = useState<string>();
  const [submissionError, setSubmissionError] = useState<string>();
  const legalReceiptCurrent = legalReceipt.data?.complete === true;
  const legalBundleReady =
    legalDocuments.data?.configured === true && legalDocuments.data.documents.length > 0;
  const legalBundleSha256 = legalDocuments.data?.bundleSha256;
  const accountLegalAccepted =
    legalReceiptCurrent ||
    (Boolean(legalBundleSha256) && acceptedBundleSha256 === legalBundleSha256);
  const busy = legalDocuments.isLoading || legalReceipt.isLoading || recordLegalReceipt.isPending;
  const canContinue = legalBundleReady && accountLegalAccepted && !busy;

  async function saveAndContinue() {
    setSubmissionError(undefined);

    if (!legalBundleReady || !legalDocuments.data) {
      setSubmissionError(
        'Current legal documents are unavailable. Check your connection and try again.'
      );
      return;
    }
    if (!accountLegalAccepted) {
      setSubmissionError('Accept the Terms and acknowledge the Privacy Policy to continue.');
      return;
    }

    try {
      if (!legalReceiptCurrent) {
        const receipt = await recordLegalReceipt.mutateAsync(legalDocuments.data);
        if (!receipt.complete || !receipt.receiptBundleId) {
          throw new Error('Your agreement receipt could not be confirmed.');
        }
      }
      onComplete();
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : 'Your agreements could not be recorded. Try again.'
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <TerminalText glow tone="cyan" variant="label">
          ACCOUNT AGREEMENTS
        </TerminalText>
        <TerminalText tone="muted" uppercase={false} variant="body">
          Review these once for your verified region. We will ask again only when a required
          document changes.
        </TerminalText>
      </View>

      <HUDBorderBox
        glow={legalReceiptCurrent}
        style={styles.panel}
        tone={legalReceiptCurrent ? 'green' : 'muted'}
      >
        <View style={styles.panelHeader}>
          <TerminalText tone="text" variant="label">
            PRIVACY + TERMS
          </TerminalText>
          {legalReceiptCurrent ? (
            <TerminalText glow tone="green" variant="micro">
              ACCEPTED
            </TerminalText>
          ) : null}
        </View>
        <LegalDocumentLinks compact={legalReceiptCurrent} jurisdictionCode={jurisdictionCode} />
        {!legalReceiptCurrent ? (
          <LegalConsentCheckbox
            checked={accountLegalAccepted}
            label="I accept the Terms and acknowledge the Privacy Policy."
            onToggle={() =>
              setAcceptedBundleSha256(
                accountLegalAccepted ? undefined : legalDocuments.data?.bundleSha256
              )
            }
          />
        ) : null}
        {busy ? (
          <TerminalText live="polite" tone="dim" variant="caption">
            CHECKING CURRENT DOCUMENTS...
          </TerminalText>
        ) : null}
        {!busy && !legalBundleReady ? (
          <AuthStatusNotice
            message="LEGAL DOCUMENTS HAVE NOT BEEN CONFIGURED FOR THIS REGION YET."
            tone="amber"
          />
        ) : null}
      </HUDBorderBox>

      {submissionError ? <AuthStatusNotice message={submissionError} tone="red" /> : null}

      <CyberButtonPrimary
        disabled={!canContinue}
        label={
          recordLegalReceipt.isPending
            ? 'SAVING AGREEMENTS...'
            : legalReceiptCurrent
              ? 'CONTINUE TO WEEKLY GOAL ->'
              : 'AGREE & CONTINUE ->'
        }
        onPress={() => void saveAndContinue()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  heading: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  panel: {
    gap: spacing.md,
    padding: spacing.lg
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  }
});
