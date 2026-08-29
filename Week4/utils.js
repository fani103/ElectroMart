/* ============================================================
   UTILITY: SHARED LOGGER
   ------------------------------------------------------------
   Used by Task 1 (Functions), Task 2 (Arrays), and Task 3
   (Objects) — all three are "console-style" tasks whose output
   is best read as a log rather than shown visually on the page.

   Tasks 4, 5, and 6 are different: they manipulate real DOM
   elements and respond to real events, so their "output" is the
   page itself, not this console. They still call log() for a
   few key actions so there's a written trail of what happened.

   Must be loaded BEFORE any other script in index.html.
   ============================================================ */

function log(...args) {
  console.log(...args);

  if (typeof document === "undefined") return; // Node.js — nothing more to do

  const outputPanel = document.getElementById("console-output");
  if (!outputPanel) return;

  const line = document.createElement("div");
  line.className = "console-line";
  line.textContent = args
    .map((value) => (typeof value === "object" ? JSON.stringify(value) : value))
    .join(" ");

  outputPanel.appendChild(line);
  outputPanel.scrollTop = outputPanel.scrollHeight;
}

function logHeading(title) {
  console.log(title);
  if (typeof document === "undefined") return;

  const outputPanel = document.getElementById("console-output");
  if (!outputPanel) return;

  const heading = document.createElement("div");
  heading.className = "console-heading";
  heading.textContent = title;
  outputPanel.appendChild(heading);
  outputPanel.scrollTop = outputPanel.scrollHeight;
}

function clearConsolePanel() {
  if (typeof document === "undefined") return;
  const outputPanel = document.getElementById("console-output");
  if (outputPanel) outputPanel.innerHTML = "";
}
