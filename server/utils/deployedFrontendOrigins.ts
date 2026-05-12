export const EXPRESS_PRODUCTION_CORS_ORIGINS = [
  "https://pfcontrol.com",
  "https://canary.pfcontrol.com",
  "https://preview.pfcontrol.com",
] as const;

export const SOCKET_IO_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:9901",
  ...EXPRESS_PRODUCTION_CORS_ORIGINS,
] as const;