"use client";

import { useState, type FormEvent } from "react";
import { useTurnstile } from "./use-turnstile";

type Step = "email" | "code";

export function EmailLoginForm({ returnTo }: { returnTo: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { siteKey, token } = useTurnstile("turnstile-widget-email", "email_login");
  const needsVerification = Boolean(siteKey) && !token;

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    if (pending || needsVerification) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setError(payload?.error ?? "No se pudo enviar el código.");
        return;
      }
      setStep("code");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setError(payload?.error ?? "Código incorrecto o vencido.");
        return;
      }
      window.location.href = returnTo;
    } finally {
      setPending(false);
    }
  }

  if (step === "code") {
    return (
      <form className="email-login-form" onSubmit={verifyCode}>
        <p className="email-login-hint">Enviamos un código a <strong>{email}</strong>. Vence en 10 minutos.</p>
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="123456"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          autoComplete="one-time-code"
        />
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" className="email-login-submit" disabled={pending || code.length !== 6}>
          {pending ? "Verificando…" : "Confirmar código"}
        </button>
        <button type="button" className="email-login-back" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
          Usar otro correo
        </button>
      </form>
    );
  }

  return (
    <form className="email-login-form" onSubmit={sendCode}>
      <input
        type="email"
        required
        placeholder="tu-correo@ejemplo.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
      />
      {siteKey && <div id="turnstile-widget-email" className="turnstile-widget" />}
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="email-login-submit" disabled={pending || needsVerification}>
        {pending ? "Enviando…" : "Enviar código"}
      </button>
    </form>
  );
}
