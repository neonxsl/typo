export const sipWords = async (lang = "english") => {
  try {
    const url = `https://raw.githubusercontent.com/monkeytypegame/monkeytype/refs/heads/master/frontend/static/languages/${lang}.json`;
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data.words) ? data.words : [];
  } catch {
    return ["type", "test", "speed", "flow", "word", "code", "pure"];
  }
};

const PUNCTUATION_MARKS = [".", ",", "!", "?", ";", ":"];

export const harvest = (quarry, qty = 50, options = { punctuation: false }) => {
  const bag = [];
  const len = quarry.length;
  if (!len) return bag;

  for (let i = 0; i < qty; i++) {
    if (options.numbers && Math.random() < 0.1) {
      const num = Math.floor(Math.random() * (Math.random() < 0.5 ? 100 : 2026)).toString();
      bag.push(num);
      continue;
    }

    let word = quarry[Math.floor(Math.random() * len)];

    if (options.punctuation) {
      if (Math.random() < 0.167) { 
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
        if (Math.random() < 0.167) { 
          const mark = PUNCTUATION_MARKS[Math.floor(Math.random() * PUNCTUATION_MARKS.length)];
          word += mark;
        }
    }

    bag.push(word);
  }
  return bag;
};

// why u snooping me code ?

export const crunch = (hits, slips, totalKeys, elapsedSec) => {
  const mins = Math.max(elapsedSec / 60, 0.001);
  const grossWpm = Math.round((totalKeys / 5) / mins);

  const netWpm = Math.max(0, Math.round((hits / 5) / mins));

  const acc = totalKeys > 0 ? Math.max(0, Math.round((hits / totalKeys) * 100)) : 100;
  return {
    wpm: netWpm,
    raw: grossWpm,
    acc: `${acc}%`,
    ratio: `${hits}/${totalKeys}`
  };
};


export class TapeDeck {
  constructor(words = [], mode = { kind: "time", target: 15 }) {
    this.mode = mode;
    this.words = words;
    this.history = [];
    this.wi = 0;
    this.ci = 0;
    this.beganAt = 0;
    this.totalKeys = 0;
    this.hits = 0;
    this.slips = 0;
    this.sealed = false;
  }
  stamp() {
    if (!this.beganAt) this.beganAt = performance.now();
  }
  spill() {
    const spent = (performance.now() - (this.beganAt || performance.now())) / 1000;
    return crunch(this.hits, this.slips, this.totalKeys, spent);
  }
  tap() { this.totalKeys++; }
  bork() { this.slips++; }
  hit() { this.hits++; }
  nuke() { this.sealed = true; }
}

export const calculateTestXP = ( stats, gear, options, lang, streak ) => {
  if (stats.wpm <= 0) return 0;

  const rawAcc = parseInt(stats.acc) || 100;
  const base = stats.wpm * (rawAcc / 100);

  const durationMult = {
    "15s":1, "10w": 1, "30s": 1.5, "25w": 1.5, "60s": 2.4, "50w": 2.4}[gear.label] || 1;

    let multiplier = durationMult;

    if (options.punctuation) multiplier += 0.25;
    if (options.numbers) multiplier += 0.2;
    if (lang.startsWith("code")) multiplier += 0.35;

    multiplier += Math.min(streak * 0.03, 0.3);

    return Math.round(base * multiplier);
};

export const calculateLevel = (totalXP) => {
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
};