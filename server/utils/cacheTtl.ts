export const DEPLOYMENT = process.env.DEPLOYMENT ?? 'development';

export const prefixKey = (key: string) => `${DEPLOYMENT}:${key}`;

export const DATA_STATIC_REDIS_SEC = 12 * 60 * 60;
export const DATA_STATIC_BROWSER_SEC = 60 * 60;
export const DATA_STATIC_EDGE_SEC = DATA_STATIC_REDIS_SEC;

export const HOMEPAGE_STATS_REDIS_SEC = 60 * 60;
export const HOMEPAGE_STATS_BROWSER_SEC = 60;
export const HOMEPAGE_STATS_EDGE_SEC = HOMEPAGE_STATS_REDIS_SEC;

export const APP_VERSION_REDIS_SEC = 24 * 60 * 60;
export const APP_VERSION_BROWSER_SEC = 60;
export const APP_VERSION_EDGE_SEC = 5 * 60;

export const UPDATE_MODAL_REDIS_SEC = 24 * 60 * 60;
export const UPDATE_MODAL_BROWSER_SEC = 0;
export const UPDATE_MODAL_EDGE_SEC = 60;

export const LEADERBOARD_BROWSER_SEC = 120;
export const LEADERBOARD_EDGE_SEC = 5 * 60;
