const header = document.getElementById("header");

window.addEventListener("scroll", () => {

if(window.scrollY > 50){
header.classList.add("scrolled");
}else{
header.classList.remove("scrolled");
}

});




async function loadUser() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();

    const userLink = document.getElementById("loginBtn");

    if (!userLink) return;

    if (data.loggedIn) {
      userLink.textContent = data.chosen_name;
      userLink.href = "/members";
    } else {
      userLink.textContent = "Login";
      userLink.href = "/login";
    }

  } catch (err) {
    console.error("User fetch error:", err);
  }
}

loadUser();






    document.getElementById("enter").addEventListener("click", () => {
  document.body.classList.add("fade-out");

  setTimeout(() => {
    window.location.href = "/home";
  }, 400);
});

document.querySelector(".content").scrollIntoView({
behavior:"smooth"
});



if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      console.log("Service worker registered");
    } catch (err) {
      console.error("Service worker registration failed:", err);
    }
  });
}


