/* ============================================================
   TASK 4: CONDITIONAL STATEMENTS
   ------------------------------------------------------------
   Concepts covered:
     - if, if...else, else if, nested if
     - comparison + logical conditions
     - real-world decision-making problems
   Depends on: utils.js (must be loaded first)
   ============================================================ */

// -------- Helper 1: Positive / Negative / Zero --------
// Kept as its own small function so it's easy to re-use and test
// independently of the rest of Task 4.
function checkSign(n) {
  if (n > 0) {
    log(`${n} is Positive`);
  } else if (n < 0) {
    log(`${n} is Negative`);
  } else {
    log(`${n} is Zero`);
  }
}

// -------- Helper 2: Even or Odd --------
function checkEvenOdd(n) {
  if (n % 2 === 0) {
    log(`${n} is Even`);
  } else {
    log(`${n} is Odd`);
  }
}

// -------- Helper 3: Voting eligibility (nested if + logical condition) --------
function checkEligibility(age, hasID) {
  if (age >= 18) {
    if (hasID) {
      log(`Age ${age}: Eligible to vote (ID verified).`);
    } else {
      log(`Age ${age}: Eligible by age, but ID is required.`);
    }
  } else {
    log(`Age ${age}: Not eligible to vote.`);
  }
}

// -------- Helper 4: Greater of two numbers --------
function greaterOfTwo(p, q) {
  if (p > q) {
    log(`${p} is greater than ${q}`);
  } else if (q > p) {
    log(`${q} is greater than ${p}`);
  } else {
    log(`${p} and ${q} are equal`);
  }
}

// -------- Helper 5: Greatest of three numbers (nested if) --------
function greatestOfThree(p, q, r) {
  let greatest;
  if (p >= q) {
    greatest = p >= r ? p : r;
  } else {
    greatest = q >= r ? q : r;
  }
  log(`Greatest among ${p}, ${q}, ${r} is ${greatest}`);
}

// -------- Helper 6: Grade assignment (else-if ladder) --------
function assignGrade(marks) {
  let grade;
  if (marks >= 90) {
    grade = "A+";
  } else if (marks >= 80) {
    grade = "A";
  } else if (marks >= 70) {
    grade = "B";
  } else if (marks >= 60) {
    grade = "C";
  } else if (marks >= 40) {
    grade = "D";
  } else {
    grade = "Fail";
  }
  log(`Marks: ${marks} -> Grade: ${grade}`);
}

// -------- Bonus helper: switch statement (alternative to else-if) --------
function dayName(dayNumber) {
  switch (dayNumber) {
    case 1: log("Monday"); break;
    case 2: log("Tuesday"); break;
    case 3: log("Wednesday"); break;
    case 4: log("Thursday"); break;
    case 5: log("Friday"); break;
    case 6: log("Saturday"); break;
    case 7: log("Sunday"); break;
    default: log("Invalid day number");
  }
}

/**
 * Runs every conditional-statement example for Task 4 in order,
 * calling each helper function above with sample values.
 */
function runTask4() {
  logHeading("==== TASK 4: Conditional Statements ====");

  // Simple if
  if (5 > 0) log("5 is a positive number.");

  // Positive / Negative / Zero
  checkSign(10);
  checkSign(-7);
  checkSign(0);

  // Even / Odd
  checkEvenOdd(12);
  checkEvenOdd(7);

  // Voting eligibility
  checkEligibility(20, true);
  checkEligibility(16, false);

  // Greater of two numbers
  greaterOfTwo(45, 32);

  // Greatest of three numbers
  greatestOfThree(12, 45, 30);

  // Grade assignment
  assignGrade(95);
  assignGrade(83);
  assignGrade(55);
  assignGrade(30);

  // Bonus: switch statement
  dayName(6);

  log("---- Task 4 Complete ----");
}

runTask4();
