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

    // -----------------------------
    // Holidays + Announcements (Step 7)
    // Company-wide data, independent of the user row -
    // they keep working even if profile queries fail
    // -----------------------------
    loadHolidays();
    loadAnnouncements();
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

        // -----------------------------
        // Attendance Card (Step 5)
        // -----------------------------
        loadAttendance();

        // -----------------------------
        // Statistics Cards (Step 6)
        // -----------------------------
        loadStats();

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
// Attendance Card (Step 5)
// =======================================

// FIX: toISOString() uses UTC - in IST a check-in between
// 00:00 and 05:30 would be saved under the PREVIOUS day.
// This helper builds the date string in local time instead.
function getTodayDate() {

    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

}

async function loadAttendance() {

    // Guard: never run before dashboardData exists
    if (!dashboardData) return;

    // Show today's date regardless of DB availability
    document.getElementById("attendanceDate").textContent =
        new Date().toLocaleDateString("en-IN", {

            weekday: "long",

            day: "numeric",

            month: "long",

            year: "numeric"

        });

    // Graceful no-DB mode: just show "Absent"
    if (!supabaseClient) {
        updateAttendanceUI(null);
        return;
    }

    const today = getTodayDate();

    const { data, error } = await supabaseClient
        .from("attendance")
        .select("*")
        .eq("user_id", dashboardData.user.id)
        .eq("attendance_date", today)
        .maybeSingle();

    if (error) {
        console.error("Attendance load error:", error);
    }

    updateAttendanceUI(data);

}

async function checkIn() {

    if (!dashboardData) return;

    if (!supabaseClient) {
        alert("Supabase is not configured yet.");
        return;
    }

    const today = getTodayDate();

    const now = new Date().toISOString();

    const { error } = await supabaseClient
        .from("attendance")
        .insert([{

            user_id: dashboardData.user.id,

            attendance_date: today,

            check_in: now,

            status: "Present"

        }]);

    if (error) {

        console.error("Check-in error:", error);

        alert(error.message);

        return;

    }

    loadAttendance();

}

async function checkOut() {

    if (!dashboardData) return;

    if (!supabaseClient) {
        alert("Supabase is not configured yet.");
        return;
    }

    const today = getTodayDate();

    const now = new Date();

    const { data } = await supabaseClient
        .from("attendance")
        .select("*")
        .eq("user_id", dashboardData.user.id)
        .eq("attendance_date", today)
        .maybeSingle();

    if (!data) {

        alert("Please check in first.");

        return;

    }

    // FIX: prevent overwriting an existing check-out
    if (data.check_out) {

        alert("You have already checked out today.");

        return;

    }

    const minutes = Math.floor(
        (now - new Date(data.check_in)) / 60000
    );

    const { error } = await supabaseClient
        .from("attendance")
        .update({

            check_out: now.toISOString(),

            working_minutes: minutes

        })
        .eq("id", data.id);

    if (error) {

        console.error("Check-out error:", error);

        alert(error.message);

        return;

    }

    loadAttendance();

}

function updateAttendanceUI(data) {

    const status = document.getElementById("attendanceStatus");

    if (!data) {

        status.textContent = "Absent";

        status.classList.remove("present");

        document.getElementById("checkInTime").textContent = "--:--";

        document.getElementById("checkOutTime").textContent = "--:--";

        document.getElementById("workingHours").textContent = "0h 0m";

        document.getElementById("breakTime").textContent = "0m";

        return;

    }

    status.textContent = data.status;

    // FIX: green badge only when not absent
    // (previously always turned green regardless of status)
    status.classList.toggle("present", data.status !== "Absent");

    document.getElementById("checkInTime").textContent =
        formatTime(data.check_in);

    document.getElementById("checkOutTime").textContent =
        data.check_out
            ? formatTime(data.check_out)
            : "--:--";

    // FIX: if checked in but not yet out, show live working
    // hours instead of a misleading "0h 0m"
    let workingMinutes = data.working_minutes;

    if (data.check_in && !data.check_out) {
        workingMinutes = Math.floor(
            (Date.now() - new Date(data.check_in)) / 60000
        );
    }

    document.getElementById("workingHours").textContent =
        minutesToHours(workingMinutes);

    // FIX: null break_minutes printed "nullm" before
    document.getElementById("breakTime").textContent =
        `${data.break_minutes ?? 0}m`;

}

function formatTime(time) {

    return new Date(time).toLocaleTimeString("en-IN", {

        hour: "2-digit",

        minute: "2-digit"

    });

}

function minutesToHours(minutes) {

    const m = Number(minutes) || 0;

    const h = Math.floor(m / 60);

    return `${h}h ${m % 60}m`;

}

// ---------------------------------------
// Attendance button wiring
// (elements exist - script runs at end of body)
// ---------------------------------------

const checkInBtn = document.getElementById("checkInBtn");

if (checkInBtn) {
    checkInBtn.addEventListener("click", checkIn);
}

const checkOutBtn = document.getElementById("checkOutBtn");

if (checkOutBtn) {
    checkOutBtn.addEventListener("click", checkOut);
}

// =======================================
// Statistics Cards (Step 6)
// =======================================

// FIX: same UTC trap as getTodayDate - new Date(y, m, 1) is
// local midnight, which is the LAST day of the previous month
// in UTC (e.g. Sep 1, 00:00 IST = Aug 31 UTC). Building the
// string in local time keeps the monthly range correct.
function getFirstDayOfMonth() {

    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

}

