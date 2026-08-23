// Default program & settings — everything here is just a starting point.
// Every value is editable in-app; nothing is hard-coded into the logic.

export const WEEK_PERCENTS = [
  { week: 1, percent: 75, isDeload: false },
  { week: 2, percent: 77.5, isDeload: false },
  { week: 3, percent: 80, isDeload: false },
  { week: 4, percent: 82.5, isDeload: false },
  { week: 5, percent: 85, isDeload: false },
  { week: 6, percent: 87.5, isDeload: false },
  { week: 7, percent: 90, isDeload: false },
  { week: 8, percent: 50, isDeload: true },
];

function ex(id, name, category, sets, reps, opts = {}) {
  return {
    id,
    name,
    category,
    sets,
    reps, // display string, e.g. "5", "8-10"
    repsScheme: opts.repsScheme || null, // per-set targets, e.g. deadlift ramp
    region: opts.region || 'upper', // 'upper' | 'lower' -> default increment bucket
    isMainLift: !!opts.isMainLift,
    percentSource: opts.percentSource || null, // 'bench' | 'squat' | 'deadlift'
    percentMode: opts.percentMode || null, // 'weekly' | 'fixed'
    fixedPercent: opts.fixedPercent ?? null,
    weightIncrement: opts.weightIncrement ?? null, // override, else region default
    notes: opts.notes || '',
  };
}

export function defaultProgram() {
  return {
    key: 'program',
    days: [
      {
        id: 'day1',
        name: 'Push',
        blocks: [
          { category: 'Bench / Chest', exercises: [
            ex('d1-bench', 'Bench Press', 'Bench / Chest', 5, '5', { isMainLift: true, percentSource: 'bench', percentMode: 'weekly', region: 'upper' }),
            ex('d1-incline-machine', 'Incline Machine Press', 'Bench / Chest', 3, '8', { region: 'upper' }),
            ex('d1-flat-machine', 'Flat Machine Chest Press', 'Bench / Chest', 2, '8-10', { region: 'upper' }),
            ex('d1-cable-fly', 'Cable Fly', 'Bench / Chest', 2, '12-15', { region: 'upper' }),
          ]},
          { category: 'Shoulders', exercises: [
            ex('d1-smith-shoulder', 'Smith Machine Shoulder Press', 'Shoulders', 2, '8', { region: 'upper' }),
            ex('d1-lateral-raise', 'Lateral Raise Machine', 'Shoulders', 3, '8-12', { region: 'upper' }),
          ]},
          { category: 'Triceps', exercises: [
            ex('d1-triceps-pushdown', 'Triceps Pushdown', 'Triceps', 3, '10-12', { region: 'upper' }),
          ]},
          { category: 'Legs', exercises: [
            ex('d1-leg-extension', 'Leg Extension', 'Legs', 3, '12', { region: 'lower' }),
          ]},
        ],
      },
      {
        id: 'day2',
        name: 'Pull',
        blocks: [
          { category: 'Back', exercises: [
            ex('d2-cs-row', 'Chest-Supported Row', 'Back', 3, '8', { region: 'upper' }),
            ex('d2-single-arm-row', 'Single-Arm Row', 'Back', 3, '8-10', { region: 'upper' }),
          ]},
          { category: 'Rear Delts', exercises: [
            ex('d2-rear-delt', 'Rear Delt Raise', 'Rear Delts', 3, '8', { region: 'upper' }),
          ]},
          { category: 'Biceps', exercises: [
            ex('d2-cable-curl', 'Single-Arm Cable Curl', 'Biceps', 3, '10', { region: 'upper' }),
            ex('d2-hammer-curl', 'Dumbbell Hammer Curl', 'Biceps', 3, '8-10', { region: 'upper' }),
          ]},
          { category: 'Legs', exercises: [
            ex('d2-leg-curl', 'Leg Curl', 'Legs', 3, '10', { region: 'lower' }),
          ]},
        ],
      },
      {
        id: 'day3',
        name: 'Legs',
        blocks: [
          { category: 'Main Strength Lift', exercises: [
            ex('d3-squat', 'Back Squat', 'Main Strength Lift', 5, '5', { isMainLift: true, percentSource: 'squat', percentMode: 'weekly', region: 'lower' }),
          ]},
          { category: 'Legs', exercises: [
            ex('d3-hip-adduction', 'Hip Adduction', 'Legs', 3, '15', { region: 'lower' }),
            ex('d3-calf-raise', 'Standing Calf Raise', 'Legs', 3, '15', { region: 'lower' }),
          ]},
        ],
      },
      {
        id: 'day4',
        name: 'Upper',
        blocks: [
          { category: 'Chest', exercises: [
            ex('d4-bench', 'Bench Press', 'Chest', 4, '8', { percentSource: 'bench', percentMode: 'fixed', fixedPercent: 65, region: 'upper' }),
          ]},
          { category: 'Back', exercises: [
            ex('d4-cs-row', 'Chest-Supported Row', 'Back', 3, '8', { region: 'upper' }),
            ex('d4-single-arm-row', 'Single-Arm Row', 'Back', 3, '8', { region: 'upper' }),
          ]},
          { category: 'Biceps', exercises: [
            ex('d4-preacher-curl', 'Preacher Curl', 'Biceps', 3, '10', { region: 'upper' }),
          ]},
        ],
      },
      {
        id: 'day5',
        name: 'Deadlift',
        blocks: [
          { category: 'Main Strength Lift', exercises: [
            ex('d5-deadlift', 'Deadlift', 'Main Strength Lift', 5, '5→4→3→2→1', {
              isMainLift: true, percentSource: 'deadlift', percentMode: 'weekly', region: 'lower',
              repsScheme: [5, 4, 3, 2, 1],
            }),
          ]},
          { category: 'Legs', exercises: [
            ex('d5-seated-leg-curl', 'Seated Leg Curl', 'Legs', 3, '10', { region: 'lower' }),
          ]},
        ],
      },
    ],
  };
}

export function defaultSettings() {
  return {
    key: 'settings',
    oneRM: { bench: 100, squat: 120, deadlift: 140 },
    weightIncrements: { upper: 2.5, lower: 5 },
    roundingIncrement: 2.5,
    restSeconds: 300,
    timerAlertMode: 'visual',
    weekPercents: WEEK_PERCENTS,
    blockNumber: 1,
    currentWeek: null, // set during onboarding
    currentDayIndex: null, // 0..4, rotates on workout completion
    onboardingComplete: false,
    prHistory: {}, // exerciseId -> { maxWeight, maxReps, best1RM, maxVolume }
    lastRecoveryWarningDismissedAt: null,
    accent: 'blue',
  };
}
