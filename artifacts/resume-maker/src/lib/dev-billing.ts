/** Explicit override from `artifacts/resume-maker/.env` (optional). */
function envFlag(name: string): boolean | undefined {
  const raw = import.meta.env[name];
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

/**
 * Show dev billing controls (bypass payment, reset plan).
 * Enabled on Vite dev, localhost (incl. preview), or when `VITE_ENABLE_DEV_BILLING=true`.
 * Never enabled on production hostnames unless explicitly forced.
 */
export function isDevBillingUiEnabled(): boolean {
  const override = envFlag("VITE_ENABLE_DEV_BILLING");
  if (override === true) return true;
  if (override === false) return false;

  if (import.meta.env.DEV) return true;
  if (isLocalDevHost()) return true;

  return false;
}
