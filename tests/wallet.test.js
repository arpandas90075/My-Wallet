/* ─────────────────────────────────────────────────────────────
   wallet.test.js — plain Node, no dependencies.
   Run:  node tests/wallet.test.js
   ───────────────────────────────────────────────────────────── */

const { Store, CATEGORIES } = require('../js/store.js');
global.Store = Store;
global.CATEGORIES = CATEGORIES;
const { Wallet } = require('../js/wallet.js');

let passed = 0, failed = 0;

function check(name, condition) {
  if (condition) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}

const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const dayKey = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Wallet.key(d);
};

// ── adding entries ──────────────────────────────────────────
Store.clear();
console.log('\nadding entries');
check('rejects a zero amount', !Wallet.add({ type: 'expense', amount: 0, category: 'food' }).ok);
check('rejects a negative amount', !Wallet.add({ type: 'expense', amount: -20, category: 'food' }).ok);
check('rejects text as an amount', !Wallet.add({ type: 'expense', amount: 'abc', category: 'food' }).ok);
check('rejects an unknown type', !Wallet.add({ type: 'refund', amount: 10, category: 'food' }).ok);
check('rejects an invalid date', !Wallet.add({ type: 'expense', amount: 10, category: 'food', date: 'not-a-date' }).ok);
check('rejects the income category on an expense',
  !Wallet.add({ type: 'expense', amount: 10, category: 'income' }).ok);

const added = Wallet.add({ type: 'expense', amount: 199.999, category: 'food', note: 'Coffee' });
check('accepts a valid expense', added.ok);
check('rounds the amount to 2 decimals', added.entry.amount === 200);
check('keeps the note', added.entry.note === 'Coffee');
check('falls back to the category name when the note is blank',
  Wallet.add({ type: 'expense', amount: 50, category: 'fun' }).entry.note === 'Fun');
check('forces income entries onto the income category',
  Wallet.add({ type: 'income', amount: 1000, category: 'food' }).entry.category === 'income');
check('trims an over-long note',
  Wallet.add({ type: 'expense', amount: 5, category: 'food', note: 'x'.repeat(200) }).entry.note.length === 60);

// ── totals ──────────────────────────────────────────────────
Store.clear();
console.log('\ntotals');
Wallet.add({ type: 'income', amount: 5000, category: 'income' });
Wallet.add({ type: 'expense', amount: 1200.50, category: 'bills' });
Wallet.add({ type: 'expense', amount: 300.25, category: 'food' });

const t = Wallet.totals();
check('sums income', t.income === 5000);
check('sums expenses', near(t.expense, 1500.75));
check('balance is income minus expenses', near(t.balance, 3499.25));
check('balance can go negative', (() => {
  Wallet.add({ type: 'expense', amount: 9000, category: 'shopping' });
  const r = Wallet.totals().balance < 0;
  Store.remove(Store.all().at(-1).id);
  return r;
})());

// ── deleting ────────────────────────────────────────────────
console.log('\ndeleting');
const target = Store.all()[1].id;
check('removes an existing entry', Wallet.remove(target).ok);
check('the entry is gone', Store.get(target) === null);
check('deleting twice fails cleanly', !Wallet.remove(target).ok);
check('totals update after a delete', near(Wallet.totals().expense, 300.25));

// ── reset ───────────────────────────────────────────────────
Store.clear();
console.log('\nreset');
Wallet.setBudget(5000);
Wallet.add({ type: 'income', amount: 9000, category: 'income' });
Wallet.add({ type: 'expense', amount: 1500, category: 'food' });
Wallet.add({ type: 'expense', amount: 250, category: 'fun' });

const wiped = Wallet.reset();
check('reports how many entries it cleared', wiped.cleared === 3);
check('no entries remain', Store.all().length === 0);
check('balance is zero', Wallet.totals().balance === 0);
check('income is zero', Wallet.totals().income === 0);
check('spending is zero', Wallet.totals().expense === 0);
check('the month total is zero', Wallet.month().expense === 0);
check('the budget is cleared too', Store.budget === 0);
check('budget status reports unset', Wallet.budgetStatus().set === false);
check('the category split is empty', Wallet.byCategory().length === 0);
check('every one of the last 7 days is zero',
  Wallet.lastDays(7).every(d => d.total === 0));
check('the history list is empty', Wallet.list().length === 0);
check('the insight falls back to the empty message',
  Wallet.insight() === 'No activity this month yet.');
check('resetting an empty wallet is harmless', Wallet.reset().cleared === 0);
check('entry ids restart from 1',
  Wallet.add({ type: 'expense', amount: 10, category: 'food' }).entry.id === 1);
