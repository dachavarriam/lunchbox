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
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the branded Lonchera prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const expectedToday = new Intl.DateTimeFormat("es-HN", {
    timeZone: "America/Tegucigalpa",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date()).toLocaleUpperCase("es-HN");
  assert.match(html, /<title>Lonchera Solo México<\/title>/i);
  assert.ok(html.includes(expectedToday), `expected Honduras date ${expectedToday}`);
  assert.doesNotMatch(html, /MIÉRCOLES, 12 DE AGOSTO/);
  assert.match(html, /Datos de demostración/);
  assert.match(html, /Escuela Internacional Sampedrana/);
  assert.match(html, /Alergias del perfil/);
  assert.match(html, /Postres/);
  assert.match(html, /Especiales/);
  assert.match(html, /Menú de la semana/);
  assert.doesNotMatch(html, /Administración|KDS · EIS/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps family, admin and kitchen surfaces on separate routes", async () => {
  const [family, admin, kitchen] = await Promise.all([
    render("/").then((response) => response.text()),
    render("/admin").then((response) => response.text()),
    render("/cocina").then((response) => response.text()),
  ]);

  assert.match(family, /Elige a tu estudiante/);
  assert.doesNotMatch(family, /Importación masiva|Servicio de almuerzo/);
  assert.match(admin, /Importación masiva/);
  assert.doesNotMatch(admin, /Elige a tu estudiante|Servicio de almuerzo/);
  assert.match(kitchen, /KDS · EIS/);
  assert.doesNotMatch(kitchen, /Elige a tu estudiante|Importación masiva/);
});

test("ships the local PWA assets and pnpm policy", async () => {
  const [manifestText, serviceWorker, packageText, workspaceText, wranglerText, clientAssets] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readdir(new URL("../dist/client/assets/", import.meta.url)),
  ]);
  const manifest = JSON.parse(manifestText);
  const packageJson = JSON.parse(packageText);
  const wranglerConfig = JSON.parse(wranglerText);

  assert.equal(manifest.name, "Lonchera Solo México");
  assert.equal(manifest.display, "standalone");
  assert.match(serviceWorker, /lonchera-prototype-v1/);
  assert.equal(packageJson.packageManager, "pnpm@11.21.0");
  assert.match(workspaceText, /allowBuilds:/);
  assert.doesNotMatch(packageText, /react-loading-skeleton|drizzle/);
  assert.equal(wranglerConfig.assets.run_worker_first, undefined);
  assert.ok(clientAssets.some((asset) => asset.endsWith(".css")), "production build must emit CSS");
});
