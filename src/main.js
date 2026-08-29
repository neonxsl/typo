import { sipWords, harvest, TapeDeck, calculateTestXP, calculateLevel } from "./engine.js";
import { StageFramer } from "./typing-view.js";
import confetti from "https://esm.sh/canvas-confetti@1.9.4";
import { getCurrentUser, loginWithGithub, saveCustomUsername, logout, syncCloudData, saveCloudKey, submitToLeaderbaord, getLeaderboard, exchangeOAuthToken, getUserStats } from "./auth.js";

const timeModes = [
  { label: "15s", kind: "time", target: 15 },
  { label: "30s", kind: "time", target: 30 },
  { label: "60s", kind: "time", target: 60 }
];

const wordModes = [
  { label: "10w", kind: "words", target: 10 },
  { label: "25w", kind: "words", target: 25 },
  { label: "50w", kind: "words", target: 50 }
]

const languages = [
  { id: "english", label: "english" },
  { id: "code_javascript", label: "javascript" },
  { id: "code_python", label: "python" },
  { id: "code_go", label: "go" },
  { id: "tanglish", label: "tamil" },
  { id: "spanish", label: "spanish" },
  { id: "french", label: "french" },
  { id: "german", label: "german" },
  { id: "italian", label: "italian" },
]

const lbModalEl = document.getElementById("leaderboard-modal");
const lbListEl = document.getElementById("lb-list");
const lbTabs = document.querySelectorAll(".lb-tab");
const lbCategories = ["overall", "15s", "30s", "60s", "10w", "25w", "50w"];
let activeLbCat = "overall";

const renderLeaderboard = async (cat = activeLbCat) => {
  activeLbCat = cat;
  lbTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.cat === cat));
  lbListEl.innerHTML = `<div class="subtle">loading...</div>`;

  const rows = await getLeaderboard(cat);

  if (!rows.length) {
    lbListEl.innerHTML = `<div class="subtle">no entries yet. be the first!</div>`;
    return;
  }

  lbListEl.innerHTML = "";
  rows.forEach((row, i) => {
    const isMe = user && row.username === user.customUsername;
    const item = document.createElement("div");
    item.className = `lb-row ${isMe ? "active-user" : ""}`;

  const scoreDisplay = cat === "overall" 
  ? `<span class="subtle">lvl ${row.level || 1}</span> <span class="lb-stat">${(row.totalXP || 0).toLocaleString()} xp</span>` 
  : `<span class="lb-stat">${row[`wpm_${cat}`] || 0} wpm</span>`;

    item.innerHTML = `
    <span class="lb-rank">${i + 1}</span>
    <span class="lb-name">${row.username}</span>
    ${scoreDisplay}
    <span class="subtle"> 🔥 ${row.streak || 0}d</span>`;
    lbListEl.appendChild(item);
  });
}

const openLeaderboard = () => {
  menu = "leaderboard";
  lbModalEl.classList.remove("hide");
  renderLeaderboard("overall");
};

const closeLeaderboard = () => {
  menu = "idle";
  lbModalEl.classList.add("hide");
  renderFooter();
}

let hasPunctuation = localStorage.getItem("typo-punc") === "true";
let hasNumbers = localStorage.getItem("typo-num") === "true";

export const togglePunctuation = () => {
  hasPunctuation = !hasPunctuation;
  localStorage.setItem("typo-punc", hasPunctuation);
  if (user) saveCloudKey("typo-punc", hasPunctuation);
  const count = gear.kind === "words" ? gear.target : 60;
  tape = new TapeDeck(harvest(pool, count, { punctuation: hasPunctuation, numbers: hasNumbers }), gear);
  view.splatWords(tape.words);
  requestAnimationFrame(() => view.snapCaret(0, 0));
}

export const toggleNumbers = () => {
  hasNumbers = !hasNumbers;
  localStorage.setItem("typo-num", hasNumbers);
  if (user) saveCloudKey("typo-num", hasNumbers);
  const count = gear.kind === "words" ? gear.target : 60;
  tape = new TapeDeck(harvest(pool, count, { punctuation: hasPunctuation, numbers: hasNumbers }), gear);
  view.splatWords(tape.words);
  requestAnimationFrame(() => view.snapCaret(0, 0));

}

let currentLang = localStorage.getItem("typo-lang") || "english";


let langCursor = languages.findIndex((l) => l.id === currentLang);
if (langCursor === -1) langCursor = 0;

