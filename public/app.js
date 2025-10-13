document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  const list = document.getElementById('list');

  async function load() {
    const res = await fetch('/api/records');
    const data = await res.json();
    list.innerHTML = data.map(r => `<div class="rec"><strong>${escapeHtml(r.name)}</strong> <div class="note">${escapeHtml(r.note)}</div><div class="meta">${r.createdAt}</div></div>`).join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const note = document.getElementById('note').value.trim();
    if (!name) return;
    await fetch('/api/records', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name, note }) });
    form.reset();
    load();
  });

  function escapeHtml(s) { return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;'}[c])); }

  load();
});
