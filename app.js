// ============================================================================
// TRANSMUTE: Discipline, Focus & Energy Hub - Core Logic
// ============================================================================

// 1. Audio Engine via Web Audio API (No external sound files required)
class AudioEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, type = 'sine', gainVal = 0.15) {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  playSuccessChime() {
    try {
      this.init();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 0.4, 'triangle', 0.2);
        }, i * 90);
      });
    } catch (e) {}
  }

  playMetronomeClick(isDownbeat) {
    try {
      this.init();
      const freq = isDownbeat ? 1200 : 800;
      const duration = 0.05;
      const gainVal = isDownbeat ? 0.35 : 0.2;
      this.playTone(freq, duration, 'square', gainVal);
    } catch (e) {}
  }

  playGong() {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 1.8);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 2.0);
    } catch (e) {}
  }
}

const audio = new AudioEngine();

// 2. Default State & Storage
const STORAGE_KEY = 'transmute_hub_v1';

const defaultState = {
  cleanStreakDays: 1,
  cleanStreakStart: Date.now() - (24 * 60 * 60 * 1000), // default 1 day
  bestStreak: 1,
  xp: 40,
  level: 1,
  urgesDefeated: 0,
  currentDateStr: new Date().toISOString().split('T')[0],
  pillars: {
    studies: { minutesToday: 0, goal: 60, tasks: [false, false, false], name: "Studies" },
    gym: { minutesToday: 0, goal: 45, tasks: [false, false, false], name: "Gym & Fitness" },
    guitar: { minutesToday: 0, goal: 30, tasks: [false, false, false], name: "Guitar" },
    trading: { minutesToday: 0, goal: 30, tasks: [false, false, false], name: "Trading" },
    singing: { minutesToday: 0, goal: 20, tasks: [false, false, false], name: "Singing" }
  },
  journal: [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      type: 'system',
      title: 'Transmute System Initialized',
      description: 'Decided to reclaim energy, master skills, and conquer idle habits. Day 1 begun.'
    }
  ],
  weeklyHistory: {}
};