const modalEl = document.getElementById("lang-modal");
const listEl = document.getElementById("lang-list");


const renderLangList = () => {
  listEl.innerHTML = "";
  languages.forEach((lang, i) => {
    const item = document.createElement("div");
    item.className = `modal-item ${i === langCursor ? "active" : ""}`;
    item.textContent = lang.label;
    listEl.appendChild(item);
  });


const activeEl = listEl.children[langCursor];
if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
};


const getDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const getYesterdayStr = () => {
  const prev = new Date();
  prev.setDate(prev.getDate() - 1);
  return getDateStr(prev);
}

export const getStreakData = () => {
  const today = getDateStr();
  const yesterday = getYesterdayStr();

  let streak = Number(localStorage.getItem("typo-streak-count") || 0);
  const lastStreakDate = localStorage.getItem("typo-streak-last-date");

  if (lastStreakDate && lastStreakDate !== today && lastStreakDate !== yesterday) {
    streak = 0;
    localStorage.setItem("typo-streak-count", streak);
  }

  const savedDate = localStorage.getItem("typo-daily-date");
  const dailyTests = (savedDate === today) ? Number(localStorage.getItem("typo-daily-count") || 0) : 0;

  return { streak, dailyTests, isCompletedToday: lastStreakDate === today };
};

export const recordTestForStreak = () => {
  const today = getDateStr();
  const yesterday = getYesterdayStr();
  let {streak, dailyTests, isCompletedToday} = getStreakData();

  dailyTests++;
  localStorage.setItem("typo-daily-count", dailyTests);
  localStorage.setItem("typo-daily-date", today);
  if (user) {
    saveCloudKey("typo-daily-count", dailyTests);
    saveCloudKey("typo-daily-date", today);
  }

  let unlockedNewStreak = false;

  if (dailyTests >= 5 && !isCompletedToday) {
    
      const lastStreakDate = localStorage.getItem("typo-streak-last-date"); 
      streak = (lastStreakDate === yesterday) ? streak + 1 : 1;
      localStorage.setItem("typo-streak-count", streak);
      localStorage.setItem("typo-streak-last-date", today);
      isCompletedToday = true;
      unlockedNewStreak = true;

      if (user) {
        saveCloudKey("typo-streak-count", streak);
        saveCloudKey("typo-streak-last-date", today);
      }

      //spiderman movie is kinda mid ngl
    }

  return { streak, dailyTests, isCompletedToday, unlockedNewStreak };
}

const openLangModal = () => {
  menu = "language";
  renderLangList();
  modalEl.classList.remove("hide");
};

const closeLangModal = () => {
  menu = "idle";
  modalEl.classList.add("hide");
  renderFooter();
};


let user = null;
const userBadgeEl = document.getElementById("user-badge");
const usernameModalEl = document.getElementById("username-modal");
const usernameInputEl = document.getElementById("username-input");

const initAuth = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get("userId");
  const secret = urlParams.get("secret");

  if (userId && secret) {
    await exchangeOAuthToken(userId, secret);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  user = await getCurrentUser();
  console.log("Appwrite Auth Status:", user);

  let totalXP = Number(localStorage.getItem("typo-total-xp") || 0);

  if (user) {
    await syncCloudData();

    const cloudDoc = await getUserStats(user.$id);
    if (cloudDoc && cloudDoc.totalXP) {
      totalXP = cloudDoc.totalXP;
      localStorage.setItem("typo-total-xp", totalXP);
    }
    if (!user.customUsername) {
      openUsernameModal();
    } else {
      userBadgeEl.textContent = user.customUsername;
    }
  } else {
    userBadgeEl.textContent = "login";
  }
  totalXP = Number(localStorage.getItem("typo-total-xp") || 0);
  view.renderUserLevel(calculateLevel(totalXP), totalXP);
  view.renderStreak(getStreakData());
  renderFooter();
}

const openUsernameModal = () => {
  menu = "username";
  usernameModalEl.classList.remove("hide");
  setTimeout(() => usernameInputEl.focus(), 50);
};

const submitUsername = async () => {
  const name = usernameInputEl.value.trim().toLowerCase();
  if (name.length < 2) return;
  const savedName = await saveCustomUsername(name);
  user.customUsername = savedName;
  userBadgeEl.textContent = savedName;

  usernameModalEl.classList.add("hide");
  usernameInputEl.blur();
  menu = "idle";
  renderFooter();
}

