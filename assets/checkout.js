(() => {
  "use strict";

  if (location.protocol === "file:") return;

  const storageKey = "aryan-pending-checkout";
  const dialog = document.createElement("dialog");
  dialog.className = "checkout-dialog";
  dialog.setAttribute("aria-labelledby", "checkout-status-title");
  dialog.innerHTML = `
    <form method="dialog">
      <button class="checkout-close" aria-label="Close payment status">×</button>
    </form>
    <h2 id="checkout-status-title"></h2>
    <p class="checkout-dialog-message" role="status"></p>
    <p class="checkout-reference" hidden></p>
    <form class="checkout-email" hidden>
      <label>Email <input type="email" name="email" autocomplete="email" maxlength="254" required></label>
      <button class="action action-acid" type="submit">Continue to pay</button>
    </form>
    <div class="checkout-actions">
      <button class="action action-acid checkout-retry" type="button" hidden>Check payment again</button>
      <a class="action action-acid checkout-library" href="/my-guides" hidden>Open my guides</a>
      <a class="action action-outline" href="https://wa.me/message/FXVMZMLJMCZ5E1">Message Aryan</a>
    </div>`;
  document.body.append(dialog);

  const title = dialog.querySelector("h2");
  const message = dialog.querySelector(".checkout-dialog-message");
  const reference = dialog.querySelector(".checkout-reference");
  const retry = dialog.querySelector(".checkout-retry");
  const emailForm = dialog.querySelector(".checkout-email");
  const emailInput = emailForm.elements.email;
  const library = dialog.querySelector(".checkout-library");
  let sdk;
  let activeAttempt;
  let lastAction;
  let verifying = false;
  let pending = null;
  let emailSelection;

  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.slug && saved.body?.razorpay_payment_id) pending = saved;
  } catch {
    // Checkout can still verify in the current tab when storage is disabled.
  }

  function remember(details) {
    pending = details;
    try {
      if (details) sessionStorage.setItem(storageKey, JSON.stringify(details));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // Keep the current attempt in memory.
    }
  }

  function showStatus(heading, copy, { paymentId, check = false, open = true, hasLibrary = false, askEmail = false } = {}) {
    title.textContent = heading;
    message.textContent = copy;
    reference.hidden = !paymentId;
    reference.textContent = paymentId ? `Payment reference: ${paymentId}` : "";
    retry.hidden = !check;
    library.hidden = !hasLibrary;
    emailForm.hidden = !askEmail;
    if (open && !dialog.open) dialog.showModal();
    if (askEmail) emailInput.focus();
  }

  async function request(slug, action, body = {}) {
    const query = new URLSearchParams({ program: slug, action });
    const response = await fetch(`/api/checkout?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout?.(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }

  function loadRazorpay() {
    if (typeof window.Razorpay === "function") return Promise.resolve(window.Razorpay);
    if (!sdk) {
      sdk = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const fail = () => {
          clearTimeout(timeout);
          script.remove();
          reject(new Error("checkout_load_failed"));
        };
        const timeout = setTimeout(fail, 12000);
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          if (typeof window.Razorpay !== "function") return fail();
          clearTimeout(timeout);
          resolve(window.Razorpay);
        };
        script.onerror = fail;
        document.head.append(script);
      }).catch((error) => {
        sdk = null;
        throw error;
      });
    }
    return sdk;
  }

  function release(attempt) {
    if (activeAttempt !== attempt) return;
    attempt.action.removeAttribute("aria-busy");
    activeAttempt = null;
  }

  async function checkPayment() {
    if (!pending || verifying) return;
    verifying = true;
    const { slug, body } = pending;
    const paymentId = body.razorpay_payment_id;

    showStatus("Checking payment", "Confirming the payment with Razorpay.", { paymentId });
    try {
      const result = await request(slug, "verify", body);
      if (result.status === "captured") {
        remember(null);
        const copy = result.library
          ? "Your sample reader is unlocked. Share your payment reference with Aryan on WhatsApp for the complete PDF."
          : `Payment for ${result.label} is confirmed. Share your payment reference with Aryan on WhatsApp for PDF delivery.`;
        showStatus("Payment confirmed", copy, { paymentId: result.paymentId, open: false, hasLibrary: result.library });
      } else if (result.status === "refunded" || result.status === "failed") {
        remember(null);
        const copy = result.status === "refunded"
          ? "Razorpay shows a refund on this payment. Share the reference with Aryan if you need help."
          : "Razorpay could not complete this payment. You can try checkout again.";
        showStatus("Payment update", copy, { paymentId: result.paymentId, open: false });
      } else {
        showStatus("Payment pending", "Razorpay is still confirming this payment. Check its status before starting another payment.", { paymentId, check: true, open: false });
      }
    } catch {
      showStatus("Payment status unavailable", "Check this payment again or share the reference with Aryan for help.", { paymentId, check: true, open: false });
    } finally {
      verifying = false;
    }
  }

  async function openCheckout(action, slug, email) {
    if (activeAttempt || verifying) return;

    lastAction = action;
    if (pending) return checkPayment();

    const attempt = { action, completed: false };
    activeAttempt = attempt;
    action.setAttribute("aria-busy", "true");

    try {
      const order = await request(slug, "create", email ? { email } : undefined);
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Aryan Pandit",
        description: order.label,
        image: new URL("/assets/imagery/favicon.png", location.href).href,
        theme: { color: "#151613" },
        ...(email && { prefill: { email } }),
        modal: { ondismiss: () => release(attempt) },
        handler: ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
          if (attempt.completed) return;
          attempt.completed = true;
          remember({
            slug,
            body: {
              orderId: order.orderId,
              proof: order.proof,
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
            },
          });
          release(attempt);
          void checkPayment();
        },
      });
      checkout.open();
    } catch (error) {
      release(attempt);
      if (error.message === "email_required") {
        emailSelection = { action, slug };
        showStatus("Your email", "Use this email to identify your guide library. The online reader currently has sample pages. Aryan sends your complete PDF on WhatsApp.", { askEmail: true });
        return;
      }
      const copy = error.message === "checkout_unavailable"
        ? "Online checkout is being set up. Message Aryan on WhatsApp to arrange your purchase."
        : "Razorpay checkout couldn’t open. Try Buy now again or message Aryan on WhatsApp.";
      showStatus("Checkout unavailable", copy);
    }
  }

  retry.addEventListener("click", checkPayment);
  emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!emailSelection) return;
    const { action, slug } = emailSelection;
    emailSelection = null;
    dialog.close();
    void openCheckout(action, slug, emailInput.value.trim());
  });
  dialog.addEventListener("close", () => lastAction?.focus({ preventScroll: true }));

  for (const action of document.querySelectorAll(".buy-action")) {
    action.hidden = false;
    action.setAttribute("aria-haspopup", "dialog");
    action.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0
          || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const slug = action.dataset.program || new URL(action.href).searchParams.get("program");
      event.preventDefault();
      void openCheckout(action, slug);
    });
  }
})();
