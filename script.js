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
        .single();

    if (error || !data) {
        alert("Invalid email or password.");
        return;
    }

    alert("Login successful!");
});

// Signup
document.getElementById("signupBtn").addEventListener("click", async function () {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseClient
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (existingUser) {
        alert("Email already registered. Please log in or use Forgot Password.");
        return;
    }

    // Create new account
    const { error } = await supabaseClient
        .from("users")
        .insert([
            { name, email, password }
        ]);

    if (error) {
        console.error(error);
        alert("Signup failed.");
    } else {
        alert("Account created successfully!");
    }
});