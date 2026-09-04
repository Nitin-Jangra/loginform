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

// =========================
// Load Departments
// =========================

async function loadDepartments() {

    const select = document.getElementById("department");

    const { data, error } = await supabaseClient
        .from("departments")
        .select("id,name")
        .order("name");

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    data.forEach(dep => {

        const option = document.createElement("option");

        option.value = dep.id;

        option.textContent = dep.name;

        select.appendChild(option);

    });

}

// =========================
// Load Managers
// =========================

async function loadManagers() {

    const select = document.getElementById("manager");

    const { data, error } = await supabaseClient
        .from("users")
        .select("id,name")
        .order("name");

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(manager => {

        if (manager.id === user.id) return;

        const option = document.createElement("option");

        option.value = manager.id;

        option.textContent = manager.name;

        select.appendChild(option);

    });

}

// Load page data

document.addEventListener("DOMContentLoaded", async () => {

    document.getElementById("joiningDate").value =
        new Date().toISOString().split("T")[0];

    await loadDepartments();

    await loadManagers();

});

// =========================
// Save Profile
// =========================

document
.getElementById("profileForm")
.addEventListener("submit", async function(e){

e.preventDefault();

const profileData={

user_id:user.id,

first_name:document.getElementById("firstName").value.trim(),

last_name:document.getElementById("lastName").value.trim(),

phone:document.getElementById("phone").value.trim(),

department_id:Number(document.getElementById("department").value)||null,

designation:document.getElementById("designation").value.trim(),

manager_id:Number(document.getElementById("manager").value)||null,

joining_date:document.getElementById("joiningDate").value||null,

dob:document.getElementById("dob").value||null,

gender:document.getElementById("gender").value||null,

blood_group:document.getElementById("bloodGroup").value||null,

address:document.getElementById("address").value.trim(),

city:document.getElementById("city").value.trim(),

state:document.getElementById("state").value.trim(),

country:document.getElementById("country").value.trim(),

pincode:document.getElementById("pincode").value.trim(),

emergency_contact_name:document.getElementById("emergencyName").value.trim(),

emergency_contact_phone:document.getElementById("emergencyPhone").value.trim()

};

// Update users table

const { error:userError }=await supabaseClient
.from("users")
.update({

phone:profileData.phone,

department_id:profileData.department_id,

manager_id:profileData.manager_id,

joining_date:profileData.joining_date

})
.eq("id",user.id);

if(userError){

alert(userError.message);

return;

}

// Insert employee profile

const { error:profileError }=await supabaseClient
.from("employee_profiles")
.insert([profileData]);

if(profileError){

alert(profileError.message);

return;

}

window.location.href="dashboard.html";

});
