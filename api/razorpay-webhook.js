const { credentials, digest, json, matchesDigest, orderPattern, paymentPattern, razorpay } = require("../server/commerce");
const store = require("../server/guide-store");

module.exports = async function webhook(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "method_not_allowed" });
  }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !store.settings()) return json(response, 503, { error: "webhook_unavailable" });

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) return json(response, 413, { error: "payload_too_large" });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks);
  if (!matchesDigest(digest(secret, raw), request.headers["x-razorpay-signature"])) {
    return json(response, 403, { error: "invalid_signature" });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(response, 400, { error: "invalid_payload" });
  }

  try {
    let payment;
    if (event?.event === "payment.captured") {
      payment = event.payload?.payment?.entity;
    } else if (event?.event === "refund.processed") {
      const paymentId = event.payload?.refund?.entity?.payment_id;
      const auth = credentials();
      if (!paymentPattern.test(paymentId || "")) return json(response, 400, { error: "invalid_payload" });
      if (!auth) return json(response, 503, { error: "webhook_unavailable" });
      payment = await razorpay(auth, `payments/${paymentId}`);
    }
    if (orderPattern.test(payment?.order_id || "")) {
      await store.recordPayment(payment.order_id, payment);
    }
    return json(response, 200, { received: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed", error.message);
    return json(response, 502, { error: "webhook_processing_failed" });
  }
};
