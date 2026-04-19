async function loadUserLinks() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();

    const bellLink = document.getElementById("bellLink");
    const heraldsLink = document.getElementById("heraldsLink");

    if (!bellLink || !heraldsLink) return;

    if (data.loggedIn) {
      bellLink.href = "/archive";
      heraldsLink.href = "/heralds";
    } else {
      bellLink.href = "/login";
      heraldsLink.href = "/login";
    }

  } catch (err) {
    console.error("User fetch error:", err);
  }
}

loadUserLinks();
