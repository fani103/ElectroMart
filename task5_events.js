/* ============================================================
   TASK 5: EVENTS
   ------------------------------------------------------------
   Wires up real user-interaction events on the "Events
   Playground" section of index.html. Each widget demonstrates
   a different kind of event.

   Concepts covered:
     - click event
     - input event (fires on every keystroke)
     - change event (fires when a field loses focus after changing)
     - submit event (form submission, with preventDefault)
     - mouse events (mouseenter / mouseleave)
     - keyboard events (keydown)
   Depends on: utils.js (must be loaded first)
   ============================================================ */

function setupEventsPlayground() {
  // -------- 1. click event --------
  let clickCount = 0;
  const clickButton = document.getElementById("click-counter-btn");
  const clickCountDisplay = document.getElementById("click-count");

  clickButton.addEventListener("click", () => {
    clickCount++;
    clickCountDisplay.textContent = clickCount;
    log(`Task 5: click event fired (count = ${clickCount})`);
  });

  // -------- 2. input event — fires on every keystroke, live preview --------
  const liveInput = document.getElementById("live-input");
  const inputPreview = document.getElementById("input-preview");

  liveInput.addEventListener("input", (event) => {
    inputPreview.textContent = event.target.value || "(nothing typed yet)";
  });

  // -------- 3. change event — fires when the value is committed (on blur) --------
  liveInput.addEventListener("change", (event) => {
    log(`Task 5: change event fired — final value was "${event.target.value}"`);
  });

  // -------- 4. submit event — form submission without reloading the page --------
  const demoForm = document.getElementById("demo-form");
  const nameInput = document.getElementById("form-name-input");
  const formResult = document.getElementById("form-result");

  demoForm.addEventListener("submit", (event) => {
    event.preventDefault(); // stops the browser's default full-page reload
    const name = nameInput.value.trim();
    formResult.textContent = name ? `Thanks, ${name}! Form submitted successfully.` : "Please enter a name first.";
    log(`Task 5: submit event fired — name = "${name}"`);
    demoForm.reset();
  });

  // -------- 5. Mouse events — mouseenter / mouseleave --------
  const hoverBox = document.getElementById("hover-box");

  hoverBox.addEventListener("mouseenter", () => {
    hoverBox.textContent = "You're hovering! 👋";
    hoverBox.classList.add("hover-box-active");
  });

  hoverBox.addEventListener("mouseleave", () => {
    hoverBox.textContent = "Hover over me";
    hoverBox.classList.remove("hover-box-active");
  });

  // -------- 6. Keyboard event — keydown --------
  const keyInput = document.getElementById("key-input");
  const keyDisplay = document.getElementById("key-display");

  keyInput.addEventListener("keydown", (event) => {
    keyDisplay.textContent = `Last key pressed: "${event.key}"`;
  });
}

window.addEventListener("DOMContentLoaded", setupEventsPlayground);
