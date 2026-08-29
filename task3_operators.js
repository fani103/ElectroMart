/* ============================================================
   TASK 3: OPERATORS
   ------------------------------------------------------------
   Concepts covered:
     - Arithmetic operators
     - Assignment operators
     - Comparison operators (including == vs ===)
     - Logical operators
     - Increment / decrement operators
   Depends on: utils.js (must be loaded first)
   ============================================================ */

function runTask3() {
  logHeading("==== TASK 3: Operators ====");

  // -------- 1. Arithmetic operators --------
  let a = 15;
  let b = 4;
  log("Addition:", a + b);
  log("Subtraction:", a - b);
  log("Multiplication:", a * b);
  log("Division:", a / b);
  log("Modulus (remainder):", a % b);
  log("Exponent (a to the power 2):", a ** 2);

  // -------- 2. Assignment operators --------
  // Each one is shorthand for "do the operation, then reassign"
  let total = 10;
  log("Initial total:", total);
  total += 5; // same as: total = total + 5
  log("After += 5:", total);
  total -= 3; // same as: total = total - 3
  log("After -= 3:", total);
  total *= 2; // same as: total = total * 2
  log("After *= 2:", total);
  total /= 4; // same as: total = total / 4
  log("After /= 4:", total);
  total %= 3; // same as: total = total % 3
  log("After %= 3:", total);

  // -------- 3. Comparison operators --------
  let x = 10;
  let y = "10"; // same value as x, but a different type (string)
  log("x == y  (loose equality, ignores type):", x == y);   // true
  log("x === y (strict equality, checks type too):", x === y); // false
  log("x != y  :", x != y);
  log("x !== y :", x !== y);
  log("x > 5   :", x > 5);
  log("x < 5   :", x < 5);
  log("x >= 10 :", x >= 10);
  log("x <= 9  :", x <= 9);

  // -------- 4. Logical operators --------
  let hasID = true;
  let hasFee = false;
  log("AND (hasID && hasFee):", hasID && hasFee); // both must be true
  log("OR  (hasID || hasFee):", hasID || hasFee); // at least one true
  log("NOT (!hasFee):", !hasFee);                 // flips the boolean

  // -------- 5. Increment operator --------
  let counter = 5;
  log("Before increment:", counter);
  counter++; // post-increment: use value, then add 1
  log("After counter++:", counter);
  log("Pre-increment ++counter:", ++counter); // add 1, then use value

  // -------- 6. Decrement operator --------
  let stock = 10;
  log("Before decrement:", stock);
  stock--; // post-decrement: use value, then subtract 1
  log("After stock--:", stock);
  log("Pre-decrement --stock:", --stock); // subtract 1, then use value

  // -------- Bonus: ternary operator (shorthand if/else) --------
  let marks = 78;
  let result = marks >= 40 ? "Pass" : "Fail";
  log(`Marks: ${marks} -> Result: ${result}`);

  log("---- Task 3 Complete ----");
}

runTask3();
