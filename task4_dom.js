/* ============================================================
   TASK 4: DOM MANIPULATION
   ------------------------------------------------------------
   Unlike Tasks 1-3, this task doesn't log to a console panel —
   it manipulates REAL elements on the page (see the "DOM
   Playground" section in index.html). Click the buttons there
   and watch the playground box change live.

   Concepts covered:
     - Selecting elements (getElementById, querySelector)
     - Changing text content (textContent)
     - Changing HTML content (innerHTML)
     - Changing CSS styles (style property)
     - Adding elements (createElement + appendChild)
     - Removing elements (removeChild / remove)
   Depends on: utils.js (must be loaded first)
   ============================================================ */

// Keep track of how many items we've added, so new list items have
// unique, readable labels (Item 3, Item 4, ...).
let domItemCounter = 2;

function setupDomPlayground() {
  // -------- 1. Selecting elements --------
  const heading = document.getElementById("dom-heading");
  const paragraph = document.getElementById("dom-paragraph");
  const list = document.getElementById("dom-list");
  const playgroundBox = document.querySelector("#dom-playground");

  // -------- 2. Changing text content --------
  document.getElementById("btn-change-text").addEventListener("click", () => {
    heading.textContent = "Heading changed with textContent!";
    log("Task 4: changed heading using textContent");
  });

  // -------- 3. Changing HTML content --------
  document.getElementById("btn-change-html").addEventListener("click", () => {
    // innerHTML lets us insert actual markup, not just plain text
    paragraph.innerHTML = "This paragraph now has <strong>bold</strong> and <em>italic</em> text!";
    log("Task 4: changed paragraph using innerHTML");
  });

  // -------- 4. Changing CSS styles --------
  document.getElementById("btn-change-style").addEventListener("click", () => {
    playgroundBox.style.background = "rgba(167, 139, 250, 0.12)";
    playgroundBox.style.borderColor = "#a78bfa";
    log("Task 4: changed playground styles via element.style");
  });

  // -------- 5. Adding an element --------
  document.getElementById("btn-add-element").addEventListener("click", () => {
    domItemCounter++;
    const newItem = document.createElement("li"); // create a new element
    newItem.textContent = `Item ${domItemCounter} (added dynamically)`;
    list.appendChild(newItem); // insert it into the DOM
    log(`Task 4: added "Item ${domItemCounter}" to the list`);
  });

  // -------- 6. Removing an element --------
  document.getElementById("btn-remove-element").addEventListener("click", () => {
    if (list.lastElementChild) {
      const removedText = list.lastElementChild.textContent;
      list.removeChild(list.lastElementChild); // remove the last <li>
      log(`Task 4: removed "${removedText}" from the list`);
    } else {
      log("Task 4: list is already empty, nothing to remove");
    }
  });

  // -------- 7. Reset playground back to its original state --------
  document.getElementById("btn-reset-dom").addEventListener("click", () => {
    heading.textContent = "Original Heading";
    paragraph.textContent = "This is the original paragraph text.";
    playgroundBox.style.background = "";
    playgroundBox.style.borderColor = "";
    list.innerHTML = "<li>Item 1</li><li>Item 2</li>";
    domItemCounter = 2;
    log("Task 4: playground reset to its original state");
  });
}

// The DOM playground buttons only exist once the page HTML is parsed,
// so we wait for DOMContentLoaded before selecting/wiring them.
window.addEventListener("DOMContentLoaded", setupDomPlayground);
