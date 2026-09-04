const supabaseUrl = "https://qalpehjzykkpvkzzikwl.supabase.co";
const supabaseKey = "sb_publishable_mWRL6nZ6vt1a78yuCdcNKA_kqI-1s_C";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const user = JSON.parse(localStorage.getItem("loggedInUser"));

if (!user) {
    window.location.href = "index.html";
}

async function loadDepartments() {

    const { data } = await supabaseClient
        .from("departments")
        .select("*");

    const select = document.getElementById("department");

    data.forEach(dep => {

        select.innerHTML +=
            `<option value="${dep.id}">${dep.name}</option>`;

    });

}

loadDepartments();

document
.getElementById("profileForm")
.addEventListener("submit", async function(e){

e.preventDefault();

const { error } = await supabaseClient
.from("employee_profiles")
.insert([{

user_id:user.id,

first_name:firstName.value,

last_name:lastName.value,

phone:phone.value,

department_id:department.value,

designation:designation.value,

dob:dob.value,

gender:gender.value,

address:address.value,

emergency_contact_name:emergencyName.value,

emergency_contact_phone:emergencyPhone.value

}]);

if(error){

alert(error.message);

return;

}

window.location.href="dashboard.html";

});
