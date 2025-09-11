const clickArea = document.querySelector(".click-area");
const displayText = document.querySelector(".display-text");
const onlineScoreElement = document.querySelectorAll("#onlineScores .score");
const localScoreElement = document.querySelectorAll("#localScores .score");
const lastLocalScoreElement = document.querySelectorAll("#lastLocalScores .score");
const failSfx = document.getElementById("failSfx");
const lastLocalScore = [];
const onlineScore = [];
const localScore = [];
const MINIMUM_MS_TILL_CHANGE = 3000;
const MAXIMUM_MS_TILL_CHANGE = 10000;
const shareScoreBtn = document.getElementById("shareScoreBtn");
const gamePassedFirstInit = "clickSiege:firstInit";
const usernameKey = "clickSiege:username";
const GDRIVE_API_URL = "https://script.google.com/macros/s/AKfycbzPiiztC8xKS3PujBJty_M-vhJIhB9h8jneZCGFRSheVHYnPyH1m3-y7LyJ42hDKnji9g/exec"

let lastScore = null;

// add localStorage for now only on last local scores, maybe see for FireBase for next steps, not sure...
const LastLocalScoresKey = "clickSiege:lastLocalScores";
const BestLocalScoresKey = "clickSiege:bestLocalScores";

function renderLastLocalScores() {
    for (let i = 0; i < 5; i++) {
        if (lastLocalScore[i] !== undefined) {
            lastLocalScoreElement[i].textContent = `${lastLocalScore[i]}ms`;
        } else {
            lastLocalScoreElement[i].textContent = "N/A";
        }
    }
}

function saveLastLocalScoresToStorage() {
    try {
        const scoresToSave = lastLocalScore.slice(0, 5);
        localStorage.setItem(LastLocalScoresKey, JSON.stringify(scoresToSave));
    } catch (e) {
        console.error("error catching your last local scores save data... if you attempted save editing, you did it wrong. try again :)");
    }
}

function loadLastLocalScoresFromStorage() {
    try {
        const raw = localStorage.getItem(LastLocalScoresKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const normalized = parsed.map(Number).filter((n) => Number.isFinite(n));
                lastLocalScore.length = 0;
                lastLocalScore.push(...normalized.slice(0, 5));
            }
        }
    } catch (e) {
        console.error("error loading your localscores into game engine. i don't know at this point. this can eventually happen if you tried local save editing, and you messed up a comma or something");
    }
    renderLastLocalScores();
}

function renderBestLocalScores() {
    const bestFive = localScore.slice().sort((a, b) => a - b).slice(0, 5);
    for (let i = 0; i < 5; i++) {
        if (bestFive[i] !== undefined) {
            localScoreElement[i].textContent = `${bestFive[i]}ms`;
        } else {
            localScoreElement[i].textContent = "N/A";
        }
    }
}

function saveBestLocalScoresToStorage() {
    try {
        const bestFive = localScore.slice().sort((a, b) => a - b).slice(0, 5);
        localStorage.setItem(BestLocalScoresKey, JSON.stringify(bestFive));
    } catch (e) {
        console.error("couldn't save your best local scores. maybe you broke our scale? :c");
    }
}

function loadBestLocalScoresFromStorage() {
    try {
        const raw = localStorage.getItem(BestLocalScoresKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const normalized = parsed.map(Number).filter((n) => Number.isFinite(n));
                localScore.length = 0;
                localScore.push(...normalized.slice(0, 5));
            }
        }
    } catch (e) {
        console.error("error loading your best local scores. maybe you tried save editing again?");
    }
    renderBestLocalScores();
}

function initGamePrompt() {
    const firstInit = localStorage.getItem(gamePassedFirstInit);

    if (!firstInit) {
        const wantsLeaderboard = confirm(
            "hi! while this is a simple game to test your reaction time, \n" + "it also includes an online leaderboard of the top 5 best scores!\n" + "since this feature is opt-in, click OK if you wish to participate, or cancel if you wish otherwise!!\n\n" + "(to check the privacy policy, click the dedicated button for it on the bottom right!!!)\n"
        );

        if (wantsLeaderboard) {
            let username = prompt("please enter a acceptable username for leaderboard:");
            if (username && username.trim() !== "") {
                username = username.trim();
                localStorage.setItem(usernameKey, username);
                alert(`thanks!! your best scores will now be submitted! if you have any regards, DM me on slack!!`);
            } else {
                alert(`as you entered no username, you won't be on the leaderboard`);
            }
        } else {
            alert(`the leaderboard will be disabled! if you wish to change your mind, please reset the "firstInit" key from your devtools!`)
        }

        localStorage.setItem(gamePassedFirstInit, "pass");
    }
}

