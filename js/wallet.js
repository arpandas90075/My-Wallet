/* ─────────────────────────────────────────────────────────────
   wallet.js — the rules and the arithmetic
   Pure functions over Store. No DOM, so tests/wallet.test.js can
   require this file directly in Node.
   ───────────────────────────────────────────────────────────── */

const Wallet = {

  MAX_AMOUNT: 1e9,

  round(v) {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  },

  /** YYYY-MM-DD for any Date, in local time (not UTC). */
  key(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  // ── writing ────────────────────────────────────────────────

  add({ type, amount, category, note, date }) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0)
      return { ok: false, error: 'Enter an amount greater than zero.' };
    if (value > this.MAX_AMOUNT)
      return { ok: false, error: 'That amount is too large.' };
    if (type !== 'income' && type !== 'expense')
      return { ok: false, error: 'Choose income or expense.' };

    const cat = Store.category(type === 'income' ? 'income' : category);
    if (type === 'expense' && cat.id === 'income')
      return { ok: false, error: 'Pick a spending category.' };

    const when = date ? new Date(date + 'T12:00:00') : new Date();
    if (Number.isNaN(when.getTime()))
      return { ok: false, error: 'That date is not valid.' };

    const entry = Store.add({
      type,
      amount: this.round(value),
      category: cat.id,
      note: String(note || '').trim().slice(0, 60) || cat.label,
      date: when
    });
    return { ok: true, entry };
  },

  remove(id) {
    return Store.remove(id)
      ? { ok: true }
      : { ok: false, error: 'That entry no longer exists.' };
  },

  /** Wipe every entry and the budget — every total returns to zero. */
  reset() {
    const cleared = Store.all().length;
    Store.clear();
    return { ok: true, cleared };
  },

  setBudget(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'Enter a valid budget.' };
    Store.budget = this.round(v);
    return { ok: true, budget: Store.budget };
  },

  // ── reading ────────────────────────────────────────────────

  /** Newest first, optionally narrowed by category or free text. */
  list({ category = 'all', query = '' } = {}) {
    const q = query.trim().toLowerCase();
    return Store.all()
      .filter(e => category === 'all' || e.category === category)
      .filter(e => !q || e.note.toLowerCase().includes(q) || String(e.amount).includes(q))
      .sort((a, b) => b.date - a.date || b.id - a.id);
  },

  totals(entries = Store.all()) {
    let income = 0, expense = 0;
    for (const e of entries) {
      if (e.type === 'income') income += e.amount;
      else expense += e.amount;
    }
    income = this.round(income);
    expense = this.round(expense);
    return { income, expense, balance: this.round(income - expense) };
  },

  /** Everything dated inside the given calendar month. */
  month(date = new Date()) {
    const d = new Date(date);
    const entries = Store.all().filter(e =>
      e.date.getFullYear() === d.getFullYear() && e.date.getMonth() === d.getMonth());
    return { entries, ...this.totals(entries) };
  },

  /** Spend per expense category, biggest first, with its share of the total. */
  byCategory(entries = Store.all()) {
    const totals = new Map();
    let sum = 0;
    for (const e of entries) {
      if (e.type !== 'expense') continue;
      totals.set(e.category, this.round((totals.get(e.category) || 0) + e.amount));
      sum += e.amount;
    }
    return [...totals.entries()]
      .map(([id, total]) => ({
        ...Store.category(id),
        total,
        share: sum ? this.round((total / sum) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  },

  /** Daily expense totals for the last n days, oldest first. */
  lastDays(n = 7, today = new Date()) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ key: this.key(d), date: d, total: 0 });
    }
    const index = new Map(days.map(d => [d.key, d]));
    for (const e of Store.all()) {
      if (e.type !== 'expense') continue;
      const slot = index.get(this.key(e.date));
      if (slot) slot.total = this.round(slot.total + e.amount);
    }
    return days;
  },

  /** How the month is tracking against the budget. */
  budgetStatus(date = new Date()) {
    const limit = Store.budget;
    const spent = this.month(date).expense;
    const pct = limit ? this.round((spent / limit) * 100) : 0;
    return {
      limit,
      spent,
      pct,
      remaining: this.round(Math.max(limit - spent, 0)),
      over: limit > 0 && spent > limit,
      set: limit > 0
    };
  },

  /** One-line read on the month, used under the balance. */
  insight(date = new Date()) {
    const m = this.month(date);
    if (!m.entries.length) return 'No activity this month yet.';
    const top = this.byCategory(m.entries)[0];
    if (!top) return 'Only income so far this month.';
    return `${top.label} is your biggest category at ${top.share}% of spending.`;
  }
};

if (typeof module !== 'undefined') module.exports = { Wallet };
