import leoProfanity from 'leo-profanity';

try {
  leoProfanity.loadDictionary('en');
} catch {
  // ignore
}
const BAD_WORDS = leoProfanity.list().filter((w) => w.length >= 5);

function normalizeForProfanity(s: string) {
  return s
    .toLowerCase()
    .replace(/[\s\-_@*#$%.,!?]+/g, '')
    .replace(/[0o]/g, 'o')
    .replace(/[1il!]/g, 'i')
    .replace(/[3e]/g, 'e')
    .replace(/[4a@]/g, 'a')
    .replace(/[5s$]/g, 's')
    .replace(/[7t]/g, 't')
    .replace(/[9g]/g, 'g');
}

function normalizeWordChars(w: string) {
  return w
    .replace(/[0o]/g, 'o')
    .replace(/[1il!]/g, 'i')
    .replace(/[3e]/g, 'e')
    .replace(/[4a@]/g, 'a')
    .replace(/[5s$]/g, 's')
    .replace(/[7t]/g, 't')
    .replace(/[9g]/g, 'g');
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyMatchesBadWord(word: string): boolean {
  if (word.length < 5) return false;
  const threshold = word.length <= 6 ? 1 : 2;
  for (const bad of BAD_WORDS) {
    if (Math.abs(word.length - bad.length) > threshold) continue;
    if (levenshteinDistance(word, bad) <= threshold) return true;
  }
  return false;
}

const SUBSTRING_MATCH_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'whore',
  'slut',
];

const SUBSTRING_SAFE_WORDS = [
  'niggardly',
  'niggard',
  'niggarded',
  'niggarding',
  'niggardliness',
  'niggardness',
  'scunthorpe',
  'shitake',
  'retardant',
  'retardants',
  'retardation',
  'retardations',
];

function hasSubstringMatch(raw: string): boolean {
  let cleaned = raw;
  for (const safe of SUBSTRING_SAFE_WORDS) {
    cleaned = cleaned.split(safe).join(' ');
  }
  return SUBSTRING_MATCH_WORDS.some((bad) => cleaned.includes(bad));
}

export function containsProfanity(message: string): boolean {
  if (!message || typeof message !== 'string') return false;

  const raw = message.toLowerCase().trim();
  try {
    if (leoProfanity.check(raw)) return true;
  } catch {
    // ignore
  }

  const norm = normalizeForProfanity(raw);
  try {
    if (leoProfanity.check(norm)) return true;
  } catch {
    // ignore
  }

  if (hasSubstringMatch(raw)) return true;

  const words = raw
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeWordChars);
  for (const word of words) {
    if (fuzzyMatchesBadWord(word)) return true;
  }

  return false;
}

export function containsHateSpeech(message: string): boolean {
  return containsProfanity(message);
}


const BIO_BLACKLISTED_LINK_DOMAINS = ['discord.com', 'discord.gg', 'discordapp.com', 'discord.app'];

export function containsBlacklistedBioLink(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  const lower = message.toLowerCase();
  return BIO_BLACKLISTED_LINK_DOMAINS.some((domain) => lower.includes(domain));
}

export function getHateSpeechReason(message: string): string {
  if (containsProfanity(message)) return 'Profanity detected';
  return 'No hate speech detected';
}
