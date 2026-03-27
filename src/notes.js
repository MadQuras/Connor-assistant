const notesList = document.getElementById('notesList');
const noteInput = document.getElementById('noteInput');
const btnAdd = document.getElementById('btnAdd');

function makeBtn(label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function refresh() {
  const st = await window.api?.notesGetState?.();
  const notes = Array.isArray(st?.notes) ? st.notes : [];
  notesList.innerHTML = '';
  for (const n of notes) {
    const item = document.createElement('div');
    item.className = 'item';

    const ta = document.createElement('textarea');
    ta.value = n.text || '';
    item.appendChild(ta);

    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(makeBtn('Сохранить', async () => {
      await window.api?.notesUpdate?.({ id: n.id, text: ta.value });
      await refresh();
    }));
    row.appendChild(makeBtn('Удалить', async () => {
      await window.api?.notesRemove?.({ id: n.id });
      await refresh();
    }));
    row.appendChild(makeBtn('Копировать', async () => {
      await window.api?.notesCopy?.({ text: ta.value });
    }));
    item.appendChild(row);

    notesList.appendChild(item);
  }
}

btnAdd?.addEventListener('click', async () => {
  const text = String(noteInput?.value || '').trim();
  if (!text) return;
  await window.api?.notesAdd?.({ text });
  noteInput.value = '';
  await refresh();
});

window.api?.onNotesUpdate?.(() => {
  refresh();
});

refresh();
