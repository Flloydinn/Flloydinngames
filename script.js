// Scripts específicos da página inicial (index.html)
// Header, menu mobile e ano do rodapé ficam em layout.js; formulário em forms.js.

// Sombra no header ao rolar
const header = document.querySelector('.site-header');
if (header) {
  window.addEventListener('scroll', () => {
    header.style.boxShadow = window.scrollY > 10 ? '0 8px 20px rgba(0,0,0,.35)' : 'none';
  }, { passive: true });
}

// Vídeo em destaque: facade (thumbnail + play). O iframe do YouTube só é criado no clique.
// Usa o vídeo mais recente de data/videos.json; se o JSON falhar, fica o vídeo do HTML (reserva).
(function featuredVideo() {
  const btn = document.getElementById('featuredVideo');
  if (!btn) return;
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;

  function setVideo(id, title) {
    if (!ID_RE.test(id)) return;
    btn.dataset.ytId = id;
    btn.setAttribute('aria-label', 'Assistir: ' + title);
    btn.querySelector('img').src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    btn.querySelector('.yt-facade__title').textContent = title;
  }

  fetch('data/videos.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const list = (d && Array.isArray(d.videos)) ? d.videos : [];
      // mais recente que seja vídeo "normal" (não Short) e que permita incorporação
      const v = list
        .filter(x => x && ID_RE.test(String(x.id)) && x.type !== 'short' && x.embeddable !== false)
        .sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')))[0];
      if (v && !btn.dataset.played) { setVideo(String(v.id), String(v.title || 'Vídeo do canal')); setFeaturedLD(v); }
    })
    .catch(() => { /* mantém o vídeo reserva do HTML */ });

  // JSON-LD do vídeo em destaque (mantém os dados estruturados iguais ao vídeo exibido)
  function setFeaturedLD(v) {
    const el = document.getElementById('ld-featured');
    if (!el || !/^\d{4}-\d{2}-\d{2}$/.test(String(v.published || ''))) return;
    const s = Math.max(1, Math.round(Number(v.dur) || 0)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    const id = String(v.id);
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'VideoObject', '@id': `https://www.youtube.com/watch?v=${id}`,
      name: String(v.title), description: String(v.description || v.title),
      thumbnailUrl: [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`], uploadDate: v.published,
      duration: 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (x || (!h && !m) ? x + 'S' : ''),
      embedUrl: `https://www.youtube.com/embed/${id}`, url: `https://www.youtube.com/watch?v=${id}`,
      inLanguage: 'pt-BR', publisher: { '@id': 'https://flloydinn.netlify.app/#org' },
    }).replace(/</g, '\\u003c');
  }

  btn.addEventListener('click', () => {
    const id = btn.dataset.ytId;
    if (!ID_RE.test(id)) return;
    btn.dataset.played = '1';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = btn.querySelector('.yt-facade__title').textContent || 'Vídeo do YouTube';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.setAttribute('frameborder', '0');
    btn.replaceWith(iframe);
    iframe.focus();
    try { window.gtag && gtag('event', 'video_play', { video_id: id, location: 'home_featured' }); } catch (e) {}
  });
})();

// Números do canal nos cards "Sobre" (data/canal.json, gerado pelo script de sincronização).
// Se o JSON não carregar, ficam os valores escritos no HTML.
(function channelStats() {
  const els = document.querySelectorAll('[data-canal]');
  if (!els.length) return;
  fetch('data/canal.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const st = d && d.stats;
      if (!st) return;
      els.forEach(el => {
        const v = Number(st[el.dataset.canal]);
        if (Number.isFinite(v) && v > 0) el.textContent = v.toLocaleString('pt-BR');
      });
    })
    .catch(() => {});
})();

// Rolagem suave para âncoras internas (#sobre, #jogos, #contato…)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const id = this.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      // #topo é o próprio header (sticky): vai direto ao início da página
      const top = target.classList.contains('site-header') ? 0 : target.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
