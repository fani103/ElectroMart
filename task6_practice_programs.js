/* ============================================================
   TASK 6: JAVASCRIPT PRACTICE PROGRAMS
   ------------------------------------------------------------
   Seven small programs that each combine several Week 3 concepts
   (variables, data types, operators, conditionals, loops).
   Required minimum was 5 — two extra are included as a bonus.
   Depends on: utils.js (must be loaded first)
   ============================================================ */

// -------- Program 1: Simple Interest Calculator --------
// Combines: variables, arithmetic operators, template literals
function calculateSimpleInterest(principal, rate, years) {
  const interest = (principal * rate * years) / 100;
  const totalAmount = principal + interest;
  log(`Principal: ₹${principal}, Rate: ${rate}%, Time: ${years} yrs`);
  log(`Interest = ₹${interest} | Total Amount = ₹${totalAmount}`);
}

// -------- Program 2: Leap Year Checker --------
// Combines: conditionals, logical operators, modulus
function isLeapYear(year) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  log(`${year} is ${leap ? "a Leap Year" : "not a Leap Year"}.`);
}

// -------- Program 3: Count Vowels in a Word --------
// Combines: for...of loop, conditionals, strings
function countVowels(word) {
  const vowels = "aeiouAEIOU";
  let vowelCount = 0;
  for (const letter of word) {
    if (vowels.includes(letter)) vowelCount++;
  }
  log(`"${word}" has ${vowelCount} vowel(s).`);
}

// -------- Program 4: Multiplication Table Generator --------
// Combines: for loop, template literals, arithmetic, default parameters
function generateTable(number, upto = 10) {
  for (let i = 1; i <= upto; i++) {
    log(`${number} x ${i} = ${number * i}`);
  }
}

// -------- Program 5: Number Guess Checker --------
// Combines: conditionals, comparison operators, boolean logic
function checkGuess(guess, target) {
  let message;
  if (guess === target) {
    message = "Correct guess!";
  } else if (guess < target) {
    message = "Too low, try higher.";
  } else {
    message = "Too high, try lower.";
  }
  log(`Guess ${guess} vs Target ${target} -> ${message}`);
}

// -------- Program 6: Factorial Calculator --------
// Combines: while loop, increment/decrement, variables
function calculateFactorial(n) {
  let factorial = 1;
  let i = n;
  while (i > 1) {
    factorial *= i;
    i--;
  }
  log(`${n}! = ${factorial}`);
}

// -------- Program 7: Attendance Summary (mini capstone) --------
// Combines: operators, conditionals, number formatting
function attendanceSummary(daysPresent, totalDays) {
  const percentage = ((daysPresent / totalDays) * 100).toFixed(2);
  let status;

  if (percentage >= 75) {
    status = "Eligible for certificate";
  } else if (percentage >= 50) {
    status = "Warning: Low attendance";
  } else {
    status = "Not eligible for certificate";
  }

  log(`Days Present: ${daysPresent}/${totalDays}`);
  log(`Attendance: ${percentage}% -> ${status}`);
}

/**
 * Runs all 7 practice programs in order, each with a labeled
 * heading so the output is easy to scan.
 */
function runTask6() {
  logHeading("==== TASK 6: Practice Programs ====");

  logHeading("Program 1 - Simple Interest");
  calculateSimpleInterest(10000, 5, 3);

  logHeading("Program 2 - Leap Year Check");
  isLeapYear(2024);
  isLeapYear(2100);

  logHeading("Program 3 - Vowel Count");
  countVowels("InternNova");

  logHeading("Program 4 - Multiplication Table of 9");
  generateTable(9, 5);

  logHeading("Program 5 - Guessing Game");
  checkGuess(45, 60);
  checkGuess(60, 60);

  logHeading("Program 6 - Factorial");
  calculateFactorial(6);

  logHeading("Program 7 - Attendance Summary");
  attendanceSummary(58, 70);

  log("---- Task 6 Complete ----");
}

runTask6();
