/* ============================================================
   TASK 5: LOOPS
   ------------------------------------------------------------
   Concepts covered:
     - for loop, while loop, do...while loop
     - loop conditions, increment/decrement inside loops
     - break and continue
   Depends on: utils.js (must be loaded first)
   ============================================================ */

// -------- Helper: sum of numbers from 1 to n --------
function sumUpTo(n) {
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    sum += i;
  }
  log(`Sum of numbers from 1 to ${n} = ${sum}`);
}

/**
 * Runs every loop example for Task 5 in order.
 */
function runTask5() {
  logHeading("==== TASK 5: Loops ====");

  // -------- 1. Numbers 1 to 10 (for loop) --------
  log("Numbers 1 to 10:");
  for (let i = 1; i <= 10; i++) {
    log(i);
  }

  // -------- 2. Even numbers 1 to 20 --------
  log("Even Numbers from 1 to 20:");
  for (let i = 1; i <= 20; i++) {
    if (i % 2 === 0) log(i);
  }

  // -------- 3. Odd numbers 1 to 20 --------
  log("Odd Numbers from 1 to 20:");
  for (let i = 1; i <= 20; i++) {
    if (i % 2 !== 0) log(i);
  }

  // -------- 4. Multiplication table (while loop) --------
  log("Multiplication Table of 7:");
  const tableNum = 7;
  let multiplier = 1;
  while (multiplier <= 10) {
    log(`${tableNum} x ${multiplier} = ${tableNum * multiplier}`);
    multiplier++; // increment happens inside the loop body
  }

  // -------- 5. Sum of 1 to N --------
  sumUpTo(50);

  // -------- 6. Reverse printing (do...while loop) --------
  // do...while always runs the body at least once before checking
  // the condition — useful when you need "run first, check after".
  log("Numbers from 10 to 1 (reverse):");
  let count = 10;
  do {
    log(count);
    count--; // decrement happens inside the loop body
  } while (count >= 1);

  // -------- 7. break: stop the loop early once a condition is met --------
  log("Looking for the first multiple of 6 from 20 to 100:");
  for (let i = 20; i <= 100; i++) {
    if (i % 6 === 0) {
      log(`Found it: ${i}`);
      break; // exits the loop immediately
    }
  }

  // -------- 8. continue: skip an iteration without stopping the loop --------
  log("Numbers 1 to 15, skipping multiples of 3:");
  for (let i = 1; i <= 15; i++) {
    if (i % 3 === 0) continue; // jump straight to the next iteration
    log(i);
  }

  // -------- Bonus: for...of loop over an array --------
  log("Iterating over an array with for...of:");
  const fruits = ["Apple", "Banana", "Mango", "Grapes"];
  for (const fruit of fruits) {
    log(fruit);
  }

  log("---- Task 5 Complete ----");
}

runTask5();
