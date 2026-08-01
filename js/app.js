/* ─────────────────────────────────────────────────────────────
   app.js — wiring
   Holds the view state (entry type, filters, theme), listens for
   input, calls Wallet, asks UI to repaint.
   Load order: store → wallet → chart → ui → app.
   ───────────────────────────────────────────────────────────── */

const App = {

  type: 'expense',
  filters: { category: 'all', query: '' },

  init() {
    UI.buildCategorySelects();
    this.applyTheme(matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    UI.$('#date').value = Wallet.key(new Date());

    this.bindForm();
    this.bindBudget();
    this.bindFilters();
    this.bindReset();
    this.bindChrome();

    this.seed();
    UI.renderAll(this.filters);
  },

  /** A few entries so the charts have something to show. */
  seed() {
    const day = n => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return Wallet.key(d);
    };
    Wallet.setBudget(30000);
    UI.$('#budget').value = 30000;
    [
      ['income',  62000, 'income',    'Monthly salary', day(6)],
      ['expense',  1840, 'food',      'Weekly groceries', day(5)],
      ['expense',  9500, 'bills',     'Electricity + internet', day(4)],
      ['expense',   420, 'transport', 'Cab to office', day(3)],
      ['expense',  2600, 'shopping',  'Running shoes', day(2)],
      ['expense',   780, 'food',      'Dinner with friends', day(1)],
      ['expense',  1200, 'health',    'Pharmacy', day(0)],
      ['expense',   350, 'fun',       'Cinema ticket', day(0)]
    ].forEach(([type, amount, category, note, date]) =>
      Wallet.add({ type, amount, category, note, date }));
  },

  // ── add / delete ───────────────────────────────────────────

  bindForm() {
    UI.$$('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.type = btn.dataset.type;
        UI.$$('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
        // the category picker is meaningless for income
        UI.$('#category').disabled = this.type === 'income';
        UI.$('#category-row').style.opacity = this.type === 'income' ? '.55' : '1';
      });
    });

    UI.$('#btn-add').addEventListener('click', () => this.addEntry());
    UI.$('#amount').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.addEntry();
    });
    UI.$('#note').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.addEntry();
    });

    // one listener for every delete button, now and in future renders
    UI.$('#entries').addEventListener('click', e => {
      const button = e.target.closest('.del');
      if (!button) return;
      Wallet.remove(button.dataset.id);
      UI.renderAll(this.filters);
    });
  },

  addEntry() {
    const res = Wallet.add({
      type: this.type,
      amount: UI.$('#amount').value,
      category: UI.$('#category').value,
      note: UI.$('#note').value,
      date: UI.$('#date').value
    });

    if (!res.ok) return UI.error(res.error);

    UI.error(null);
    UI.$('#amount').value = '';
    UI.$('#note').value = '';
    UI.$('#amount').focus();
    UI.renderAll(this.filters);
  },

  // ── reset ──────────────────────────────────────────────────

  /**
   * Two-step, so a stray click cannot wipe the wallet: the first
   * click arms the button, the second one clears everything. It
   * disarms itself after four seconds.
   */
  bindReset() {
    const btn = UI.$('#btn-reset');
    let armed = false;
    let timer;

    const disarm = () => {
      armed = false;
      clearTimeout(timer);
      btn.classList.remove('armed');
      btn.textContent = 'Reset wallet';
    };

    btn.addEventListener('click', () => {
      if (!armed) {
        if (!Store.all().length && !Store.budget) {
          UI.error('The wallet is already empty.');
          return;
        }
        armed = true;
        btn.classList.add('armed');
        btn.textContent = 'Tap again to clear';
        timer = setTimeout(disarm, 4000);
        return;
      }

      clearTimeout(timer);
      const { cleared } = Wallet.reset();

      // put the form and the filters back to their starting state
      this.filters = { category: 'all', query: '' };
      UI.$('#search').value = '';
      UI.$('#filter').value = 'all';
      UI.$('#budget').value = '';
      UI.$('#amount').value = '';
      UI.$('#note').value = '';
      UI.$('#date').value = Wallet.key(new Date());
      UI.renderAll(this.filters);

      armed = false;
      btn.classList.remove('armed');
      btn.textContent = cleared ? `Cleared ${cleared}` : 'Cleared';
      setTimeout(() => { btn.textContent = 'Reset wallet'; }, 1800);
    });
  },

  // ── budget ─────────────────────────────────────────────────

  bindBudget() {
    const save = () => {
      const res = Wallet.setBudget(UI.$('#budget').value || 0);
      if (!res.ok) return UI.error(res.error);
      UI.renderBudget();
    };
    UI.$('#btn-budget').addEventListener('click', save);
    UI.$('#budget').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  },

  // ── filters ────────────────────────────────────────────────

  bindFilters() {
    UI.$('#search').addEventListener('input', e => {
      this.filters.query = e.target.value;
      UI.renderEntries(this.filters);
    });
    UI.$('#filter').addEventListener('change', e => {
      this.filters.category = e.target.value;
      UI.renderEntries(this.filters);
    });
  },

  // ── theme, currency, resize ────────────────────────────────

  bindChrome() {
    UI.$('#theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      UI.renderCategories();   // canvases must be redrawn in the new palette
      UI.renderWeek();
    });

    UI.$('#currency').addEventListener('change', e => {
      UI.currency = e.target.value;
      UI.$$('.sym').forEach(s => { s.textContent = UI.currency; });
      UI.renderAll(this.filters);
    });

    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { UI.renderCategories(); UI.renderWeek(); }, 120);
    });
  },

  applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    UI.$('#theme-icon').textContent = theme === 'dark' ? '◐' : '◑';
    UI.$('#theme-toggle').setAttribute(
      'aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
