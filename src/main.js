import { sipWords, harvest, TapeDeck } from "./engine.js";
import { StageFramer } from "./typing-view.js";
import confetti from "https://esm.sh/canvas-confetti@1.9.4";

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

const allMods = [...timeModes, ...wordModes];

const savedModeLabel = localStorage.getItem("typo-mode") || "15s";
let gear = allMods.find(m => m.label === savedModeLabel) || timeModes[0];

let pool = [];
let tape = new TapeDeck([], gear), ticker = null;
let view = new StageFramer();
const reboot = async (selectedGear = gear) => {

  gear = selectedGear;
  localStorage.setItem("typo-mode", gear.label);

  menu = "idle";
  renderFooter();

  if (ticker) clearInterval(ticker);
  ticker = null;
  if (!pool.length) pool = await sipWords();
  const count = gear.kind === "words" ? gear.target : 60;
  tape = new TapeDeck(harvest(pool, count), gear);
  view.scrubStage();
  view.setModeTag(gear.label);
  view.tickClock(gear.kind === "time" ? gear.target : `${tape.words.length}w`);
  view.splatWords(tape.words);

  requestAnimationFrame(() => view.snapCaret(0, 0));
};


const halt = () => {
  tape.nuke();
  if (ticker) clearInterval(ticker);
  ticker = null;

  const stats = tape.spill();
  const pbinfo = updatePB(gear.label, stats.wpm);
  view.showTrophy(stats, pbinfo);

  if (pbinfo.isNew && stats.wpm > 0) {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#fff", "#ccc", "#888", "#444"]
    });
  }
};



const pulse = () => {
  ticker = setInterval(() => {
    if (!tape.beganAt || tape.sealed) return;
    const passed = Math.floor((performance.now() - tape.beganAt) / 1000);
    if (gear.kind === "time") {
      const rem = Math.max(0, gear.target - passed);
      view.tickClock(rem);
      if (rem <= 0) halt();
    } else {
      view.tickClock(`${Math.max(0, tape.words.length - tape.wi)}w`);
    }
  }, 250);
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

  const target = tape.words[tape.wi] || "";

  if (typed.length < target.length) {
    tape.slips += target.length - typed.length;
    for (let i = tape.ci; i < target.length; i++) {
      view.paintChar(tape.wi, i, "wrong");
    }
  }

  tape.wi++;
  tape.ci = 0;

  if (gear.kind === "time" && tape.wi > tape.words.length - 20) {
    const fresh = harvest(pool, 25);
    tape.words.push(...fresh);
    view.feedWords(fresh);
  }

  if (gear.kind === "words" && tape.wi >= tape.words.length) return halt();
  if (gear.kind === "words") view.tickClock(`${tape.words.length - tape.wi}w`);
  view.snapCaret(tape.wi, 0);
};

export const getPB = (modeLabel) => {
  return Number(localStorage.getItem(`typo-pb-${modeLabel}`) || 0);

};

export const updatePB = (modeLabel, wpm) => {
  const currentPB = getPB(modeLabel);
  const isNew = wpm > currentPB;
  if (isNew) {
    localStorage.setItem(`typo-pb-${modeLabel}`, wpm);
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

window.addEventListener("keydown", (e) => {

  if (e.key === "Tab") { e.preventDefault(); return; }


  if (e.key === "Escape") {
    if (menu !== "idle") { menu = "idle"; renderFooter(); return; }
    return reboot();
  }

  if (!tape.beganAt) {
    if (menu === "idle") {
      if (e.key === "1") { menu = "time"; renderFooter(); return; }
      if (e.key === "2") { menu = "words"; renderFooter(); return; }
      if (e.key === "3") { menu = "settings"; renderFooter(); return; }
    
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
  return next;
};

const savedTheme = localStorage.getItem("typo-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

let menu = "idle";
const footerEl = document.querySelector(".bottom-shelf");

const renderFooter = () => {
if (menu === "idle") {
  footerEl.innerHTML = `
  <span>[1] time</span>
  <span>[2] words</span>
  <span>[3] settings</span>
  <span>[esc] restart</span>`;
  } else if (menu === "time") {
    footerEl.innerHTML = `<span>[1] 15s</span>
    <span>[2] 30s</span>
    <span>[3] 60s</span>
    <span>[esc] back</span>`
  } else if (menu === "words") {
    footerEl.innerHTML = `<span>[1] 10w</span>
    <span>[2] 25w</span>
    <span>[3] 50w</span>
    <span>[esc] back</span>`
  } else if (menu === "settings") {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    footerEl.innerHTML = `<span>[1] theme: ${current}</span><span>[esc] back</span>`;
  }
}

reboot();
renderFooter();
