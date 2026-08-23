// Badge definitions + detection. Pure functions — UI decides how to celebrate.

export const BADGES = [
  { id: 'first_workout', title: 'First Workout', desc: 'You logged your very first session.', icon: '🏁' },
  { id: 'workouts_10', title: '10 Workouts', desc: 'Ten sessions in the books.', icon: '🔟' },
  { id: 'workouts_50', title: '50 Workouts', desc: 'Fifty sessions of grinding.', icon: '🏆' },
  { id: 'workouts_100', title: '100 Workouts', desc: 'A full century of training.', icon: '💯' },
  { id: 'first_bench_100', title: 'First 100kg Bench', desc: 'You touched 3 plates on bench.', icon: '🎖️' },
  { id: 'first_squat_120', title: 'First 120kg Squat', desc: 'A big squat milestone.', icon: '🎖️' },
  { id: 'first_deadlift_140', title: 'First 140kg Deadlift', desc: 'A big pull milestone.', icon: '🎖️' },
  { id: 'new_bench_pr', title: 'New Bench PR', desc: 'Heaviest bench of your life so far.', icon: '📈' },
  { id: 'new_squat_pr', title: 'New Squat PR', desc: 'Heaviest squat of your life so far.', icon: '📈' },
  { id: 'new_deadlift_pr', title: 'New Deadlift PR', desc: 'Heaviest deadlift of your life so far.', icon: '📈' },
  { id: 'streak_7', title: '7-Day Streak', desc: 'Trained 7 days in a row.', icon: '🔥' },
  { id: 'streak_30', title: '30-Day Streak', desc: 'Trained 30 days in a row.', icon: '🔥🔥' },
];

export function badgeById(id) {
  return BADGES.find((b) => b.id === id);
}

const LIFT_THRESHOLDS = {
  bench: { weight: 100, badge: 'first_bench_100' },
  squat: { weight: 120, badge: 'first_squat_120' },
  deadlift: { weight: 140, badge: 'first_deadlift_140' },
};

const LIFT_PR_BADGE = {
  bench: 'new_bench_pr',
  squat: 'new_squat_pr',
  deadlift: 'new_deadlift_pr',
};

// ctx: { totalWorkouts, alreadyUnlocked:Set, liftPrEvents: [{liftKey, type:'weight'|'reps'|'1rm'|'volume', value}], streak }
export function evaluateAchievements(ctx) {
  const unlocked = [];
  const has = (id) => ctx.alreadyUnlocked.has(id);
  const grant = (id) => {
    if (!has(id)) unlocked.push(id);
  };

  if (ctx.totalWorkouts >= 1) grant('first_workout');
  if (ctx.totalWorkouts >= 10) grant('workouts_10');
  if (ctx.totalWorkouts >= 50) grant('workouts_50');
  if (ctx.totalWorkouts >= 100) grant('workouts_100');

  if (ctx.streak >= 7) grant('streak_7');
  if (ctx.streak >= 30) grant('streak_30');

  for (const evt of ctx.liftPrEvents || []) {
    const threshold = LIFT_THRESHOLDS[evt.liftKey];
    if (threshold && evt.type === 'weight' && evt.value >= threshold.weight) {
      grant(threshold.badge);
    }
    if (evt.type === 'weight' && LIFT_PR_BADGE[evt.liftKey]) {
      grant(LIFT_PR_BADGE[evt.liftKey]);
    }
  }

  return unlocked.map(badgeById).filter(Boolean);
}