let appState = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    
    // Check if new day
    const today = new Date().toISOString().split('T')[0];
    if (parsed.currentDateStr !== today) {
      // Archive yesterday's minutes to history
      if (!parsed.weeklyHistory) parsed.weeklyHistory = {};
      parsed.weeklyHistory[parsed.currentDateStr] = {
        studies: parsed.pillars.studies.minutesToday,
        gym: parsed.pillars.gym.minutesToday,
        guitar: parsed.pillars.guitar.minutesToday,
        trading: parsed.pillars.trading.minutesToday,
        singing: parsed.pillars.singing.minutesToday
      };

      // Reset daily counts
      parsed.currentDateStr = today;
      Object.keys(parsed.pillars).forEach(k => {
        parsed.pillars[k].minutesToday = 0;
        parsed.pillars[k].tasks = [false, false, false];
      });

      // Update clean streak days
      const daysDiff = Math.floor((Date.now() - parsed.cleanStreakStart) / (1000 * 60 * 60 * 24));
      parsed.cleanStreakDays = Math.max(0, daysDiff);
      if (parsed.cleanStreakDays > (parsed.bestStreak || 0)) {
        parsed.bestStreak = parsed.cleanStreakDays;
      }
    }
    return parsed;
  } catch (e) {
    console.error("Failed to load state", e);
    return defaultState;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

// 3. XP & Progression Logic
const XP_PER_LEVEL = 250;
const RANK_TITLES = [
  "Mindful Initiate",
  "Disciplined Apprentice",
  "Focus Warrior",
  "Energy Alchemist",
  "Willpower Architect",
  "Grandmaster of Focus"
];

function addXp(amount, reason = "") {
  appState.xp += amount;
  const newLevel = Math.floor(appState.xp / XP_PER_LEVEL) + 1;
  
  if (newLevel > appState.level) {
    appState.level = newLevel;
    celebrateLevelUp(newLevel);
  }

  saveState();
  updateUI();
}

function celebrateLevelUp(lvl) {
  audio.playSuccessChime();
  if (window.confetti) {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }
  const title = RANK_TITLES[Math.min(lvl - 1, RANK_TITLES.length - 1)];
  alert(`⚡ LEVEL UP! You reached Level ${lvl}: ${title}! Keep channeling your energy!`);
}

// 4. UI Updating & Synchronization
function updateUI() {
  // Streak
  const daysDiff = Math.max(0, Math.floor((Date.now() - appState.cleanStreakStart) / (1000 * 60 * 60 * 24)));
  appState.cleanStreakDays = daysDiff;
  if (appState.cleanStreakDays > (appState.bestStreak || 0)) {
    appState.bestStreak = appState.cleanStreakDays;
  }
  
  document.getElementById('headerStreakDays').innerText = `${appState.cleanStreakDays} ${appState.cleanStreakDays === 1 ? 'Day' : 'Days'}`;
  document.getElementById('statBestStreak').innerText = `${appState.bestStreak || 1} Days`;
  document.getElementById('statUrgesDefeated').innerText = appState.urgesDefeated;

  // Level & XP Bar
  const currentLvlXp = appState.xp % XP_PER_LEVEL;
  const pct = Math.min(100, Math.round((currentLvlXp / XP_PER_LEVEL) * 100));
  const rank = RANK_TITLES[Math.min(appState.level - 1, RANK_TITLES.length - 1)];
  
  document.getElementById('headerLevel').innerText = `Lvl ${appState.level} (${rank})`;
  document.getElementById('headerXp').innerText = `${currentLvlXp} / ${XP_PER_LEVEL} XP`;
  document.getElementById('headerXpBar').style.width = `${pct}%`;

  // Date
  const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
  document.getElementById('currentDateStr').innerText = new Date().toLocaleDateString(undefined, options);

  // Pillars metrics & checkboxes
  let totalMinutes = 0;
  Object.keys(appState.pillars).forEach(pillarKey => {
    const p = appState.pillars[pillarKey];
    totalMinutes += p.minutesToday;

    // Minute stats
    const minEl = document.getElementById(`stat-${pillarKey}-mins`);
    if (minEl) minEl.innerText = `${p.minutesToday} min`;
    const goalEl = document.getElementById(`stat-${pillarKey}-goal`);
    if (goalEl) goalEl.innerText = p.goal;

    // Badges
    const badge = document.getElementById(`badge-${pillarKey}-status`);
    if (badge) {
      if (p.minutesToday >= p.goal) {
        badge.innerText = "Completed ✓";
        badge.className = "px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600";
      } else if (p.minutesToday > 0) {
        badge.innerText = "In Progress";
        badge.className = "px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-900/50 text-amber-300 border border-amber-700";
      } else {
        badge.innerText = "Pending";
        badge.className = "px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700";
      }
    }

    // Checkboxes
    p.tasks.forEach((done, idx) => {
      const cb = document.querySelector(`.pillar-checkbox[data-pillar="${pillarKey}"][data-task="${idx}"]`);
      if (cb) cb.checked = done;
    });
  });

  // Total Focus Hours
  document.getElementById('statTotalHours').innerText = `${(totalMinutes / 60).toFixed(1)} hrs`;

  // Refresh Journal
  renderJournal();

  // Refresh Chart
  renderChart();

  // Refresh Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// 5. Checklist Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  // Checkbox change listener
  document.querySelectorAll('.pillar-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const pillar = e.target.getAttribute('data-pillar');
      const taskIdx = parseInt(e.target.getAttribute('data-task'), 10);
      const isChecked = e.target.checked;
      
      appState.pillars[pillar].tasks[taskIdx] = isChecked;

      if (isChecked) {
        audio.playSuccessChime();
        addXp(25, `Completed ${pillar} task`);
        if (window.confetti) {
          confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
        }
      }

      saveState();
      updateUI();
    });
  });

  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active', 'border-emerald-500/30', 'text-emerald-400'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));

      tab.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.remove('hidden');

      if (targetTab === 'analytics') {
        setTimeout(renderChart, 50);
      }
    });
  });

  // Urge Shield Open Button
  document.getElementById('openUrgeShieldBtn').addEventListener('click', openUrgeShield);
  document.getElementById('streakBadge').addEventListener('click', () => {
    document.querySelector('.nav-tab[data-tab="analytics"]').click();
  });

  // Free Time Modal Button
  document.getElementById('openFreeTimeModalBtn').addEventListener('click', openFreeTimeModal);

  // Initialize UI
  updateUI();
  initMetronomeUI();
  initFocusTimerUI();
});

