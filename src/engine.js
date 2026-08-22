export const sipWords = async () => {
  try {
    const res = await fetch("languages/english.json");
    const data = await res.json();
    return Array.isArray(data.words) ? data.words : [];
  } catch {
    return ["type", "test", "speed", "flow", "word", "code", "pure"];
  }
};
export const harvest = (quarry, qty = 50) => {
  const bag = [];
  const len = quarry.length;
  if (!len) return bag;
  for (let i = 0; i < qty; i++) {
    bag.push(quarry[Math.floor(Math.random() * len)]);
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