initAuth();

const allMods = [...timeModes, ...wordModes];

const savedModeLabel = localStorage.getItem("typo-mode") || "15s";
let gear = allMods.find(m => m.label === savedModeLabel) || timeModes[0];

let pool = [];
let tape = new TapeDeck([], gear), ticker = null;
let view = new StageFramer();

let timeline = [];
let lastRecordedErrors = 0;

const getSampleInterval = () => {
  if (gear.target <= 15) return 500;
  return 1000;
};

const recordSnapshot = () => {
  if (!tape.beganAt || tape.sealed) return;
  const elapsed = (performance.now() - tape.beganAt) / 1000;
  if (elapsed <0.2) return;

  const stats = tape.spill();
  const newErrors = tape.slips - lastRecordedErrors;
  lastRecordedErrors = tape.slips;

  timeline.push({
    second: Math.round(elapsed*10)/10,
    wpm: stats.wpm,
    raw: stats.raw,
    errors: newErrors > 0 ? newErrors : 0
  });
}

const reboot = async (selectedGear = gear, changeLang = false) => {
  timeline = [];
  lastRecordedErrors = 0;
  gear = selectedGear;
  localStorage.setItem("typo-mode", gear.label);
  if (user) saveCloudKey("typo-mode", gear.label);

  const count = gear.kind === "words" ? gear.target : 60;

  const isCode = currentLang.startsWith("code");
  document.body.classList.toggle("code-mode", isCode);

  menu = "idle";
  renderFooter();

  if (ticker) clearInterval(ticker);
  ticker = null;

  if (!pool.length || changeLang) {
    pool = await sipWords(currentLang);
  }

  tape = new TapeDeck(harvest(pool, count, { punctuation: hasPunctuation, numbers: hasNumbers }), gear);
  view.scrubStage();
  view.setModeTag(gear.label);
  view.tickClock(gear.kind === "time" ? gear.target : `${tape.words.length}w`);
  view.splatWords(tape.words);

  requestAnimationFrame(() => view.snapCaret(0, 0));
  view.renderStreak(getStreakData());
};

const halt = () => {


  tape.nuke();
  if (ticker) clearInterval(ticker);
  ticker = null;

  recordSnapshot();

  const stats = tape.spill();
  const pbinfo = updatePB(gear.label, stats.wpm, currentLang);

  let unlockedStreak = false;
  let isLevelUp = false;
  let earnedXP = 0;

  if (stats.wpm > 0) {
    const streakInfo = recordTestForStreak();
    view.renderStreak(streakInfo);
    unlockedStreak = streakInfo.unlockedNewStreak;

    if (unlockedStreak) {
      view.flashStreakAlert(streakInfo.streak);
    }

    earnedXP = calculateTestXP(stats, gear, { punctuation: hasPunctuation, numbers: hasNumbers }, currentLang, streakInfo.streak);

    const oldTotalXP = Number(localStorage.getItem("typo-total-xp") || 0);
    const oldLevel = calculateLevel(oldTotalXP);

    let newTotalXP = oldTotalXP + earnedXP;
    let newLevel = calculateLevel(newTotalXP);

    localStorage.setItem("typo-total-xp", newTotalXP);
    view.renderUserLevel(newLevel, newTotalXP);

    if (user && user.customUsername) {
      submitToLeaderbaord(user, stats, gear, earnedXP, currentLang, streakInfo.streak).then((updated) => {
        if (updated) {
          localStorage.setItem("typo-total-xp", updated.totalXP);
          view.renderUserLevel(calculateLevel(updated.totalXP), updated.totalXP);
        }
      });
    }

    if (newLevel > oldLevel) {
      isLevelUp = true;
      view.flashLevelUpAlert(newLevel);
    }
  }

  view.showTrophy(stats, pbinfo, timeline, earnedXP);

  if ((pbinfo.isNew || unlockedStreak || isLevelUp) && stats.wpm > 0) {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#fff", "#ccc", "#888", "#444"]
    });
  }
};

const pulse = () => {
  const sampleRate = getSampleInterval();


  ticker = setInterval(() => {
    if (!tape.beganAt || tape.sealed) return;
    const passed = Math.floor((performance.now() - tape.beganAt) / 1000);

    recordSnapshot();
  
    if (gear.kind === "time") {
      const rem = Math.max(0, gear.target - passed);
      view.tickClock(rem);
      if (rem <= 0) halt();
    } else {
      view.tickClock(`${Math.max(0, tape.words.length - tape.wi)}w`);
    }
  }, sampleRate);
};

