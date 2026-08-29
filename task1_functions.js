/* ============================================================
   TASK 1: JAVASCRIPT FUNCTIONS
   ------------------------------------------------------------
   Concepts covered:
     - Function declaration
     - Parameters vs arguments
     - Return values
     - Multiple functions working together
     - Arrow functions
   Depends on: utils.js (must be loaded first)
   ============================================================ */

// -------- 1. Function declaration with parameters + return value --------
// "marks" and "totalMarks" are PARAMETERS (placeholders in the definition).
// The actual numbers passed in when calling the function are ARGUMENTS.
function calculatePercentage(marks, totalMarks) {
  const percentage = (marks / totalMarks) * 100;
  return percentage.toFixed(2); // returning a value makes this function reusable
}

// -------- 2. A second function that uses the return value of the first --------
function getGrade(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 75) return "A";
  if (percentage >= 60) return "B";
  if (percentage >= 40) return "C";
  return "Fail";
}

// -------- 3. Function with multiple parameters — total price calculator --------
function calculateTotalPrice(pricePerItem, quantity, discountPercent = 0) {
  const subtotal = pricePerItem * quantity;
  const discount = (subtotal * discountPercent) / 100;
  return (subtotal - discount).toFixed(2);
}

// -------- 4. Arrow function — compact syntax for a simple function --------
// This is equivalent to: function generateGreeting(name) { return `Hi ${name}...` }
const generateGreeting = (name, timeOfDay) => `Good ${timeOfDay}, ${name}! Ready to code?`;

// -------- 5. Arrow function with no parameters --------
const getRandomMotivation = () => {
  const quotes = [
    "Small progress is still progress.",
    "Debugging is just problem-solving in disguise.",
    "Every expert was once a beginner.",
  ];
  const index = Math.floor(Math.random() * quotes.length);
  return quotes[index];
};

// -------- 6. Function calling another function (composition) --------
function printStudentReport(name, marks, totalMarks) {
  const percentage = calculatePercentage(marks, totalMarks); // reuse function 1
  const grade = getGrade(percentage);                        // reuse function 2
  log(`${name}: ${marks}/${totalMarks} marks -> ${percentage}% -> Grade ${grade}`);
}

/**
 * Runs every function example for Task 1 in order.
 */
function runTask1() {
  logHeading("==== TASK 1: JavaScript Functions ====");

  // Function declaration + return value
  log("Percentage (45/50):", calculatePercentage(45, 50) + "%");

  // Multiple functions working together
  printStudentReport("Ananya", 88, 100);
  printStudentReport("Rahul", 34, 100);

  // Function with multiple parameters + a default parameter
  log("Total price (3 x ₹250, no discount):", "₹" + calculateTotalPrice(250, 3));
  log("Total price (3 x ₹250, 10% discount):", "₹" + calculateTotalPrice(250, 3, 10));

  // Arrow functions
  log(generateGreeting("Faneesh", "morning"));
  log("Motivation:", getRandomMotivation());

  log("---- Task 1 Complete ----");
}

runTask1();
