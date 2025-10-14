document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form');
  const list = document.getElementById('list');

  async function load() {
    const res = await fetch('/api/records');
    const data = await res.json();
    list.innerHTML = data.map(r => {
      const media = renderMedia(r.mediaUrl);
      return `<div class="rec"><strong>${escapeHtml(r.name)}</strong> <div class="note">${escapeHtml(r.note)}</div>${media}<div class="meta">${r.createdAt}</div></div>`;
    }).join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const note = document.getElementById('note').value.trim();
    const mediaUrl = document.getElementById('mediaUrl').value.trim();
    const mediaFileInput = document.getElementById('mediaFile');
    if (!name) return;
    // If a file is selected, use multipart/form-data
    if (mediaFileInput && mediaFileInput.files && mediaFileInput.files.length > 0) {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('note', note);
      fd.append('mediaFile', mediaFileInput.files[0]);
      await fetch('/api/records', { method: 'POST', body: fd });
    } else {
      await fetch('/api/records', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name, note, mediaUrl: mediaUrl || null }) });
    }
    form.reset();
    load();
  });

  // background music toggle
  const musicToggle = document.getElementById('musicToggle');
  const bgMusic = document.getElementById('bgMusic');
  if (musicToggle && bgMusic) {
    musicToggle.addEventListener('click', () => {
      if (bgMusic.paused) { bgMusic.play().catch(()=>{}); musicToggle.textContent = 'Pause background music'; }
      else { bgMusic.pause(); musicToggle.textContent = 'Play background music'; }
    });
  }

  function escapeHtml(s) { return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;', '"':'&quot;'}[c])); }

  function renderMedia(url) {
    if (!url) return '';
    const u = String(url).trim();
    if (u.match(/\.(png|jpe?g|gif|webp)(\?|$)/i)) return `<div class="media"><img src="${escapeHtml(u)}" alt="media" /></div>`;
    if (u.match(/\.(mp4|webm)(\?|$)/i)) return `<div class="media"><video controls src="${escapeHtml(u)}"></video></div>`;
    return `<div class="media"><a href="${escapeHtml(u)}" target="_blank" rel="noopener">View media</a></div>`;
  }

  load();
});
