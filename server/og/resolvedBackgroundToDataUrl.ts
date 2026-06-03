import fs from "node:fs";
import { fetchUrlAsDataUrl } from "./renderProfileOgPng.js";
import type { ResolvedBackground } from "./profileBackground.js";

export async function resolvedBackgroundToDataUrl(
  resolved: ResolvedBackground | null
): Promise<string | null> {
  if (!resolved) return null;

  if (resolved.kind === "local") {
    try {
      const buf = fs.readFileSync(resolved.filePath);
      const ext = resolved.filePath.split(".").pop()?.toLowerCase() ?? "png";
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }

  return (await fetchUrlAsDataUrl(resolved.url)) ?? null;
}
