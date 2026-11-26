(() => {
  "use strict";

  // Add the live payment URLs when the four checkout pages are ready.
  const checkoutLinks = {
    fatloss: "",
    recomp: "",
    gain: "",
    bundle: "",
  };

  const purchaseActions = [...document.querySelectorAll("[data-buy]")];
  const liveCheckouts = purchaseActions.filter((action) => {
    const url = checkoutLinks[action.dataset.buy];
    if (!url) return false;

    action.href = url;
    action.textContent = action.dataset.checkoutLabel;
    return true;
  });

  if (liveCheckouts.length) {
    const allLive = liveCheckouts.length === purchaseActions.length;

    document.querySelector("[data-purchase-note]").textContent = allLive
      ? "One-time payment. Guide covers are illustrations of the digital products."
      : "You can ask Aryan on WhatsApp about any guide without an online checkout link. Guide covers are illustrations of the digital products.";
    document.querySelector("[data-delivery-note]").textContent = allLive
      ? "Follow the delivery instructions at checkout. If you need help getting your PDF, message Aryan on WhatsApp."
      : "Follow the delivery instructions at checkout. For guides sold through WhatsApp, Aryan can help with payment and delivery.";
  }

  const menu = document.querySelector(".site-menu");
  const menuToggle = menu.querySelector("summary");

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.open = false;
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !menu.open) return;

    menu.open = false;
    menuToggle.focus();
  });

  document.addEventListener("click", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });

  const root = document.documentElement;
  const motionPreference = matchMedia("(prefers-reduced-motion: no-preference)");
  const wheelInput = matchMedia("(any-pointer: fine)");
  const hero = document.querySelector(".hero");
  const heroMedia = document.querySelector(".hero-media");
  const reel = document.querySelector(".lift-reel");
  const reelStage = document.querySelector(".lift-sticky");
  const manualRunway = document.querySelector(".manual-runway");
  const manualIntro = document.querySelector(".manual-intro");
  const journal = document.querySelector(".journal-frame");
  const unwrap = document.querySelector(".unwrap-button");
  const ruler = document.querySelector(".roadmap-ruler");
  const bookArt = [...document.querySelectorAll(".book-art")];
  const coachPhoto = document.querySelector(".coach-note img");
  const openThreshold = .78;
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const segment = (value, start, end) => clamp((value - start) / (end - start));
  const easeOut = (value) => 1 - (1 - value) ** 3;
  const smoothstep = (value) => value * value * (3 - 2 * value);

  function setProperties(element, properties) {
    for (const [property, value] of Object.entries(properties)) {
      element.style.setProperty(property, value);
    }
  }

  let lenis;
  let frame = 0;
  let paperProgress = 1;
  let paperOverride = null;
  let paperAnimation = null;
  let paperIsOpen = true;

  function pinnedProgress(track, panel) {
    const travel = track.height - panel.height;
    return travel > 1 ? clamp((Math.max(0, panel.top) - track.top) / travel) : null;
  }

  function renderLift(progress) {
    const roll = easeOut(segment(progress, .04, .56));
    const leave = smoothstep(segment(progress, .57, .99));
    const tear = smoothstep(segment(progress, .64, 1));

    setProperties(reel, {
      "--disc-x": `${54 * (1 - roll) - 64 * leave}%`,
      "--disc-y": `${15 * (1 - roll) + 23 * leave}%`,
      "--disc-turn": `${-48 + 60 * roll - 100 * leave}deg`,
      "--disc-scale": .82 + .18 * roll + .15 * leave,
      "--type-shift": `${-34 * (1 - roll) - 84 * leave}px`,
      "--target-shift": `${-6 * leave}%`,
      "--sheet-x": `${62 - 100 * tear}%`,
    });
  }

  function renderPaper(progress) {
    const seal = smoothstep(segment(progress, 0, .3));
    const left = smoothstep(segment(progress, .13, .74));
    const right = smoothstep(segment(progress, .27, .94));

    setProperties(journal, {
      "--unfold": left,
      "--unfold-second": right,
      "--paper-opacity": 1 - segment(left, .76, 1),
      "--paper-opacity-second": 1 - segment(right, .76, 1),
      "--seal-y": `${-128 * seal}px`,
      "--seal-spin": `${-6 + 49 * seal}deg`,
      "--seal-opacity": 1 - segment(seal, .28, .96),
      "--seal-scale": 1 + .16 * seal,
    });
  }

  function renderScene(time) {
    frame = 0;
    const height = window.innerHeight;
    const heroBox = hero.getBoundingClientRect();
    const reelBox = reel.getBoundingClientRect();
    const stageBox = reelStage.getBoundingClientRect();
    const manualBox = manualRunway.getBoundingClientRect();
    const introBox = manualIntro.getBoundingClientRect();
    const journalBox = journal.getBoundingClientRect();
    const rulerBox = ruler.getBoundingClientRect();
    const coachTop = coachPhoto.getBoundingClientRect().top;
    const coverProgress = bookArt.map((art) => {
      const box = art.getBoundingClientRect();
      return clamp((height - box.top) / (height + box.height));
    });

    const liftProgress = pinnedProgress(reelBox, stageBox);
    const scrollFold = pinnedProgress(manualBox, introBox)
      ?? clamp((height * .88 - journalBox.top) / (height * .82));
    const afterHero = clamp(-heroBox.top / heroBox.height);
    const scrollRuler = clamp((height * .82 - rulerBox.top) / (height * .43));

    if (journalBox.bottom < 0 || journalBox.top > height * 1.15) {
      paperOverride = null;
      paperAnimation = null;
    }

    paperProgress = paperOverride ?? scrollFold;
    if (paperAnimation) {
      const { from, to, start } = paperAnimation;
      const progress = clamp((time - start) / 750);
      paperProgress = from + (to - from) * easeOut(progress);

      if (progress === 1) paperAnimation = null;
      else scheduleScene();
    }

    const openNow = paperProgress >= openThreshold;
    if (openNow !== paperIsOpen) {
      paperIsOpen = openNow;
      unwrap.textContent = openNow ? "Wrap the journal" : "Unwrap the journal";
    }

    if (liftProgress !== null) renderLift(liftProgress);
    else if (reel.hasAttribute("style")) reel.removeAttribute("style");
    renderPaper(paperProgress);
    heroMedia.style.setProperty("--hero-drift", `${afterHero * 78}px`);
    ruler.style.setProperty("--weeks-fill", scrollRuler);
    bookArt.forEach((art, index) => {
      const progress = coverProgress[index];
      setProperties(art, {
        "--cover-drift": `${(progress - .5) * 6}%`,
        "--cover-tilt": `${(index === 1 ? -1 : 1) * (1 - progress) * 2.2}deg`,
      });
    });
    coachPhoto.style.setProperty("--photo-settle", clamp((height * .87 - coachTop) / (height * .56)));
  }

  function scheduleScene() {
    if (!frame) frame = requestAnimationFrame(renderScene);
  }

  function flipPaper() {
    paperOverride = (paperOverride ?? paperProgress) >= openThreshold ? 0 : 1;
    paperAnimation = { from: paperProgress, to: paperOverride, start: performance.now() };
    scheduleScene();
  }

  function syncWheel() {
    lenis?.destroy();
    lenis = undefined;

    if (motionPreference.matches && wheelInput.matches && typeof window.Lenis === "function") {
      lenis = new window.Lenis({
        autoRaf: true,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
        stopInertiaOnNavigate: true,
        lerp: .084,
      });
    }
  }

  function syncMotion() {
    const enabled = motionPreference.matches;
    root.classList.toggle("motion-on", enabled);
    unwrap.hidden = !enabled;

    if (enabled) {
      paperIsOpen = true;
      unwrap.textContent = "Wrap the journal";
      scheduleScene();
      window.addEventListener("scroll", scheduleScene, { passive: true });
      window.addEventListener("resize", scheduleScene);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      paperOverride = null;
      paperAnimation = null;
      window.removeEventListener("scroll", scheduleScene);
      window.removeEventListener("resize", scheduleScene);
      hero.classList.remove("hero-enter");
      reel.removeAttribute("style");
    }

    syncWheel();
  }

  document.addEventListener("click", (event) => {
    if (!lenis || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href^="#"]');
    if (!link || link.classList.contains("skip-link")) return;

    const hash = link.getAttribute("href");
    const destination = document.getElementById(hash.slice(1));
    if (!destination) return;

    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, "", hash);

    // Preserve the keyboard navigation position while Lenis moves the viewport.
    if (!destination.hasAttribute("tabindex")) {
      destination.tabIndex = -1;
      destination.addEventListener("blur", () => destination.removeAttribute("tabindex"), { once: true });
    }
    destination.focus({ preventScroll: true });

    const scrollPadding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const target = hash === "#top" ? 0 : destination.getBoundingClientRect().top + window.scrollY - scrollPadding;
    lenis.scrollTo(target, { duration: .96, easing: easeOut });
  });

  unwrap.addEventListener("click", flipPaper);
  motionPreference.addEventListener("change", syncMotion);
  wheelInput.addEventListener("change", syncWheel);
  syncMotion();

  if (motionPreference.matches && window.scrollY < 80) {
    hero.classList.add("hero-enter");
    hero.addEventListener("animationend", () => hero.classList.remove("hero-enter"), { once: true });
  }
})();
