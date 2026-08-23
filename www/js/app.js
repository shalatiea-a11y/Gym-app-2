import { DB } from './db.js';
import { defaultProgram, defaultSettings, WEEK_PERCENTS } from './defaults.js';
import { roundToIncrement, workingWeight, estimate1RM, parseRepTarget, totalVolume, suggestIncrease, checkExceededTarget, computeStreak, isoWeekKey, monthKey } from './calc.js';
import { BADGES, evaluateAchievements } from './achievements.js';
import { drawLineChart, drawBarChart } from './charts.js';

const APP = document.getElementById('app');

const STATE = {
  settings: null,
  program: null,
  screen: 'today',
  draftWorkout: null,
  celebrationQueue: [],
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fmt1 = (n) => (Math.round(n * 10) / 10).toString();
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------- Boot ----------

async function boot() {
  let settings = await DB.get('settings', 'settings');
  let program = await DB.get('program', 'program');
  if (!settings) { settings = defaultSettings(); await DB.put('settings', settings); }
  if (!program) { program = defaultProgram(); await DB.put('program', program); }
  STATE.settings = settings;
  STATE.program = program;

  const workouts = await DB.getAll('workouts');
  STATE.draftWorkout = workouts.find((w) => !w.completedAt) || null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  render();
}

async function saveSettings() {
  await DB.put('settings', STATE.settings);
}
async function saveProgram() {
  await DB.put('program', STATE.program);
}

function currentDay() {
  const idx = STATE.settings.currentDayIndex ?? 0;
  return STATE.program.days[idx];
}
function currentWeekInfo() {
  const wk = STATE.settings.currentWeek || 1;
  return STATE.settings.weekPercents.find((w) => w.week === wk) || STATE.settings.weekPercents[0];
}
function allExercises() {
  const list = [];
  for (const day of STATE.program.days) {
    for (const block of day.blocks) {
      for (const exercise of block.exercises) list.push({ ...exercise, dayId: day.id, category: block.category });
    }
  }
  return list;
}
function findExerciseDef(exerciseId) {
  return allExercises().find((e) => e.id === exerciseId);
}

// ---------- Render shell ----------

function render() {
  if (!STATE.settings.onboardingComplete) {
    APP.innerHTML = '';
    APP.appendChild(renderOnboarding());
    return;
  }
  APP.innerHTML = '';
  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = titleForScreen();
  APP.appendChild(topbar);

  const screenEl = document.createElement('div');
  screenEl.className = 'screen';
  screenEl.id = 'screen';
  APP.appendChild(screenEl);
  renderScreenBody(screenEl);

  const nav = document.createElement('div');
  nav.className = 'bottom-nav';
  nav.innerHTML = [
    ['today', '🏋️', 'Today'],
    ['program', '📋', 'Program'],
    ['progress', '📊', 'Progress'],
    ['recovery', '🌙', 'Recovery'],
    ['settings', '⚙️', 'Settings'],
  ].map(([key, ic, label]) => `
    <button class="nav-btn ${STATE.screen === key ? 'active' : ''}" data-nav="${key}">
      <span class="ic">${ic}</span><span>${label}</span>
    </button>`).join('');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;
    STATE.screen = btn.dataset.nav;
    render();
  });
  APP.appendChild(nav);
}

function titleForScreen() {
  const map = {
    today: ['IronLog', `Block ${STATE.settings.blockNumber} · Week ${STATE.settings.currentWeek || 1} of 8`],
    program: ['Program', 'Everything here is editable'],
    progress: ['Progress', 'Your trends & trophies'],
    recovery: ['Recovery', 'Sleep, mood, body & fuel'],
    settings: ['Settings', 'App preferences & backup'],
  };
  const [t, s] = map[STATE.screen];
  return `<div><h1>${t}</h1><div class="sub">${s}</div></div>`;
}

function renderScreenBody(container) {
  if (STATE.screen === 'today') return renderToday(container);
  if (STATE.screen === 'program') return renderProgram(container);
  if (STATE.screen === 'progress') return renderProgress(container);
  if (STATE.screen === 'recovery') return renderRecovery(container);
  if (STATE.screen === 'settings') return renderSettings(container);
}

// ---------- Onboarding ----------

function renderOnboarding() {
  const wrap = document.createElement('div');
  wrap.className = 'onboarding-wrap';
  const s = STATE.settings;
  wrap.innerHTML = `
    <h1>Welcome to IronLog</h1>
    <div class="sub">Set your starting numbers. You can change all of this later.</div>

    <div class="card">
      <div class="card-title">Current 1RM</div>
      <label>Bench Press (kg)</label>
      <input type="number" id="ob-bench" value="${s.oneRM.bench}">
      <label>Squat (kg)</label>
      <input type="number" id="ob-squat" value="${s.oneRM.squat}">
      <label>Deadlift (kg)</label>
      <input type="number" id="ob-deadlift" value="${s.oneRM.deadlift}">
    </div>

    <div class="card">
      <div class="card-title">Start Point</div>
      <label>Starting Week (1-8, week 8 is deload)</label>
      <select id="ob-week">
        ${s.weekPercents.map((w) => `<option value="${w.week}">Week ${w.week}${w.isDeload ? ' (Deload)' : ''} — ${w.percent}%</option>`).join('')}
      </select>
      <label>Starting Day</label>
      <select id="ob-day">
        ${STATE.program.days.map((d, i) => `<option value="${i}">Day ${i + 1} — ${d.name}</option>`).join('')}
      </select>
    </div>

    <div class="card">
      <div class="card-title">Weight Increments</div>
      <div class="row">
        <div><label>Upper body +kg</label><input type="number" step="0.5" id="ob-inc-upper" value="${s.weightIncrements.upper}"></div>
        <div><label>Lower body +kg</label><input type="number" step="0.5" id="ob-inc-lower" value="${s.weightIncrements.lower}"></div>
      </div>
      <label>Round calculated weights to nearest</label>
      <select id="ob-round">
        <option value="2.5" selected>2.5 kg</option>
        <option value="1">1 kg</option>
        <option value="5">5 kg</option>
      </select>
    </div>

    <button class="btn block" id="ob-start" style="margin-top:10px;">Start Training</button>
  `;
  wrap.querySelector('#ob-start').addEventListener('click', async () => {
    s.oneRM.bench = parseFloat(wrap.querySelector('#ob-bench').value) || s.oneRM.bench;
    s.oneRM.squat = parseFloat(wrap.querySelector('#ob-squat').value) || s.oneRM.squat;
    s.oneRM.deadlift = parseFloat(wrap.querySelector('#ob-deadlift').value) || s.oneRM.deadlift;
    s.currentWeek = parseInt(wrap.querySelector('#ob-week').value, 10);
    s.currentDayIndex = parseInt(wrap.querySelector('#ob-day').value, 10);
    s.weightIncrements.upper = parseFloat(wrap.querySelector('#ob-inc-upper').value) || s.weightIncrements.upper;
    s.weightIncrements.lower = parseFloat(wrap.querySelector('#ob-inc-lower').value) || s.weightIncrements.lower;
    s.roundingIncrement = parseFloat(wrap.querySelector('#ob-round').value) || 2.5;
    s.onboardingComplete = true;
    await saveSettings();
    render();
  });
  return wrap;
}

