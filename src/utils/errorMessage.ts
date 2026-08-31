const GENERIC_ERRORS = new Set([
  'internal server error',
  'something went wrong',
]);

function pickServerMessage(data: {
  error?: unknown;
  message?: unknown;
}): string | undefined {
  const error =
    typeof data.error === 'string' && data.error.trim()
      ? data.error
      : undefined;
  const message =
    typeof data.message === 'string' && data.message.trim()
      ? data.message
      : undefined;

  if (message && !GENERIC_ERRORS.has(message.toLowerCase())) return message;
  if (error && !GENERIC_ERRORS.has(error.toLowerCase())) return error;
  return undefined;
}

export async function errorFromResponse(
  response: Response,
  fallback: string
): Promise<Error> {
  try {
    const clone = response.clone();
    const data = (await clone.json()) as {
      error?: unknown;
      message?: unknown;
    };
    const serverMsg = pickServerMessage(data);
    if (serverMsg) return new Error(serverMsg);
  } catch {
    // body was not JSON — fall through to the generic message
  }
  return new Error(fallback);
}
