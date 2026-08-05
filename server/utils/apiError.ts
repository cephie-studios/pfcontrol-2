import type { Response } from 'express';

export function sendServerError(
  res: Response,
  publicMessage: string,
  err: unknown,
  status = 500
): void {
  const detail =
    process.env.NODE_ENV !== 'production' && err instanceof Error
      ? err.message
      : undefined;
  res
    .status(status)
    .json(detail ? { error: publicMessage, detail } : { error: publicMessage });
}
