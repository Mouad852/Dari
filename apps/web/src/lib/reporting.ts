export type SafeErrorContext = {
  route?: string;
  digest?: string;
  correlationId?: string;
  releaseVersion?: string;
  kind?: string;
};

export type ErrorReporter = (error: unknown, context: SafeErrorContext) => void;

let reporter: ErrorReporter = () => undefined;

export function configureErrorReporter(nextReporter: ErrorReporter): void {
  reporter = nextReporter;
}

export function reportError(error: unknown, context: SafeErrorContext = {}): void {
  reporter(error, {
    ...context,
    route: context.route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
    releaseVersion: context.releaseVersion ?? process.env.NEXT_PUBLIC_RELEASE_VERSION ?? 'development',
  });
}