const ingest = (key) => {
  tape.stamp();
  if (!ticker) pulse();
  const targetWord = tape.words[tape.wi] || "";
  tape.tap();
  if (tape.ci < targetWord.length) {
    const ok = key === targetWord[tape.ci];
    if (ok) tape.hit(); else tape.bork();
    view.paintChar(tape.wi, tape.ci, ok ? "correct" : "wrong");
  } else {
    tape.bork();
    view.paintChar(tape.wi, tape.ci, "extra", key);
  }
  tape.ci++;
  tape.history[tape.wi] = (tape.history[tape.wi] || "") + key;

  
  view.snapCaret(tape.wi, tape.ci);
  if (gear.kind === "words" && tape.wi === tape.words.length - 1 && tape.ci === targetWord.length) halt();


};

const bumpWord = () => {
  const typed = tape.history[tape.wi] || "";
  if (!typed.length && tape.ci === 0) return;
  tape.stamp();

  if (!ticker) pulse();

  tape.tap();

  const target = tape.words[tape.wi] || "";

  if (typed.length < target.length) {
    tape.slips += target.length - typed.length;
    for (let i = tape.ci; i < target.length; i++) {
      view.paintChar(tape.wi, i, "wrong");
    } 
    } else if (typed === target) {
      tape.hit();
  }

  tape.wi++;
  tape.ci = 0;

  if (gear.kind === "time" && tape.wi > tape.words.length - 20) {
    const fresh = harvest(pool, 25, { punctuation: hasPunctuation, numbers: hasNumbers });
    tape.words.push(...fresh);
    view.feedWords(fresh);
  }

  if (gear.kind === "words" && tape.wi >= tape.words.length) return halt();
  if (gear.kind === "words") view.tickClock(`${tape.words.length - tape.wi}w`);
  view.snapCaret(tape.wi, 0);
};

export const getPB = (modeLabel, lang = currentLang) => {
  return Number(localStorage.getItem(`typo-pb-${lang}-${modeLabel}`) || 0);

};

export const updatePB = (modeLabel, wpm, lang = currentLang) => {
  const currentPB = getPB(modeLabel, lang);
  const isNew = wpm > currentPB;
  if (isNew) {
    const key = `typo-pb-${lang}-${modeLabel}`;

    localStorage.setItem(`typo-pb-${lang}-${modeLabel}`, wpm);

    if (user) saveCloudKey(key,wpm);
  }
  return {pb: Math.max(currentPB, wpm), isNew};

}

const peel = () => {
  if (tape.ci === 0) {
    if (tape.wi > 0) {
      tape.wi--;
      const target = tape.words[tape.wi] || "";
      const typed = tape.history[tape.wi] || "";
      if (typed.length < target.length) {
        tape.slips -= target.length - typed.length; 
        for (let i = typed.length; i < target.length; i++) {
          view.paintChar(tape.wi, i, "");
        }
      }

      tape.ci = typed.length;
      view.snapCaret(tape.wi, tape.ci);
    }
    return;
  }
  const target = tape.words[tape.wi] || "";
  tape.ci--;

  tape.history[tape.wi] = (tape.history[tape.wi] || "").slice(0, -1);
  if (tape.ci >= target.length) view.popExtra(tape.wi);
  else view.paintChar(tape.wi, tape.ci, "");
  view.snapCaret(tape.wi, tape.ci);
};

