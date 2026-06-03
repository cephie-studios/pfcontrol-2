import type { PostHogErrorBoundaryFallbackProps } from '@posthog/react';

export default function PostHogErrorFallback({
  error,
}: PostHogErrorBoundaryFallbackProps) {
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred';
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold text-neutral-100">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-neutral-400">
        This error was reported automatically. Try refreshing the page. If it
        keeps happening, contact support.
      </p>
      {import.meta.env.DEV ? (
        <pre className="mt-2 max-h-40 max-w-full overflow-auto rounded-md bg-neutral-900 p-3 text-left text-xs text-red-300">
          {message}
        </pre>
      ) : null}
    </div>
  );
}
