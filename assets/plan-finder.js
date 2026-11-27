(() => {
  const finder = document.querySelector(".plan-finder");
  if (!finder) return;

  const goal = finder.querySelector('[data-finder="goal"]');
  const priority = finder.querySelector('[data-finder="priority"]');
  const result = finder.querySelector(".finder-result");
  const heading = result.querySelector("h4");
  const link = result.querySelector(".finder-link");
  const reset = finder.querySelector(".finder-reset");
  const plans = {
    "fat-loss": ["Fat Loss", "Your priority is getting leaner while continuing to lift and hold on to the muscle you’ve built."],
    "body-recomp": ["Body Recomp", "You want to work on losing fat and building muscle in the same training block."],
    "muscle-gain": ["Muscle Gain", "Your priority is adding size. This guide pairs progressive lifting with a controlled calorie surplus."],
  };

  finder.addEventListener("click", (event) => {
    const choice = event.target.closest("button[data-plan]");
    if (!choice) return;
    const plan = choice.dataset.plan;
    goal.hidden = true;
    reset.hidden = false;
    if (plan === "both") {
      priority.hidden = false;
      priority.querySelector("button").focus();
      return;
    }
    priority.hidden = true;
    const [label, reason] = plans[plan];
    heading.textContent = label;
    result.querySelector(".finder-reason").textContent = reason;
    link.href = `#${plan}`;
    result.hidden = false;
    heading.focus();
  });

  reset.addEventListener("click", () => {
    priority.hidden = true;
    result.hidden = true;
    reset.hidden = true;
    goal.hidden = false;
    goal.querySelector("button").focus();
  });

  finder.hidden = false;
})();