window.addEventListener("keydown", async (e) => {

  if (e.key === "Tab") { e.preventDefault(); return; }

  if (menu === "leaderboard") {
    if (e.key === "Escape") { closeLeaderboard(); return; }

    if (e.key === "ArrowUp") { e.preventDefault(); lbListEl.scrollTop -= 50; return; }
    if (e.key === "ArrowDown") { e.preventDefault(); lbListEl.scrollTop += 50; return; }

    const catIndex = Number(e.key) - 1;
    if (catIndex >= 0 && catIndex < lbCategories.length) {
      renderLeaderboard(lbCategories[catIndex]);
      return;
    }
    return;
  }


  if (menu === "username") {
    usernameInputEl.focus();
    if (e.key === "Enter") {
      e.preventDefault();
      await submitUsername();
    }
    return;
  }

  if (menu === "language") {
    if (e.key === "Escape") {
       closeLangModal(); 
       return; 
      }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      langCursor = (langCursor - 1 + languages.length) % languages.length;
      renderLangList();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      langCursor = (langCursor + 1) % languages.length;
      renderLangList();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      currentLang = languages[langCursor].id;
      localStorage.setItem("typo-lang", currentLang);
      if (user) saveCloudKey("typo-lang", currentLang);
      closeLangModal();
      return reboot(gear, true);
    }
    return;
  }

  if (e.key === "Escape") {
    if (menu !== "idle") { menu = "idle"; renderFooter(); return; }
    return reboot();
  } 

  if (!tape.beganAt) {
    if (menu === "idle") {
      if (e.key === "1") { menu = "time"; renderFooter(); return; }
      if (e.key === "2") { menu = "words"; renderFooter(); return; }
      if (e.key === "3") { menu = "settings"; renderFooter(); return; }
      if (e.key === "4") { openLangModal(); return; }
      if (e.key === "5") { openLeaderboard(); return; }
    }
    else if (menu === "time") {
      if (["1", "2", "3"].includes(e.key)) {
        menu = "idle";
        renderFooter();
        return reboot(timeModes[Number(e.key) - 1]);
      }
    }
    else if (menu === "words") {
      if (["1", "2", "3"].includes(e.key)) {
        menu = "idle";
        renderFooter();
        return reboot(wordModes[Number(e.key) - 1]);
      }
    }
    else if (menu === "settings") {
      if (e.key === "1") {
        toggleTheme();
        renderFooter();
        return;
      }
      if (e.key === "2") {
        toggleHighlight();
        renderFooter();
        return;
      }
      if (e.key === "3") {
        togglePunctuation();
        renderFooter();
        return;
      }
      if (e.key === "4") {
        toggleNumbers();
        renderFooter();
        return;
      }
      if (e.key === "5") {
        if (user) {
          await logout();
          user = null;
          userBadgeEl.textContent = "login";
          renderFooter();
        } else {
          loginWithGithub();
        }
        return;
      }
    }

  }

  if (menu !== "idle") return;

  if (tape.sealed) return;
  if (e.key === "Backspace") return peel();
  if (e.key === " ") { e.preventDefault(); return bumpWord(); }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) ingest(e.key);

});

export const toggleTheme = () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("typo-theme", next);
  if (user) saveCloudKey("typo-theme", next);
  return next;
};

let highlightWord = localStorage.getItem("typo-highlight-word") === "true";
document.body.classList.toggle("highlight-active", highlightWord);

export const toggleHighlight = () => {
  highlightWord = !highlightWord;
  localStorage.setItem("typo-highlight-word", highlightWord);
  document.body.classList.toggle("highlight-active", highlightWord);
  if (user) saveCloudKey("typo-highlight-word", highlightWord);
  return highlightWord;
}


const savedTheme = localStorage.getItem("typo-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

let menu = "idle";
const footerEl = document.querySelector(".bottom-shelf");

const renderFooter = () => {

  const langObj = languages.find((l) => l.id === currentLang);
  const langLabel = langObj ? langObj.label : currentLang;


  if (menu === "idle") {
    footerEl.innerHTML = `
      <span>[1] time</span>
      <span>[2] words</span>
      <span>[3] settings</span>
      <span>[4] lang: ${langLabel}</span>
      <span>[5] leaderboard</span>
      <span>[esc] restart</span>`;
  } else if (menu === "time") {
    footerEl.innerHTML = `<span>[1] 15s</span><span>[2] 30s</span><span>[3] 60s</span><span>[esc] back</span>`;
  } else if (menu === "words") {
    footerEl.innerHTML = `<span>[1] 10w</span><span>[2] 25w</span><span>[3] 50w</span><span>[esc] back</span>`;
  }   else if (menu === "settings") {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const authLabel = user ? "logout" : "login";
    footerEl.innerHTML = `
    <span>[1] theme: ${current}</span>
    <span>[2] highlight: ${highlightWord ? "on" : "off"}</span>
    <span>[3] punc: ${hasPunctuation ? "on" : "off"}</span>
    <span>[4] num: ${hasNumbers ? "on" : "off"}</span>
    <span>[5] ${authLabel}</span> 
    <span>[esc] back</span>`;
}

};

reboot();
renderFooter();
