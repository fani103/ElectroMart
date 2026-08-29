/* ============================================================
   TASK 6: MINI JAVASCRIPT PROJECT — TO-DO LIST
   ------------------------------------------------------------
   Combines everything from Week 4:
     - Functions   -> addTask(), toggleTask(), deleteTask(), renderTasks()
     - Arrays      -> the `tasks` array is the app's entire data model
     - Objects     -> each task is stored as an object { id, text, priority, completed }
     - DOM         -> renderTasks() builds/updates the <ul> from the array
     - Events      -> form submit, click (toggle/delete), filter buttons

   Note: tasks live in memory only (a JS array), so the list resets
   on page refresh. That keeps this a pure vanilla-JS exercise
   without relying on browser storage.
   Depends on: utils.js (must be loaded first)
   ============================================================ */

// -------- The data model: an array of task OBJECTS --------
let tasks = [
  { id: 1, text: "Complete Week 4 assignment", priority: "High", completed: false },
  { id: 2, text: "Review JavaScript array methods", priority: "Medium", completed: true },
];

let nextTaskId = 3;        // simple auto-incrementing id for new tasks
let currentFilter = "all"; // "all" | "active" | "completed"

// -------- Function: add a new task object to the array --------
function addTask(text, priority) {
  const newTask = {
    id: nextTaskId++,
    text: text.trim(),
    priority,
    completed: false,
  };
  tasks.push(newTask); // Array method: push()
  log(`Task 6: added task "${newTask.text}" (${newTask.priority} priority)`);
  renderTasks();
}

// -------- Function: toggle a task's completed state --------
function toggleTask(id) {
  // Array method: map() — rebuild the array, flipping only the matching task
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  const target = tasks.find((task) => task.id === id); // Array method: find()
  log(`Task 6: "${target.text}" marked as ${target.completed ? "completed" : "active"}`);
  renderTasks();
}

// -------- Function: remove a task from the array --------
function deleteTask(id) {
  const target = tasks.find((task) => task.id === id);
  tasks = tasks.filter((task) => task.id !== id); // Array method: filter()
  log(`Task 6: deleted task "${target.text}"`);
  renderTasks();
}

// -------- Function: change which tasks are currently visible --------
function setFilter(filter) {
  currentFilter = filter;
  renderTasks();
}

// -------- Function: return only the tasks that match the current filter --------
function getVisibleTasks() {
  if (currentFilter === "active") return tasks.filter((task) => !task.completed);
  if (currentFilter === "completed") return tasks.filter((task) => task.completed);
  return tasks; // "all"
}

// -------- Function: render the task array onto the page (DOM manipulation) --------
function renderTasks() {
  const list = document.getElementById("todo-list");
  const stats = document.getElementById("todo-stats");
  const visibleTasks = getVisibleTasks();

  list.innerHTML = ""; // clear current list before re-rendering

  if (visibleTasks.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "todo-empty";
    emptyMessage.textContent = "No tasks here yet.";
    list.appendChild(emptyMessage);
  }

  visibleTasks.forEach((task) => {
    // Build one <li> per task using createElement (DOM manipulation)
    const item = document.createElement("li");
    item.className = "todo-item" + (task.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => toggleTask(task.id)); // Event: change

    const textSpan = document.createElement("span");
    textSpan.className = "todo-text";
    textSpan.textContent = task.text;

    const priorityBadge = document.createElement("span");
    priorityBadge.className = `todo-priority priority-${task.priority.toLowerCase()}`;
    priorityBadge.textContent = task.priority;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "todo-delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => deleteTask(task.id)); // Event: click

    item.append(checkbox, textSpan, priorityBadge, deleteBtn);
    list.appendChild(item);
  });

  // Update the stats line (e.g. "1 of 2 tasks completed")
  const completedCount = tasks.filter((task) => task.completed).length;
  stats.textContent = `${completedCount} of ${tasks.length} tasks completed`;
}

function setupTodoApp() {
  const form = document.getElementById("todo-form");
  const input = document.getElementById("todo-input");
  const prioritySelect = document.getElementById("todo-priority");
  const filterButtons = document.querySelectorAll(".filter-btn");

  // Event: submit — add a new task without reloading the page
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim()) return; // ignore empty submissions
    addTask(input.value, prioritySelect.value);
    input.value = "";
    input.focus();
  });

  // Event: click — switch the active filter
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      setFilter(button.dataset.filter);
    });
  });

  renderTasks(); // initial render with the starting sample tasks
}

window.addEventListener("DOMContentLoaded", setupTodoApp);
