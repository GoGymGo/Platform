import { BadRequestException } from '@nestjs/common';
import { assertSupportedPayoutCurrency, minorUnitsToDecimal } from './money';

describe('Hyperwallet money helpers', () => {
  it.each([
    [1, '0.01'],
    [105, '1.05'],
    [12_345, '123.45'],
    ['9007199254740993', '90071992547409.93'],
  ])('formats %s minor units without floating-point math', (input, output) => {
    expect(minorUnitsToDecimal(input)).toBe(output);
  });

  it.each([0, -1, 1.5, 'not-money'])(
    'rejects invalid minor units: %s',
    (input) => {
      expect(() => minorUnitsToDecimal(input)).toThrow(BadRequestException);
    },
  );

  it('limits the payout boundary to configured North American currencies', () => {
    expect(() => assertSupportedPayoutCurrency('CAD')).not.toThrow();
    expect(() => assertSupportedPayoutCurrency('EUR')).toThrow(
      /CAD, MXN, or USD/i,
    );
  });
});
