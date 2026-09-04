const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

if (!loggedInUser) {
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {

    await loadDashboard();

    updateDate();

    lucide.createIcons();

});

// Load Dashboard

async function loadDashboard(){

try{

// Users table

const { data:user, error:userError } = await supabaseClient
.from("users")
.select("*")
.eq("id",loggedInUser.id)
.single();

if(userError) throw userError;

// Employee Profile

const { data:profile } = await supabaseClient
.from("employee_profiles")
.select("*")
.eq("user_id",user.id)
.maybeSingle();

// Department

let departmentName="Not Assigned";

if(user.department_id){

const { data } = await supabaseClient
.from("departments")
.select("name")
.eq("id",user.department_id)
.maybeSingle();

if(data) departmentName=data.name;

}

// Full Name

const fullName=profile
?`${profile.first_name||""} ${profile.last_name||""}`.trim()
:user.name;

// Greeting

document.getElementById("welcomeName").textContent=
`${getGreeting()}, ${fullName} 👋`;

// Header

document.getElementById("chipName").textContent=fullName;
document.getElementById("chipRole").textContent=
profile?.designation||"Employee";

// Hero

document.getElementById("summaryEmployeeId").textContent=
`Employee ID: ${user.employee_id}`;

// Profile Card

document.getElementById("profileName").textContent=fullName;
document.getElementById("profileDesignation").textContent=
profile?.designation||"Employee";
document.getElementById("profileDepartment").textContent=
departmentName;

document.getElementById("employeeIdText").textContent=
user.employee_id;

document.getElementById("emailText").textContent=
user.email;

document.getElementById("phoneText").textContent=
profile?.phone||user.phone||"Not Added";

const location=[profile?.city,profile?.state,profile?.country]
.filter(Boolean)
.join(", ");

document.getElementById("locationText").textContent=
location||"Not Added";

// Cards

document.getElementById("departmentCard").textContent=
departmentName;

document.getElementById("designationCard").textContent=
profile?.designation||"Not Added";

document.getElementById("joiningCard").textContent=
profile?.joining_date||user.joining_date||"--";

// Avatar

const initials=getInitials(fullName);

document.getElementById("avatarInitials").textContent=initials;
document.getElementById("topAvatar").textContent=initials;

}catch(err){

console.error(err);

alert("Unable to load dashboard.");

}

}

// Date

function updateDate(){

const options={

weekday:"long",

day:"numeric",

month:"long",

year:"numeric"

};

document.getElementById("todayDate").textContent=
new Date().toLocaleDateString("en-IN",options);

}

function getGreeting(){

const hour=new Date().getHours();

if(hour<12) return"Good Morning";

if(hour<17) return"Good Afternoon";

return"Good Evening";

}

function getInitials(name){

return name
.split(" ")
.map(n=>n[0])
.join("")
.substring(0,2)
.toUpperCase();

}

// Logout

document.getElementById("logoutBtn").addEventListener("click",()=>{

localStorage.removeItem("loggedInUser");

window.location.href="index.html";

});

// View Profile (Future)

document.getElementById("viewProfileBtn").addEventListener("click",()=>{

alert("My Profile page will be added next.");

});

document.getElementById("heroProfileBtn").addEventListener("click",()=>{

alert("My Profile page will be added next.");

});