// Quick Time Log buttons
function logQuickTime(pillar, minutes) {
  audio.playSuccessChime();
  appState.pillars[pillar].minutesToday += minutes;
  addXp(minutes, `Logged ${minutes}m of ${pillar}`);
  
  // Log entry in journal
  appState.journal.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'session',
    title: `+${minutes}m Logged: ${appState.pillars[pillar].name}`,
    description: `Dedicated focused time to developing mastery instead of idling.`
  });

  saveState();
  updateUI();
}

// Quick Session Note
function saveQuickNote() {
  const input = document.getElementById('quickSessionNoteInput');
  const text = input.value.trim();
  if (!text) return;

  audio.playSuccessChime();
  appState.journal.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'note',
    title: 'Daily Practice Reflection',
    description: text
  });

  input.value = '';
  addXp(20, 'Logged practice reflection');
  saveState();
  updateUI();
  alert("Reflection saved to your Discipline Log (+20 XP)!");
}

// 6. Urge Shield / SOS Protocol
let breathInterval = null;
let breathState = 'inhale'; // inhale, hold, exhale, hold
let breathSecondsLeft = 4;

function openUrgeShield() {
  audio.init();
  document.getElementById('urgeShieldModal').classList.remove('hidden');
  startBreathingGuide();
}

function closeUrgeShield() {
  document.getElementById('urgeShieldModal').classList.add('hidden');
  stopBreathingGuide();
}

function startBreathingGuide() {
  stopBreathingGuide();
  breathSecondsLeft = 4;
  breathState = 'inhale';
  updateBreathDisplay();

  breathInterval = setInterval(() => {
    breathSecondsLeft--;
    if (breathSecondsLeft <= 0) {
      if (breathState === 'inhale') {
        breathState = 'hold-in';
        breathSecondsLeft = 4;
      } else if (breathState === 'hold-in') {
        breathState = 'exhale';
        breathSecondsLeft = 4;
      } else if (breathState === 'exhale') {
        breathState = 'hold-out';
        breathSecondsLeft = 4;
      } else {
        breathState = 'inhale';
        breathSecondsLeft = 4;
      }
    }
    updateBreathDisplay();
  }, 1000);
}

function stopBreathingGuide() {
  if (breathInterval) {
    clearInterval(breathInterval);
    breathInterval = null;
  }
}

function updateBreathDisplay() {
  const ring = document.getElementById('breathRing');
  const text = document.getElementById('breathPhaseText');
  const count = document.getElementById('breathCountText');

  count.innerText = `${breathSecondsLeft}s`;

  if (breathState === 'inhale') {
    text.innerText = "INHALE DEEP (NOSE)";
    ring.className = "absolute w-36 h-36 rounded-full border-4 transition-all duration-1000 breath-in";
  } else if (breathState === 'hold-in') {
    text.innerText = "HOLD BREATH";
    ring.className = "absolute w-36 h-36 rounded-full border-4 transition-all duration-1000 breath-hold";
  } else if (breathState === 'exhale') {
    text.innerText = "SLOW EXHALE (MOUTH)";
    ring.className = "absolute w-36 h-36 rounded-full border-4 transition-all duration-1000 breath-out";
  } else {
    text.innerText = "HOLD EMPTY";
    ring.className = "absolute w-36 h-36 rounded-full border-4 transition-all duration-1000 breath-out";
  }
}

function pickEmergencyMission(instruction) {
  audio.playSuccessChime();
  closeUrgeShield();
  alert(`🚨 IMMEDIATE MISSION ACTIVATED:\n\n${instruction}\n\nExecute it now without second-guessing!`);
}

function logUrgeDefeated() {
  audio.playSuccessChime();
  if (window.confetti) {
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
  }

  appState.urgesDefeated += 1;
  addXp(100, "Defeated compulsive impulse");

  appState.journal.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'victory',
    title: '🛡️ Urge Surfed & Impulses Defeated',
    description: 'Chose willpower over immediate dopamine. Neural rewiring in progress.'
  });

  saveState();
  closeUrgeShield();
  updateUI();
  alert("VICTORY! You proved to yourself that you are in control. +100 XP awarded!");
}