// ---------- Workout weight/target computation ----------

function computeTarget(exerciseDef) {
  if (!exerciseDef.percentSource) return { weight: null, percent: null };
  const oneRM = STATE.settings.oneRM[exerciseDef.percentSource];
  let percent;
  if (exerciseDef.percentMode === 'fixed') percent = exerciseDef.fixedPercent;
  else percent = currentWeekInfo().percent;
  const weight = workingWeight(oneRM, percent, STATE.settings.roundingIncrement);
  return { weight, percent };
}

async function findPrevious(exerciseId, excludeWorkoutId) {
  const workouts = await DB.getAll('workouts');
  const sorted = workouts
    .filter((w) => w.completedAt && w.id !== excludeWorkoutId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  for (const w of sorted) {
    const inst = w.exercises && w.exercises.find((e) => e.exerciseId === exerciseId);
    if (inst) {
      const doneSets = inst.sets.filter((s) => s.done);
      if (doneSets.length) {
        const top = doneSets.reduce((a, b) => (b.weight > a.weight ? b : a));
        return { date: w.completedAt, weight: top.weight, reps: top.actualReps };
      }
    }
  }
  return null;
}

async function buildWorkout(dayIndex) {
  const day = STATE.program.days[dayIndex];
  const weekInfo = currentWeekInfo();
  const exercises = [];
  for (const block of day.blocks) {
    for (const def of block.exercises) {
      const { weight, percent } = computeTarget(def);
      const prev = await findPrevious(def.id, null);
      const setCount = def.sets;
      const sets = [];
      for (let i = 0; i < setCount; i++) {
        const targetReps = def.repsScheme ? def.repsScheme[i] : parseRepTarget(def.reps).max;
        sets.push({
          targetReps,
          weight: weight != null ? weight : (prev ? prev.weight : null),
          actualReps: null,
          done: false,
        });
      }
      exercises.push({
        exerciseId: def.id,
        name: def.name,
        category: block.category,
        region: def.region,
        isMainLift: def.isMainLift,
        percentSource: def.percentSource,
        percentMode: def.percentMode,
        percent,
        targetWeight: weight,
        repsDisplay: def.reps,
        notes: def.notes || '',
        sessionNote: '',
        previous: prev,
        sets,
        suggestion: null,
      });
    }
  }
  return {
    id: uid(),
    dayId: day.id,
    dayName: day.name,
    dayIndex,
    weekNumber: STATE.settings.currentWeek || 1,
    isDeload: !!weekInfo.isDeload,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSec: 0,
    exercises,
  };
}

async function persistDraft() {
  if (STATE.draftWorkout) await DB.put('workouts', STATE.draftWorkout);
}

// ---------- Today screen ----------

function liftKeyFor(def) {
  return def.percentSource || def.exerciseId || def.id;
}

async function renderToday(container) {
  const w = STATE.draftWorkout;
  if (!w) {
    const dayIdx = STATE.settings.currentDayIndex ?? 0;
    const day = STATE.program.days[dayIdx];
    const weekInfo = currentWeekInfo();
    container.innerHTML = `
      ${weekInfo.isDeload ? `<div class="deload-banner">⚠ DELOAD WEEK — RECOVERY &amp; TECHNIQUE</div>` : ''}
      <div class="card">
        <div class="card-title">Next Up</div>
        <div class="exercise-name" style="font-size:20px;">Day ${dayIdx + 1} — ${day.name}</div>
        <div class="exercise-meta" style="margin:8px 0 14px;">
          ${day.blocks.flatMap((b) => b.exercises.map((e) => e.name)).join(' · ')}
        </div>
        <button class="btn block" id="start-workout">Start Workout</button>
      </div>
    `;
    container.querySelector('#start-workout').addEventListener('click', async () => {
      STATE.draftWorkout = await buildWorkout(dayIdx);
      await persistDraft();
      render();
    });
    return;
  }

  container.innerHTML = `
    ${w.isDeload ? `<div class="deload-banner">⚠ DELOAD WEEK — RECOVERY &amp; TECHNIQUE</div>` : ''}
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div class="exercise-name">Day ${w.dayIndex + 1} — ${w.dayName}</div>
        <div class="exercise-meta">Week ${w.weekNumber} of 8</div>
      </div>
      <button class="btn success small" id="finish-workout">Finish</button>
    </div>
    <div id="exercise-list"></div>
  `;
  const list = container.querySelector('#exercise-list');
  w.exercises.forEach((inst, idx) => list.appendChild(renderExerciseCard(inst, idx)));

  container.querySelector('#finish-workout').addEventListener('click', finishWorkout);
}

function renderExerciseCard(inst, exIdx) {
  const card = document.createElement('div');
  card.className = 'card exercise-card';
  const vol = totalVolume(inst.sets.filter((s) => s.done).map((s) => ({ weight: s.weight, actualReps: s.actualReps })));
  const targetLine = inst.targetWeight != null
    ? `Working weight: <strong>${fmt1(inst.targetWeight)} kg</strong> (${inst.percentMode === 'fixed' ? 'fixed' : 'week'} ${inst.percent}% of ${fmt1(STATE.settings.oneRM[inst.percentSource])} kg)`
    : `Target: ${inst.repsDisplay} reps — enter your own weight`;

  card.innerHTML = `
    <div class="exercise-cat">${inst.category}</div>
    <div class="exercise-head">
      <div>
        <div class="exercise-name">${inst.name}${inst.isMainLift ? ' <span class="badge-pill">MAIN LIFT</span>' : ''}</div>
        <div class="exercise-meta">${targetLine}</div>
        ${inst.notes ? `<div class="prev-line">📝 ${escapeHtml(inst.notes)}</div>` : ''}
      </div>
    </div>
    ${inst.previous ? `<div class="prev-line">Previous: ${fmt1(inst.previous.weight)} kg × ${inst.previous.reps} reps</div>` : ''}
    <div class="sets-wrap" data-ex="${exIdx}">
      ${inst.sets.map((s, si) => renderSetRow(s, si)).join('')}
    </div>
    <div class="prev-line" style="margin-top:8px;">Total volume: <strong>${fmt1(vol)} kg</strong></div>
    ${inst.suggestion ? `<div class="suggestion-banner">💡 ${inst.suggestion}</div>` : ''}
    <div class="photo-zone" data-ex="${exIdx}"></div>
    <label style="margin-top:10px;">Session note</label>
    <textarea rows="1" data-ex="${exIdx}" class="session-note" placeholder="Optional note for this set...">${escapeHtml(inst.sessionNote || '')}</textarea>
  `;

  renderPhotoZone(card.querySelector('.photo-zone'), inst.exerciseId);

  card.querySelector('.sets-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('.set-check');
    if (!btn) return;
    const si = parseInt(btn.dataset.set, 10);
    onToggleSet(exIdx, si, card, inst);
  });
  card.querySelectorAll('.set-row input[data-field]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const si = parseInt(inp.dataset.set, 10);
      const field = inp.dataset.field;
      const val = parseFloat(inp.value);
      inst.sets[si][field] = isNaN(val) ? null : val;
      persistDraft();
    });
  });
  card.querySelector('.session-note').addEventListener('change', (e) => {
    inst.sessionNote = e.target.value;
    persistDraft();
  });

  return card;
}

