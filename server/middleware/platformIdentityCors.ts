import cors from 'cors';

const PROD_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)*pfcontrol\.com$/i;
const DEV_ORIGINS = ['http://localhost:9901', 'http://localhost:5173'];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / non-browser requests carry no Origin header
  if (process.env.NODE_ENV === 'production') {
    return PROD_ORIGIN_PATTERN.test(origin);
  }
  return DEV_ORIGINS.includes(origin);
}

export const platformIdentityCors = cors({
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Accept', 'Content-Type'],
});
