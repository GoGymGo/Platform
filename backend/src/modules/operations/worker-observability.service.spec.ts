import { safeOperationalErrorCode } from './worker-observability.service';

describe('worker observability', () => {
  it('records only a bounded error type, never the error message', () => {
    const error = new TypeError('coupon code and encryption secret');
    expect(safeOperationalErrorCode(error)).toBe('TypeError');
    expect(safeOperationalErrorCode(error)).not.toContain(error.message);
    expect(safeOperationalErrorCode('failure')).toBe('UnknownError');
  });
});
