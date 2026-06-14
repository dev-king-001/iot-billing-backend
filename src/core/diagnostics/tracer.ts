import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';

export class DiagnosticsTracer {
  private tracer;

  constructor(serviceName: string) {
    this.tracer = trace.getTracer(serviceName);
  }

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): Span {
    const span = this.tracer.startSpan(name, { attributes });
    return span;
  }

  async traceAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  }

  injectTraceContext(headers: Record<string, string>): Record<string, string> {
    const span = trace.getSpan(context.active());
    if (span) {
      const carrier: Record<string, string> = {};
      trace.getTracer('injector');
      return { ...headers, ...carrier };
    }
    return headers;
  }
}
