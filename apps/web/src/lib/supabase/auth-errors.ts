export type AuthFailure = {
  message: string;
  /** Supabase error code, when the server supplied one. */
  code?: string;
};

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Your email address isn't confirmed yet. Check your inbox for the confirmation link.",
  user_already_exists: "An account with this email already exists. Sign in instead.",
  email_exists: "An account with this email already exists. Sign in instead.",
  weak_password: "That password is too weak. Use at least 6 characters and mix in numbers or symbols.",
  signup_disabled: "Sign ups are currently disabled for this workspace.",
  over_email_send_rate_limit: "Too many emails were requested. Wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  otp_expired: "That link has expired or was already used. Request a new one.",
  user_banned: "This account has been suspended.",
  validation_failed: "Enter a valid email address.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Turns a Supabase auth error (or anything thrown) into a message safe to show users. */
export function describeAuthError(error: unknown): AuthFailure {
  if (!isRecord(error)) return { message: "Authentication request failed. Try again." };

  const code = typeof error.code === "string" ? error.code : undefined;
  const name = typeof error.name === "string" ? error.name : "";
  const raw = typeof error.message === "string" ? error.message : "";

  if (name === "AuthRetryableFetchError" || /failed to fetch|networkerror|load failed/i.test(raw)) {
    return { code: "network", message: "Can't reach the server. Check your connection and try again." };
  }
  if (name === "AuthSessionMissingError") {
    return { code: "session_missing", message: "Your session has expired. Sign in again, or request a new reset link." };
  }
  if (code && MESSAGES[code]) return { code, message: MESSAGES[code] };
  // Older auth servers omit `code`; match the few messages we care about.
  if (/email not confirmed/i.test(raw)) return { code: "email_not_confirmed", message: MESSAGES.email_not_confirmed };
  if (/invalid login credentials/i.test(raw)) return { code: "invalid_credentials", message: MESSAGES.invalid_credentials };

  return { code, message: raw || "Authentication request failed. Try again." };
}

/**
 * Reads an error Supabase appended to the current URL, e.g. after following an expired
 * confirmation link: `?error_code=otp_expired&error_description=...` or the same in the hash.
 */
export function readUrlAuthError(url: URL): AuthFailure | null {
  const sources = [url.searchParams, new URLSearchParams(url.hash.replace(/^#/, ""))];
  for (const params of sources) {
    const code = params.get("error_code") ?? undefined;
    const description = params.get("error_description");
    if (!code && !description && !params.get("error")) continue;
    return {
      code,
      message: (code && MESSAGES[code]) || description?.replace(/\+/g, " ") || "That link is no longer valid. Request a new one.",
    };
  }
  return null;
}

const DEAD_SESSION_CODES = new Set(["bad_jwt", "user_not_found", "session_not_found", "refresh_token_not_found"]);

/**
 * True when the server says the stored session can never work again (deleted user, rotated
 * keys, revoked token). The right response is to drop it and sign in again, not to retry.
 */
export function isDeadSessionError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const status = typeof error.status === "number" ? error.status : undefined;
  const code = typeof error.code === "string" ? error.code : undefined;
  if (code && DEAD_SESSION_CODES.has(code)) return true;
  return status === 401 || status === 403;
}
