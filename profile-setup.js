const supabaseUrl = "https://qalpehjzykkpvkzzikwl.supabase.co";
const supabaseKey = "sb_publishable_mWRL6nZ6vt1a78yuCdcNKA_kqI-1s_C";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

// =========================================
// Get Logged-in User
// =========================================

const user = JSON.parse(localStorage.getItem("loggedInUser"));

if (!user) {
    window.location.href = "index.html";
}

// =========================================
// Load Departments
// =========================================

async function loadDepartments() {
    const departmentSelect = document.getElementById("department");

    try {
        const { data, error } = await supabaseClient
            .from("departments")
            .select("id, name")
            .order("name", { ascending: true });

        if (error) {
            console.error("Department Load Error:", error);
            alert("Unable to load departments.");
            return;
        }

        // Reset dropdown
        departmentSelect.innerHTML =
            '<option value="">Select Department</option>';

        data.forEach((department) => {
            const option = document.createElement("option");
            option.value = department.id;
            option.textContent = department.name;
            departmentSelect.appendChild(option);
        });

    } catch (err) {
        console.error(err);
        alert("Something went wrong while loading departments.");
    }
}

// Load departments after page is ready
document.addEventListener("DOMContentLoaded", loadDepartments);

// =========================================
// Save Employee Profile
// =========================================

document
    .getElementById("profileForm")
    .addEventListener("submit", async function (e) {

        e.preventDefault();

        const profileData = {
            user_id: user.id,
            first_name: document.getElementById("firstName").value.trim(),
            last_name: document.getElementById("lastName").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            department_id: Number(document.getElementById("department").value) || null,
            designation: document.getElementById("designation").value.trim(),
            dob: document.getElementById("dob").value || null,
            gender: document.getElementById("gender").value || null,
            address: document.getElementById("address").value.trim(),
            emergency_contact_name: document.getElementById("emergencyName").value.trim(),
            emergency_contact_phone: document.getElementById("emergencyPhone").value.trim()
        };

        const { error } = await supabaseClient
            .from("employee_profiles")
            .insert([profileData]);

        if (error) {
            console.error("Profile Save Error:", error);
            alert(error.message);
            return;
        }

        // Profile completed successfully
        window.location.href = "dashboard.html";
    });