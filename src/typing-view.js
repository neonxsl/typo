export class StageFramer {
  constructor() {
    this.streamWrapEl = document.getElementById("stream-wrap");
    this.streamEl = document.getElementById("word-stream");
    this.caretEl = document.getElementById("caret");
    this.clockEl = document.getElementById("clock");
    this.resultsEl = document.getElementById("results");
    this.modeEl = document.getElementById("mode-label");
    this.resWpm = document.getElementById("res-wpm");
    this.resAcc = document.getElementById("res-acc");
    this.resRaw = document.getElementById("res-raw");
    this.resChars = document.getElementById("res-chars");
    this.resPb = document.getElementById("res-pb");
    this.resXpEl = document.getElementById("res-xp");
    this.levelBadgeEl = document.getElementById("level-badge");
    this.levelAlertEl = document.getElementById("level-alert");
    this.chartCanvas = document.getElementById("speed-chart");
    this.chartInstance = null;
    this.streakEl = document.getElementById("streak-badge");
    this.streakAlert = document.getElementById("streak-alert");
  }

  renderUserLevel(level, totalXP) {
    if (this.levelBadgeEl) {
      this.levelBadgeEl.textContent = `lvl ${level} (${(totalXP || 0).toLocaleString()} xp)`;
    }
  }

  flashLevelUpAlert(newLevel) {
    if (this.levelAlertEl) {
      this.levelAlertEl.textContent = `🎉 level up! reached level ${newLevel}`;
      this.levelAlertEl.classList.remove("hide");
    }
  }

  renderChart(timeline) {
    if (!this.chartCanvas || !timeline || !timeline.length) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    Chart.defaults.font.family = "'Space Grotesk', sans-serif";

    const labels = timeline.map((pt) => `${pt.second}s`);
    const wpmData = timeline.map((pt) => pt.wpm);
    const rawData = timeline.map((pt) => pt.raw);

    const errorPoints = timeline.map((pt) => (pt.errors > 0 ? 1 : null));

    // if you find this, have a great day!

    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const lineCol = isLight ? "#111" : "#fff";
    const rawCol = isLight ? "#888" : "#333";
    const gridCol = isLight ? "#eee" : "#161616";

    

    this.chartInstance = new Chart(this.chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'errors',
            data: errorPoints,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#ef4444',
            pointRadius: 5,
            pointStyle: 'crossRot',
            order: 0,
          },
          {
            label: 'wpm',
            data: wpmData,
            borderColor: lineCol,
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: 'raw',
            data: rawData,
            borderColor: rawCol,
            borderWidth: 1.5,
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
        ]
      },
      options: {
        responsive: true,
        animation: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {display: false},
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        scales: {
          x: {
            grid: {display: true, color: gridCol,},
          },
          y: {
            beginAtZero: true,
            grid: {display: true, color: gridCol,},

          }
        }
      }
    });
  }

  feedWords(words) {
    words.forEach((w) => {
      const wNode = document.createElement("div");
      wNode.className = "word";
      for (let i = 0; i < w.length; i++) {
        const ch = document.createElement("span");
        ch.className = "letter";
        ch.textContent = w[i];
        wNode.appendChild(ch);
      }
      this.streamEl.appendChild(wNode);


    });
  }

  renderStreak(streakData) {
    if (!this.streakEl) return;
    const progress = Math.min(streakData.dailyTests, 5);
    this.streakEl.textContent = `🔥 ${streakData.streak} (${progress}/5)`;

  }

  flashStreakAlert(streak) {
    if (this.streakEl) {
      this.streakEl.classList.remove("funkyeh");
      void this.streakEl.offsetWidth;
      this.streakEl.classList.add("funkyeh");
    }

    if (this.streakAlert) {
      this.streakAlert.textContent = `🔥 streak extended to ${streak}`;
      this.streakAlert.classList.remove("hide");

    }
  }

  splatWords(words) {
    this.lastWi = null;
    this.streamEl.innerHTML = "";
    this.feedWords(words);
    this.streamEl.style.transform = "translateY(0px)";

  }
  snapCaret(wi, ci) {

    const words = this.streamEl.children;
    if (!words.length || wi >= words.length) return;

    if (this.lastWi !== wi) {
      if (words[this.lastWi]) words[this.lastWi].classList.remove("current");
      if (words[wi]) words[wi].classList.add("current");
      this.lastWi = wi;
    }

    const currentWord = words[wi];

    const letters = currentWord.children;
    let x = currentWord.offsetLeft;
    const y = currentWord.offsetTop;
    if (ci < letters.length) {

      x += letters[ci].offsetLeft;
    } else if (letters.length > 0) {
      const last = letters[letters.length - 1];
      x += last.offsetLeft + last.offsetWidth;


    }
    const shift = y > 50 ? y - 42 : 0;
    this.streamEl.style.transform = `translateY(-${shift}px)`;
    this.caretEl.style.left = `${x}px`;
    this.caretEl.style.top = `${y - shift + 4}px`;
  }
  paintChar(wi, ci, state, char = "") {
    const word = this.streamEl.children[wi];
    if (!word) return;
    const letters = word.children;


    if (ci < letters.length) {
      letters[ci].className = state ? `letter ${state}` : "letter";

    } else if (state === "extra") {
      const extraNode = document.createElement("span");

      extraNode.className = "letter extra";
      extraNode.textContent = char;
      word.appendChild(extraNode);


    }


  }


  popExtra(wi) {
    const word = this.streamEl.children[wi];
    if (!word) return;
    const last = word.lastElementChild;
    if (last && last.classList.contains("extra")) {
      word.removeChild(last);
    }
  }
  tickClock(val) { this.clockEl.textContent = val; }
  setModeTag(txt) {
    this.modeEl.textContent = txt;
  }
  showTrophy(stats, pbInfo, timeline = [], earnedXP = 0) {
    this.resWpm.textContent = stats.wpm;
    this.resAcc.textContent = stats.acc;
    this.resRaw.textContent = stats.raw;
    this.resChars.textContent = stats.ratio;


    if (this.resPb && pbInfo) {
      this.resPb.textContent = pbInfo.pb;
      this.resPb.classList.toggle("new-pb", pbInfo.isNew);
    // ayyy you got a new pb
    }

    if (this.resXpEl) {
      this.resXpEl.textContent = `+${earnedXP.toLocaleString()} xp`;
  }

    this.renderChart(timeline);

    this.resultsEl.classList.remove("hide");
    this.clockEl.classList.add("hide");
    this.streamWrapEl.classList.add("hide");

  }
  scrubStage() {
    this.resultsEl.classList.add("hide");
    this.clockEl.classList.remove("hide");
    this.streamWrapEl.classList.remove("hide");
    this.streamEl.style.transform = "translateY(0px)";
    if (this.streakAlert) this.streakAlert.classList.add("hide");
    if (this.levelAlertEl) this.levelAlertEl.classList.add("hide");

  }
  
  douse() {
    this.caretEl.style.left = "0px";
    this.caretEl.style.top = "0px";
  }
}





// toodles