// 7. "I Am Free Right Now!" Boredom Buster Generator
const MISSIONS = {
  15: [
    { pillar: 'gym', badge: '🏋️ Physical Power', desc: 'Do 3 sets of 15 pushups + 20 squats. Shake out nervous energy and get blood flowing.' },
    { pillar: 'guitar', badge: '🎸 Guitar Agility', desc: 'Grab guitar. Run spider chromatics on frets 1-4 with a metronome at 75 BPM. Build clean finger tone.' },
    { pillar: 'trading', badge: '📈 Market Prep', desc: 'Open TradingView. Mark out the daily and 4h key support/resistance levels on your favorite index or stock.' },
    { pillar: 'singing', badge: '🎤 Vocal Warmup', desc: 'Do 5 minutes of lip trills sirens followed by 10 minutes humming arpeggios in your comfortable range.' },
    { pillar: 'studies', badge: '📚 Rapid Study', desc: 'Pick 1 tough concept from your notes. Explain it out loud in simple terms using the Feynman technique.' }
  ],
  30: [
    { pillar: 'studies', badge: '📚 Deep Study Block', desc: 'Turn phone completely on silent in another room. Complete 1 full chapter reading with active margin notes.' },
    { pillar: 'guitar', badge: '🎸 Song Practice', desc: 'Work on transitioning between transitions of a difficult song or learn the pentatonic box 1 and box 2.' },
    { pillar: 'gym', badge: '🏋️ Core & Calisthenics', desc: 'Full body circuit: Pushups, planks, lunges, and jumping jacks for 30 minutes. Sweat it out.' },
    { pillar: 'trading', badge: '📈 Backtesting Session', desc: 'Go back 3 months in price action. Backtest your primary strategy setup on 10 historical charts.' },
    { pillar: 'singing', badge: '🎤 Vocal Repertoire', desc: 'Record yourself singing 1 verse and chorus. Listen back analytically to pitch and breath control.' }
  ],
  45: [
    { pillar: 'gym', badge: '🏋️ Full Gym Workout', desc: 'Pack gym bag, put on workout shoes, and hit a heavy lifting or cardio session. Leave everything on the floor.' },
    { pillar: 'studies', badge: '📚 Problem Solving Run', desc: 'Solve 10 complex practice exam questions under simulated timed conditions without distractions.' },
    { pillar: 'guitar', badge: '🎸 Jam & Ear Training', desc: 'Put on a backing track in A minor or E minor on YouTube and improvise solos using scales.' },
    { pillar: 'trading', badge: '📈 Strategy Journaling', desc: 'Review the week\'s trades. Document emotional mistakes, risk:reward ratios, and market lessons.' }
  ],
  60: [
    { pillar: 'studies', badge: '📚 Mastermind Session', desc: 'Full 60-minute deep work block with zero tab switching. Write comprehensive summary notes.' },
    { pillar: 'gym', badge: '🏋️ Iron Mastery', desc: 'Complete workout: 10m warmup, 40m compound lifts / intense training, 10m deep mobility stretch.' },
    { pillar: 'guitar', badge: '🎸 Full Masterclass', desc: '20m scales & metronome drills + 20m rhythm and strumming + 20m new song composition.' },
    { pillar: 'singing', badge: '🎤 Complete Vocal Workout', desc: 'Diaphragm breath exercises, vocal scales, pitch accuracy, dynamic projection, and 2 full songs.' }
  ]
};

let currentFreeDuration = 15;
let currentFreeMission = null;

function openFreeTimeModal() {
  document.getElementById('freeTimeModal').classList.remove('hidden');
  selectFreeDuration(15);
}

function closeFreeTimeModal() {
  document.getElementById('freeTimeModal').classList.add('hidden');
}

function selectFreeDuration(dur) {
  currentFreeDuration = dur;
  document.querySelectorAll('.free-dur-btn').forEach(btn => {
    if (parseInt(btn.getAttribute('data-dur'), 10) === dur) {
      btn.className = "free-dur-btn active text-xs py-2 rounded-xl border border-teal-500 bg-teal-500/20 text-teal-200 font-bold";
    } else {
      btn.className = "free-dur-btn text-xs py-2 rounded-xl border border-gray-800 bg-gray-900 text-gray-400 font-bold hover:text-white";
    }
  });
  regenerateFreeMission();
}

