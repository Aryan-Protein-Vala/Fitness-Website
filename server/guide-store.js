const { createHash, randomBytes } = require("node:crypto");
const { paymentPattern } = require("./commerce");

const cookieName = "__Host-ap_guides";
const sessionSeconds = 180 * 24 * 60 * 60;
const sessionPattern = /^[A-Za-z0-9_-]{43}$/;
const codePattern = /^[A-Za-z0-9_-]{32}$/;

function settings() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return url && key?.startsWith("sb_secret_") ? { url, key } : null;
}

function emailAddress(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function query(table, filters, { method = "GET", body } = {}) {
  const { url, key } = settings();
  const target = new URL(`/rest/v1/${table}`, url);
  target.search = new URLSearchParams(filters);
  const response = await fetch(target, {
    method,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Guide store returned ${response.status} for ${table}`);
  return response.json();
}

function sessionHash(request) {
  const token = /(?:^|;\s*)__Host-ap_guides=([^;]+)/.exec(request.headers.cookie || "")?.[1];
  return sessionPattern.test(token || "") ? hash(token) : null;
}

async function readerFor(request) {
  const tokenHash = sessionHash(request);
  if (!tokenHash) return null;
  const [session] = await query("ap_guide_sessions", {
    token_hash: `eq.${tokenHash}`,
    expires_at: `gt.${new Date().toISOString()}`,
    select: "ap_guide_readers(id,email,recovery_hash)",
  });
  return session?.ap_guide_readers || null;
}

async function startSession(response, reader) {
  const token = randomBytes(32).toString("base64url");
  await query("ap_guide_sessions", {}, {
    method: "POST",
    body: {
      token_hash: hash(token),
      reader_id: reader.id,
      expires_at: new Date(Date.now() + sessionSeconds * 1000).toISOString(),
    },
  });
  response.setHeader("Set-Cookie", `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionSeconds}`);
}

async function endSession(request, response) {
  const tokenHash = sessionHash(request);
  if (tokenHash) await query("ap_guide_sessions", { token_hash: `eq.${tokenHash}` }, { method: "DELETE" });
  response.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

async function saveOrder(request, response, order, program, email) {
  let reader = await readerFor(request);
  const needsSession = reader?.email !== email;
  if (needsSession) {
    [reader] = await query("ap_guide_readers", { select: "id" }, {
      method: "POST",
      body: { email },
    });
  }
  await query("ap_guide_orders", {}, {
    method: "POST",
    body: {
      order_id: order.id,
      reader_id: reader.id,
      program,
      amount: order.amount,
      currency: order.currency,
    },
  });
  if (needsSession) await startSession(response, reader);
}

function readerOrders(reader, filters = {}) {
  return query("ap_guide_orders", {
    reader_id: `eq.${reader.id}`,
    select: "order_id,program,amount,currency,status,payment_id",
    order: "created_at.desc",
    limit: 100,
    ...filters,
  });
}

async function recordPayment(orderId, payment) {
  if (!paymentPattern.test(payment?.id || "") || payment.order_id !== orderId) return null;
  const [order] = await query("ap_guide_orders", { order_id: `eq.${orderId}` });
  if (!order || payment.amount !== order.amount || payment.currency !== order.currency) return null;
  if (order.payment_id && order.payment_id !== payment.id) return null;

  const refunded = payment.status === "refunded" || payment.amount_refunded > 0;
  if (!refunded && !(payment.status === "captured" && payment.captured === true)) return order;
  if (order.status === "refunded") return order;
  const [updated] = await query("ap_guide_orders", {
    order_id: `eq.${orderId}`,
    status: "neq.refunded",
    or: `(payment_id.is.null,payment_id.eq.${payment.id})`,
  }, {
    method: "PATCH",
    body: { status: refunded ? "refunded" : "captured", payment_id: payment.id },
  });
  return updated || null;
}

async function generateRecoveryCode(reader) {
  const code = randomBytes(24).toString("base64url");
  await query("ap_guide_readers", { id: `eq.${reader.id}` }, {
    method: "PATCH",
    body: { recovery_hash: hash(code) },
  });
  return code;
}

async function recover(response, email, code) {
  if (!email || !codePattern.test(code || "")) return false;
  const [reader] = await query("ap_guide_readers", {
    recovery_hash: `eq.${hash(code)}`,
    select: "id,email",
  });
  if (!reader || reader.email !== email) return false;
  await startSession(response, reader);
  return true;
}

module.exports = { settings, emailAddress, readerFor, saveOrder, readerOrders, recordPayment, generateRecoveryCode, recover, endSession };
