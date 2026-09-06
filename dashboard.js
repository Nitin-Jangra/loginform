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
// Get logged-in user (safe JSON parse)
// ---------------------------------------
let loggedInUser = null;

try {
    loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
} catch (e) {
    console.warn("Corrupted 'loggedInUser' in localStorage:", e);
    loggedInUser = null;
}

// FIX: dashboardData is now properly declared
// (previously created as an implicit global, which breaks
// in strict mode / modules and is fragile in general)
let dashboardData = null;

// Redirect if user is not logged in
if (!loggedInUser) {
    window.location.replace("index.html");
}

// Page Load
document.addEventListener("DOMContentLoaded", async () => {

    // Stop here when redirecting (previously the code kept
    // running with a null user and crashed on loggedInUser.id)
    if (!loggedInUser) return;

    // Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    await loadHeader();
});

// =======================================
// Load Header Data (+ fills dashboardData)
// =======================================

async function loadHeader() {
    try {

        // -----------------------------
        // Fallback values (used when Supabase is not configured,
        // so the header + greeting still render instead of crashing)
        // -----------------------------
        let user = loggedInUser;
        let profile = null;
        let departmentName = "Not Assigned";
        let designationName = "Employee";
        let fullName = loggedInUser.name || loggedInUser.email || "User";

        // -----------------------------
        // Fetch from Supabase (only when the client exists)
        // -----------------------------
        if (supabaseClient && loggedInUser.id) {

            // -----------------------------
            // Fetch User
            // -----------------------------
            const { data: dbUser, error: userError } = await supabaseClient
                .from("users")
                .select("*")
                .eq("id", loggedInUser.id)
                .single();

            if (userError) throw userError;

            user = dbUser;

            // -----------------------------
            // Fetch Employee Profile
            // -----------------------------
            const { data: dbProfile, error: profileError } = await supabaseClient
                .from("employee_profiles")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            profile = dbProfile;

            // -----------------------------
            // Fetch Department
            // -----------------------------
            if (profile?.department_id) {

                const { data, error: deptError } = await supabaseClient
                    .from("departments")
                    .select("name")
                    .eq("id", profile.department_id)
                    .maybeSingle();

                if (deptError) throw deptError;

                if (data) {
                    departmentName = data.name;
                }

            }

            // -----------------------------
            // Fetch Designation
            // -----------------------------
            if (profile?.designation_id) {

                const { data, error: desigError } = await supabaseClient
                    .from("designations")
                    .select("name")
                    .eq("id", profile.designation_id)
                    .maybeSingle();

                if (desigError) throw desigError;

                if (data) {
                    designationName = data.name;
                }

            }

            // -----------------------------
            // Full Name
            // -----------------------------
            fullName = profile
                ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || fullName
                : (user.name || fullName);

        } else if (!supabaseClient) {
            // Warn instead of throwing a ReferenceError
            console.warn(
                "Supabase is not configured yet. " +
                "Set SUPABASE_URL / SUPABASE_ANON_KEY in dashboard.js " +
                "to load employee details from the database."
            );
        }

        // -----------------------------
        // Shared dashboard data
        // -----------------------------
        dashboardData = {
            user,
            profile,
            departmentName,
            designationName,
            fullName
        };

        // -----------------------------
        // Update Header UI
        // -----------------------------
        document.getElementById("topUserName").textContent = fullName;
        document.getElementById("topUserRole").textContent = designationName;
        document.getElementById("topAvatar").textContent = getInitials(fullName);

        // -----------------------------
        // Greeting Section
        // -----------------------------
        loadGreeting();

        // -----------------------------
        // Employee Profile Card (Step 4)
        // -----------------------------
        loadProfileCard();

    } catch (err) {

        console.error("Dashboard Error:", err);

        // Show the real reason to make future debugging easier
        alert("Unable to load employee details: " + (err?.message || err));

    }
}

// =======================================
// Greeting Section (Step 3)
// =======================================

function loadGreeting() {

    // Guard: never run before dashboardData exists
    if (!dashboardData) return;

    const hour = new Date().getHours();

    let greeting = "Good Evening";

    if (hour < 12) greeting = "Good Morning";
    else if (hour < 17) greeting = "Good Afternoon";

    document.getElementById("welcomeText").textContent =
        `${greeting}, ${dashboardData.fullName}! 👋`;

    document.getElementById("currentDate").textContent =
        new Date().toLocaleDateString("en-IN", {

            weekday: "long",

            day: "numeric",

            month: "long",

            year: "numeric"

        });

    // FIX: fallback shown instead of the literal text "undefined"
    // when the users row has no employee_id yet
    document.getElementById("greetingEmployeeId").textContent =
        dashboardData.user?.employee_id || "Not Set";

    document.getElementById("greetingDepartment").textContent =
        dashboardData.departmentName;

    document.getElementById("greetingDesignation").textContent =
        dashboardData.designationName;

}

// =======================================
// Helper - Generate Avatar Initials
// (handles double spaces / extra whitespace safely)
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
// Employee Profile Card (Step 4)
// =======================================

function loadProfileCard() {

    // Guard: never run before dashboardData exists
    if (!dashboardData) return;

    const profile = dashboardData.profile;
    const user = dashboardData.user;

    // Avatar

    document.getElementById("profileAvatar").textContent =
        getInitials(dashboardData.fullName);

    // Basic Info

    document.getElementById("profileName").textContent =
        dashboardData.fullName;

    document.getElementById("profileDesignation").textContent =
        dashboardData.designationName;

    document.getElementById("profileDepartment").textContent =
        dashboardData.departmentName;

    // Details

    // FIX: fallbacks instead of the literal text "undefined"
    // when employee_id / email are missing
    document.getElementById("profileEmployeeId").textContent =
        user?.employee_id || "Not Set";

    document.getElementById("profileEmail").textContent =
        user?.email || "Not Added";

    document.getElementById("profilePhone").textContent =
        profile?.phone || "Not Added";

    const location = [
        profile?.city,
        profile?.state,
        profile?.country
    ]
        .filter(Boolean)
        .join(", ");

    document.getElementById("profileLocation").textContent =
        location || "Not Added";

    document.getElementById("profileJoiningDate").textContent =
        formatJoiningDate(profile?.joining_date);

}

// FIX: the database stores dates like "2024-03-15" -
// format them nicely instead of showing the raw string.
// Falls back to the raw value if it cannot be parsed.
function formatJoiningDate(value) {

    if (!value) return "Not Available";

    const parsed = new Date(value);

    if (isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString("en-IN", {

        day: "numeric",

        month: "short",

        year: "numeric",

        timeZone: "UTC"

    });

}

// =======================================
// Placeholder Functions
// (Future Components)
// =======================================

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