import { EVENT_TYPES, normalizeInput, dateFromWeeks, weeksUntil } from './lib/plan-core.js';
import { fallbackPlan } from './lib/fallback.js';

const STORE_KEY = 'celebrate.plans.v1';
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let current = null; // { id, input, plan, source, progress, updated }

// ---------- storage (per browser only) ----------
function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* storage may be blocked */ }
}
function saveCurrent() {
  if (!current) return;
  current.updated = Date.now();
  const all = loadAll();
  all[current.id] = current;
  saveAll(all);
  refreshSavedList();
}
function refreshSavedList() {
  const all = Object.values(loadAll()).sort((a, b) => b.updated - a.updated);
  const sel = $('#saved');
  sel.innerHTML = '<option value="">My saved plans</option>' +
    all.map((p) => `<option value="${esc(p.id)}">${esc(p.plan.title)}${p.input.date ? ' · ' + esc(p.input.date) : ''}</option>`).join('');
  sel.value = current?.id || '';
}

// ---------- helpers ----------
function money(n, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch { return `${Math.round(n).toLocaleString()} ${currency}`; }
}
function prettyDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3500);
}
function setLoading(on, text = 'Planning your celebration…') {
  $('#loading').hidden = !on;
  $('#loadingText').textContent = text;
  document.querySelectorAll('#generateBtn, #refineBtn, #regenBtn').forEach((b) => (b.disabled = on));
}

// ---------- API ----------
async function requestPlan(payload) {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.code = data.code;
    throw err;
  }
  return data;
}

async function generate(input, keepId) {
  setLoading(true);
  let plan, source;
  try {
    ({ plan, source } = await requestPlan({ mode: 'create', input }));
  } catch (err) {
    plan = fallbackPlan(input);
    source = 'template';
    toast(err.code === 'NO_KEY' ? 'AI key not set — showing a sample plan.' : 'AI is busy — showing a sample plan. Try Regenerate.');
  } finally {
    setLoading(false);
  }
  const old = keepId ? current : null;
  current = {
    id: keepId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    input, plan, source,
    progress: old?.progress || { spent: {}, tasks: {}, vendors: {} },
  };
  saveCurrent();
  showPlan();
}

async function refine(message) {
  if (!current || !message.trim()) return;
  setLoading(true, 'Updating your plan…');
  try {
    const { plan } = await requestPlan({ mode: 'refine', input: current.input, plan: current.plan, message });
    current.plan = plan;
    current.source = 'gemini';
    saveCurrent();
    renderPlan();
    $('#refineInput').value = '';
    toast('Plan updated ✨');
  } catch (err) {
    toast(err.code === 'NO_KEY' ? 'Changes need the AI key to be set on the server.' : 'Could not update the plan. Please try again.');
  } finally {
    setLoading(false);
  }
}

// ---------- views ----------
function showForm(input) {
  $('#planView').hidden = true;
  $('#formView').hidden = false;
  const el = $('#eventForm').elements;
  if (input) {
    ['type', 'name', 'date', 'guests', 'budget', 'currency', 'location', 'theme', 'notes'].forEach((k) => (el.namedItem(k).value = input[k] ?? ''));
  }
  el.namedItem('name').focus();
}

function showPlan() {
  $('#formView').hidden = true;
  $('#planView').hidden = false;
  renderPlan();
  selectTab('tab-budget');
  $('#planTitle').focus?.();
  window.scrollTo({ top: 0 });
}

