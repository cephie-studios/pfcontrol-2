export class ExclusiveSessionNetworkFlagsError extends Error {
  constructor() {
    super("is_pfatc and is_advanced_atc cannot both be true");
    this.name = "ExclusiveSessionNetworkFlagsError";
  }
}

export function assertExclusiveSessionNetworkFlags(
  isPfatc: boolean,
  isAdvancedAtc: boolean
): void {
  if (isPfatc && isAdvancedAtc) {
    throw new ExclusiveSessionNetworkFlagsError();
  }
}

export function isPostgresCheckViolation(error: unknown): boolean {
  const walk = (e: unknown): boolean => {
    if (e === null || typeof e !== "object") return false;
    const o = e as { code?: string; cause?: unknown };
    if (o.code === "23514") return true;
    if (o.cause !== undefined) return walk(o.cause);
    return false;
  };
  return walk(error);
}
