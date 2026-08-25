import Image from "next/image";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  access_denied: "Se canceló el acceso con Google.",
  invalid_state: "La solicitud de acceso venció o no es válida. Intenta nuevamente.",
  expired_state: "La solicitud de acceso venció. Intenta nuevamente.",
  used_state: "Este enlace de acceso ya fue utilizado.",
  token_exchange_failed: "Google no pudo completar el acceso. Intenta nuevamente.",
  invalid_identity: "No se pudo verificar la identidad de Google.",
  not_configured: "El acceso estará disponible cuando Pipiro quede conectado al dominio.",
  invitation_required: "Esta sección es privada. Un administrador debe invitar este correo antes de permitir el acceso.",
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
        <a className="google-login-button" href={`/api/auth/google/start?returnTo=${encodeURIComponent(safeReturnTo)}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/>
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"/>
            <path fill="#FBBC05" d="M6.4 13.8A6 6 0 0 1 6.1 12c0-.6.1-1.2.3-1.8V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3 1.1 4.4l3.3-2.6Z"/>
            <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.6C7.2 7.8 9.4 6 12 6Z"/>
          </svg>
          Continuar con Google
        </a>
        <button className="email-login-button" disabled>Continuar con correo <span>Próximamente</span></button>
        <p className="login-legal">Al continuar aceptas los <Link href="/terminos">términos</Link> y el <Link href="/privacidad">aviso de privacidad</Link> de Pipiro.</p>
      </section>
      <aside className="login-aside" aria-hidden="true"><div><span>Almuerzos escolares</span><strong>Preparados con cuidado.<br />Entregados a tiempo.</strong></div></aside>
    </main>
  );
}