function renderSetRow(s, si) {
  return `
    <div class="set-row">
      <div class="set-num">${si + 1}</div>
      <input type="number" step="0.5" placeholder="kg" data-field="weight" data-set="${si}" value="${s.weight ?? ''}">
      <input type="number" placeholder="reps (target ${s.targetReps})" data-field="actualReps" data-set="${si}" value="${s.actualReps ?? ''}">
      <button class="set-check ${s.done ? 'done' : ''}" data-set="${si}">${s.done ? '✓' : ''}</button>
    </div>
  `;
}

async function onToggleSet(exIdx, si, cardEl, inst) {
  const set = inst.sets[si];
  set.done = !set.done;
  if (set.done && (set.actualReps == null || set.weight == null)) {
    toast('⚠️', 'Missing data', 'Enter weight and reps before checking off a set.');
    set.done = false;
    return;
  }
  await persistDraft();

  if (set.done) {
    checkMiniPr(inst);
    const exceeded = checkExceededTarget(set.targetReps, set.actualReps);
    const isLastSet = si === inst.sets.length - 1;
    if (exceeded && isLastSet) {
      const inc = suggestIncrease(inst.region, STATE.settings.weightIncrements);
      inst.suggestion = `Great job! You exceeded the target by ${exceeded.exceededBy} rep${exceeded.exceededBy > 1 ? 's' : ''}. This weight may be too light. Consider +${inc} kg next time.`;
      await persistDraft();
    }
    openRestTimer();
  }
  render();
}

function checkMiniPr(inst) {
  const key = liftKeyFor(inst);
  const hist = STATE.settings.prHistory[key] || { maxWeight: 0, maxReps: 0, best1RM: 0, maxVolume: 0 };
  const doneSets = inst.sets.filter((s) => s.done);
  const vol = totalVolume(doneSets.map((s) => ({ weight: s.weight, actualReps: s.actualReps })));
  const lastSet = doneSets[doneSets.length - 1];
  const est1rm = estimate1RM(lastSet.weight, lastSet.actualReps);

  let hit = null;
  if (lastSet.weight > hist.maxWeight) hit = 'weight';
  else if (est1rm > hist.best1RM) hit = '1rm';
  else if (vol > hist.maxVolume) hit = 'volume';

  hist.maxWeight = Math.max(hist.maxWeight, lastSet.weight);
  hist.maxReps = Math.max(hist.maxReps, lastSet.actualReps);
  hist.best1RM = Math.max(hist.best1RM, est1rm);
  hist.maxVolume = Math.max(hist.maxVolume, vol);
  STATE.settings.prHistory[key] = hist;
  saveSettings();

  if (hit) {
    inst._prEventsThisSession = inst._prEventsThisSession || [];
    inst._prEventsThisSession.push({ liftKey: key, type: hit, value: lastSet.weight });
    toast('🔥', 'New PR!', `${inst.name}: new ${hit === '1rm' ? 'estimated 1RM' : hit} PR.`);
  }
}

function renderPhotoZone(container, exerciseId) {
  container.innerHTML = `<div class="photo-row">
    <button class="btn secondary small" data-photo-action="capture">📷 Photo</button>
    <button class="btn secondary small" data-photo-action="view" style="display:none;">👁 View</button>
    <button class="btn secondary small" data-photo-action="delete" style="display:none;">🗑 Delete</button>
  </div>`;
  DB.get('photos', exerciseId).then((rec) => {
    if (rec) {
      container.querySelector('[data-photo-action="capture"]').textContent = '📷 Replace';
      container.querySelector('[data-photo-action="view"]').style.display = '';
      container.querySelector('[data-photo-action="delete"]').style.display = '';
    }
  });
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-photo-action]');
    if (!btn) return;
    const action = btn.dataset.photoAction;
    if (action === 'capture') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        await DB.put('photos', { exerciseId, blob: file, savedAt: new Date().toISOString() });
        toast('📷', 'Photo saved', 'Machine photo attached to this exercise.');
        renderPhotoZone(container, exerciseId);
      };
      input.click();
    } else if (action === 'view') {
      const rec = await DB.get('photos', exerciseId);
      if (rec) openPhotoViewer(rec.blob);
    } else if (action === 'delete') {
      await DB.delete('photos', exerciseId);
      renderPhotoZone(container, exerciseId);
    }
  });
}