async function loadStats() {

    // Guard: never run before dashboardData exists
    if (!dashboardData) return;

    const user = dashboardData.user;

    // Graceful no-DB mode: neutral card values
    if (!supabaseClient) {
        updateStatsUI(0, "12", "0h 0m", user.last_login);
        return;
    }

    try {

        const firstDay = getFirstDayOfMonth();

        const today = getTodayDate();

        // Monthly attendance

        const { data: attendance, error } = await supabaseClient
            .from("attendance")
            .select("*")
            .eq("user_id", user.id)
            .gte("attendance_date", firstDay)
            .lte("attendance_date", today);

        if (error) throw error;

        const presentDays = attendance
            ? attendance.filter(a => a.status === "Present").length
            : 0;

        const overtimeMinutes = attendance
            ? attendance.reduce(
                (sum, a) => sum + (a.overtime_minutes || 0),
                0
            )
            : 0;

        updateStatsUI(
            presentDays,
            "12", // TODO: replace with real leave balance when the leave module exists
            minutesToHours(overtimeMinutes),
            user.last_login
        );

    } catch (err) {

        console.error("Stats load error:", err);

        // Neutral values instead of an unhandled rejection
        updateStatsUI(0, "12", "0h 0m", user.last_login);

    }

}

function updateStatsUI(presentDays, leaveBalance, overtimeText, lastLogin) {

    // Update Cards

    document.getElementById("presentDays").textContent =
        presentDays;

    document.getElementById("leaveBalance").textContent =
        leaveBalance;

    document.getElementById("overtimeHours").textContent =
        overtimeText;

    document.getElementById("lastLogin").textContent =
        lastLogin
            ? formatTime(lastLogin)
            : "Today";

}

// =======================================
// Placeholder Functions
// (Future Components)
// =======================================

// =======================================
// Quick Actions + Holidays + Announcements (Step 7)
// =======================================

// Quick Action navigation.
// "profile" opens the profile page; the other modules show
// a placeholder alert until their pages are built.

function bindQuickActions() {

    document.querySelectorAll(".quick-card").forEach(card => {

        card.addEventListener("click", () => {

            const page = card.dataset.page;

            switch (page) {

                case "profile":
                    window.location.href = "profile.html";
                    break;

                default:
                    alert(`${page} module will be built next.`);

            }

        });

    });

}

// Elements exist - script runs at end of body
bindQuickActions();

async function loadHolidays() {

    const container = document.getElementById("holidayList");

    // Guard: section missing from the page
    if (!container) return;

    // Graceful no-DB mode
    if (!supabaseClient) {
        container.innerHTML =
            "<p>Holidays will appear here once Supabase is connected.</p>";
        return;
    }

    try {

        // FIX: toISOString() is UTC - in IST, UTC "today" is still
        // yesterday between 00:00 and 05:30, which would wrongly
        // include yesterday's holidays. Reuse the local-date helper.
        const today = getTodayDate();

        const { data, error } = await supabaseClient
            .from("holidays")
            .select("*")
            .gte("holiday_date", today)
            .order("holiday_date")
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = "<p>No upcoming holidays.</p>";
            return;
        }

        container.innerHTML = "";

        const now = new Date();

        const todayMidnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        data.forEach(holiday => {

            // FIX: new Date("YYYY-MM-DD") is parsed as UTC midnight,
            // which shifts the day-countdown by hours. Parse the
            // parts and build a local date instead.
            const parts = String(holiday.holiday_date)
                .split("T")[0]
                .split("-")
                .map(Number);

            const holidayDate = new Date(
                parts[0],
                parts[1] - 1,
                parts[2]
            );

            const days = Math.round(
                (holidayDate - todayMidnight) / 86400000
            );

            // Friendlier labels instead of "0 days" / "1 days"
            let daysLabel = `${days} days`;

            if (days <= 0) daysLabel = "Today";
            else if (days === 1) daysLabel = "Tomorrow";

            container.innerHTML += `
                <div class="list-item">
                    <div>
                        <h4>${holiday.title}</h4>
                        <p>${holidayDate.toLocaleDateString("en-IN")}</p>
                    </div>
                    <strong>${daysLabel}</strong>
                </div>
            `;

        });

    } catch (err) {

        console.error("Holidays load error:", err);

        container.innerHTML = "<p>Could not load holidays.</p>";

    }

}

async function loadAnnouncements() {

    const container = document.getElementById("announcementList");

    // Guard: section missing from the page
    if (!container) return;

    // Graceful no-DB mode
    if (!supabaseClient) {
        container.innerHTML =
            "<p>Announcements will appear here once Supabase is connected.</p>";
        return;
    }

    try {

        const { data, error } = await supabaseClient
            .from("announcements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = "<p>No announcements.</p>";
            return;
        }

        container.innerHTML = "";

        data.forEach(item => {

            container.innerHTML += `
                <div class="list-item">
                    <div>
                        <h4>${item.title}</h4>
                        <p>${item.description || ""}</p>
                    </div>
                    <small>${new Date(item.created_at).toLocaleDateString("en-IN")}</small>
                </div>
            `;

        });

    } catch (err) {

        console.error("Announcements load error:", err);

        container.innerHTML = "<p>Could not load announcements.</p>";

    }

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
