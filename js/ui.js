/* ─────────────────────────────────────────────────────────────
   ui.js — rendering only
   Reads from Wallet, writes to the page. Never mutates state.
   ───────────────────────────────────────────────────────────── */

const UI = {

  currency: '₹',

  $(sel) { return document.querySelector(sel); },
  $$(sel) { return [...document.querySelectorAll(sel)]; },

  money(v, sign = '') {
    const n = Math.abs(Number(v)).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${sign}${this.currency}${n}`;
  },

  day(date) {
    return new Date(date).toLocaleDateString('en-US', {
      day: '2-digit', month: 'short', year: '2-digit'
    });
  },

  error(message) {
    const el = this.$('#error');
    if (!message) { el.classList.add('hidden'); return; }
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3200);
  },

  /** Fill both category dropdowns from the single source of truth. */
  buildCategorySelects() {
    const spend = CATEGORIES.filter(c => c.kind === 'expense');
    this.$('#category').innerHTML =
      spend.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    this.$('#filter').innerHTML =
      '<option value="all">All categories</option>' +
      CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  },

  /** One call repaints every surface. */
  renderAll(filters) {
    this.renderSummary();
    this.renderBudget();
    this.renderCategories();
    this.renderWeek();
    this.renderEntries(filters);
  },

  renderSummary() {
    const t = Wallet.totals();
    this.$('#balance').textContent = this.money(t.balance, t.balance < 0 ? '−' : '');
    this.$('#income').textContent = this.money(t.income);
    this.$('#expense').textContent = this.money(t.expense);
    this.$('#month-spend').textContent = this.money(Wallet.month().expense);
    this.$('#insight').textContent = Wallet.insight();
  },

  renderBudget() {
    const b = Wallet.budgetStatus();
    const fill = this.$('#budget-fill');
    const note = this.$('#budget-note');

    fill.style.width = Math.min(b.pct, 100) + '%';
    fill.classList.toggle('over', b.over);

    if (!b.set) {
      note.textContent = 'No budget set for this month.';
      return;
    }
    note.textContent = b.over
      ? `Over budget by ${this.money(b.spent - b.limit)} — ${b.pct}% of ${this.money(b.limit)}.`
      : `${this.money(b.spent)} of ${this.money(b.limit)} used · ${this.money(b.remaining)} left.`;
  },

  renderCategories() {
    const slices = Wallet.byCategory();
    Chart.donut(this.$('#donut'), slices);

    const legend = this.$('#legend');
    legend.innerHTML = slices.length
      ? slices.map(s => `
          <li>
            <span class="dot" style="background:${s.color}"></span>
            ${s.label}
            <span class="amt">${this.money(s.total)} · ${s.share}%</span>
          </li>`).join('')
      : '<li class="muted">Add an expense to see the split.</li>';
  },

  renderWeek() {
    const days = Wallet.lastDays(7);
    Chart.week(this.$('#week-chart'), days);
    const total = days.reduce((s, d) => s + d.total, 0);
    this.$('#week-total').textContent = this.money(total);
  },

  renderEntries(filters) {
    const rows = Wallet.list(filters);
    const list = this.$('#entries');
    const all = Store.all().length;

    this.$('#count').textContent = all
      ? `${rows.length} of ${all} ${all === 1 ? 'entry' : 'entries'}`
      : 'Nothing recorded yet.';

    if (!rows.length) {
      list.innerHTML = `<li class="empty">${all ? 'No entries match that filter.' : 'Your wallet is empty — add your first entry.'}</li>`;
      return;
    }

    list.innerHTML = rows.map(e => {
      const cat = Store.category(e.category);
      const income = e.type === 'income';
      return `
        <li class="entry">
          <span class="tag" style="background:${cat.color}22; color:${cat.color}">
            ${cat.label.slice(0, 2).toUpperCase()}
          </span>
          <span class="body">
            <p>${this.escape(e.note)}</p>
            <span class="muted">${cat.label} · ${this.day(e.date)}</span>
          </span>
          <span class="amt ${income ? 'up' : 'down'}">
            ${this.money(e.amount, income ? '+' : '−')}
          </span>
          <button class="del" data-id="${e.id}" aria-label="Delete entry">×</button>
        </li>`;
    }).join('');
  },

  escape(text) {
    return String(text).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
};
