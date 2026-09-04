const user = JSON.parse(localStorage.getItem("loggedInUser"));

if (!user) {
    window.location.href = "index.html";
}

document.getElementById("welcomeName").textContent =
    `Good Morning, ${user.name} 👋`;

document.getElementById("employeeId").textContent =
    `Employee ID: ${user.employee_id || "--"}`;

document.getElementById("logoutBtn").addEventListener("click", () => {

    localStorage.removeItem("loggedInUser");

    window.location.href = "index.html";

});