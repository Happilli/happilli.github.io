async function updateWPM() {

    const res = await fetch("https://api.monkeytype.com/users/safalski/profile");
    const data = await res.json();
    const wpm = data.data.personalBests.time["60"].find(
      test => test.language === "english").wpm;
      document.getElementById("wpm").textContent  = wpm.toFixed(1);
  }

updateWPM();
