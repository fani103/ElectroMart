/* ============================================================
   TASK 3: OBJECTS
   ------------------------------------------------------------
   Concepts covered:
     - Creating objects
     - Properties and values
     - Accessing properties (dot vs bracket notation)
     - Updating properties
     - Adding new properties
     - Removing properties (delete)
   Scenario: employee records — a practical, realistic use case.
   Depends on: utils.js (must be loaded first)
   ============================================================ */

function runTask3() {
  logHeading("==== TASK 3: Objects ====");

  // -------- 1. Creating objects (3 meaningful examples) --------
  const employee1 = {
    id: "EMP001",
    name: "Ananya Rao",
    role: "Frontend Developer",
    salary: 45000,
  };

  const employee2 = {
    id: "EMP002",
    name: "Rahul Verma",
    role: "Backend Developer",
    salary: 48000,
  };

  const employee3 = {
    id: "EMP003",
    name: "Priya Nair",
    role: "UI/UX Designer",
    salary: 42000,
  };

  log("Employee 1:", employee1);
  log("Employee 2:", employee2);
  log("Employee 3:", employee3);

  // -------- 2. Accessing properties: dot notation --------
  log("Employee 1 name (dot notation):", employee1.name);

  // -------- 3. Accessing properties: bracket notation --------
  // Useful when the property name is stored in a variable, or has spaces/special characters.
  const propertyToCheck = "role";
  log(`Employee 2 ${propertyToCheck} (bracket notation):`, employee2[propertyToCheck]);

  // -------- 4. Updating a property --------
  employee1.salary = 47000; // Ananya got a raise
  log("Employee 1 after salary update:", employee1);

  // -------- 5. Adding a new property --------
  employee1.yearsOfExperience = 3;
  log("Employee 1 after adding 'yearsOfExperience':", employee1);

  // -------- 6. Removing a property --------
  delete employee3.salary; // e.g. salary info hidden from this view
  log("Employee 3 after removing 'salary':", employee3);

  // -------- 7. Objects with a nested object + a method --------
  // Real-world objects often nest other objects and include their own functions.
  const employee4 = {
    id: "EMP004",
    name: "Dev Kumar",
    role: "Team Lead",
    contact: {
      email: "dev.kumar@example.com",
      phone: "9999999999",
    },
    // A method: a function stored as a property
    getSummary() {
      return `${this.name} — ${this.role} (${this.contact.email})`;
    },
  };
  log("Employee 4 (nested object):", employee4);
  log("Employee 4 summary (calling a method):", employee4.getSummary());

  // -------- 8. Looping through an object's properties --------
  log("All properties of Employee 2:");
  for (const key in employee2) {
    log(`  ${key}: ${employee2[key]}`);
  }

  // -------- 9. Object.keys() / Object.values() (bonus, common in real code) --------
  log("Employee 1 keys:", Object.keys(employee1));
  log("Employee 1 values:", Object.values(employee1));

  log("---- Task 3 Complete ----");
}

runTask3();
