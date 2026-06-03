import { useEffect } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { apiFetch } from "../../utils/apiFetch";

/**
 * Loads FingerprintJS, gets the visitor ID, and submits it to the server.
 * Only runs when the user is authenticated (userId is defined).
 * On a 403 response, apiFetch dispatches 'auth:forbidden' which evicts the session.
 */
export function useFingerprint(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function submitFingerprint() {
      try {
        const apiBase = import.meta.env.VITE_SERVER_URL ?? "";
        const base = apiBase.replace(/\/$/, "");
        const url =
          base === ""
            ? "/api/auth/fingerprint"
            : `${base}/api/auth/fingerprint`;
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        if (cancelled) return;
        await apiFetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: result.visitorId }),
        });
      } catch {
        // Non-fatal — fingerprint is a secondary layer, not required for login
      }
    }

    submitFingerprint();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