function openPhotoViewer(blob) {
  const url = URL.createObjectURL(blob);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop center';
  backdrop.innerHTML = `<div class="modal-sheet card-modal" style="padding:8px;"><img src="${url}" style="width:100%;border-radius:14px;display:block;"><button class="btn block secondary" style="margin-top:10px;">Close</button></div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.tagName === 'BUTTON') {
      backdrop.remove();
      URL.revokeObjectURL(url);
    }
  });
  document.body.appendChild(backdrop);
}

// ---------- Rest timer ----------

function openRestTimer() {
  const seconds = STATE.settings.restSeconds || 300;
  let remaining = seconds;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop center';
  backdrop.innerHTML = `
    <div class="modal-sheet card-modal">
      <div class="modal-title" style="text-align:center;">Rest Timer</div>
      <div class="timer-ring">
        <div class="timer-display" id="timer-display">${formatTime(remaining)}</div>
      </div>
      <div class="row">
        <button class="btn secondary" id="timer-minus">−30s</button>
        <button class="btn secondary" id="timer-plus">+30s</button>
      </div>
      <button class="btn block" id="timer-skip" style="margin-top:10px;">Skip / Close</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  const display = backdrop.querySelector('#timer-display');
  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      display.textContent = "Time's up!";
      clearInterval(interval);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(() => backdrop.remove(), 1200);
      return;
    }
    display.textContent = formatTime(remaining);
  }, 1000);
  backdrop.querySelector('#timer-minus').addEventListener('click', () => { remaining = Math.max(0, remaining - 30); display.textContent = formatTime(remaining); });
  backdrop.querySelector('#timer-plus').addEventListener('click', () => { remaining += 30; display.textContent = formatTime(remaining); });
  backdrop.querySelector('#timer-skip').addEventListener('click', () => { clearInterval(interval); backdrop.remove(); });
}
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- Finish workout ----------

async function finishWorkout() {
  const w = STATE.draftWorkout;
  const anyDone = w.exercises.some((e) => e.sets.some((s) => s.done));
  if (!anyDone) {
    toast('⚠️', 'No sets logged', 'Log at least one set before finishing.');
    return;
  }
  w.completedAt = new Date().toISOString();
  w.durationSec = Math.round((new Date(w.completedAt) - new Date(w.startedAt)) / 1000);

  let liftPrEvents = [];
  w.exercises.forEach((inst) => {
    if (inst._prEventsThisSession) liftPrEvents = liftPrEvents.concat(inst._prEventsThisSession);
    delete inst._prEventsThisSession;
  });

  await DB.put('workouts', w);

  const allWorkouts = await DB.getAll('workouts');
  const completed = allWorkouts.filter((x) => x.completedAt);
  const streak = computeStreak(completed.map((x) => x.completedAt));

  const alreadyUnlocked = new Set((await DB.getAll('achievements')).map((a) => a.id));
  const newBadges = evaluateAchievements({
    totalWorkouts: completed.length,
    alreadyUnlocked,
    liftPrEvents,
    streak,
  });
  for (const b of newBadges) {
    await DB.put('achievements', { id: b.id, unlockedAt: new Date().toISOString() });
  }

  // Rotate to next day
  STATE.settings.currentDayIndex = (STATE.settings.currentDayIndex + 1) % STATE.program.days.length;
  const justFinishedLastDay = STATE.settings.currentDayIndex === 0;
  await saveSettings();

  STATE.draftWorkout = null;

  STATE.celebrationQueue = newBadges.slice();
  render();
  runCelebrationQueue();

  if (justFinishedLastDay) {
    setTimeout(() => promptWeekAdvance(), newBadges.length ? 400 * (newBadges.length + 1) : 300);
  }
}

