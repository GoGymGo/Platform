import {
  isSpanContextValid,
  trace,
  type SpanContext,
} from '@opentelemetry/api';

export interface TraceLogFields {
  'logging.googleapis.com/spanId': string;
  'logging.googleapis.com/trace'?: string;
  'logging.googleapis.com/trace_sampled': boolean;
  spanId: string;
  traceId: string;
}

export function traceLogFields(
  context: SpanContext | undefined,
  googleCloudProject?: string,
): TraceLogFields | Record<string, never> {
  if (!context || !isSpanContextValid(context)) return {};
  return {
    ...(googleCloudProject
      ? {
          'logging.googleapis.com/trace': `projects/${googleCloudProject}/traces/${context.traceId}`,
        }
      : {}),
    'logging.googleapis.com/spanId': context.spanId,
    'logging.googleapis.com/trace_sampled': (context.traceFlags & 1) === 1,
    spanId: context.spanId,
    traceId: context.traceId,
  };
}

export function activeTraceLogFields(): TraceLogFields | Record<string, never> {
  return traceLogFields(
    trace.getActiveSpan()?.spanContext(),
    process.env.GOOGLE_CLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID,
  );
}
