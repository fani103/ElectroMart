/* ============================================================
   TASK 1: JAVASCRIPT BASICS
   ------------------------------------------------------------
   Concepts covered:
     - JavaScript syntax & statements
     - console.log() (via the shared log() helper — see utils.js)
     - Single-line and multi-line comments
     - Linking JavaScript with an HTML file
   Depends on: utils.js (must be loaded first)
   ============================================================ */

/**
 * Runs every example for Task 1 in order.
 * Wrapped in a function (instead of running loose at file scope)
 * so index.html can re-run this task on demand via its "Run" button.
 */
function runTask1() {
  logHeading("==== TASK 1: JavaScript Basics ====");

  // -------- 1. Basic statement --------
  // A "statement" is a single instruction the JS engine executes.
  log("Hello, JavaScript!");

  // -------- 2. Multi-line comment (example above this block) --------
  // Multi-line comments explain a whole block of code at once and
  // are written with /* at the start and */ at the end.

  // -------- 3. Variables + basic syntax --------
  // Statements typically end with a semicolon (;)
  let studentName = "Priya"; // string value
  log("Student Name:", studentName);

  // -------- 4. Case sensitivity --------
  // JavaScript treats "score" and "Score" as two different variables.
  let score = 90;
  let Score = 95;
  log("score:", score, "| Score:", Score);

  // -------- 5. Linking JavaScript with HTML --------
  // This file is attached to index.html using:
  //   <script src="utils.js" defer></script>
  //   <script src="task1_basics.js" defer></script>
  // The "defer" attribute makes the browser finish loading the HTML
  // first, then run these scripts in the order they're listed.
  log("This script is linked correctly from index.html.");

  // -------- 6. Block scope --------
  // Variables declared with let/const only exist inside the {} block.
  {
    let insideBlock = "I only exist inside this block";
    log(insideBlock);
  }

  log("---- Task 1 Complete ----");
}

// Run automatically when the file loads (both in the browser and
// when executed directly with `node task1_basics.js`).
runTask1();
