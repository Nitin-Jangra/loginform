// =======================================
// HRMS Dashboard - Step 1 + Step 2
// Layout + Header (Supabase Connected)
// =======================================

// ---------------------------------------
// Supabase configuration
// FIX: credentials were never defined anywhere,
// which caused "supabaseClient is not defined".
// Use the SAME URL / anon key as your login page,
// or define them in a supabase-config.js file loaded
// BEFORE this script (see comment in dashboard.html).
// ---------------------------------------
const SUPABASE_URL = "https://qalpehjzykkpvkzzikwl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mWRL6nZ6vt1a78yuCdcNKA_kqI-1s_C";

// If a config file already created the client, reuse it.
// Otherwise create it here (only when real credentials are set).
let supabaseClient = window.supabaseClient || null;

const isSupabaseConfigured =
    !SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
    !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE");

if (!supabaseClient && window.supabase && isSupabaseConfigured) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------------------------------------
// Get logged-in user
// FIX: safe JSON parse (crashed on corrupted storage)
// ---------------------------------------
let loggedInUser = null;

try {
    loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
} catch (e) {
    console.warn("Corrupted 'loggedInUser' in localStorage:", e);
    loggedInUser = null;
}

// Redirect if user is not logged in
if (!loggedInUser) {
    window.location.replace("index.html");
}

// Page Load
document.addEventListener("DOMContentLoaded", async () => {

    // FIX: stop here when redirecting (previously the code kept
    // running with a null user and crashed on loggedInUser.id)
    if (!loggedInUser) return;

    // Initialize Lucide Icons (only place it is called now)
    if (window.lucide) {
        lucide.createIcons();
    }

    await loadHeader();
});

// =======================================
// Load Header Data
// =======================================

async function loadHeader() {
    try {

        // -----------------------------
        // Fallback values (used when Supabase is not configured,
        // so the header still renders instead of crashing)
        // -----------------------------
        let fullName = loggedInUser.name || loggedInUser.email || "User";
        let designationName = "Employee";

        // -----------------------------
        // Fetch from Supabase (only when the client exists)
        // -----------------------------
        if (supabaseClient && loggedInUser.id) {

            // -----------------------------
            // Fetch User
            // -----------------------------
            const { data: user, error: userError } = await supabaseClient
                .from("users")
                .select("*")
                .eq("id", loggedInUser.id)
                .single();

            console.log("User:", user);
            console.log("User Error:", userError);

            if (userError) throw userError;

            // -----------------------------
            // Fetch Employee Profile
            // -----------------------------
            const { data: profile, error: profileError } = await supabaseClient
                .from("employee_profiles")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            console.log("Profile:", profile);
            console.log("Profile Error:", profileError);

            if (profileError) throw profileError;

            // -----------------------------
            // Fetch Designation
            // -----------------------------
            if (profile?.designation_id) {

                const { data: designation, error: designationError } =
                    await supabaseClient
                        .from("designations")
                        .select("name")
                        .eq("id", profile.designation_id)
                        .maybeSingle();

                console.log("Designation:", designation);
                console.log("Designation Error:", designationError);

                if (designationError) throw designationError;

                if (designation) {
                    designationName = designation.name;
                }
            }

            // -----------------------------
            // Full Name
            // -----------------------------
            fullName = profile
                ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || fullName
                : (user.name || fullName);

        } else if (!supabaseClient) {
            // FIX: warn instead of throwing a ReferenceError
            console.warn(
                "Supabase is not configured yet. " +
                "Set SUPABASE_URL / SUPABASE_ANON_KEY in dashboard.js " +
                "to load employee details from the database."
            );
        }

        // -----------------------------
        // Update Header UI
        // -----------------------------
        document.getElementById("topUserName").textContent = fullName;
        document.getElementById("topUserRole").textContent = designationName;
        document.getElementById("topAvatar").textContent = getInitials(fullName);

    } catch (err) {

        console.error("Dashboard Error:", err);

        // FIX: show the real reason to make future debugging easier
        alert("Unable to load employee details: " + (err?.message || err));

    }
}

// =======================================
// Helper - Generate Avatar Initials
// FIX: handles double spaces / extra whitespace safely
// =======================================

function getInitials(name) {

    if (!name) return "HR";

    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}

// =======================================
// Placeholder Functions
// (Future Components)
// =======================================

function loadGreeting() {
    // Step 3
}

function loadProfileCard() {
    // Step 4
}

function loadAttendance() {
    // Step 5
}

function loadStats() {
    // Step 6
}

function loadAnnouncements() {
    // Step 8
}

// =======================================
// Logout (Future Sidebar Button)
// =======================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", () => {

        localStorage.removeItem("loggedInUser");

        window.location.href = "index.html";

    });

}
