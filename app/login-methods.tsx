"use client";

import { useState } from "react";
import { EmailLoginForm } from "./email-login-form";
import { GoogleLoginButton } from "./google-login-button";

export function LoginMethods({ returnTo }: { returnTo: string }) {
  const [showEmail, setShowEmail] = useState(false);
  return (
    <>
      <GoogleLoginButton returnTo={returnTo} />
      {showEmail ? (
        <EmailLoginForm returnTo={returnTo} />
      ) : (
        <button type="button" className="email-login-button" onClick={() => setShowEmail(true)}>
          Continuar con correo
        </button>
      )}
    </>
  );
}
