/* ─────────────────────────────────────────────────────────────
   store.js — in-memory state
   One array of entries plus a monthly budget. Nothing is written
   to disk or to the browser; a refresh starts the wallet over.
   ───────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: 'food',      label: 'Food',      color: '#22d3ee', kind: 'expense' },
  { id: 'transport', label: 'Transport', color: '#818cf8', kind: 'expense' },
  { id: 'shopping',  label: 'Shopping',  color: '#f472b6', kind: 'expense' },
  { id: 'bills',     label: 'Bills',     color: '#fbbf24', kind: 'expense' },
  { id: 'health',    label: 'Health',    color: '#34d399', kind: 'expense' },
  { id: 'fun',       label: 'Fun',       color: '#a78bfa', kind: 'expense' },
  { id: 'other',     label: 'Other',     color: '#94a3b8', kind: 'expense' },
  { id: 'income',    label: 'Income',    color: '#4ade80', kind: 'income'  }
];

const Store = {
  entries: [],
  nextId: 1,
  budget: 0,          // monthly spending cap, 0 means "not set"

  add(entry) {
    const record = { id: this.nextId++, ...entry };
    this.entries.push(record);
    return record;
  },

  remove(id) {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.id !== Number(id));
    return this.entries.length < before;
  },

  get(id) {
    return this.entries.find(e => e.id === Number(id)) || null;
  },

  all() {
    return [...this.entries];
  },

  category(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 2];
  },

  /** Back to a brand new wallet: no entries, no budget, ids from 1. */
  clear() {
    this.entries = [];
    this.nextId = 1;
    this.budget = 0;
  }
};

if (typeof module !== 'undefined') module.exports = { Store, CATEGORIES };
