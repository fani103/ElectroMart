/* ============================================================
   TASK 2: VARIABLES & DATA TYPES
   ------------------------------------------------------------
   Concepts covered:
     - let vs const, declaration vs assignment
     - string, number, boolean, undefined, null
     - typeof operator
   Depends on: utils.js (must be loaded first)
   ============================================================ */

function runTask2() {
  logHeading("==== TASK 2: Variables & Data Types ====");

  // -------- 1. Declaration vs assignment --------
  let city;             // declaration only — no value yet
  city = "Chennai";     // assignment happens here, separately
  log("Declared then assigned:", city);

  let country = "India"; // declaration + assignment together
  log("Declared and assigned together:", country);

  // -------- 2. let vs const --------
  let temperature = 30;  // "let" can be reassigned later
  temperature = 32;
  log("Updated temperature (let):", temperature);

  const pi = 3.14159;    // "const" can NEVER be reassigned
  log("Constant value (const):", pi);
  // pi = 3.14; // <- this line would throw a TypeError if uncommented

  // -------- 3. String --------
  let greeting = "Welcome to InternNova!";
  log("String:", greeting, "| typeof:", typeof greeting);

  // -------- 4. Number (JS has only one number type for int + float) --------
  let age = 21;
  let price = 499.99;
  log("Number (int):", age, "| typeof:", typeof age);
  log("Number (float):", price, "| typeof:", typeof price);

  // -------- 5. Boolean --------
  let isEnrolled = true;
  let isCompleted = false;
  log("Boolean:", isEnrolled, "|", isCompleted, "| typeof:", typeof isEnrolled);

  // -------- 6. Undefined --------
  // A variable that has been declared but never assigned a value.
  let mentorName;
  log("Undefined variable:", mentorName, "| typeof:", typeof mentorName);

  // -------- 7. Null --------
  // Represents an intentional "no value" — set explicitly by the developer.
  let internshipCertificate = null;
  log("Null variable:", internshipCertificate, "| typeof:", typeof internshipCertificate);
  // Note: typeof null returns "object" — this is a well-known JS quirk,
  // not a bug in this code.

  // -------- 8. typeof on several values at once --------
  log("typeof 100         ->", typeof 100);
  log("typeof 'text'      ->", typeof "text");
  log("typeof true        ->", typeof true);
  log("typeof undefined   ->", typeof undefined);
  log("typeof null        ->", typeof null);
  log("typeof [1,2,3]     ->", typeof [1, 2, 3]); // arrays are "object"
  log("typeof {a:1}       ->", typeof { a: 1 });  // objects are "object"

  // -------- Bonus: template literals for cleaner string building --------
  let studentName = "Arjun";
  let course = "Web Development";
  log(`${studentName} is enrolled in ${course}.`);

  log("---- Task 2 Complete ----");
}

runTask2();
