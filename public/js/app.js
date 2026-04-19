const header = document.getElementById("header");

window.addEventListener("scroll", () => {
  if (!header) return;

  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
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
      userLink.href = "/archive";
    } else {
      userLink.textContent = "Login";
      userLink.href = "/login";
    }
  } catch (err) {
    console.error("User fetch error:", err);
  }
}

loadUser();



const enterBtn = document.getElementById("enter");
if (enterBtn) {
  enterBtn.addEventListener("click", () => {
    document.body.classList.add("fade-out");

    setTimeout(() => {
      window.location.href = "/home";
    }, 400);
  });
}

const content = document.querySelector(".content");
if (content) {
  content.scrollIntoView({
    behavior: "smooth"
  });
}

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

// Block right click
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

// Block drag on images
document.addEventListener("dragstart", function (e) {
  if (e.target.tagName === "IMG") {
    e.preventDefault();
  }
});

// Block double click
document.addEventListener("dblclick", function (e) {
  e.preventDefault();
});

// Block some keyboard shortcuts
document.addEventListener("keydown", function (e) {
  const blocked =
    e.key === "F12" ||
    (e.ctrlKey && ["u", "s", "p", "c"].includes(e.key.toLowerCase())) ||
    (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()));

  if (blocked) {
    e.preventDefault();
  }
});

// Mobile long-press rough deterrent
document.addEventListener("touchstart", function (e) {
  if (e.target.tagName === "IMG") {
    e.target.style.webkitTouchCallout = "none";
    e.target.style.userSelect = "none";
  }
}, { passive: true });