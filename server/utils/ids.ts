import crypto from 'crypto';

export function generateFlightId() {
  return crypto.randomBytes(8).toString('hex').substring(0, 8);
}
export function generateSessionId() {
  return crypto.randomBytes(4).toString('hex').substring(0, 8);
}
export function generateAccessId() {
  return crypto.randomBytes(32).toString('hex');
}
