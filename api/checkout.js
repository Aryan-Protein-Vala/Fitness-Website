const programs = new Map([
  ["fat-loss", { label: "Fat Loss", price: "₹649", setting: "RAZORPAY_FAT_LOSS_URL" }],
  ["body-recomp", { label: "Body Recomp", price: "₹649", setting: "RAZORPAY_BODY_RECOMP_URL" }],
  ["muscle-gain", { label: "Muscle Gain", price: "₹649", setting: "RAZORPAY_MUSCLE_GAIN_URL" }],
  ["bundle", { label: "The Complete Set", price: "₹1,299", setting: "RAZORPAY_BUNDLE_URL" }],
]);

const hostedCheckout = new Set(["rzp.io", "pages.razorpay.com"]);
const support = "https://wa.me/message/FXVMZMLJMCZ5E1";

function paymentUrl(setting) {
  const configured = process.env[setting]?.trim();
  if (!configured) return null;

  const url = URL.parse(configured);
  if (!url || url.protocol !== "https:" || !hostedCheckout.has(url.hostname)) return null;
  if (url.username || url.password || url.port || url.pathname === "/") return null;
  return url.href;
}

function unavailablePage({ label, price }) {
  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#151613">
  <title>${label} checkout | Aryan Pandit</title>
  <link rel="icon" href="/assets/imagery/favicon.png">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="stylesheet" href="/assets/chapters.css">
</head>
<body class="checkout-page">
  <main class="shell checkout-shell">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">AP</span> Aryan Pandit</a>
    <div class="checkout-message">
      <p class="checkout-kind">Digital training guide · ${price}</p>
      <h1>${label}</h1>
      <p>Online checkout for this guide is being set up. Message Aryan on WhatsApp to arrange your purchase and PDF delivery.</p>
      <div class="checkout-actions">
        <a class="action action-acid" href="${support}">Message Aryan</a>
        <a class="action action-outline" href="/#programs">Back to programs</a>
      </div>
    </div>
  </main>
</body>
</html>`;
}

module.exports = function checkout(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex");

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.statusCode = 405;
    return response.end("Method not allowed.");
  }

  const params = new URL(request.url, "https://checkout.invalid").searchParams;
  const chosen = params.getAll("program");
  const program = chosen.length === 1 ? programs.get(chosen[0]) : null;
  if (!program) {
    response.statusCode = 404;
    return response.end("Training program not found.");
  }

  const url = paymentUrl(program.setting);
  if (url) {
    response.writeHead(302, { Location: url });
    return response.end();
  }

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  return response.end(request.method === "HEAD" ? undefined : unavailablePage(program));
};
