// Supabase Connection
const supabaseUrl = "https://qalpehjzykkpvkzzikwl.supabase.co";
const supabaseKey = "sb_publishable_mWRL6nZ6vt1a78yuCdcNKA_kqI-1s_C";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

// ================================
// Toggle Login / Signup Forms
// ================================

function toggleForms() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    loginForm.classList.toggle("active");
    registerForm.classList.toggle("active");
}

// ================================
// Login
// ================================

document.getElementById("loginBtn").addEventListener("click", async function () {

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
        alert("Please fill all fields.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("users")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .maybeSingle();

    if (error) {
        console.error("Login Error:", error);
        alert(error.message);
        return;
    }

    if (!data) {
        alert("Invalid email or password.");
        return;
    }

    // Save logged-in user (we'll use this later on the dashboard)
    localStorage.setItem("loggedInUser", JSON.stringify(data));

    alert("Login successful!");

    // Redirect after successful login
    window.location.href = "https://nitin-jangra.github.io/hrms-frontend/index.html";
});


// ================================
// Signup
// ================================

document.getElementById("signupBtn").addEventListener("click", async function () {

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabaseClient
        .from("users")
        .select("email")
        .eq("email", email)
        .maybeSingle();

    if (checkError) {
        console.error("Signup Check Error:", checkError);
        alert(checkError.message);
        return;
    }

    if (existingUser) {
        alert("Email already registered. Please log in or use Forgot Password.");
        return;
    }

    // Insert new user
    const { error } = await supabaseClient
        .from("users")
        .insert([
            {
                name,
                email,
                password
            }
        ]);

    if (error) {
        console.error("Signup Error:", error);
        alert(error.message);
        return;
    }

    alert("Account created successfully!");

    // Switch back to Login form after signup
    toggleForms();
});