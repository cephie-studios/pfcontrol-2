export type NetworkKind = "pfatc" | "advanced_atc";

type SessionKindShape = {
  is_pfatc?: boolean | null;
  is_advanced_atc?: boolean | null;
};

export function isAdvancedNetworkSession(session: SessionKindShape): boolean {
  return Boolean(session.is_pfatc) || Boolean(session.is_advanced_atc);
}

export function getNetworkKind(session: SessionKindShape): NetworkKind | null {
  if (session.is_pfatc) return "pfatc";
  if (session.is_advanced_atc) return "advanced_atc";
  return null;
}

export function isSameNetwork(
  a: SessionKindShape,
  b: SessionKindShape
): boolean {
  const kindA = getNetworkKind(a);
  const kindB = getNetworkKind(b);
  return kindA !== null && kindA === kindB;
}
