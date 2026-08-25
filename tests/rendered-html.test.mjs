import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      DEMO_MODE: "true",
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function fetchProduction(url) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("production-test", `${process.pid}-${Date.now()}-${url}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(url, { headers: { accept: "text/html" }, redirect: "manual" }),
    {
      APP_ORIGIN: "https://pipiro.solomexicohn.com",
      ADMIN_ORIGIN: "https://admin-pipiro.solomexicohn.com",
      KDS_ORIGIN: "https://kds-pipiro.solomexicohn.com",
      DEMO_MODE: "true",
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the branded Pipiro prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Pipiro by Solo México<\/title>/i);
  assert.match(html, /pipiro-logo\.png/);
  assert.doesNotMatch(html, /MIÉRCOLES, 12 DE AGOSTO/);
  assert.doesNotMatch(html, /Datos de demostración|Transferencia simulada/);
  assert.match(html, /Cargando tu cuenta/);
  assert.doesNotMatch(html, /Administración|KDS · EIS/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps family, admin and kitchen surfaces on separate routes", async () => {
  const [family, admin, kitchen] = await Promise.all([
    render("/").then((response) => response.text()),
    render("/admin").then((response) => response.text()),
    render("/cocina").then((response) => response.text()),
  ]);

  assert.match(family, /Cargando tu cuenta/);
  assert.doesNotMatch(family, /Importación masiva|Servicio de almuerzo/);
  assert.match(admin, /Importación masiva/);
  assert.match(admin, /Catálogo de platillos/);
  assert.match(admin, /Calendario y ventanas de pedido/);
  assert.match(admin, /Conciliación de transferencias/);
  assert.doesNotMatch(admin, /Elige a tu estudiante|Servicio de almuerzo/);
  assert.match(kitchen, /KDS · EIS/);
  assert.doesNotMatch(kitchen, /Elige a tu estudiante|Importación masiva/);
});

test("renders Google login and public legal pages", async () => {
  const [login, privacy, terms] = await Promise.all([
    render("/login").then((response) => response.text()),
    render("/privacidad").then((response) => response.text()),
    render("/terminos").then((response) => response.text()),
  ]);
  assert.match(login, /Continuar con Google/);
  assert.match(login, /\/api\/auth\/google\/start/);
  assert.match(privacy, /Aviso de privacidad/);
  assert.match(privacy, /Datos de estudiantes/);
  assert.doesNotMatch(privacy, /Borrador para pruebas/);
  assert.match(terms, /Términos de uso/);
  assert.match(terms, /Cancelaciones, créditos y reembolsos/);
  assert.doesNotMatch(terms, /Borrador para pruebas/);
});

test("isolates production surfaces by hostname before rendering", async () => {
  const [family, familyAdmin, adminRoot, adminPage, kdsRoot, kdsPage] = await Promise.all([
    fetchProduction("https://pipiro.solomexicohn.com/"),
    fetchProduction("https://pipiro.solomexicohn.com/admin"),
    fetchProduction("https://admin-pipiro.solomexicohn.com/"),
    fetchProduction("https://admin-pipiro.solomexicohn.com/admin"),
    fetchProduction("https://kds-pipiro.solomexicohn.com/"),
    fetchProduction("https://kds-pipiro.solomexicohn.com/cocina"),
  ]);
  assert.equal(family.status, 302);
  assert.equal(family.headers.get("location"), "/login?returnTo=%2F");
  assert.equal(familyAdmin.status, 404);
  assert.equal(adminRoot.status, 302);
  assert.equal(adminRoot.headers.get("location"), "/admin");
  assert.equal(adminPage.status, 302);
  assert.equal(kdsRoot.status, 302);
  assert.equal(kdsRoot.headers.get("location"), "/cocina");
  assert.equal(kdsPage.status, 302);
});

test("ships the local PWA assets, functional migrations and pnpm policy", async () => {
  const [manifestText, serviceWorker, packageText, workspaceText, wranglerText, functionalMigration, cmsMigration, paymentMigration, authMigration, operationsMigration, customerAccessMigration, authSource, prototypeSource, workerSource, clientAssets] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0005_functional_demo_core.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0006_cms_catalog_calendar.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0007_transfer_receipts_and_lunch_rules.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0010_google_auth_sessions.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0011_staff_kds_and_printing.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0014_admin_customer_access.sql", import.meta.url), "utf8"),
    readFile(new URL("../worker/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/prototype-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readdir(new URL("../dist/client/assets/", import.meta.url)),
  ]);
  const manifest = JSON.parse(manifestText);
  const packageJson = JSON.parse(packageText);
  const wranglerConfig = JSON.parse(wranglerText);

  assert.equal(manifest.name, "Pipiro by Solo México");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#658BD0");
  assert.match(serviceWorker, /pipiro-logo\.png/);
  assert.match(serviceWorker, /pipiro-fondo\.png/);
  assert.match(serviceWorker, /pipiro-prototype-v6/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.equal(packageJson.packageManager, "pnpm@11.21.0");
  assert.match(packageJson.scripts["dev:lan"], /--hostname 0\.0\.0\.0/);
  assert.match(workspaceText, /allowBuilds:/);
  assert.doesNotMatch(packageText, /react-loading-skeleton|drizzle/);
  assert.equal(wranglerConfig.assets.run_worker_first, undefined);
  assert.equal(wranglerConfig.workers_dev, false);
  assert.deepEqual(wranglerConfig.routes.map((route) => route.pattern), [
    "pipiro.solomexicohn.com",
    "admin-pipiro.solomexicohn.com",
    "kds-pipiro.solomexicohn.com",
  ]);
  assert.match(functionalMigration, /CREATE TABLE payment_transfers/);
  assert.match(functionalMigration, /CREATE TABLE demo_request_keys/);
  assert.match(cmsMigration, /CREATE TABLE cms_media/);
  assert.match(cmsMigration, /CREATE TABLE cms_import_jobs/);
  assert.match(paymentMigration, /receipt_submitted_at/);
  assert.match(authMigration, /CREATE TABLE auth_sessions/);
  assert.match(authMigration, /CREATE TABLE oauth_login_states/);
  assert.match(operationsMigration, /prep_time_minutes/);
  assert.match(operationsMigration, /CREATE TABLE staff_invitations/);
  assert.match(operationsMigration, /CREATE TABLE print_jobs/);
  assert.match(customerAccessMigration, /'customer', 'school_eis'/);
  assert.match(authSource, /code_challenge_method: "S256"/);
  assert.match(authSource, /HttpOnly; SameSite=Lax/);
  assert.match(authSource, /crypto\.subtle\.verify/);
  assert.match(authSource, /authorizeRequest/);
  assert.match(authSource, /No tienes permiso para esta sección/);
  assert.match(authSource, /requestSurface\(url, env\) === "family"/);
  assert.deepEqual(wranglerConfig.secrets.required, ["GOOGLE_CLIENT_SECRET", "VAPID_PRIVATE_KEY"]);
  assert.equal(Object.hasOwn(wranglerConfig.vars, "GOOGLE_CLIENT_SECRET"), false);
  assert.equal(Object.hasOwn(wranglerConfig.vars, "VAPID_PRIVATE_KEY"), false);
  assert.equal(wranglerConfig.r2_buckets.some((bucket) => bucket.binding === "PAYMENT_RECEIPTS" && bucket.bucket_name === "pipiro"), true);
  assert.match(prototypeSource, /pipiro:order-draft:v1/);
  assert.match(prototypeSource, /typeof cryptoApi\.randomUUID === "function"/);
  assert.doesNotMatch(prototypeSource, /requestKey: crypto\.randomUUID\(\)/);
  assert.match(prototypeSource, /Transferencia bancaria/);
  assert.match(prototypeSource, /Tarjeta de crédito o débito/);
  assert.match(prototypeSource, /Tiempo de cocina/);
  assert.match(prototypeSource, /Accesos del personal/);
  assert.match(prototypeSource, /Carga de producción por platillo/);
  assert.match(prototypeSource, /Agrega tu primer estudiante/);
  assert.match(prototypeSource, /Escuela Internacional Sampedrana/);
  assert.match(prototypeSource, /desktop-account-nav/);
  assert.match(prototypeSource, /family-shell/);
  assert.match(prototypeSource, /order\.status !== "cancelled" && order\.payment_method\.includes\("transfer"\)/);
  assert.match(prototypeSource, /candidate\.payment_batch_id === order\.payment_batch_id && candidate\.status !== "cancelled"/);
  assert.doesNotMatch(prototypeSource, /Solo almuerzos|Lunch only/);
  assert.match(prototypeSource, /Alergias del perfil/);
  assert.match(prototypeSource, /Tacos de birria/);
  assert.match(prototypeSource, /Ventas y pagos/);
  assert.match(prototypeSource, /Platillos más vendidos/);
  assert.match(workerSource, /excludeDemoActor/);
  assert.match(workerSource, /Los almuerzos deben pedirse con al menos un día de anticipación/);
  assert.match(workerSource, /PAYMENT_RECEIPTS\.put/);
  assert.ok(clientAssets.some((asset) => asset.endsWith(".css")), "production build must emit CSS");
});
