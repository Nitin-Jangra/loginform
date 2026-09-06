// =======================================
// HRMS Dashboard - Step 1 + Step 2
// Layout + Header (Supabase Connected)
// =======================================

// Get logged-in user
const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

// Redirect if user is not logged in
if (!loggedInUser) {
    window.location.href = "index.html";
}

// Page Load
document.addEventListener("DOMContentLoaded", async () => {
    await loadHeader();

    // Initialize Lucide Icons
    lucide.createIcons();
});

// =======================================
// Load Header Data
// =======================================

async function loadHeader() {
    try {

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
        let designationName = "Employee";

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
        const fullName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
            : user.name;

        // -----------------------------
        // Update Header UI
        // -----------------------------
        document.getElementById("topUserName").textContent = fullName;
        document.getElementById("topUserRole").textContent = designationName;
        document.getElementById("topAvatar").textContent = getInitials(fullName);

    } catch (err) {

        console.error("Dashboard Error:", err);

        alert("Unable to load employee details.");

    }
}

// =======================================
// Helper - Generate Avatar Initials
// =======================================

function getInitials(name) {

    if (!name) return "HR";

    return name
        .split(" ")
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