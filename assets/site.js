(() => {
  "use strict";

  if (location.protocol === "file:") {
    document.querySelectorAll(".buy-action").forEach((action) => {
      action.href = new URL(action.getAttribute("href"), "https://fitness-website-zeta-red.vercel.app/");
    });
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
  const roadmap = document.querySelector(".roadmap");
  const roadmapStage = roadmap.querySelector(".roadmap-stage");
  const roadmapCamera = roadmap.querySelector(".roadmap-camera");
  const ruler = roadmap.querySelector(".roadmap-ruler");
  const roadmapWeeks = [...ruler.querySelectorAll(".roadmap-week")];
  const roadmapPhases = [...roadmap.querySelectorAll(".phase-copy")];
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

  const coverHover = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

  function resetCover(art) {
    for (const property of ["--book-pitch", "--book-yaw", "--book-light-x", "--book-light-y"]) {
      art.style.removeProperty(property);
    }
  }

  for (const art of bookArt) {
    art.addEventListener("pointermove", (event) => {
      if (!coverHover.matches || event.pointerType !== "mouse") return;

      const bounds = art.getBoundingClientRect();
      const x = clamp((event.clientX - bounds.left) / bounds.width);
      const y = clamp((event.clientY - bounds.top) / bounds.height);
      setProperties(art, {
        "--book-pitch": `${(0.5 - y) * 17}deg`,
        "--book-yaw": `${(x - 0.5) * 21}deg`,
        "--book-light-x": `${x * 100}%`,
        "--book-light-y": `${y * 100}%`,
      });
    });
    art.addEventListener("pointerleave", () => resetCover(art));
  }
  coverHover.addEventListener("change", () => bookArt.forEach(resetCover));

  let lenis;
  let frame = 0;
  let paperProgress = 1;
  let paperOverride = null;
  let paperAnimation = null;
  let paperIsOpen = true;
  let lastRoadmapProgress = null;

  // Each phase has an approach, a short hold, and a release into the next.
  const phaseBeats = [
    [.135, .285, .325, .49],
    [.31, .475, .515, .675],
    [.50, .665, .72, .875],
  ];

  function measureRoadmap() {
    const viewportHeight = Math.min(window.innerHeight, root.clientHeight);
    const rem = parseFloat(getComputedStyle(root).fontSize);
    const requiredHeight = roadmapCamera.offsetHeight * 1.048 + 2.5 * rem;
    const fits = requiredHeight <= viewportHeight;

    roadmap.classList.toggle("roadmap-pinned", fits);
    if (fits) {
      roadmap.style.setProperty("--camera-ruler", `${ruler.offsetTop + ruler.offsetHeight / 2}px`);
    } else {
      roadmap.removeAttribute("style");
      lastRoadmapProgress = null;
    }
    scheduleScene();
  }

  const roadmapObserver = new ResizeObserver(measureRoadmap);

  function scrubBeat(progress, start, arrive, release, end) {
    return smoothstep(segment(progress, start, arrive))
      * (1 - smoothstep(segment(progress, release, end)));
  }

  function renderRoadmap(progress) {
    if (progress === lastRoadmapProgress) return;
    lastRoadmapProgress = progress;

    const start = scrubBeat(progress, 0, .105, .13, .245);
    const finish = scrubBeat(progress, .69, .855, .88, .97);
    const endpointFocus = start + finish;
    const readingPhases = scrubBeat(progress, .045, .17, .835, .97);

    setProperties(roadmap, {
      "--weeks-fill": smoothstep(segment(progress, .105, .855)),
      "--camera-focus": endpointFocus + (1 - endpointFocus) * .34 * readingPhases,
      "--camera-anchor": `${25 + 50 * smoothstep(progress)}%`,
      "--roadmap-heading-clarity": 1 - .12 * endpointFocus,
    });
    roadmapWeeks[0].style.setProperty("--week-focus", start);
    roadmapWeeks[1].style.setProperty("--week-focus", finish);

    roadmapPhases.forEach((copy, index) => {
      const beat = phaseBeats[index];
      const focus = scrubBeat(progress, ...beat);
      const revealed = smoothstep(segment(progress, beat[0], beat[1]));

      setProperties(copy, {
        "--phase-clarity": 1 - .12 * readingPhases * (1 - focus),
        "--phase-lift": `${8 * readingPhases * (1 - revealed) - 6 * focus}px`,
        "--phase-scale": 1 + .026 * focus,
      });
    });
  }

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
    const roadmapProgress = roadmap.classList.contains("roadmap-pinned")
      ? pinnedProgress(roadmap.getBoundingClientRect(), roadmapStage.getBoundingClientRect())
      : null;
    const coachTop = coachPhoto.getBoundingClientRect().top;
    const coverProgress = bookArt.map((art) => {
      const box = art.getBoundingClientRect();
      return clamp((height - box.top) / (height + box.height));
    });

    const liftProgress = pinnedProgress(reelBox, stageBox);
    const scrollFold = pinnedProgress(manualBox, introBox)
      ?? clamp((height * .88 - journalBox.top) / (height * .82));
    const afterHero = clamp(-heroBox.top / heroBox.height);

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
    if (roadmapProgress !== null) renderRoadmap(roadmapProgress);
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
      measureRoadmap();
      roadmapObserver.observe(roadmapCamera);
      window.addEventListener("resize", measureRoadmap);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      paperOverride = null;
      paperAnimation = null;
      window.removeEventListener("scroll", scheduleScene);
      window.removeEventListener("resize", measureRoadmap);
      roadmapObserver.disconnect();
      roadmap.classList.remove("roadmap-pinned");
      roadmap.removeAttribute("style");
      lastRoadmapProgress = null;
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

  function setupFooterLens() {
    const title = document.querySelector(".footer-title");
    const lens = title.querySelector(".footer-lens");
    const preference = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)");
    const current = { x: 0, y: 0, radius: 0 };
    const target = { x: 0, y: 0, radius: 0 };
    let animation = 0;
    let lastTime = 0;

    function clearLens() {
      cancelAnimationFrame(animation);
      animation = 0;
      lastTime = 0;
      current.radius = target.radius = 0;
      lens.hidden = true;
    }

    function paint(time) {
      const elapsed = lastTime ? Math.min(50, time - lastTime) : 16;
      const follow = 1 - Math.exp(-elapsed / 39);
      lastTime = time;

      current.x += (target.x - current.x) * follow;
      current.y += (target.y - current.y) * follow;
      current.radius += (target.radius - current.radius) * follow;

      setProperties(lens, {
        "--lens-x": `${current.x}px`,
        "--lens-y": `${current.y}px`,
        "--lens-r": `${current.radius}px`,
      });

      const settled = Math.hypot(target.x - current.x, target.y - current.y, target.radius - current.radius) < .35;
      if (!settled) {
        animation = requestAnimationFrame(paint);
        return;
      }

      animation = 0;
      lastTime = 0;
      if (!target.radius) clearLens();
    }

    function followPointer(event) {
      if (!preference.matches || event.pointerType !== "mouse") return;

      const entering = lens.hidden;
      lens.hidden = false;
      const bounds = lens.getBoundingClientRect();
      target.x = event.clientX - bounds.left;
      target.y = event.clientY - bounds.top;
      target.radius = Math.min(118, Math.max(66, title.clientWidth * .12));
      if (entering) {
        current.x = target.x;
        current.y = target.y;
      }
      if (!animation) animation = requestAnimationFrame(paint);
    }

    function leave() {
      if (lens.hidden) return;
      target.radius = 0;
      if (!animation) animation = requestAnimationFrame(paint);
    }

    title.addEventListener("pointerenter", followPointer);
    title.addEventListener("pointermove", followPointer);
    title.addEventListener("pointerleave", leave);
    title.addEventListener("pointercancel", clearLens);
    window.addEventListener("blur", clearLens);
    preference.addEventListener("change", clearLens);
  }

  unwrap.addEventListener("click", flipPaper);
  motionPreference.addEventListener("change", syncMotion);
  wheelInput.addEventListener("change", syncWheel);
  syncMotion();
  setupFooterLens();

  if (motionPreference.matches && window.scrollY < 80) {
    hero.classList.add("hero-enter");
    hero.addEventListener("animationend", () => hero.classList.remove("hero-enter"), { once: true });
  }
})();
