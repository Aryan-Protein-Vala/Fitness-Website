const { randomBytes } = require("node:crypto");
const { programs, currency, orderPattern, paymentPattern, credentials, digest, matchesDigest, razorpay, json, sameOriginJson } = require("../server/commerce");
const guideStore = require("../server/guide-store");

const support = "https://wa.me/message/FXVMZMLJMCZ5E1";

// Bind the server-created order to the selected product without storing a client-provided order ID.
function orderProof(secret, orderId, slug) {
  return digest(secret, `aryan-pandit:checkout:${orderId}:${slug}`);
}

async function createOrder(request, response, auth, program, slug) {
  const library = Boolean(guideStore.settings());
  const email = guideStore.emailAddress(request.body?.email);
  if (library && !email) return json(response, 400, { error: "email_required" });

  const order = await razorpay(auth, "orders", {
    amount: program.amount,
    currency,
    receipt: `ap_${randomBytes(12).toString("hex")}`,
    notes: { program: slug, source: "aryan-pandit-training" },
  });

  if (typeof order.id !== "string" || !orderPattern.test(order.id)
      || order.amount !== program.amount || order.currency !== currency) {
    throw new Error("Unexpected Razorpay order");
  }

  if (library) await guideStore.saveOrder(request, response, order, slug, email);

  return json(response, 201, {
    key: auth.key,
    orderId: order.id,
    proof: orderProof(auth.secret, order.id, slug),
    amount: program.amount,
    currency,
    label: program.label,
  });
}

async function verifyPayment(response, auth, program, slug, body) {
  const { orderId, proof, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (typeof orderId !== "string" || !orderPattern.test(orderId)
      || razorpay_order_id !== orderId
      || typeof razorpay_payment_id !== "string" || !paymentPattern.test(razorpay_payment_id)
      || !matchesDigest(orderProof(auth.secret, orderId, slug), proof)
      || !matchesDigest(digest(auth.secret, `${orderId}|${razorpay_payment_id}`), razorpay_signature)) {
    return json(response, 400, { error: "invalid_payment" });
  }

  const payment = await razorpay(auth, `payments/${razorpay_payment_id}`);
  if (payment.id !== razorpay_payment_id || payment.order_id !== orderId
      || payment.amount !== program.amount || payment.currency !== currency) {
    return json(response, 409, { error: "payment_mismatch" });
  }

  let status = "pending";
  if (payment.status === "refunded" || payment.amount_refunded > 0) status = "refunded";
  else if (payment.status === "failed") status = "failed";
  else if (payment.status === "captured" && payment.captured === true) status = "captured";

  const order = guideStore.settings() ? await guideStore.recordPayment(orderId, payment) : null;
  return json(response, 200, {
    status,
    paymentId: payment.id,
    label: program.label,
    library: order?.status === "captured",
  });
}

function checkoutPage(program, slug, configured) {
  const price = new Intl.NumberFormat("en-IN").format(program.amount / 100);
  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#151613">
  <title>${program.label} checkout | Aryan Pandit</title>
  <link rel="icon" href="/assets/imagery/favicon.png">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="stylesheet" href="/assets/chapters.css">
  <link rel="stylesheet" href="/assets/guides.css">
  ${configured ? '<script defer src="/assets/checkout.js"></script>' : ""}
</head>
<body class="checkout-page">
  <main class="shell checkout-shell">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">AP</span> Aryan Pandit</a>
    <div class="checkout-message">
      <p class="checkout-kind">Digital training program · ₹${price}</p>
      <h1>${program.label}</h1>
      <p>${configured ? "Continue to Razorpay checkout. Message Aryan on WhatsApp if you need help."
        : "Online checkout is being set up. Message Aryan on WhatsApp to arrange your purchase and PDF delivery."}</p>
      <div class="checkout-actions">
        ${configured ? `<button type="button" class="action action-acid buy-action" data-program="${slug}" hidden><span>Open checkout</span></button>` : ""}
        <a class="action ${configured ? "action-outline" : "action-acid"}" href="${support}">Message Aryan</a>
        <a class="action action-outline" href="/#programs">Back to programs</a>
      </div>
    </div>
  </main>
</body>
</html>`;
}

module.exports = async function checkout(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex");

  const method = request.method;
  if (!["GET", "HEAD", "POST"].includes(method)) {
    response.setHeader("Allow", "GET, HEAD, POST");
    return json(response, 405, { error: "method_not_allowed" });
  }

  const query = new URL(request.url, "https://checkout.invalid").searchParams;
  const slugs = query.getAll("program");
  const slug = slugs.length === 1 ? slugs[0] : null;
  const program = programs.get(slug);
  if (!program) return json(response, 404, { error: "unknown_program" });

  const auth = credentials();
  if (method !== "POST") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.end(method === "HEAD" ? undefined : checkoutPage(program, slug, Boolean(auth)));
  }

  const invalid = sameOriginJson(request);
  if (invalid) return json(response, invalid, { error: "invalid_request" });
  if (!auth) return json(response, 503, { error: "checkout_unavailable" });

  const actions = query.getAll("action");
  const action = actions.length === 1 ? actions[0] : null;
  try {
    if (action === "create") return await createOrder(request, response, auth, program, slug);
    if (action === "verify") {
      const body = request.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(response, 400, { error: "invalid_payment" });
      }
      return await verifyPayment(response, auth, program, slug, body);
    }
  } catch {
    return json(response, 502, { error: "payment_provider_unavailable" });
  }
  return json(response, 400, { error: "unknown_action" });
};