function promptWeekAdvance() {
  const wk = STATE.settings.currentWeek || 1;
  const info = currentWeekInfo();
  if (info.isDeload) {
    openStartNewBlockModal();
    return;
  }
  const nextWeek = Math.min(8, wk + 1);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop center';
  backdrop.innerHTML = `
    <div class="modal-sheet card-modal">
      <div class="modal-title">Cycle Complete 🎉</div>
      <div class="exercise-meta" style="margin-bottom:16px;">You finished all 5 training days. Move on to Week ${nextWeek}?</div>
      <button class="btn block" id="wk-yes">Yes, start Week ${nextWeek}</button>
      <button class="btn block secondary" id="wk-no" style="margin-top:8px;">Stay on Week ${wk}</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#wk-yes').addEventListener('click', async () => {
    STATE.settings.currentWeek = nextWeek;
    await saveSettings();
    backdrop.remove();
    render();
  });
  backdrop.querySelector('#wk-no').addEventListener('click', () => backdrop.remove());
}

// ---------- Celebrations & confetti ----------

function runCelebrationQueue() {
  if (!STATE.celebrationQueue.length) return;
  const badge = STATE.celebrationQueue.shift();
  showCelebration(badge, () => runCelebrationQueue());
}

function showCelebration(badge, onClose) {
  spawnConfetti();
  const el = document.createElement('div');
  el.className = 'celebration';
  el.innerHTML = `
    <div class="celebration-card">
      <div class="celebration-icon">${badge.icon}</div>
      <div class="celebration-title">${badge.title}</div>
      <div class="celebration-desc">${badge.desc}</div>
      <button class="btn">Nice!</button>
    </div>
  `;
  el.querySelector('button').addEventListener('click', () => { el.remove(); if (onClose) onClose(); });
  document.body.appendChild(el);
  if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 160]);
}

function spawnConfetti() {
  const colors = ['#4f8cff', '#8b6bff', '#22e584', '#ffd60a', '#ff5470'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    piece.style.animationDelay = Math.random() * 0.3 + 's';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

function toast(icon, title, desc) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="ic">${icon}</div><div><div class="t">${title}</div><div class="d">${desc}</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2600);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- Program screen ----------

function renderProgram(container) {
  const s = STATE.settings;
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Current 1RM</div>
      <div class="row">
        <div><label>Bench</label><input type="number" id="rm-bench" value="${s.oneRM.bench}"></div>
        <div><label>Squat</label><input type="number" id="rm-squat" value="${s.oneRM.squat}"></div>
        <div><label>Deadlift</label><input type="number" id="rm-deadlift" value="${s.oneRM.deadlift}"></div>
      </div>
      <button class="btn block secondary" id="save-1rm" style="margin-top:12px;">Save 1RM Values</button>
      <button class="btn block" id="start-block" style="margin-top:8px;">Start New Block (new PRs)</button>
    </div>

    <div class="card">
      <div class="card-title">Block Position</div>
      <div class="row">
        <div><label>Block #</label><input type="number" id="pos-block" value="${s.blockNumber}"></div>
        <div><label>Week</label>
          <select id="pos-week">${s.weekPercents.map((w) => `<option value="${w.week}" ${w.week === s.currentWeek ? 'selected' : ''}>Week ${w.week}${w.isDeload ? ' (Deload)' : ''}</option>`).join('')}</select>
        </div>
        <div><label>Next Day</label>
          <select id="pos-day">${STATE.program.days.map((d, i) => `<option value="${i}" ${i === s.currentDayIndex ? 'selected' : ''}>Day ${i + 1} ${d.name}</option>`).join('')}</select>
        </div>
      </div>
      <button class="btn block secondary" id="save-pos" style="margin-top:12px;">Save Position</button>
    </div>

    <div class="card">
      <div class="card-title">8-Week Percentage Schedule</div>
      <div id="week-table"></div>
    </div>

    <div class="card">
      <div class="card-title">Weight Increment Suggestions</div>
      <div class="row">
        <div><label>Upper body +kg</label><input type="number" step="0.5" id="inc-upper" value="${s.weightIncrements.upper}"></div>
        <div><label>Lower body +kg</label><input type="number" step="0.5" id="inc-lower" value="${s.weightIncrements.lower}"></div>
      </div>
      <label>Round calculated weights to nearest</label>
      <select id="round-inc">
        <option value="1" ${s.roundingIncrement === 1 ? 'selected' : ''}>1 kg</option>
        <option value="2.5" ${s.roundingIncrement === 2.5 ? 'selected' : ''}>2.5 kg</option>
        <option value="5" ${s.roundingIncrement === 5 ? 'selected' : ''}>5 kg</option>
      </select>
      <button class="btn block secondary" id="save-inc" style="margin-top:12px;">Save Increments</button>
    </div>

    <div id="days-editor"></div>
    <button class="btn block secondary" id="add-day">+ Add Training Day</button>
  `;

  renderWeekTable(container.querySelector('#week-table'));
  renderDaysEditor(container.querySelector('#days-editor'));

  container.querySelector('#save-1rm').addEventListener('click', async () => {
    s.oneRM.bench = parseFloat(container.querySelector('#rm-bench').value) || s.oneRM.bench;
    s.oneRM.squat = parseFloat(container.querySelector('#rm-squat').value) || s.oneRM.squat;
    s.oneRM.deadlift = parseFloat(container.querySelector('#rm-deadlift').value) || s.oneRM.deadlift;
    await saveSettings();
    toast('✅', 'Saved', '1RM values updated.');
  });
  container.querySelector('#start-block').addEventListener('click', openStartNewBlockModal);
  container.querySelector('#save-pos').addEventListener('click', async () => {
    s.blockNumber = parseInt(container.querySelector('#pos-block').value, 10) || s.blockNumber;
    s.currentWeek = parseInt(container.querySelector('#pos-week').value, 10);
    s.currentDayIndex = parseInt(container.querySelector('#pos-day').value, 10);
    await saveSettings();
    toast('✅', 'Saved', 'Block position updated.');
    render();
  });
  container.querySelector('#save-inc').addEventListener('click', async () => {
    s.weightIncrements.upper = parseFloat(container.querySelector('#inc-upper').value) || s.weightIncrements.upper;
    s.weightIncrements.lower = parseFloat(container.querySelector('#inc-lower').value) || s.weightIncrements.lower;
    s.roundingIncrement = parseFloat(container.querySelector('#round-inc').value) || 2.5;
    await saveSettings();
    toast('✅', 'Saved', 'Increments updated.');
  });
  container.querySelector('#add-day').addEventListener('click', async () => {
    STATE.program.days.push({ id: uid(), name: `Day ${STATE.program.days.length + 1}`, blocks: [{ category: 'New Block', exercises: [] }] });
    await saveProgram();
    render();
  });
}

function renderWeekTable(container) {
  container.innerHTML = STATE.settings.weekPercents.map((w, i) => `
    <div class="row" style="align-items:center;margin-bottom:6px;">
      <div style="flex:0 0 60px;font-weight:700;font-size:13px;">Wk ${w.week}</div>
      <input type="number" step="0.5" data-wk="${i}" data-field="percent" value="${w.percent}">
      <label class="switch" style="flex:0 0 90px;margin:0;padding:0;font-size:11px;">
        Deload <input type="checkbox" data-wk="${i}" data-field="isDeload" ${w.isDeload ? 'checked' : ''}>
      </label>
    </div>
  `).join('');
  container.addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-wk]');
    if (!inp) return;
    const i = parseInt(inp.dataset.wk, 10);
    if (inp.dataset.field === 'percent') STATE.settings.weekPercents[i].percent = parseFloat(inp.value) || 0;
    else STATE.settings.weekPercents[i].isDeload = inp.checked;
    await saveSettings();
  });
}

function renderDaysEditor(container) {
  container.innerHTML = '';
  STATE.program.days.forEach((day, dIdx) => {
    const dayCard = document.createElement('div');
    dayCard.className = 'card';
    dayCard.innerHTML = `
      <div class="row" style="align-items:center;">
        <input type="text" value="${escapeHtml(day.name)}" data-day="${dIdx}" class="day-name-input" style="font-weight:800;">
        <button class="btn danger small" data-del-day="${dIdx}" style="flex:0 0 auto;">Delete Day</button>
      </div>
      <div class="blocks-wrap" data-day="${dIdx}"></div>
      <button class="btn secondary small" data-add-block="${dIdx}" style="margin-top:8px;">+ Add Category</button>
    `;
    const blocksWrap = dayCard.querySelector('.blocks-wrap');
    day.blocks.forEach((block, bIdx) => blocksWrap.appendChild(renderBlockEditor(day, dIdx, block, bIdx)));

    dayCard.querySelector('.day-name-input').addEventListener('change', async (e) => {
      day.name = e.target.value;
      await saveProgram();
    });
    dayCard.querySelector('[data-del-day]').addEventListener('click', async () => {
      if (!confirm(`Delete "${day.name}" and all its exercises?`)) return;
      STATE.program.days.splice(dIdx, 1);
      if (STATE.settings.currentDayIndex >= STATE.program.days.length) STATE.settings.currentDayIndex = 0;
      await saveProgram();
      await saveSettings();
      render();
    });
    dayCard.querySelector('[data-add-block]').addEventListener('click', async () => {
      day.blocks.push({ category: 'New Category', exercises: [] });
      await saveProgram();
      render();
    });
    container.appendChild(dayCard);
  });
}

