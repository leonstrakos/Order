const target = new Date("August 1, 2026 00:00:00");

function updateCountdown() {

  const now = new Date();
  const diff = target - now;

  const days =
    Math.floor(diff / (1000 * 60 * 60 * 24));

  const hours =
    Math.floor(
      (diff % (1000 * 60 * 60 * 24))
      / (1000 * 60 * 60)
    );

  const minutes =
    Math.floor(
      (diff % (1000 * 60 * 60))
      / (1000 * 60)
    );

      const seconds =
    Math.floor(
      (diff % (1000 * 60 ))
      / (1000)
    );

  document.getElementById("countdown").innerHTML =
    `
    <span>${days} Days</span>
    <span>${hours} Hours</span>
    <span>${minutes} Minutes</span> </br>
    <span class="seconds">${seconds} </span>
    `;
}

updateCountdown();
setInterval(updateCountdown,1000);