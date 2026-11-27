const { createHmac, timingSafeEqual } = require("node:crypto");

const programs = new Map([
  ["fat-loss", { label: "Fat Loss", amount: 64900 }],
  ["body-recomp", { label: "Body Recomp", amount: 64900 }],
  ["muscle-gain", { label: "Muscle Gain", amount: 64900 }],
  ["bundle", { label: "The Complete Set", amount: 129900 }],
]);
const currency = "INR";
const orderPattern = /^order_[A-Za-z0-9]{1,64}$/;
const paymentPattern = /^pay_[A-Za-z0-9]{1,64}$/;

function credentials() {
  const key = process.env.RAZORPAY_KEY_ID?.trim();
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return key && secret ? { key, secret } : null;
}

function digest(secret, message) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function matchesDigest(expected, received) {
  return typeof received === "string" && /^[a-f0-9]{64}$/i.test(received)
    && timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

async function razorpay(auth, path, body) {
  const headers = {
    Authorization: `Basic ${Buffer.from(`${auth.key}:${auth.secret}`).toString("base64")}`,
  };
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Razorpay API returned ${response.status}`);
  return response.json();
}

function json(response, code, data) {
  response.statusCode = code;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(data));
}

function sameOriginJson(request) {
  const { origin, host } = request.headers;
  if (request.headers["sec-fetch-site"] === "cross-site" || (origin && URL.parse(origin)?.host !== host)) {
    return 403;
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) return 415;
  return 0;
}

module.exports = { programs, currency, orderPattern, paymentPattern, credentials, digest, matchesDigest, razorpay, json, sameOriginJson };
