// Fuel: daily calories, protein and water against targets from your weight and today's training,
// graded on your pace through the day (not the full day). Pure logic. Every number is an estimate
// from simple sports-nutrition rules of thumb; it says so, and it is not medical advice.

const LB = 0.4536;
export const kgOf = (value, unit) => (value > 0 ? (unit === 'lb' ? value * LB : value) : null);

// Quick-add foods: a typical portion with rounded, approximate values.
export const FOODS = [
  // Protein
  { id: 'chicken', cat: 'Protein', name: 'Chicken breast', portion: '150 g cooked', kcal: 250, protein: 46 },
  { id: 'eggs', cat: 'Protein', name: 'Eggs', portion: '2 large', kcal: 145, protein: 13 },
  { id: 'yogurt', cat: 'Protein', name: 'Greek yogurt', portion: '170 g, plain', kcal: 100, protein: 17 },
  { id: 'tuna', cat: 'Protein', name: 'Tuna', portion: '1 can, drained', kcal: 120, protein: 26 },
  { id: 'salmon', cat: 'Protein', name: 'Salmon', portion: '150 g fillet', kcal: 310, protein: 33 },
  { id: 'beef', cat: 'Protein', name: 'Lean beef mince', portion: '150 g cooked', kcal: 300, protein: 37 },
  { id: 'shake', cat: 'Protein', name: 'Protein shake', portion: '1 scoop, water', kcal: 120, protein: 24 },
  { id: 'cottage', cat: 'Protein', name: 'Cottage cheese', portion: '1 cup', kcal: 180, protein: 24 },
  { id: 'turkey', cat: 'Protein', name: 'Turkey slices', portion: '100 g', kcal: 105, protein: 18 },
  // Carbs
  { id: 'rice', cat: 'Carbs', name: 'Rice', portion: '1 cup cooked', kcal: 205, protein: 4 },
  { id: 'oats', cat: 'Carbs', name: 'Oatmeal', portion: '1 cup cooked', kcal: 165, protein: 6 },
  { id: 'pasta', cat: 'Carbs', name: 'Pasta', portion: '1 cup cooked', kcal: 220, protein: 8 },
  { id: 'potato', cat: 'Carbs', name: 'Potato', portion: '1 medium', kcal: 160, protein: 4 },
  { id: 'bread', cat: 'Carbs', name: 'Bread', portion: '2 slices', kcal: 160, protein: 7 },
  { id: 'bagel', cat: 'Carbs', name: 'Bagel', portion: '1 plain', kcal: 280, protein: 11 },
  { id: 'banana', cat: 'Carbs', name: 'Banana', portion: '1 medium', kcal: 105, protein: 1 },
  { id: 'apple', cat: 'Carbs', name: 'Apple', portion: '1 medium', kcal: 95, protein: 0 },
  // Meals
  { id: 'chicken-rice', cat: 'Meals', name: 'Chicken, rice and veg', portion: '1 plate', kcal: 550, protein: 45 },
  { id: 'burrito', cat: 'Meals', name: 'Burrito', portion: '1 large', kcal: 700, protein: 30 },
  { id: 'sandwich', cat: 'Meals', name: 'Turkey sandwich', portion: '1', kcal: 400, protein: 25 },
  { id: 'burger', cat: 'Meals', name: 'Burger', portion: '1, no fries', kcal: 550, protein: 30 },
  { id: 'pizza', cat: 'Meals', name: 'Pizza', portion: '2 slices', kcal: 570, protein: 24 },
  { id: 'salad', cat: 'Meals', name: 'Chicken salad', portion: '1 bowl', kcal: 400, protein: 35 },
  { id: 'pasta-meal', cat: 'Meals', name: 'Pasta with meat sauce', portion: '1 plate', kcal: 650, protein: 32 },
  // Snacks and drinks
  { id: 'pb', cat: 'Snacks', name: 'Peanut butter', portion: '2 tbsp', kcal: 190, protein: 7 },
  { id: 'nuts', cat: 'Snacks', name: 'Almonds', portion: 'a handful, 28 g', kcal: 165, protein: 6 },
  { id: 'bar', cat: 'Snacks', name: 'Protein bar', portion: '1', kcal: 200, protein: 20 },
  { id: 'milk', cat: 'Snacks', name: 'Milk', portion: '1 cup', kcal: 120, protein: 8 },
  { id: 'choc-milk', cat: 'Snacks', name: 'Chocolate milk', portion: '1 cup', kcal: 190, protein: 8 },
  { id: 'sports', cat: 'Snacks', name: 'Sports drink', portion: '500 ml', kcal: 130, protein: 0 },
  { id: 'soda', cat: 'Snacks', name: 'Soda', portion: '1 can', kcal: 140, protein: 0 },
];
export const FOOD_CATS = ['Protein', 'Carbs', 'Meals', 'Snacks'];

// Boxing burns about MET 7.8: kcal/min ≈ 7.8 × 3.5 × kg / 200.
const trainKcal = (kg, minutes) => Math.round(minutes * 0.1365 * kg);

