import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
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
  assert.match(html, /<title>Lonchera Solo México<\/title>/i);
  assert.match(html, /Datos de demostración/);
  assert.match(html, /Familias/);
  assert.match(html, /Administración/);
  assert.match(html, /Cocina/);
  assert.match(html, /Menú de la semana/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the local PWA assets and pnpm policy", async () => {
  const [manifestText, serviceWorker, packageText, workspaceText] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const packageJson = JSON.parse(packageText);

  assert.equal(manifest.name, "Lonchera Solo México");
  assert.equal(manifest.display, "standalone");
  assert.match(serviceWorker, /lonchera-prototype-v1/);
  assert.equal(packageJson.packageManager, "pnpm@11.21.0");
  assert.match(workspaceText, /allowBuilds:/);
  assert.doesNotMatch(packageText, /react-loading-skeleton|drizzle/);
});
