import { errorFromResponse } from '../errorMessage';

export async function apiError(
  response: Response,
  fallback: string
): Promise<never> {
  throw await errorFromResponse(response, fallback);
}
