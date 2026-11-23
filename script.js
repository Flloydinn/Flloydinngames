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
      if (v && !btn.dataset.played) setVideo(String(v.id), String(v.title || 'Vídeo do canal'));
    })
    .catch(() => { /* mantém o vídeo reserva do HTML */ });

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