function renderPlan() {
  const { input, plan, source, progress } = current;
  $('#planMeta').textContent = `${EVENT_TYPES[input.type]} · ${input.date ? prettyDate(input.date) : 'Date not set'} · ${input.guests} guests${input.location ? ' · ' + input.location : ''}`;
  $('#planTitle').textContent = plan.title;
  $('#planSummary').textContent = plan.summary;
  const note = $('#sourceNote');
  note.hidden = source === 'gemini';
  note.textContent = 'This is a sample plan from built-in templates (the AI was not available). Press Regenerate to try the AI again.';

  // stats
  const spent = plan.budget.reduce((s, b) => s + (Number(progress.spent[b.category]) || 0), 0);
  const tasksDone = plan.timeline.filter((t) => progress.tasks[t.task]).length;
  const vendorsDone = plan.vendors.filter((v) => progress.vendors[v.type]).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const days = input.date ? Math.round((new Date(input.date + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 864e5) : null;
  $('#stats').innerHTML = [
    [days === null ? '—' : days < 0 ? 'Done' : days, days === null ? 'Set a date' : 'days to go', null],
    [money(input.budget - spent, input.currency), `left of ${money(input.budget, input.currency)}`, pct(spent, input.budget)],
    [`${tasksDone}/${plan.timeline.length}`, 'tasks done', pct(tasksDone, plan.timeline.length)],
    [`${vendorsDone}/${plan.vendors.length}`, 'vendors booked', pct(vendorsDone, plan.vendors.length)],
  ].map(([v, l, p]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span>${p === null ? '' : `<div class="progress" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i></div>`}</div>`).join('');

  renderBudget(); renderTimeline(); renderVendors(); renderIdeas(); renderDay();
}

function renderBudget() {
  const { input, plan, progress } = current;
  const total = input.budget || 1;
  const rows = plan.budget.map((b, i) => {
    const spent = Number(progress.spent[b.category]) || 0;
    const share = Math.round((b.amount / total) * 100);
    return `<tr>
      <td><strong>${esc(b.category)}</strong><div class="small">${esc(b.notes)}</div>
        <div class="bar" aria-hidden="true"><i style="width:${share}%"></i></div></td>
      <td class="num">${money(b.amount, input.currency)}<div class="small">${share}%</div></td>
      <td class="num"><label class="sr-only" for="spent-${i}">Spent on ${esc(b.category)}</label>
        <input id="spent-${i}" type="number" min="0" inputmode="numeric" data-cat="${esc(b.category)}" value="${spent || ''}" placeholder="0"></td>
      <td class="num ${spent > b.amount ? 'over' : ''}">${money(b.amount - spent, input.currency)}</td>
    </tr>`;
  }).join('');
  const spentTotal = plan.budget.reduce((s, b) => s + (Number(progress.spent[b.category]) || 0), 0);
  $('#panel-budget').innerHTML = `<h2>Budget breakdown</h2>
    <p class="small">Enter what you actually spend to track what's left. Per guest: ${money(input.budget / input.guests, input.currency)}.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Category</th><th class="num">Planned</th><th class="num">Spent</th><th class="num">Left</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th>Total</th><th class="num">${money(input.budget, input.currency)}</th><th class="num">${money(spentTotal, input.currency)}</th>
        <th class="num ${spentTotal > input.budget ? 'over' : ''}">${money(input.budget - spentTotal, input.currency)}</th></tr></tfoot>
    </table></div>`;
}

function renderTimeline() {
  const { input, plan, progress } = current;
  const today = todayStr();
  const items = plan.timeline.map((t, i) => {
    const due = dateFromWeeks(input.date, t.weeks_before);
    const done = !!progress.tasks[t.task];
    const late = !done && due && due < today;
    const when = t.weeks_before === 0 ? 'Event week' : `${t.weeks_before} wk before`;
    return `<li class="${done ? 'done' : ''}">
      <input type="checkbox" id="task-${i}" data-task="${esc(t.task)}" ${done ? 'checked' : ''}>
      <div class="body"><label for="task-${i}" class="title">${esc(t.task)}</label>
        <div><span class="tag">${esc(t.category)}</span><span class="tag ${late ? 'late' : ''}">${late ? 'Overdue · ' : ''}${esc(due ? prettyDate(due) : when)}</span>${due ? `<span class="small">${esc(when)}</span>` : ''}</div>
      </div></li>`;
  }).join('');
  $('#panel-timeline').innerHTML = `<h2>Planning timeline</h2>
    <p class="small">${weeksUntil(input.date)} weeks to go. Tick tasks as you finish them.</p><ul class="checklist">${items}</ul>`;
}

function renderVendors() {
  const { plan, progress, input } = current;
  const items = plan.vendors.map((v, i) => {
    const done = !!progress.vendors[v.type];
    const by = dateFromWeeks(input.date, v.book_weeks_before);
    return `<li class="${done ? 'done' : ''}">
      <input type="checkbox" id="vendor-${i}" data-vendor="${esc(v.type)}" ${done ? 'checked' : ''}>
      <div class="body"><label for="vendor-${i}" class="title">${esc(v.type)}</label>
        <div><span class="tag">${done ? 'Booked' : 'To book'}</span>${by ? `<span class="tag">Book by ${esc(prettyDate(by))}</span>` : ''}${v.est_cost ? `<span class="small">Est. ${esc(v.est_cost)}</span>` : ''}</div>
        ${v.questions.length ? `<ul class="vendor-q">${v.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
      </div></li>`;
  }).join('');
  $('#panel-vendors').innerHTML = `<h2>Vendor checklist</h2>
    <p class="small">Questions to ask each vendor before you sign. Tick them off once booked.</p><ul class="checklist">${items}</ul>`;
}

function renderIdeas() {
  const { plan } = current;
  $('#panel-ideas').innerHTML = `<h2>Personalised ideas</h2>
    <div class="ideas">${plan.ideas.map((i) => `<article class="idea"><h3>${esc(i.title)}</h3><p>${esc(i.description)}</p></article>`).join('')}</div>
    ${plan.tips.length ? `<h2 style="margin-top:20px">Planner tips</h2><ul class="tips">${plan.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
}

function renderDay() {
  const { plan } = current;
  $('#panel-day').innerHTML = `<h2>Event-day run sheet</h2>
    <ol class="schedule">${plan.schedule.map((s) => `<li><time>${esc(s.time)}</time> ${esc(s.activity)}</li>`).join('')}</ol>`;
}

// ---------- tabs (keyboard accessible) ----------
function selectTab(id) {
  document.querySelectorAll('[role="tab"]').forEach((t) => {
    const on = t.id === id;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
}
const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t.id));
  t.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const next = tabs[(i + step + tabs.length) % tabs.length];
    selectTab(next.id); next.focus();
  });
});

