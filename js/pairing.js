// Pairs mode: who draws with whom. Everyone draws once a round, two at a time, and the same two
// should draw together as rarely as possible. Picking one partner per turn corners itself: the
// last two of a round can be left with each other again while new pairs were still possible.
// So the rest of a round is planned in one go: of all the ways to pair everyone up, one with the
// fewest repeats (at random among equally good ones), preferring one that leaves the next round
// as few repeats as possible too.
import { shuffle } from './util.js';

const STEPS = 30000; // most search steps for one plan, so even a full room never stalls the host
const LOOKS = 20;    // most equally good plans compared on what they leave for the next round

// The planner gets `ctx`: everyone (ids of the players in the room), together(a, b) (times two
// of them drew together), drawn(id) (turns someone drew) and lookahead (another round follows).

// Puts the players still to draw this round in turn order: the first two draw together, then the
// next two, and so on. With an odd number the last one is left over and draws with someone who
// already drew (leftoverPartner).
export function planRound(waiting, ctx) {
  const ids = shuffle(waiting);
  if (ids.length < 2) return ids;
  const budget = { steps: STEPS };
  const best = cheapest(ids, ctx, budget);
  if (!ctx.lookahead || ctx.everyone.length < 3) return best.plan;
  // The next round can't do better than this, whatever happens in this one
  const floor = costs(ctx.everyone, ctx).floor;
  let pick = { ...best, next: Infinity };
  let looks = 0;
  search(costs(ids, ctx), budget, () => best.cost, (plan, cost) => {
    const next = cheapest(shuffle(ctx.everyone), { ...ctx, together: withPlan(plan, ctx) }, budget).cost;
    if (cost < pick.cost || (cost === pick.cost && next < pick.next)) pick = { plan, cost, next };
    return (cost <= best.cost && next <= floor) || ++looks >= LOOKS;
  });
  return pick.plan;
}

// The partner of the player left over in an odd round: whoever drew with them least, then whoever
// has drawn least, at random among equals
export function leftoverPartner(id, { everyone, together, drawn = () => 0 }) {
  const score = (o) => together(id, o) * 1000 + drawn(o);
  return shuffle(everyone.filter((o) => o !== id)).reduce((a, b) => (a && score(a) <= score(b) ? a : b), null);
}

// The plan for `ids` with the fewest repeats (as far as the budget lets it look)
function cheapest(ids, ctx, budget) {
  const c = costs(ids, ctx);
  let best = { plan: ids, cost: Infinity };
  search(c, budget, () => best.cost - 1, (plan, cost) => {
    best = { plan, cost };
    return cost <= c.floor;
  });
  return best;
}

// What pairing up `ids` costs: price[i][j] when two of them draw together (the times they already
// did), alone[i] when one is left over (the fewest times they drew with anyone), and the floor
// no plan can go under (every pair costs at least the cheapest one)
function costs(ids, { everyone, together }) {
  const price = ids.map((a) => ids.map((b) => together(a, b)));
  const alone = ids.map((a) => Math.min(...everyone.filter((o) => o !== a).map((o) => together(a, o))));
  const odd = ids.length % 2 === 1;
  let least = odd ? Math.min(...alone) : Infinity;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) least = Math.min(least, price[i][j]);
  return { ids, price, alone, odd, floor: Math.ceil(ids.length / 2) * least };
}

// Goes through the ways to pair up the players (one left over when odd), cheapest pairs first and
// in the given order among equal ones. visit(plan, cost) gets every plan costing no more than
// limit(), and returns true to stop.
function search({ ids, price, alone, odd }, budget, limit, visit) {
  const used = ids.map(() => false);
  const plan = [];
  let left = null;
  let stop = false;
  const go = (cost) => {
    const i = used.indexOf(false);
    if (i < 0) {
      stop = visit(left === null ? [...plan] : [...plan, left], cost);
      return;
    }
    if (--budget.steps < 0) {
      stop = true;
      return;
    }
    used[i] = true;
    const options = [];
    for (let j = i + 1; j < ids.length; j++) if (!used[j]) options.push([j, price[i][j]]);
    if (odd && left === null) options.push([-1, alone[i]]);
    options.sort((a, b) => a[1] - b[1]);
    for (const [j, p] of options) {
      if (stop || cost + p > limit()) break;
      if (j < 0) left = ids[i];
      else {
        used[j] = true;
        plan.push(ids[i], ids[j]);
      }
      go(cost + p);
      if (j < 0) left = null;
      else {
        used[j] = false;
        plan.length -= 2;
      }
    }
    used[i] = false;
  };
  go(0);
}

// `together` as it will be once this plan has been drawn
function withPlan(plan, ctx) {
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const extra = new Map();
  const add = (a, b) => extra.set(key(a, b), (extra.get(key(a, b)) || 0) + 1);
  for (let i = 0; i + 1 < plan.length; i += 2) add(plan[i], plan[i + 1]);
  if (plan.length % 2) add(plan.at(-1), leftoverPartner(plan.at(-1), ctx));
  return (a, b) => ctx.together(a, b) + (extra.get(key(a, b)) || 0);
}