function renderBlockEditor(day, dIdx, block, bIdx) {
  const wrap = document.createElement('div');
  wrap.style.marginTop = '12px';
  wrap.innerHTML = `
    <hr class="sep">
    <div class="row" style="align-items:center;">
      <input type="text" value="${escapeHtml(block.category)}" class="block-name-input" style="font-size:13px;font-weight:700;">
      <button class="btn secondary small" data-del-block style="flex:0 0 auto;">✕</button>
    </div>
    <div class="ex-list"></div>
    <button class="btn secondary small" data-add-ex style="margin-top:6px;">+ Add Exercise</button>
  `;
  const exList = wrap.querySelector('.ex-list');
  block.exercises.forEach((ex, eIdx) => exList.appendChild(renderExerciseEditor(block, ex, eIdx)));

  wrap.querySelector('.block-name-input').addEventListener('change', async (e) => {
    block.category = e.target.value;
    await saveProgram();
  });
  wrap.querySelector('[data-del-block]').addEventListener('click', async () => {
    if (!confirm(`Delete category "${block.category}"?`)) return;
    day.blocks.splice(bIdx, 1);
    await saveProgram();
    render();
  });
  wrap.querySelector('[data-add-ex]').addEventListener('click', async () => {
    block.exercises.push({ id: uid(), name: 'New Exercise', category: block.category, sets: 3, reps: '10', region: 'upper', isMainLift: false, percentSource: null, percentMode: null, fixedPercent: null, weightIncrement: null, notes: '' });
    await saveProgram();
    render();
  });
  return wrap;
}

function renderExerciseEditor(block, ex, eIdx) {
  const row = document.createElement('div');
  row.style.cssText = 'background:var(--bg-elev-2);border:1px solid var(--border);border-radius:12px;padding:10px;margin-top:8px;';
  row.innerHTML = `
    <div class="row">
      <input type="text" value="${escapeHtml(ex.name)}" data-f="name" placeholder="Exercise name">
      <button class="btn danger small" data-del style="flex:0 0 auto;">✕</button>
    </div>
    <div class="row" style="margin-top:6px;">
      <div><label>Sets</label><input type="number" data-f="sets" value="${ex.sets}"></div>
      <div><label>Reps</label><input type="text" data-f="reps" value="${ex.reps}" placeholder="e.g. 8-10"></div>
      <div><label>Region</label>
        <select data-f="region">
          <option value="upper" ${ex.region === 'upper' ? 'selected' : ''}>Upper</option>
          <option value="lower" ${ex.region === 'lower' ? 'selected' : ''}>Lower</option>
        </select>
      </div>
    </div>
    <label class="switch"><span>Main lift (% of 1RM)</span><input type="checkbox" data-f="isMainLift" ${ex.isMainLift ? 'checked' : ''}></label>
    <div class="pct-fields" style="${ex.isMainLift ? '' : 'display:none;'}">
      <div class="row">
        <div><label>Based on</label>
          <select data-f="percentSource">
            <option value="bench" ${ex.percentSource === 'bench' ? 'selected' : ''}>Bench</option>
            <option value="squat" ${ex.percentSource === 'squat' ? 'selected' : ''}>Squat</option>
            <option value="deadlift" ${ex.percentSource === 'deadlift' ? 'selected' : ''}>Deadlift</option>
          </select>
        </div>
        <div><label>Mode</label>
          <select data-f="percentMode">
            <option value="weekly" ${ex.percentMode === 'weekly' ? 'selected' : ''}>Weekly %</option>
            <option value="fixed" ${ex.percentMode === 'fixed' ? 'selected' : ''}>Fixed %</option>
          </select>
        </div>
        <div class="fixed-pct-field" style="${ex.percentMode === 'fixed' ? '' : 'display:none;'}">
          <label>Fixed %</label><input type="number" step="0.5" data-f="fixedPercent" value="${ex.fixedPercent ?? ''}">
        </div>
      </div>
    </div>
    <label>Notes (e.g. machine settings)</label>
    <textarea rows="1" data-f="notes">${escapeHtml(ex.notes || '')}</textarea>
  `;

  row.querySelectorAll('[data-f]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const f = inp.dataset.f;
      if (f === 'isMainLift') {
        ex.isMainLift = inp.checked;
        row.querySelector('.pct-fields').style.display = ex.isMainLift ? '' : 'none';
        if (ex.isMainLift && !ex.percentSource) ex.percentSource = 'bench';
        if (ex.isMainLift && !ex.percentMode) ex.percentMode = 'weekly';
      } else if (f === 'percentMode') {
        ex.percentMode = inp.value;
        row.querySelector('.fixed-pct-field').style.display = ex.percentMode === 'fixed' ? '' : 'none';
      } else if (f === 'sets') {
        ex.sets = parseInt(inp.value, 10) || 1;
      } else if (f === 'fixedPercent') {
        ex.fixedPercent = parseFloat(inp.value) || 0;
      } else {
        ex[f] = inp.value;
      }
      await saveProgram();
    });
  });
  row.querySelector('[data-del]').addEventListener('click', async () => {
    if (!confirm(`Delete "${ex.name}"?`)) return;
    block.exercises.splice(eIdx, 1);
    await saveProgram();
    render();
  });
  return row;
}

