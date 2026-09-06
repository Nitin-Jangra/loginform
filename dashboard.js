// Dashboard JavaScript

document.addEventListener("DOMContentLoaded", () => {

    console.log("Dashboard Layout Loaded");

});

// ================================
// Dashboard - Step 2
// ================================

const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

if (!loggedInUser) {

    window.location.href = "index.html";

}

document.addEventListener("DOMContentLoaded", async () => {

    await loadHeader();

    lucide.createIcons();

});

// Load employee details

async function loadHeader(){

try{

// Users table

const { data:user, error:userError } = await supabaseClient
.from("users")
.select("*")
.eq("id",loggedInUser.id)
.single();

if(userError) throw userError;

// Employee profile

const { data:profile } = await supabaseClient
.from("employee_profiles")
.select("*")
.eq("user_id",user.id)
.maybeSingle();

// Designation

let roleName="Employee";

if(profile?.designation_id){

const { data } = await supabaseClient
.from("designations")
.select("name")
.eq("id",profile.designation_id)
.maybeSingle();

if(data){

roleName=data.name;

}

}

// Full Name

const fullName=
profile
?`${profile.first_name||""} ${profile.last_name||""}`.trim()
:user.name;

// Update Header

document.getElementById("topUserName").textContent=fullName;
document.getElementById("topUserRole").textContent=roleName;

// Avatar

document.getElementById("topAvatar").textContent=
getInitials(fullName);

}catch(err){

console.error(err);

alert("Unable to load employee details.");

}

}

// Initials

function getInitials(name){

return name
.split(" ")
.map(word=>word[0])
.join("")
.substring(0,2)
.toUpperCase();

}