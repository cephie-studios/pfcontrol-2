const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

export interface ATISGenerateRequest {
  sessionId: string;
  ident: string;
  icao: string;
  remarks1?: string;
  remarks2?: Record<string, unknown>;
  landing_runways: string[];
  departing_runways: string[];
  metar?: string;
}

export interface ATISGenerateResponse {
  atisText: string;
  ident: string;
  timestamp: string;
}

export async function generateATIS(
  data: ATISGenerateRequest
): Promise<ATISGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/atis/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Server responded with ${response.status}`
    );
  }

  return response.json();
}
