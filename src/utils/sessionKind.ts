export function hasAdvancedNetworkFeatures(session: {
  isPFATC?: boolean;
  isAdvancedATC?: boolean;
}): boolean {
  return Boolean(session.isPFATC) || Boolean(session.isAdvancedATC);
}