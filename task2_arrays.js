/* ============================================================
   TASK 2: ARRAYS
   ------------------------------------------------------------
   Concepts covered:
     - Creating arrays
     - Accessing elements (index)
     - Adding elements (push, unshift)
     - Removing elements (pop, shift, splice)
     - Updating elements
     - Iterating (for, for...of, forEach)
     - Array methods (map, filter, find, includes, sort)
   Dataset: a small product catalog — a practical, realistic use case.
   Depends on: utils.js (must be loaded first)
   ============================================================ */

function runTask2() {
  logHeading("==== TASK 2: Arrays ====");

  // -------- 1. Creating an array --------
  let products = ["Notebook", "Pen", "Backpack", "Water Bottle"];
  log("Initial array:", products);

  // -------- 2. Accessing elements by index --------
  log("First item (index 0):", products[0]);
  log("Last item:", products[products.length - 1]);

  // -------- 3. Adding elements --------
  products.push("Headphones");     // adds to the END
  products.unshift("Sticky Notes"); // adds to the START
  log("After push('Headphones') and unshift('Sticky Notes'):", products);

  // -------- 4. Updating an element --------
  products[2] = "Premium Pen"; // overwrite by index
  log("After updating index 2:", products);

  // -------- 5. Removing elements --------
  products.pop();   // removes the LAST item
  products.shift(); // removes the FIRST item
  log("After pop() and shift():", products);

  const removed = products.splice(1, 1); // remove 1 item starting at index 1
  log(`After splice(1, 1) — removed "${removed[0]}":`, products);

  // -------- 6. Iterating with a classic for loop --------
  log("Iterating with for loop:");
  for (let i = 0; i < products.length; i++) {
    log(`  [${i}] ${products[i]}`);
  }

  // -------- 7. Iterating with for...of --------
  log("Iterating with for...of:");
  for (const item of products) {
    log(`  - ${item}`);
  }

  // -------- 8. Iterating with forEach (array method + callback function) --------
  log("Iterating with forEach:");
  products.forEach((item, index) => {
    log(`  #${index + 1}: ${item}`);
  });

  // -------- 9. Working with a richer dataset: student records --------
  const students = [
    { name: "Ananya", marks: 88 },
    { name: "Rahul", marks: 34 },
    { name: "Priya", marks: 72 },
    { name: "Dev", marks: 95 },
  ];
  log("Student dataset:", students);

  // map(): transform every element into something new
  const namesOnly = students.map((s) => s.name);
  log("Names only (map):", namesOnly);

  // filter(): keep only elements matching a condition
  const passedStudents = students.filter((s) => s.marks >= 40);
  log("Passed students (filter, marks >= 40):", passedStudents.map((s) => s.name));

  // find(): return the FIRST element matching a condition
  const topper = students.find((s) => s.marks === 95);
  log("Topper (find, marks === 95):", topper);

  // includes(): check if a value exists in an array
  log("Does products include 'Notebook'?", products.includes("Notebook"));

  // sort(): sort students by marks, descending
  const rankedStudents = [...students].sort((a, b) => b.marks - a.marks);
  log("Ranked by marks (sort, descending):", rankedStudents.map((s) => `${s.name} (${s.marks})`));

  log("---- Task 2 Complete ----");
}

runTask2();
