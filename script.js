// Supabase Connection
const supabaseUrl = "https://qalpehjzykkpvkzzikwl.supabase.co";
const supabaseKey = "sb_publishable_mWRL6nZ6vt1a78yuCdcNKA_kqI-1s_C";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

// Toggle Login / Signup Forms
function toggleForms() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    loginForm.classList.toggle("active");
    registerForm.classList.toggle("active");
}

// Login
document.getElementById("loginBtn").addEventListener("click", function () {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        alert("Please fill all fields.");
        return;
    }

    const loginData = {
        email,
        password
    };

    console.log("Login Data:", JSON.stringify(loginData));
});

// Signup
document.getElementById("signupBtn").addEventListener("click", async function () {
    const name = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("users")
        .insert([
            {
                name: name,
                email: email,
                password: password
            }
        ]);

    if (error) {
        console.error("Signup Error:", error);
        alert("Signup failed!");
    } else {
        console.log("User Created:", data);
        alert("Account created successfully!");
    }
});