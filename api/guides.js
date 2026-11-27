const { credentials, json, orderPattern, programs, razorpay, sameOriginJson } = require("../server/commerce");
const store = require("../server/guide-store");
const samples = require("../server/sample-guides");

function viewOrders(orders) {
  const guides = new Map();
  const pending = [];
  for (const order of orders) {
    if (order.status === "pending") {
      pending.push({ orderId: order.order_id, label: programs.get(order.program).label });
    }
    if (order.status !== "captured") continue;
    const slugs = order.program === "bundle" ? Object.keys(samples) : [order.program];
    for (const slug of slugs) {
      if (!guides.has(slug)) guides.set(slug, {
        slug,
        label: programs.get(slug).label,
        reference: `AP-${order.order_id.slice(6)}`,
      });
    }
  }
  return { guides: [...guides.values()], pending };
}

module.exports = async function guideLibrary(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  const query = new URL(request.url, "https://library.invalid").searchParams;
  const action = query.get("action");
  const method = request.method;

  if (method !== "GET" && method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { error: "method_not_allowed" });
  }
  if (method === "POST") {
    const invalid = sameOriginJson(request);
    if (invalid) return json(response, invalid, { error: "invalid_request" });
  }
  if (!store.settings()) return json(response, 503, { error: "library_unavailable" });

  try {
    const body = request.body;
    if (method === "POST" && action === "recover") {
      const code = typeof body?.code === "string" ? body.code.trim() : "";
      const success = await store.recover(response, store.emailAddress(body?.email), code);
      return json(response, success ? 200 : 403, success ? { restored: true } : { error: "invalid_recovery" });
    }
    if (method === "POST" && action === "sign-out") {
      await store.endSession(request, response);
      return json(response, 200, { signedOut: true });
    }

    const reader = await store.readerFor(request);
    if (!reader) return json(response, 401, { error: "sign_in_required" });

    if (method === "GET" && action === "read") {
      const slug = query.get("guide");
      if (!Object.hasOwn(samples, slug)) return json(response, 404, { error: "guide_not_found" });
      const { guides } = viewOrders(await store.readerOrders(reader, { status: "eq.captured" }));
      const guide = guides.find((item) => item.slug === slug);
      if (!guide) return json(response, 404, { error: "guide_not_found" });
      return json(response, 200, { ...guide, ...samples[slug] });
    }

    if (method === "GET" && !action) {
      return json(response, 200, {
        email: reader.email,
        hasRecoveryCode: Boolean(reader.recovery_hash),
        ...viewOrders(await store.readerOrders(reader)),
      });
    }

    if (method === "POST" && action === "make-code") {
      const [order] = await store.readerOrders(reader, { status: "eq.captured", limit: 1 });
      if (!order) return json(response, 403, { error: "no_purchases" });
      return json(response, 200, { code: await store.generateRecoveryCode(reader) });
    }

    if (method === "POST" && action === "check") {
      const { orderId } = body || {};
      if (typeof orderId !== "string" || !orderPattern.test(orderId)) {
        return json(response, 400, { error: "invalid_order" });
      }
      const [order] = await store.readerOrders(reader, { order_id: `eq.${orderId}` });
      if (!order) return json(response, 404, { error: "order_not_found" });
      if (order.status !== "pending") return json(response, 200, { status: order.status });
      const auth = credentials();
      if (!auth) return json(response, 503, { error: "payment_unavailable" });
      const { items } = await razorpay(auth, `orders/${orderId}/payments`);
      const payment = items.find((item) => item.captured === true || item.status === "refunded");
      const result = payment ? await store.recordPayment(orderId, payment) : null;
      return json(response, 200, { status: result?.status || "pending" });
    }

    return json(response, 400, { error: "unknown_action" });
  } catch (error) {
    console.error("Guide library request failed", error.message);
    return json(response, 502, { error: "library_unavailable" });
  }
};
