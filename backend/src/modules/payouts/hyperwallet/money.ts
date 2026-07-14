import { BadRequestException } from '@nestjs/common';
import type { SupportedPayoutCurrency } from './hyperwallet.types';

const SUPPORTED_CURRENCIES = new Set<SupportedPayoutCurrency>([
  'CAD',
  'MXN',
  'USD',
]);

export function assertSupportedPayoutCurrency(
  currency: string,
): asserts currency is SupportedPayoutCurrency {
  if (!SUPPORTED_CURRENCIES.has(currency as SupportedPayoutCurrency)) {
    throw new BadRequestException({
      code: 'UNSUPPORTED_PAYOUT_CURRENCY',
      message: 'Payout currency must be CAD, MXN, or USD.',
    });
  }
}

export function minorUnitsToDecimal(
  amountMinor: bigint | number | string,
): string {
  let amount: bigint;
  try {
    amount = BigInt(amountMinor);
  } catch {
    throw new BadRequestException({
      code: 'INVALID_PAYOUT_AMOUNT',
      message: 'The payout amount must be a whole number of minor units.',
    });
  }

  if (amount <= 0n) {
    throw new BadRequestException({
      code: 'INVALID_PAYOUT_AMOUNT',
      message: 'The payout amount must be greater than zero.',
    });
  }

  const whole = amount / 100n;
  const fraction = (amount % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${fraction}`;
}
