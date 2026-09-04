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

    // Save logged-in user
    localStorage.setItem("loggedInUser", JSON.stringify(data));

    // Check whether employee profile exists
    const { data: profile, error: profileError } = await supabaseClient
        .from("employee_profiles")
        .select("id")
        .eq("user_id", data.id)
        .maybeSingle();

    if (profileError) {
        console.error("Profile Check Error:", profileError);
        alert(profileError.message);
        return;
    }

    // Redirect
    if (profile) {
        window.location.href = "dashboard.html";
    } else {
        window.location.href = "profile-setup.html";
    }
});

// ================================
// Signup (Admin creates employee)
// ================================

document.getElementById("signupBtn").addEventListener("click", async function () {

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }

    // Check duplicate email
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
        alert("Email already registered.");
        return;
    }

    // Create employee login
    const { data: newUser, error } = await supabaseClient
        .from("users")
        .insert([
            {
                name,
                email,
                password
            }
        ])
        .select()
        .single();

    if (error) {
        console.error("Signup Error:", error);
        alert(error.message);
        return;
    }

    // Save employee
    localStorage.setItem("loggedInUser", JSON.stringify(newUser));

    // Admin now completes employee profile
    window.location.href = "profile-setup.html";
});