check('the wallet works normally after a reset',
  Wallet.totals().expense === 10);

// ── category breakdown ──────────────────────────────────────
Store.clear();
console.log('\ncategory breakdown');
Wallet.add({ type: 'expense', amount: 600, category: 'food' });
Wallet.add({ type: 'expense', amount: 200, category: 'food' });
Wallet.add({ type: 'expense', amount: 200, category: 'fun' });
Wallet.add({ type: 'income', amount: 9999, category: 'income' });

const cats = Wallet.byCategory();
check('groups entries by category', cats.length === 2);
check('sorts the biggest category first', cats[0].id === 'food');
check('merges repeat entries', cats[0].total === 800);
check('shares add up to 100%', near(cats.reduce((s, c) => s + c.share, 0), 100, 0.1));
check('income is excluded from the split', !cats.some(c => c.id === 'income'));
check('every slice carries a colour', cats.every(c => /^#/.test(c.color)));

// ── last 7 days ─────────────────────────────────────────────
Store.clear();
console.log('\nlast 7 days');
Wallet.add({ type: 'expense', amount: 100, category: 'food', date: dayKey(0) });
Wallet.add({ type: 'expense', amount: 50, category: 'food', date: dayKey(0) });
Wallet.add({ type: 'expense', amount: 700, category: 'bills', date: dayKey(3) });
Wallet.add({ type: 'expense', amount: 999, category: 'fun', date: dayKey(30) });
Wallet.add({ type: 'income', amount: 500, category: 'income', date: dayKey(1) });

const week = Wallet.lastDays(7);
check('returns exactly 7 days', week.length === 7);
check('runs oldest to newest', week[0].date < week[6].date);
check('adds up entries on the same day', week[6].total === 150);
check('places an older entry on the right day', week[3].total === 700);
check('ignores anything outside the window',
  week.reduce((s, d) => s + d.total, 0) === 850);
check('ignores income', !week.some(d => d.total === 500));

// ── budget ──────────────────────────────────────────────────
Store.clear();
console.log('\nbudget');
check('rejects a negative budget', !Wallet.setBudget(-100).ok);
check('accepts a valid budget', Wallet.setBudget(1000).ok);
Wallet.add({ type: 'expense', amount: 250, category: 'food' });
let b = Wallet.budgetStatus();
check('tracks the percentage used', b.pct === 25);
check('reports what is left', b.remaining === 750);
check('is not over budget yet', b.over === false);
Wallet.add({ type: 'expense', amount: 900, category: 'shopping' });
b = Wallet.budgetStatus();
check('flags going over budget', b.over === true);
check('never reports negative remaining', b.remaining === 0);
check('an unset budget is reported as unset', (() => {
  Wallet.setBudget(0);
  return Wallet.budgetStatus().set === false;
})());

// ── filtering ───────────────────────────────────────────────
Store.clear();
console.log('\nfiltering and sorting');
Wallet.add({ type: 'expense', amount: 100, category: 'food', note: 'Pizza night', date: dayKey(5) });
Wallet.add({ type: 'expense', amount: 200, category: 'fun', note: 'Concert', date: dayKey(1) });
Wallet.add({ type: 'income', amount: 300, category: 'income', note: 'Freelance', date: dayKey(3) });

check('lists newest first', Wallet.list()[0].note === 'Concert');
check('filters by category', Wallet.list({ category: 'food' }).length === 1);
check('search is case insensitive', Wallet.list({ query: 'PIZZA' }).length === 1);
check('search matches partial words', Wallet.list({ query: 'con' }).length === 1);
check('an empty search returns everything', Wallet.list({ query: '' }).length === 3);
check('a search with no match returns nothing', Wallet.list({ query: 'zzz' }).length === 0);

// ── month view and insight ──────────────────────────────────
// Entries above are dated relative to today, so near a month boundary
// some of them belong to the previous month. Build this block fresh.
Store.clear();
console.log('\nmonth view');
Wallet.add({ type: 'expense', amount: 400, category: 'food', date: dayKey(0) });
Wallet.add({ type: 'expense', amount: 100, category: 'fun', date: dayKey(0) });
Wallet.add({ type: 'expense', amount: 999, category: 'bills', date: '2020-01-15' });

const m = Wallet.month();
check('month view excludes other months', m.entries.length === 2);
check('month expense totals only this month', m.expense === 500);
check('insight names the top category', Wallet.insight().startsWith('Food'));
check('insight reports the top share', Wallet.insight().includes('80%'));
check('insight handles an empty month', (() => {
  Store.clear();
  return Wallet.insight() === 'No activity this month yet.';
})());

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
