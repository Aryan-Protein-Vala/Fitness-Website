(() => {
  const status = document.querySelector(".guides-status");
  const email = document.querySelector("#reader-email");
  const account = document.querySelector(".guides-account");
  const recovery = document.querySelector(".guide-recovery");
  const library = document.querySelector(".guide-library");
  const shelf = library.querySelector(".guide-shelf");
  const pending = library.querySelector(".guide-pending");
  const recoveryCode = library.querySelector(".guide-code");
  const codeButton = recoveryCode.querySelector("button");
  const codeOutput = recoveryCode.querySelector(".guide-code-output");
  const article = document.querySelector(".guide-article");
  const selectedGuide = new URL(location.href).searchParams.get("guide");

  async function request(query = {}, body) {
    const response = await fetch(`/api/guides?${new URLSearchParams(query)}`, {
      ...(body && {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout?.(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }

  function guideCard(guide) {
    const card = document.createElement("li");
    const link = document.createElement("a");
    link.href = `/my-guides?guide=${encodeURIComponent(guide.slug)}`;
    const image = document.createElement("img");
    image.src = `/assets/imagery/${guide.slug}.webp`;
    image.alt = "";
    const name = document.createElement("strong");
    name.textContent = guide.label;
    const action = document.createElement("span");
    action.textContent = "Open sample ↗";
    link.append(image, name, action);
    card.append(link);
    return card;
  }

  function showPending(orders) {
    pending.replaceChildren();
    if (!orders.length) return;
    const note = document.createElement("p");
    note.textContent = "Already paid? Check for confirmation from Razorpay.";
    pending.append(note);
    for (const order of orders) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action action-ink";
      button.textContent = `Check ${order.label} payment`;
      button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "Checking with Razorpay…";
        try {
          const result = await request({ action: "check" }, { orderId: order.orderId });
          await loadLibrary();
          if (result.status === "pending") status.textContent = "Razorpay hasn’t confirmed this payment yet.";
          if (result.status === "refunded") status.textContent = "Razorpay shows this payment was refunded.";
        } catch {
          status.textContent = "We couldn’t check that payment. Try again in a moment.";
        } finally {
          button.disabled = false;
        }
      });
      pending.append(button);
    }
  }

  function showGuide(guide) {
    article.querySelector(".guide-series").textContent = guide.label;
    const title = article.querySelector("h2");
    title.textContent = guide.title;
    article.querySelector(".guide-lede").textContent = guide.introduction;
    article.querySelector(".guide-reference").textContent = `Personal copy · ${guide.reference}`;
    const chapters = article.querySelector(".guide-chapters");
    chapters.replaceChildren();
    for (const [name, text] of guide.chapters) {
      const chapter = document.createElement("li");
      const copy = document.createElement("div");
      const heading = document.createElement("h3");
      heading.textContent = name;
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      copy.append(heading, paragraph);
      chapter.append(copy);
      chapters.append(chapter);
    }
    article.hidden = false;
    title.focus({ preventScroll: true });
  }

  async function loadLibrary() {
    status.textContent = "Opening your library…";
    recovery.hidden = true;
    article.hidden = true;
    try {
      const data = await request();
      email.textContent = data.email;
      account.hidden = false;
      status.textContent = "";
      if (selectedGuide) {
        try {
          showGuide(await request({ action: "read", guide: selectedGuide }));
          return;
        } catch (error) {
          if (error.message !== "guide_not_found") throw error;
          status.textContent = "This guide is unavailable in your library.";
        }
      }
      shelf.replaceChildren(...data.guides.map(guideCard));
      showPending(data.pending);
      recoveryCode.hidden = !data.guides.length;
      recoveryCode.open = Boolean(data.guides.length && !data.hasRecoveryCode);
      codeButton.textContent = data.hasRecoveryCode ? "Replace recovery code" : "Create recovery code";
      recoveryCode.querySelector("p").textContent = data.hasRecoveryCode
        ? "Use your saved code on another device. Replacing it makes the previous code expire."
        : "Save a private recovery code so you can reopen your guides if you clear browser data or switch devices.";
      library.hidden = false;
      if (!status.textContent && !data.guides.length && !data.pending.length) {
        status.textContent = "There are no unlocked guides in this library.";
      }
    } catch (error) {
      if (error.message === "sign_in_required") {
        status.textContent = "Purchased a guide on another device?";
        recovery.hidden = false;
      } else {
        status.textContent = "The guide library is unavailable right now. If you’ve already paid, message Aryan for help.";
        recovery.querySelector("form").hidden = true;
        recovery.querySelector("h2").hidden = true;
        recovery.querySelector("p").hidden = true;
        recovery.hidden = false;
      }
    }
  }

  recovery.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button");
    submit.disabled = true;
    try {
      await request({ action: "recover" }, Object.fromEntries(new FormData(form)));
      form.reset();
      await loadLibrary();
    } catch (error) {
      status.textContent = error.message === "invalid_recovery"
        ? "That email and recovery code don’t match."
        : "We couldn’t restore your library. Try again in a moment.";
    } finally {
      submit.disabled = false;
    }
  });

  codeButton.addEventListener("click", async () => {
    codeButton.disabled = true;
    try {
      const { code } = await request({ action: "make-code" }, {});
      const input = codeOutput.querySelector("input");
      codeOutput.hidden = false;
      input.value = code;
      input.focus();
      input.select();
      codeButton.textContent = "Replace recovery code";
      recoveryCode.querySelector("p").textContent = "Keep this code private. Replacing it makes the previous code expire.";
    } catch {
      status.textContent = "We couldn’t create a recovery code. Try again in a moment.";
    } finally {
      codeButton.disabled = false;
    }
  });

  account.querySelector("button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await request({ action: "sign-out" }, {});
      location.replace("/my-guides");
    } catch {
      status.textContent = "We couldn’t sign you out. Try again in a moment.";
      button.disabled = false;
    }
  });

  void loadLibrary();
})();