function regenerateFreeMission() {
  const list = MISSIONS[currentFreeDuration] || MISSIONS[15];
  const rand = list[Math.floor(Math.random() * list.length)];
  currentFreeMission = rand;

  document.getElementById('freeMissionPillarBadge').innerText = rand.badge;
  document.getElementById('freeMissionDescription').innerText = `"${rand.desc}"`;
}

function acceptFreeMission() {
  if (!currentFreeMission) return;
  closeFreeTimeModal();

  // Switch to focus timer tab and set up
  document.querySelector('.nav-tab[data-tab="timer"]').click();
  document.getElementById('timerPillarSelect').value = currentFreeMission.pillar;
  setTimerDuration(currentFreeDuration);
  toggleTimer(); // Start timer
  alert(`Mission started! Stay focused on ${currentFreeMission.badge} for ${currentFreeDuration} minutes!`);
}

// 8. Relapse & Recovery System (Compassionate Reset)
function openRelapseModal() {
  document.getElementById('relapseModal').classList.remove('hidden');
}

function closeRelapseModal() {
  document.getElementById('relapseModal').classList.add('hidden');
}

function confirmRelapseReset() {
  const trigger = document.getElementById('relapseTriggerSelect').value;
  const rule = document.getElementById('relapseRuleInput').value.trim() || 'Keep awareness high and phone away from bed';

  appState.cleanStreakStart = Date.now();
  appState.cleanStreakDays = 0;

  appState.journal.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'relapse',
    title: 'Reset & Re-Commitment (No Shame)',
    description: `Trigger: ${trigger}. Environmental Adjustment: ${rule}. Standing back up immediately.`
  });

  saveState();
  closeRelapseModal();
  updateUI();
  alert("Streak reset logged with zero shame. Today you stand up and continue building discipline!");
}

// 9. Interactive Metronome Engine
let metroRunning = false;
let metroBpm = 100;
let metroBeatsPerMeasure = 4;
let metroCurrentBeat = 0;
let metroInterval = null;

function initMetronomeUI() {
  const slider = document.getElementById('bpmSlider');
  const bpmText = document.getElementById('bpmValue');
  const beatsSelect = document.getElementById('beatsPerMeasure');

  slider.addEventListener('input', (e) => {
    metroBpm = parseInt(e.target.value, 10);
    bpmText.innerText = metroBpm;
    updateTempoMarking(metroBpm);
    if (metroRunning) {
      restartMetronomeInterval();
    }
  });

  beatsSelect.addEventListener('change', (e) => {
    metroBeatsPerMeasure = parseInt(e.target.value, 10);
    renderMetronomeDots();
    if (metroRunning) {
      metroCurrentBeat = 0;
    }
  });

  renderMetronomeDots();
}

function updateTempoMarking(bpm) {
  let label = "Moderato";
  if (bpm < 60) label = "Largo (Slow)";
  else if (bpm < 76) label = "Adagio";
  else if (bpm < 108) label = "Andante / Moderato";
  else if (bpm < 168) label = "Allegro (Fast)";
  else label = "Presto (Very Fast)";
  document.getElementById('tempoMarking').innerText = label;
}

function adjustBpm(amount) {
  metroBpm = Math.min(220, Math.max(40, metroBpm + amount));
  document.getElementById('bpmSlider').value = metroBpm;
  document.getElementById('bpmValue').innerText = metroBpm;
  updateTempoMarking(metroBpm);
  if (metroRunning) {
    restartMetronomeInterval();
  }
}

function renderMetronomeDots() {
  const container = document.getElementById('metronomeDots');
  container.innerHTML = '';
  for (let i = 1; i <= metroBeatsPerMeasure; i++) {
    const dot = document.createElement('div');
    dot.className = "w-5 h-5 rounded-full bg-gray-800 border border-gray-700 transition-all metro-dot";
    dot.setAttribute('data-beat', i);
    container.appendChild(dot);
  }
}

