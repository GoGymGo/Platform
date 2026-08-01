import { privacyPolicy, termsOfService } from '@/constants/legal';
import { createUserStorage } from '@/services/storage/userStorage';

const legalAcceptanceKey = '@gogymgo/account-legal-acceptance';

type AccountLegalAcceptance = {
  acceptedAt: string;
  privacyPolicyEffectiveDate: string;
  termsEffectiveDate: string;
  userId: string;
};

export async function recordAccountLegalAcceptance(userId: string) {
  const acceptance: AccountLegalAcceptance = {
    acceptedAt: new Date().toISOString(),
    privacyPolicyEffectiveDate: privacyPolicy.effectiveDate,
    termsEffectiveDate: termsOfService.effectiveDate,
    userId
  };

  await createUserStorage(userId).setItem(
    legalAcceptanceKey,
    JSON.stringify(acceptance)
  );
}
