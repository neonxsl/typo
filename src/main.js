import { sipWords, harvest, TapeDeck } from "./engine.js";
import { StageFramer } from "./typing-view.js";
import confetti from "https://esm.sh/canvas-confetti@1.9.4";

const modes = [

  { label: "15s", kind: "time", target: 15 },
  { label: "30s", kind: "time", target: 30 },
  { label: "60s", kind: "time", target: 60 },
  { label: "25w", kind: "words", target: 25 }

];


let pool = [];
let gear = modes[0];
let tape = new TapeDeck([], gear), ticker = null;
let view = new StageFramer();
const reboot = async (selectedGear = gear) => {

  gear = selectedGear;
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
  if (typed.length < target.length) tape.slips += target.length - typed.length;
  tape.wi++;
  tape.ci = 0;
  if (gear.kind === "time" && tape.wi > tape.words.length - 20) {
    const fresh = harvest(pool, 25); tape.words.push(...fresh); view.feedWords(fresh);
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
    if (tape.wi > 0) { tape.wi--; tape.ci = (tape.history[tape.wi] || "").length; view.snapCaret(tape.wi, tape.ci); }
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
  if (e.key === "Escape") return reboot();
  if (!tape.beganAt && ["1", "2", "3", "4"].includes(e.key)) return reboot(modes[Number(e.key) - 1]);
  if (tape.sealed) return;
  if (e.key === "Backspace") return peel();
  if (e.key === " ") { e.preventDefault(); return bumpWord(); }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) ingest(e.key);

});


reboot();

