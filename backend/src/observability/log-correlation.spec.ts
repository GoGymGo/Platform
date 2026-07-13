import { TraceFlags } from '@opentelemetry/api';
import { traceLogFields } from './log-correlation';

describe('trace log correlation', () => {
  it('formats valid trace context for generic and Google structured logs', () => {
    expect(
      traceLogFields(
        {
          spanId: '1234567890abcdef',
          traceFlags: TraceFlags.SAMPLED,
          traceId: '1234567890abcdef1234567890abcdef',
        },
        'gogymgo-production',
      ),
    ).toEqual({
      'logging.googleapis.com/spanId': '1234567890abcdef',
      'logging.googleapis.com/trace':
        'projects/gogymgo-production/traces/1234567890abcdef1234567890abcdef',
      'logging.googleapis.com/trace_sampled': true,
      spanId: '1234567890abcdef',
      traceId: '1234567890abcdef1234567890abcdef',
    });
  });

  it('does not emit malformed trace identifiers', () => {
    expect(
      traceLogFields({
        spanId: 'bad',
        traceFlags: TraceFlags.NONE,
        traceId: 'bad',
      }),
    ).toEqual({});
  });
});