function openStartNewBlockModal() {
  const s = STATE.settings;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop center';
  backdrop.innerHTML = `
    <div class="modal-sheet card-modal">
      <div class="modal-title">Start New Block</div>
      <div class="exercise-meta" style="margin-bottom:10px;">Enter your new 1RM / PR values. This resets you to Week 1.</div>
      <label>Bench</label><input type="number" id="nb-bench" value="${s.oneRM.bench}">
      <label>Squat</label><input type="number" id="nb-squat" value="${s.oneRM.squat}">
      <label>Deadlift</label><input type="number" id="nb-deadlift" value="${s.oneRM.deadlift}">
      <button class="btn block" id="nb-confirm" style="margin-top:14px;">Start Block ${s.blockNumber + 1}</button>
      <button class="btn block secondary" id="nb-cancel" style="margin-top:8px;">Cancel</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#nb-confirm').addEventListener('click', async () => {
    s.oneRM.bench = parseFloat(backdrop.querySelector('#nb-bench').value) || s.oneRM.bench;
    s.oneRM.squat = parseFloat(backdrop.querySelector('#nb-squat').value) || s.oneRM.squat;
    s.oneRM.deadlift = parseFloat(backdrop.querySelector('#nb-deadlift').value) || s.oneRM.deadlift;
    s.currentWeek = 1;
    s.blockNumber += 1;
    await saveSettings();
    backdrop.remove();
    toast('🚀', 'New block started', `Block ${s.blockNumber}, Week 1.`);
    render();
  });
  backdrop.querySelector('#nb-cancel').addEventListener('click', () => backdrop.remove());
}

// ---------- Progress screen ----------

async function renderProgress(container) {
  const workouts = (await DB.getAll('workouts')).filter((w) => w.completedAt).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const recovery = (await DB.getAll('recovery')).sort((a, b) => new Date(a.date) - new Date(b.date));
  const achievementsUnlocked = await DB.getAll('achievements');
  const unlockedIds = new Set(achievementsUnlocked.map((a) => a.id));

  container.innerHTML = `
    <div class="card">
      <div class="card-title">Trophy Case</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${BADGES.map((b) => `
          <div style="text-align:center;width:64px;opacity:${unlockedIds.has(b.id) ? '1' : '0.25'};">
            <div style="font-size:26px;">${b.icon}</div>
            <div style="font-size:9px;color:var(--text-dim);margin-top:2px;">${b.title}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Estimated 1RM — Bench</div>
      <canvas class="chart" id="chart-bench"></canvas>
    </div>
    <div class="card">
      <div class="card-title">Estimated 1RM — Squat</div>
      <canvas class="chart" id="chart-squat"></canvas>
    </div>
    <div class="card">
      <div class="card-title">Estimated 1RM — Deadlift</div>
      <canvas class="chart" id="chart-deadlift"></canvas>
    </div>
    <div class="card">
      <div class="card-title">Body Weight</div>
      <canvas class="chart" id="chart-bw"></canvas>
    </div>
    <div class="card">
      <div class="card-title">Weekly Training Volume</div>
      <canvas class="chart" id="chart-weekvol"></canvas>
    </div>
    <div class="card">
      <div class="card-title">Monthly Training Volume</div>
      <canvas class="chart" id="chart-monthvol"></canvas>
    </div>
  `;

  const oneRMSeries = (liftKey) => {
    const pts = [];
    workouts.forEach((w) => {
      w.exercises.filter((e) => e.percentSource === liftKey).forEach((inst) => {
        inst.sets.filter((s) => s.done).forEach((s) => {
          pts.push({ value: estimate1RM(s.weight, s.actualReps) });
        });
      });
    });
    return pts.slice(-20);
  };
  drawLineChart(container.querySelector('#chart-bench'), oneRMSeries('bench'), { color: '#4f8cff' });
  drawLineChart(container.querySelector('#chart-squat'), oneRMSeries('squat'), { color: '#8b6bff' });
  drawLineChart(container.querySelector('#chart-deadlift'), oneRMSeries('deadlift'), { color: '#ff5470' });

  const bwPts = recovery.filter((r) => r.bodyweight).slice(-20).map((r) => ({ value: r.bodyweight }));
  drawLineChart(container.querySelector('#chart-bw'), bwPts, { color: '#22e584' });

  const weekMap = {};
  workouts.forEach((w) => {
    const key = isoWeekKey(new Date(w.completedAt));
    const vol = w.exercises.reduce((sum, e) => sum + totalVolume(e.sets.filter((s) => s.done)), 0);
    weekMap[key] = (weekMap[key] || 0) + vol;
  });
  const weekPts = Object.entries(weekMap).slice(-8).map(([k, v]) => ({ label: k.split('-W')[1], value: v }));
  drawBarChart(container.querySelector('#chart-weekvol'), weekPts, { color: '#4f8cff' });

  const monthMap = {};
  workouts.forEach((w) => {
    const key = monthKey(w.completedAt);
    const vol = w.exercises.reduce((sum, e) => sum + totalVolume(e.sets.filter((s) => s.done)), 0);
    monthMap[key] = (monthMap[key] || 0) + vol;
  });
  const monthPts = Object.entries(monthMap).slice(-6).map(([k, v]) => ({ label: k.split('-')[1], value: v }));
  drawBarChart(container.querySelector('#chart-monthvol'), monthPts, { color: '#8b6bff' });
}

// ---------- Recovery screen ----------

async function renderRecovery(container) {
  const all = (await DB.getAll('recovery')).sort((a, b) => new Date(b.date) - new Date(a.date));
  const today = all.find((r) => r.date === todayISO()) || { date: todayISO() };
  const recent = all.slice(0, 5);
  const poorSignal = recent.length >= 3 && recent.slice(0, 3).every((r) => (r.energy && r.energy <= 2) || (r.sleep && r.sleep < 6) || (r.soreness && r.soreness >= 4));

  container.innerHTML = `
    ${poorSignal ? `<div class="warning-banner"><div>⚠️</div><div>Your recovery markers have been low for the last 3 entries. Consider reducing training volume or intensity this week.</div></div>` : ''}
    <div class="card">
      <div class="card-title">Today — ${today.date}</div>
      <div class="row">
        <div><label>Sleep (hrs)</label><input type="number" step="0.5" id="rc-sleep" value="${today.sleep ?? ''}"></div>
        <div><label>Body weight (kg)</label><input type="number" step="0.1" id="rc-bw" value="${today.bodyweight ?? ''}"></div>
      </div>
      <div class="row">
        <div><label>Energy (1-5)</label><input type="number" min="1" max="5" id="rc-energy" value="${today.energy ?? ''}"></div>
        <div><label>Mood (1-5)</label><input type="number" min="1" max="5" id="rc-mood" value="${today.mood ?? ''}"></div>
        <div><label>Soreness (1-5)</label><input type="number" min="1" max="5" id="rc-soreness" value="${today.soreness ?? ''}"></div>
      </div>
      <div class="row">
        <div><label>Water (L)</label><input type="number" step="0.1" id="rc-water" value="${today.water ?? ''}"></div>
        <div><label>Calories</label><input type="number" id="rc-cal" value="${today.calories ?? ''}"></div>
        <div><label>Protein (g)</label><input type="number" id="rc-protein" value="${today.protein ?? ''}"></div>
      </div>
      <button class="btn block" id="rc-save" style="margin-top:12px;">Save Today's Recovery</button>
    </div>

    <div class="card">
      <div class="card-title">Recent Entries</div>
      ${recent.length ? recent.map((r) => `
        <div class="prev-line" style="margin-bottom:6px;">
          <strong>${r.date}</strong> — Sleep ${r.sleep ?? '–'}h, Energy ${r.energy ?? '–'}/5, Mood ${r.mood ?? '–'}/5, BW ${r.bodyweight ?? '–'}kg
        </div>
      `).join('') : '<div class="empty-state"><div class="ic">🌙</div>No recovery entries yet.</div>'}
    </div>
  `;

  container.querySelector('#rc-save').addEventListener('click', async () => {
    const entry = {
      date: today.date,
      sleep: parseFloat(container.querySelector('#rc-sleep').value) || null,
      bodyweight: parseFloat(container.querySelector('#rc-bw').value) || null,
      energy: parseInt(container.querySelector('#rc-energy').value, 10) || null,
      mood: parseInt(container.querySelector('#rc-mood').value, 10) || null,
      soreness: parseInt(container.querySelector('#rc-soreness').value, 10) || null,
      water: parseFloat(container.querySelector('#rc-water').value) || null,
      calories: parseFloat(container.querySelector('#rc-cal').value) || null,
      protein: parseFloat(container.querySelector('#rc-protein').value) || null,
    };
    await DB.put('recovery', entry);
    toast('✅', 'Saved', "Today's recovery logged.");
    render();
  });
}

// ---------- Settings screen ----------

function renderSettings(container) {
  const s = STATE.settings;
  container.innerHTML = `
    <div class="card">
      <div class="card-title">Rest Timer</div>
      <label>Default rest between sets (seconds)</label>
      <input type="number" id="set-rest" value="${s.restSeconds}">
      <label>Alert style</label>
      <select id="set-alert">
        <option value="visual" ${s.timerAlertMode === 'visual' ? 'selected' : ''}>Visual only</option>
        <option value="vibration" ${s.timerAlertMode === 'vibration' ? 'selected' : ''}>Vibration</option>
        <option value="sound" ${s.timerAlertMode === 'sound' ? 'selected' : ''}>Sound + Vibration</option>
      </select>
      <button class="btn block secondary" id="save-rest" style="margin-top:12px;">Save</button>
    </div>

    <div class="card">
      <div class="card-title">Theme Accent</div>
      <div class="row">
        <button class="btn ${s.accent === 'blue' ? '' : 'secondary'}" data-accent="blue">Blue</button>
        <button class="btn ${s.accent === 'red' ? '' : 'secondary'}" data-accent="red">Red</button>
        <button class="btn ${s.accent === 'green' ? '' : 'secondary'}" data-accent="green">Green</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Backup</div>
      <div class="exercise-meta" style="margin-bottom:10px;">All data lives only on this device. Export a backup file regularly, especially before changing phones.</div>
      <button class="btn block secondary" id="export-btn">⬇ Export Backup</button>
      <label style="margin-top:10px;">Import backup file</label>
      <input type="file" id="import-file" accept="application/json">
    </div>

    <div class="card">
      <div class="card-title">Danger Zone</div>
      <button class="btn block danger" id="reset-btn">Erase All Data</button>
    </div>

    <div class="card">
      <div class="card-title">About</div>
      <div class="exercise-meta">IronLog — personal powerlifting tracker. No ads, no accounts, fully offline.</div>
    </div>
  `;

  container.querySelector('#save-rest').addEventListener('click', async () => {
    s.restSeconds = parseInt(container.querySelector('#set-rest').value, 10) || s.restSeconds;
    s.timerAlertMode = container.querySelector('#set-alert').value;
    await saveSettings();
    toast('✅', 'Saved', 'Timer settings updated.');
  });

  container.querySelectorAll('[data-accent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      s.accent = btn.dataset.accent;
      applyAccent(s.accent);
      await saveSettings();
      render();
    });
  });

  container.querySelector('#export-btn').addEventListener('click', async () => {
    const dump = await DB.exportAll();
    const serializable = { ...dump, photos: [] };
    for (const p of dump.photos) {
      const b64 = await blobToBase64(p.blob);
      serializable.photos.push({ exerciseId: p.exerciseId, savedAt: p.savedAt, dataUrl: b64 });
    }
    const blob = new Blob([JSON.stringify(serializable)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironlog-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  container.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('This will replace all current data with the backup file. Continue?')) return;
    const text = await file.text();
    const dump = JSON.parse(text);
    for (const p of dump.photos || []) {
      if (p.dataUrl) p.blob = await dataUrlToBlob(p.dataUrl);
    }
    await DB.importAll(dump);
    toast('✅', 'Imported', 'Backup restored. Reloading...');
    setTimeout(() => location.reload(), 1000);
  });

  container.querySelector('#reset-btn').addEventListener('click', async () => {
    if (!confirm('This permanently deletes ALL workouts, photos, and settings. Are you sure?')) return;
    if (!confirm('Really sure? This cannot be undone.')) return;
    indexedDB.deleteDatabase('ironlog');
    location.reload();
  });
}

function applyAccent(accent) {
  const root = document.documentElement.style;
  if (accent === 'red') {
    root.setProperty('--primary', '#ff5470');
    root.setProperty('--primary-2', '#ff8a3d');
  } else if (accent === 'green') {
    root.setProperty('--primary', '#22e584');
    root.setProperty('--primary-2', '#4f8cff');
  } else {
    root.setProperty('--primary', '#4f8cff');
    root.setProperty('--primary-2', '#8b6bff');
  }
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ---------- Go ----------

boot().then(() => {
  if (STATE.settings.accent) applyAccent(STATE.settings.accent);
});