// goal: 'cut' | 'keep' | 'gain'. trainMin: today's training (done, or planned if not done yet).
export function targets({ kg, trainMin = 0, goal = 'keep' }) {
  if (!kg) return null;
  const base = 30 * kg; // a day's needs for an active adult, before training
  const adjust = goal === 'cut' ? -Math.min(500, 0.15 * base) : goal === 'gain' ? 300 : 0;
  return {
    kcal: Math.round((base + trainKcal(kg, trainMin) + adjust) / 10) * 10,
    protein: Math.round(kg * (goal === 'cut' ? 2.2 : 2.0)),
    water: Math.round((kg * 35 + trainMin * 12) / 50) * 50, // ml
    trainMin, goal,
  };
}

// Cut, keep or gain, from your target weight (more than 1% away counts).
export function goalFrom(avgWeight, targetWeight) {
  if (!(avgWeight > 0) || !(targetWeight > 0)) return 'keep';
  const off = (avgWeight - targetWeight) / targetWeight;
  return off > 0.01 ? 'cut' : off < -0.01 ? 'gain' : 'keep';
}

// How far through the eating day (7:00 to 21:00) it is, 0-1, and what to call that part of it.
export function dayPace(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  const pace = Math.min(1, Math.max(0, (h - 7) / 14));
  const part = h < 5 ? 'Late night' : h < 11 ? 'Morning' : h < 14 ? 'Midday' : h < 18 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return { pace, part };
}

export function totals(entries = []) {
  return entries.reduce((a, e) => ({ kcal: a.kcal + (e.kcal || 0), protein: a.protein + (e.protein || 0), water: a.water + (e.water || 0), meals: a.meals + (e.kcal ? 1 : 0) }), { kcal: 0, protein: 0, water: 0, meals: 0 });
}

const LETTERS = [[90, 'A'], [80, 'B'], [65, 'C'], [50, 'D'], [0, 'F']];
const unitWater = (ml, unit) => (unit === 'lb' ? `${Math.round(ml / 29.57)} oz` : ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`);
export const waterText = unitWater;

// The grade for the day so far: { score 0-100, letter, rows[{key, got, want, target, status}], headline, tips[] }
// or { early: true } before the day has really started.
export function gradeDay(entries, tg, { now = new Date(), trainedToday = false, unit = 'kg' } = {}) {
  const { pace, part } = dayPace(now);
  const got = totals(entries);
  if (!tg) return null;
  if (pace < 0.08 && !got.meals && !got.water) return { early: true, part, pace, got };
  const p = Math.max(pace, 0.15); // by early morning, breakfast is all that's expected
  const want = { kcal: Math.round(tg.kcal * p), protein: Math.round(tg.protein * p), water: Math.round(tg.water * p) };
  const fill = (k) => (want[k] ? got[k] / want[k] : 1);
  const sP = Math.min(1, fill('protein'));
  const rK = fill('kcal');
  const over = tg.goal === 'cut' ? 1.08 : 1.2;
  const sK = rK <= over ? Math.min(1, rK) : Math.max(0, 1 - (rK - over) * 2);
  const sW = Math.min(1, fill('water'));
  const score = Math.round(100 * (0.4 * sP + 0.4 * sK + 0.2 * sW));
  const letter = LETTERS.find(([min]) => score >= min)[1];
  const status = (r, k) => (k === 'kcal' && r > over ? 'over' : r >= 0.9 ? 'on' : r >= 0.6 ? 'behind' : 'well');
  const rows = ['kcal', 'protein', 'water'].map((k) => ({ key: k, got: got[k], want: want[k], target: tg[k], status: status(fill(k), k) }));

  const tips = [];
  if (sP < 0.8) tips.push(`Protein is behind: ${got.protein} of ${want.protein} g by now. Add a palm of chicken, fish, eggs or Greek yogurt next meal.`);
  if (rK > over) tips.push(tg.goal === 'cut' ? `Over pace for your cut: ${got.kcal} of ${want.kcal} kcal by now. Keep the next meal lean: protein and vegetables.` : `Ahead on calories: ${got.kcal} of ${want.kcal} by now. Lighter next meal.`);
  else if (rK < 0.7) tips.push(`Under-fuelled: ${got.kcal} of ${want.kcal} kcal by now.${tg.trainMin ? ' You train today: eat carbs 2–3 hours before.' : ' A real meal will fix it.'}`);
  if (sW < 0.8) tips.push(`Drink about ${unitWater(Math.max(0, want.water - got.water), unit)} more to be on pace.`);
  if (trainedToday) tips.push('You trained today: 25–40 g of protein and some carbs in the next meal helps you recover.');
  if (!tips.length) tips.push('On pace. Keep the same rhythm: protein in every meal, water through the day.');

  const worst = rows.filter((r) => r.status !== 'on').sort((a, b) => (a.status === 'over' ? -1 : 0) - (b.status === 'over' ? -1 : 0) || a.got / (a.want || 1) - b.got / (b.want || 1))[0];
  const headline = !got.meals && !got.water ? 'Nothing logged yet: log what you’ve eaten'
    : !worst ? 'Right on pace'
    : worst.status === 'over' ? 'Ahead on calories: go lighter next'
    : worst.key === 'protein' ? 'Protein is behind: make the next meal count'
    : worst.key === 'kcal' ? (got.meals <= 1 ? 'Light so far: round it out' : 'Under-fuelled for today')
    : 'Drink some water';
  return { score, letter, rows, headline, tips: tips.slice(0, 3), part, pace, got, want };
}
