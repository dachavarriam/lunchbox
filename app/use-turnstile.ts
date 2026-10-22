"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** Loads the Turnstile widget script once and renders a widget into `containerId` for `action`. */
export function useTurnstile(containerId: string, action: string) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/config", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() as Promise<{ turnstileSiteKey?: string | null }> : null)
      .then((payload) => { if (!cancelled && payload?.turnstileSiteKey) setSiteKey(payload.turnstileSiteKey); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!siteKey) return;
    const renderWidget = () => {
      const container = document.getElementById(containerId);
      if (container && window.turnstile) {
        window.turnstile.render(container, { sitekey: siteKey, action, callback: (widgetToken: string) => setToken(widgetToken) });
      }
    };
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) renderWidget();
      else existing.addEventListener("load", renderWidget);
      return;
    }
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderWidget);
    document.head.appendChild(script);
  }, [siteKey, containerId, action]);

  return { siteKey, token };
}
