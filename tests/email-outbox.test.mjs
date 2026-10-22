import assert from "node:assert/strict";
import test from "node:test";
import { processEmailOutbox } from "../worker/email.ts";

// Minimal in-memory fake of the D1 subset processEmailOutbox actually uses.
function makeFakeDb(rows, users = { user_1: "family@example.com" }) {
  const outbox = rows.map((row) => ({ ...row }));

  function run(sql, params) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("SELECT o.id, COALESCE")) {
      return {
        results: outbox
          .filter((row) => row.channel === "email" && row.status === "queued")
          .map((row) => ({ id: row.id, recipient_email: row.recipient_email ?? users[row.user_id] ?? null, template_key: row.template_key })),
      };
    }
    if (normalized.startsWith("UPDATE notification_outbox SET status = 'sending'")) {
      const [id] = params;
      const row = outbox.find((candidate) => candidate.id === id && candidate.status === "queued");
      if (!row) return { meta: { changes: 0 } };
      row.status = "sending";
      row.attempts += 1;
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("UPDATE notification_outbox SET status = 'failed', last_error")) {
      const [lastError, id] = params;
      Object.assign(outbox.find((candidate) => candidate.id === id), { status: "failed", last_error: lastError });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("UPDATE notification_outbox SET status = 'sent'")) {
      const [id] = params;
      Object.assign(outbox.find((candidate) => candidate.id === id), { status: "sent", last_error: null });
      return { meta: { changes: 1 } };
    }
    if (normalized.startsWith("UPDATE notification_outbox SET status = CASE WHEN attempts")) {
      const [lastError, id] = params;
      const row = outbox.find((candidate) => candidate.id === id);
      row.status = row.attempts < 3 ? "queued" : "failed";
      row.last_error = lastError;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled SQL in fake DB: ${normalized}`);
  }

  return {
    prepare(sql) {
      let boundParams = [];
      const statement = {
        bind: (...params) => { boundParams = params; return statement; },
        all: async () => run(sql, boundParams),
        run: async () => run(sql, boundParams),
        first: async () => run(sql, boundParams).results?.[0] ?? null,
      };
      return statement;
    },
    outbox,
  };
}

const baseEnv = { APP_ORIGIN: "https://pipiro.solomexicohn.com", EMAIL_FROM: "Pipiro <pedidos@send.solomexicohn.com>" };

test("processEmailOutbox is a no-op without RESEND_API_KEY", async () => {
  const db = makeFakeDb([{ id: "a", channel: "email", status: "queued", attempts: 0, user_id: "user_1", recipient_email: null, template_key: "payment_approved" }]);
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalled = true; return new Response("{}", { status: 200 }); };
  try {
    await processEmailOutbox({ DB: db, ...baseEnv });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalled, false);
  assert.equal(db.outbox[0].status, "queued");
});

test("processEmailOutbox resolves the recipient via user_id and marks the message sent", async () => {
  const db = makeFakeDb([{ id: "b", channel: "email", status: "queued", attempts: 0, user_id: "user_1", recipient_email: null, template_key: "payment_approved" }]);
  let capturedBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(init.headers.Authorization, "Bearer re_test_key");
    capturedBody = JSON.parse(init.body);
    return new Response("{}", { status: 200 });
  };
  try {
    await processEmailOutbox({ DB: db, RESEND_API_KEY: "re_test_key", ...baseEnv });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(db.outbox[0].status, "sent");
  assert.equal(capturedBody.to, "family@example.com");
  assert.equal(capturedBody.from, baseEnv.EMAIL_FROM);
  assert.match(capturedBody.subject, /aprobado/i);
  assert.match(capturedBody.html, /https:\/\/pipiro\.solomexicohn\.com\/\?view=orders/);
});

test("processEmailOutbox requeues failed sends until attempts run out", async () => {
  const db = makeFakeDb([{ id: "c", channel: "email", status: "queued", attempts: 2, user_id: "user_1", recipient_email: null, template_key: "payment_rejected" }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("server error", { status: 500 });
  try {
    await processEmailOutbox({ DB: db, RESEND_API_KEY: "re_test_key", ...baseEnv });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(db.outbox[0].attempts, 3);
  assert.equal(db.outbox[0].status, "failed");
});

test("processEmailOutbox marks the message failed without calling Resend when no recipient is on file", async () => {
  const db = makeFakeDb([{ id: "d", channel: "email", status: "queued", attempts: 0, user_id: "user_unknown", recipient_email: null, template_key: "payment_approved" }]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("should not be called"); };
  try {
    await processEmailOutbox({ DB: db, RESEND_API_KEY: "re_test_key", ...baseEnv });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(db.outbox[0].status, "failed");
  assert.match(db.outbox[0].last_error, /correo del destinatario/);
});