initGamePrompt();
fetchOnlineScores();

let msSinceEpochOnTimeout = 0;
let waitingForClick = false;
let isWaitingGreen = false;
let timeoutId = null;

function play() {
    const msTillChange =
        Math.floor(
            Math.random() * (MAXIMUM_MS_TILL_CHANGE - MINIMUM_MS_TILL_CHANGE)
        ) + MINIMUM_MS_TILL_CHANGE;

    clickArea.style.backgroundColor = null;
    displayText.textContent = "";
    shareScoreBtn.style.display = "none";
    lastScore = null;
    isWaitingGreen = true;
    waitingForClick = false;

    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    // add timeout otherwise ppl can spam the red box n fuck it up

    timeoutId = setTimeout(() => {
        msSinceEpochOnTimeout = Date.now();
        clickArea.style.backgroundColor = "#009578";
        waitingForClick = true;
        isWaitingGreen = true;
        timeoutId = null;
    }, msTillChange);
}

function addScore(score) {
    onlineScore.unshift(score);
    localScore.unshift(score);
    lastLocalScore.unshift(score);

    if(lastLocalScore.length > 5) {
        lastLocalScore.length = 5;
    }

    for (let i = 0; i < Math.min(onlineScore.length, 5); i++) {
        onlineScoreElement[i].textContent = `${onlineScore[i]}ms`;
    }

    renderBestLocalScores();
    renderLastLocalScores();
    saveBestLocalScoresToStorage();
    saveLastLocalScoresToStorage();
}

clickArea.addEventListener("click", () => {
    if (waitingForClick) {
        const score = Date.now() - msSinceEpochOnTimeout;
        const username = localStorage.getItem("clickSiege:username");
        if (username) {
            submitOnlineScore(username, score).then(() => {
                fetchOnlineScores();
            });
        }
        waitingForClick = false;
        isWaitingGreen = false;
        msSinceEpochOnTimeout = 0;
        // forgot to clear it so it would just go over and over again
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        failSfx.pause();
        failSfx.currentTime = 0;
        displayText.textContent = `You did ${score} milliseconds.\nTap or click to try again!`;
        addScore(score);
        lastScore = score;
        shareScoreBtn.style.display = "inline-block";
    } else if (isWaitingGreen) {
        displayText.textContent = `You're faster than light!\nNo seriously, you hit too soon. Make sure to wait the green! Tap or click to retry :D`;

        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        failSfx.currentTime = 0;
        failSfx.play();
        isWaitingGreen = false;
        msSinceEpochOnTimeout = 0;
    } else {
        failSfx.pause();
        failSfx.currentTime = 0;
        play();
    }
});

const palette = document.getElementById("switchColorProfile");

if (localStorage.getItem("colorMode") === "light") {
    document.body.classList.add("light")
}

palette.addEventListener("click", (e) => {
    e.preventDefault();
    document.body.classList.toggle("light");
    if (document.body.classList.contains("light")) {
        localStorage.setItem("colorMode", "light");
    } else {
        localStorage.setItem("colorMode", "dark");
    }
});

shareScoreBtn.addEventListener("click", () => {
    event.stopPropagation();
    if (lastScore !== null) {
        const text = `i have a reaction time of ${lastScore} milliseconds! what about you? try yours at https://click.lolodotzip.tech !!!`;
        navigator.clipboard.writeText(text).then(() => {
            shareScoreBtn.textContent = "copied to clipboard!!!";
            setTimeout(() => {
                shareScoreBtn.innerHTML = "share your results!!!<br>(promote on hackclub plz)";
            }, 2000);
        });
    }
});

async function submitOnlineScore(username, score){
    try {
        await fetch(GDRIVE_API_URL, {
            method: "POST",
            body: JSON.stringify({username, score}),
        });
    } catch (err) {
        console.error("failed to submit your online score!", err);
    }
}

async function fetchOnlineScores() {
    try {
        const res = await fetch(GDRIVE_API_URL);
        const scores = await res.json();
        scores.sort((a, b) => a.score - b.score);
        for (let i = 0; i < Math.min(scores.length, 5); i++) {
            onlineScoreElement[i].textContent = `${scores[i].username}: ${scores[i].score}ms`;
        }
    } catch (err) {
        console.error("failed to fetch online scores!", err);
        for (let i = 0; i < 5; i++) {
            onlineScoreElement[i].textContent = "odd thing, we couldn't load...";
        }
    }
}

loadBestLocalScoresFromStorage();
setInterval(fetchOnlineScores, 15000);
loadLastLocalScoresFromStorage();