import Image from "next/image";
import Link from "next/link";
import { LoginMethods } from "../login-methods";

const errorMessages: Record<string, string> = {
  access_denied: "Se canceló el acceso con Google.",
  invalid_state: "La solicitud de acceso venció o no es válida. Intenta nuevamente.",
  expired_state: "La solicitud de acceso venció. Intenta nuevamente.",
  used_state: "Este enlace de acceso ya fue utilizado.",
  token_exchange_failed: "Google no pudo completar el acceso. Intenta nuevamente.",
  invalid_identity: "No se pudo verificar la identidad de Google.",
  not_configured: "El acceso estará disponible cuando Pipiro quede conectado al dominio.",
  invitation_required: "Esta sección es privada. Un administrador debe invitar este correo antes de permitir el acceso.",
  rate_limited: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  turnstile_failed: "No pudimos confirmar que eres una persona. Inténtalo de nuevo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const { error, returnTo } = await searchParams;
  const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return (
    <main className="login-page">
      <section className="login-card">
        <Link className="login-brand" href="/" aria-label="Volver a Pipiro">
          <Image src="/pipiro-logo.png" alt="Pipiro x Solo México" width={900} height={500} priority unoptimized />
        </Link>
        <div className="login-copy">
          <p className="eyebrow">TU CUENTA PIPIRO</p>
          <h1>Ingresa para ordenar</h1>
          <p>Administra tus estudiantes, pedidos, comprobantes y entregas desde un solo lugar.</p>
        </div>
        {error && <p className="login-error" role="alert">{errorMessages[error] ?? "No se pudo completar el acceso."}</p>}
        <LoginMethods returnTo={safeReturnTo} />
        <p className="login-legal">Al continuar aceptas los <Link href="/terminos">términos</Link> y el <Link href="/privacidad">aviso de privacidad</Link> de Pipiro.</p>
      </section>
      <aside className="login-aside" aria-hidden="true"><div><span>Almuerzos escolares</span><strong>Preparados con cuidado.<br />Entregados a tiempo.</strong></div></aside>
    </main>
  );
}