function toggleMetronome() {
  audio.init();
  metroRunning = !metroRunning;
  const btn = document.getElementById('metronomeToggleBtn');

  if (metroRunning) {
    btn.innerHTML = `<i data-lucide="square" class="w-4 h-4"></i><span>Stop Metronome</span>`;
    btn.className = "bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all";
    metroCurrentBeat = 0;
    tickMetronome();
    restartMetronomeInterval();
  } else {
    btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i><span>Start Metronome</span>`;
    btn.className = "bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all";
    if (metroInterval) clearInterval(metroInterval);
    document.querySelectorAll('.metro-dot').forEach(d => d.classList.remove('active', 'downbeat'));
  }
  lucide.createIcons();
}

function restartMetronomeInterval() {
  if (metroInterval) clearInterval(metroInterval);
  const intervalMs = (60 / metroBpm) * 1000;
  metroInterval = setInterval(tickMetronome, intervalMs);
}

function tickMetronome() {
  metroCurrentBeat = (metroCurrentBeat % metroBeatsPerMeasure) + 1;
  const isDownbeat = metroCurrentBeat === 1;

  audio.playMetronomeClick(isDownbeat);

  const dots = document.querySelectorAll('.metro-dot');
  dots.forEach((dot, index) => {
    dot.classList.remove('active', 'downbeat');
    if (index + 1 === metroCurrentBeat) {
      if (isDownbeat) {
        dot.classList.add('downbeat');
      } else {
        dot.classList.add('active');
      }
    }
  });
}

// 10. Focus & Pomodoro Timer Engine
let timerSecondsTotal = 25 * 60;
let timerSecondsRemaining = 25 * 60;
let timerRunning = false;
let timerInterval = null;

function initFocusTimerUI() {
  const select = document.getElementById('timerPillarSelect');
  select.addEventListener('change', (e) => {
    const name = select.options[select.selectedIndex].text;
    document.getElementById('timerPillarLabel').innerText = name;
  });
  updateTimerDisplay();
}

function setTimerDuration(mins) {
  if (timerRunning) toggleTimer(); // Stop if running
  timerSecondsTotal = mins * 60;
  timerSecondsRemaining = timerSecondsTotal;
  updateTimerDisplay();
}

function startSpecificTimer(pillarKey, displayName) {
  document.querySelector('.nav-tab[data-tab="timer"]').click();
  document.getElementById('timerPillarSelect').value = pillarKey;
  document.getElementById('timerPillarLabel').innerText = displayName;
  setTimerDuration(25);
  toggleTimer();
}

function toggleTimer() {
  audio.init();
  timerRunning = !timerRunning;
  const btn = document.getElementById('timerToggleBtn');

  if (timerRunning) {
    btn.innerHTML = `<i data-lucide="pause" class="w-6 h-6"></i>`;
    btn.className = "w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-600/30 transition-all hover:scale-105 active:scale-95";
    timerInterval = setInterval(() => {
      timerSecondsRemaining--;
      if (timerSecondsRemaining <= 0) {
        finishTimer();
      }
      updateTimerDisplay();
    }, 1000);
  } else {
    btn.innerHTML = `<i data-lucide="play" class="w-6 h-6 ml-0.5"></i>`;
    btn.className = "w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95";
    if (timerInterval) clearInterval(timerInterval);
  }
  lucide.createIcons();
}

function resetTimer() {
  if (timerRunning) toggleTimer();
  timerSecondsRemaining = timerSecondsTotal;
  updateTimerDisplay();
}

function finishTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerRunning = false;
  timerSecondsRemaining = 0;
  updateTimerDisplay();

  audio.playGong();
  if (window.confetti) {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }

  const selectedPillar = document.getElementById('timerPillarSelect').value;
  const minsLogged = Math.round(timerSecondsTotal / 60);

  appState.pillars[selectedPillar].minutesToday += minsLogged;
  addXp(minsLogged * 2, `Completed ${minsLogged}m focus session on ${selectedPillar}`);

  appState.journal.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'session',
    title: `🏆 Completed ${minsLogged}m Session: ${appState.pillars[selectedPillar].name}`,
    description: `Deep focus achieved. Another block of disciplined mastery logged.`
  });

  saveState();
  updateUI();
  alert(`🔔 FOCUS SESSION COMPLETE!\n\nAwesome work! You logged ${minsLogged} minutes on ${appState.pillars[selectedPillar].name} and earned +${minsLogged * 2} XP!`);
}

function updateTimerDisplay() {
  const m = Math.floor(timerSecondsRemaining / 60);
  const s = timerSecondsRemaining % 60;
  document.getElementById('timerDisplay').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  // SVG circle progress (Circumference = 2 * PI * 98 = 615.75)
  const circle = document.getElementById('timerCircleProgress');
  const circumference = 615.75;
  const pctRemaining = timerSecondsRemaining / timerSecondsTotal;
  const offset = circumference * (1 - pctRemaining);
  circle.style.strokeDashoffset = offset;
}

// 11. Journal History Rendering
function renderJournal() {
  const container = document.getElementById('journalList');
  const empty = document.getElementById('journalEmptyState');

  if (!appState.journal || appState.journal.length === 0) {
    empty.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = '';

  appState.journal.forEach(entry => {
    const item = document.createElement('div');
    item.className = "bg-gray-950/70 border border-gray-800 rounded-xl p-3.5 flex items-start gap-3 hover:border-gray-700 transition";

    let iconClass = "text-indigo-400 bg-indigo-500/10 border-indigo-500/30";
    let iconName = "clock";
    if (entry.type === 'victory') {
      iconClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      iconName = "shield-check";
    } else if (entry.type === 'relapse') {
      iconClass = "text-amber-400 bg-amber-500/10 border-amber-500/30";
      iconName = "refresh-cw";
    } else if (entry.type === 'note') {
      iconClass = "text-purple-400 bg-purple-500/10 border-purple-500/30";
      iconName = "edit-3";
    }

    const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

    item.innerHTML = `
      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${iconClass}">
        <i data-lucide="${iconName}" class="w-4 h-4"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-xs font-bold text-gray-200 truncate">${entry.title}</h4>
          <span class="text-[10px] text-gray-500 shrink-0">${timeStr}</span>
        </div>
        <p class="text-xs text-gray-400 mt-1 leading-relaxed">${entry.description}</p>
      </div>
    `;

    container.appendChild(item);
  });
}

function clearJournalHistory() {
  if (confirm("Clear your journal history? (Your streak and stats will remain intact)")) {
    appState.journal = [];
    saveState();
    updateUI();
  }
}

// 12. Chart.js Weekly Visualization
let chartInstance = null;

function renderChart() {
  const ctx = document.getElementById('pillarBarChart');
  if (!ctx) return;

  const labels = ['Studies', 'Gym', 'Guitar', 'Trading', 'Singing'];
  const todayData = [
    appState.pillars.studies.minutesToday,
    appState.pillars.gym.minutesToday,
    appState.pillars.guitar.minutesToday,
    appState.pillars.trading.minutesToday,
    appState.pillars.singing.minutesToday
  ];
  const goalsData = [
    appState.pillars.studies.goal,
    appState.pillars.gym.goal,
    appState.pillars.guitar.goal,
    appState.pillars.trading.goal,
    appState.pillars.singing.goal
  ];

  if (chartInstance) {
    chartInstance.data.datasets[0].data = todayData;
    chartInstance.data.datasets[1].data = goalsData;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Today Logged (mins)',
          data: todayData,
          backgroundColor: [
            'rgba(59, 130, 246, 0.75)',
            'rgba(249, 115, 22, 0.75)',
            'rgba(168, 85, 247, 0.75)',
            'rgba(16, 185, 129, 0.75)',
            'rgba(236, 72, 153, 0.75)'
          ],
          borderColor: [
            '#3b82f6',
            '#f97316',
            '#a855f7',
            '#10b981',
            '#ec4899'
          ],
          borderWidth: 1.5,
          borderRadius: 8
        },
        {
          label: 'Target Goal (mins)',
          data: goalsData,
          backgroundColor: 'rgba(75, 85, 99, 0.35)',
          borderColor: '#6b7280',
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9ca3af', font: { size: 11 } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#1f2937' },
          ticks: { color: '#9ca3af', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 11, weight: 'bold' } }
        }
      }
    }
  });
}

// 13. Data Export & Import
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `transmute_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.pillars && parsed.cleanStreakStart !== undefined) {
        appState = parsed;
        saveState();
        updateUI();
        alert("Backup imported successfully!");
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Error parsing JSON backup.");
    }
  };
  reader.readAsText(file);
}
