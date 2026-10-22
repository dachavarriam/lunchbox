"use client";

import { useTurnstile } from "./use-turnstile";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.8A6 6 0 0 1 6.1 12c0-.6.1-1.2.3-1.8V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3 1.1 4.4l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.6C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  );
}

export function GoogleLoginButton({ returnTo }: { returnTo: string }) {
  const { siteKey, token } = useTurnstile("turnstile-widget-google", "login");
  const needsVerification = Boolean(siteKey) && !token;
  const href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}${token ? `&turnstileToken=${encodeURIComponent(token)}` : ""}`;

  return (
    <>
      {siteKey && <div id="turnstile-widget-google" className="turnstile-widget" />}
      <a
        className={`google-login-button${needsVerification ? " is-disabled" : ""}`}
        href={needsVerification ? undefined : href}
        aria-disabled={needsVerification}
        onClick={(event) => { if (needsVerification) event.preventDefault(); }}
      >
        <GoogleIcon />
        Continuar con Google
      </a>
    </>
  );
}