// ---------- events ----------
$('#eventForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const err = $('#formError');
  if (!data.date) { err.textContent = 'Please choose the event date.'; err.hidden = false; e.target.date.focus(); return; }
  if (data.date < todayStr()) { err.textContent = 'The event date should be today or later.'; err.hidden = false; e.target.date.focus(); return; }
  if (!(Number(data.budget) > 0)) { err.textContent = 'Please enter a budget above zero.'; err.hidden = false; e.target.budget.focus(); return; }
  err.hidden = true;
  const editing = current && !$('#formView').dataset.fresh;
  generate(normalizeInput(data), editing ? current.id : null);
});

$('#planView').addEventListener('change', (e) => {
  const el = e.target;
  if (!current) return;
  if (el.dataset.cat !== undefined) current.progress.spent[el.dataset.cat] = Math.max(0, Number(el.value) || 0);
  else if (el.dataset.task !== undefined) current.progress.tasks[el.dataset.task] = el.checked;
  else if (el.dataset.vendor !== undefined) current.progress.vendors[el.dataset.vendor] = el.checked;
  else return;
  saveCurrent();
  const active = document.querySelector('[role="tab"][aria-selected="true"]').id;
  const focusId = el.id;
  renderPlan(); selectTab(active);
  document.getElementById(focusId)?.focus();
});

$('#refineForm').addEventListener('submit', (e) => { e.preventDefault(); refine($('#refineInput').value); });
document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => refine(c.textContent)));
$('#editBtn').addEventListener('click', () => { delete $('#formView').dataset.fresh; showForm(current.input); });
$('#regenBtn').addEventListener('click', () => generate(current.input, current.id));
$('#printBtn').addEventListener('click', () => window.print());
$('#deleteBtn').addEventListener('click', () => {
  if (!confirm('Delete this plan from this browser?')) return;
  const all = loadAll(); delete all[current.id]; saveAll(all);
  current = null; refreshSavedList(); newPlan();
});
$('#newPlan').addEventListener('click', () => newPlan());
$('#saved').addEventListener('change', (e) => {
  const p = loadAll()[e.target.value];
  if (p) { current = p; showPlan(); refreshSavedList(); }
});

function newPlan() {
  $('#formView').dataset.fresh = '1';
  $('#eventForm').reset();
  current = null;
  refreshSavedList();
  showForm();
}

// ---------- start ----------
$('#eventForm').date.min = todayStr();
$('#formView').dataset.fresh = '1';
refreshSavedList();
const latest = Object.values(loadAll()).sort((a, b) => b.updated - a.updated)[0];
if (latest) { current = latest; showPlan(); refreshSavedList(); }
