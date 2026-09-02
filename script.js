function toggleForms() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        loginForm.classList.toggle('active');
        registerForm.classList.toggle('active');
    }


document.getElementById("loginBtn").addEventListener("click", function () {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        alert("Please fill all fields.");
        return;
    }

    console.log("Login Data:", { email, password });
});

document.getElementById("signupBtn").addEventListener("click", function () {
    const name = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }

    console.log("Signup Data:", { name, email, password });
});