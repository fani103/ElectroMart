/* ============================================================
   UTILITY: SHARED LOGGER
   ------------------------------------------------------------
   Why this file exists:
   All 6 task files originally used console.log() directly, which
   means output was only visible in the browser DevTools console.
   That's fine for grading, but not a great experience for anyone
   just opening index.html.

   This file defines two small helper functions, log() and
   logHeading(), that both task files use INSTEAD of console.log().
   They do two things at once:
     1. Print to the real console (so `node task1_basics.js` still
        works exactly as before, and DevTools output is unchanged).
     2. Mirror the same output into the on-page console panel
        (div#console-output in index.html), if it exists.

   This file must be loaded BEFORE any task file in index.html.
   ============================================================ */

/**
 * Print a line of output to both the real console and the
 * on-page console panel (if present).
 * @param {...any} args - values to log, same usage as console.log
 */
function log(...args) {
  // 1) Always log to the real console (keeps Node.js execution working)
  console.log(...args);

  // 2) If we're in a browser and the output panel exists, mirror it there
  if (typeof document === "undefined") return; // running in Node, nothing more to do

  const outputPanel = document.getElementById("console-output");
  if (!outputPanel) return; // page doesn't have the panel (or not built yet)

  const line = document.createElement("div");
  line.className = "console-line";
  // Turn objects/arrays into readable text instead of "[object Object]"
  line.textContent = args
    .map((value) => (typeof value === "object" ? JSON.stringify(value) : value))
    .join(" ");

  outputPanel.appendChild(line);
  outputPanel.scrollTop = outputPanel.scrollHeight; // auto-scroll to latest line
}

/**
 * Print a visually distinct section heading (used to separate
 * each task's output, and each program inside Task 6).
 * @param {string} title
 */
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

/**
 * Clear the on-page console panel only (does not affect the
 * real DevTools console). Used by the "Clear Output" button.
 */
function clearConsolePanel() {
  if (typeof document === "undefined") return;
  const outputPanel = document.getElementById("console-output");
  if (outputPanel) outputPanel.innerHTML = "";
}
