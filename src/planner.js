const tabs = Array.from(document.querySelectorAll('.tab'));
const panes = {
  reminders: document.getElementById('tab-reminders'),
  timers: document.getElementById('tab-timers'),
  alarms: document.getElementById('tab-alarms'),
};

const remindersList = document.getElementById('remindersList');
const timersList = document.getElementById('timersList');
const alarmsList = document.getElementById('alarmsList');
const timerMinutes = document.getElementById('timerMinutes');
const alarmTime = document.getElementById('alarmTime');

function setTab(tab) {
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  Object.entries(panes).forEach(([k, el]) => el.classList.toggle('hidden', k !== tab));
}

tabs.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

function item(text) {
  const div = document.createElement('div');
  div.className = 'item';
  div.textContent = text;
  return div;
}

function render(data) {
  const timers = data?.timers?.timers || [];
  const alarms = data?.timers?.alarms || [];
  const reminders = Array.isArray(data?.reminders) ? data.reminders : [];

  remindersList.innerHTML = '';
  timersList.innerHTML = '';
  alarmsList.innerHTML = '';

  if (!reminders.length) remindersList.appendChild(item('Напоминаний нет'));
  else reminders.slice(0, 50).forEach((r) => remindersList.appendChild(item(`${r.message || r.title || 'Напоминание'} — ${new Date(Number(r.ts || r.time || Date.now())).toLocaleString('ru-RU')}`)));

  if (!timers.length) timersList.appendChild(item('Активных таймеров нет'));
  else timers.forEach((t) => timersList.appendChild(item(`${t.label}: ${t.remainingSec} сек`)));

  if (!alarms.length) alarmsList.appendChild(item('Будильники не заданы'));
  else alarms.forEach((a) => alarmsList.appendChild(item(`Будильник: ${a.time}`)));
}

document.getElementById('btnAddTimer')?.addEventListener('click', async () => {
  const minutes = Number(timerMinutes?.value || 1);
  await window.api?.plannerAddTimer?.({ minutes });
  const st = await window.api?.plannerGetState?.();
  render(st);
});

document.getElementById('btnStopTimer')?.addEventListener('click', async () => {
  await window.api?.plannerStopTimer?.({});
  const st = await window.api?.plannerGetState?.();
  render(st);
});

document.getElementById('btnClearTimers')?.addEventListener('click', async () => {
  await window.api?.plannerClearTimers?.();
  const st = await window.api?.plannerGetState?.();
  render(st);
});

document.getElementById('btnAddAlarm')?.addEventListener('click', async () => {
  const time = String(alarmTime?.value || '').trim();
  if (!time) return;
  await window.api?.plannerAddAlarm?.({ time });
  const st = await window.api?.plannerGetState?.();
  render(st);
});

window.api?.onPlannerUpdate?.((data) => render(data));

(async () => {
  const st = await window.api?.plannerGetState?.();
  render(st || {});
})();
