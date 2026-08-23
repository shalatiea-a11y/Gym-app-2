// Pure calculation helpers — percentages, rounding, 1RM estimates, streaks.

export function roundToIncrement(value, increment) {
  if (!increment) return Math.round(value * 100) / 100;
  return Math.round(value / increment) * increment;
}

export function workingWeight(oneRM, percent, roundingIncrement) {
  const raw = (oneRM * percent) / 100;
  return roundToIncrement(raw, roundingIncrement);
}

// Epley formula: 1RM = weight * (1 + reps/30)
export function estimate1RM(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function parseRepTarget(reps) {
  // "5" -> {min:5, max:5}; "8-10" -> {min:8, max:10}
  if (!reps) return { min: 0, max: 0 };
  const m = String(reps).match(/(\d+)\s*-\s*(\d+)/);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  const n = parseInt(reps, 10);
  return { min: n || 0, max: n || 0 };
}

export function totalVolume(sets) {
  // sets: [{weight, actualReps}]
  return sets.reduce((sum, s) => sum + (s.weight || 0) * (s.actualReps || 0), 0);
}

export function suggestIncrease(region, weightIncrements) {
  return region === 'lower' ? weightIncrements.lower : weightIncrements.upper;
}

// Given a completed set, decide if the weight looks too light.
// Returns null, or { exceededBy } if actual reps clearly beat the target.
export function checkExceededTarget(targetReps, actualReps) {
  if (!targetReps || !actualReps) return null;
  const exceededBy = actualReps - targetReps;
  if (exceededBy >= 3) return { exceededBy };
  return null;
}

function toDateOnly(d) {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function computeStreak(workoutDates) {
  // workoutDates: array of ISO date strings (one per workout, duplicates ok)
  if (!workoutDates.length) return 0;
  const uniqueDays = [...new Set(workoutDates.map((d) => toDateOnly(d).getTime()))].sort((a, b) => b - a);
  const today = toDateOnly(new Date()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  let streak = 0;
  let cursor = today;
  // allow streak to count even if today has no workout yet, starting from yesterday
  if (uniqueDays[0] !== today) {
    cursor = today - oneDay;
  }
  for (const day of uniqueDays) {
    if (day === cursor) {
      streak++;
      cursor -= oneDay;
    } else if (day < cursor) {
      break;
    }
  }
  return streak;
}

export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
