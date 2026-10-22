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

function makeFakeEmailBinding(sendImpl) {
  const calls = [];
  return {
    calls,
    send: async (message) => {
      calls.push(message);
      return sendImpl ? sendImpl(message) : { messageId: "test-message-id" };
    },
  };
}

const baseEnv = { APP_ORIGIN: "https://pipiro.solomexicohn.com", EMAIL_FROM: "pedidos@solomexicohn.com" };

test("processEmailOutbox is a no-op without the EMAIL binding", async () => {
  const db = makeFakeDb([{ id: "a", channel: "email", status: "queued", attempts: 0, user_id: "user_1", recipient_email: null, template_key: "payment_approved" }]);
  await processEmailOutbox({ DB: db, ...baseEnv });
  assert.equal(db.outbox[0].status, "queued");
});

test("processEmailOutbox resolves the recipient via user_id and marks the message sent", async () => {
  const db = makeFakeDb([{ id: "b", channel: "email", status: "queued", attempts: 0, user_id: "user_1", recipient_email: null, template_key: "payment_approved" }]);
  const EMAIL = makeFakeEmailBinding();
  await processEmailOutbox({ DB: db, EMAIL, ...baseEnv });
  assert.equal(db.outbox[0].status, "sent");
  assert.equal(EMAIL.calls.length, 1);
  assert.equal(EMAIL.calls[0].to, "family@example.com");
  assert.deepEqual(EMAIL.calls[0].from, { email: "pedidos@solomexicohn.com", name: "Pipiro" });
  assert.match(EMAIL.calls[0].subject, /aprobado/i);
  assert.match(EMAIL.calls[0].html, /https:\/\/pipiro\.solomexicohn\.com\/\?view=orders/);
});

test("processEmailOutbox requeues failed sends until attempts run out", async () => {
  const db = makeFakeDb([{ id: "c", channel: "email", status: "queued", attempts: 2, user_id: "user_1", recipient_email: null, template_key: "payment_rejected" }]);
  const EMAIL = makeFakeEmailBinding(() => {
    const error = new Error("sender domain not onboarded");
    error.code = "E_SENDER_DOMAIN_NOT_AVAILABLE";
    throw error;
  });
  await processEmailOutbox({ DB: db, EMAIL, ...baseEnv });
  assert.equal(db.outbox[0].attempts, 3);
  assert.equal(db.outbox[0].status, "failed");
  assert.match(db.outbox[0].last_error, /E_SENDER_DOMAIN_NOT_AVAILABLE/);
});

test("processEmailOutbox marks the message failed without calling EMAIL.send when no recipient is on file", async () => {
  const db = makeFakeDb([{ id: "d", channel: "email", status: "queued", attempts: 0, user_id: "user_unknown", recipient_email: null, template_key: "payment_approved" }]);
  const EMAIL = makeFakeEmailBinding(() => { throw new Error("should not be called"); });
  await processEmailOutbox({ DB: db, EMAIL, ...baseEnv });
  assert.equal(db.outbox[0].status, "failed");
  assert.match(db.outbox[0].last_error, /correo del destinatario/);
  assert.equal(EMAIL.calls.length, 0);
});
