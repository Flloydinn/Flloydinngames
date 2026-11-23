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

// ====== Faixa "Em destaque agora" (dados reais; o HTML é a reserva se algo falhar) ======
(function highlights() {
  const elV = document.getElementById('hlVideo'), elG = document.getElementById('hlGame'), elN = document.getElementById('hlNext');
  if (!elV || !elG || !elN) return;
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const TZ = 'America/Sao_Paulo';
  const EPOCH = Date.parse('2025-01-01T00:00:00-03:00'); // mesmo marco da tv.html
  const fmtDur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const fill = (card, { href, img, kicker, name, meta }) => {
    if (href) card.href = href;
    const im = card.querySelector('.hl-media img'); if (im && img) im.src = img;
    card.querySelector('.hl-kicker').textContent = kicker;
    card.querySelector('.hl-name').textContent = name;
    card.querySelector('.hl-meta').textContent = meta;
  };
  const get = url => fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);

  // jogo do dia: muda a cada dia (mesmo jogo para todo mundo no dia, pelo horário de Brasília)
  const GAMES = [['asteroid.html', 'Space Courier 3D', 'space-courier'], ['runner.html', 'Neon Runner 3D', 'neon-runner'],
    ['drifter.html', 'Desert Drifter 3D', 'desert-drifter'], ['minigolf.html', 'Galaxy MiniGolf 3D', 'galaxy-minigolf'],
    ['wildlands-online.html', 'Wildlands Online', 'wildlands-online'], ['arcade.html', 'Arcade: Parry, Aim e Quiz', 'arcade']];
  const brtDay = Math.floor((Date.now() - 3 * 3600e3) / 864e5);
  const g = GAMES[brtDay % GAMES.length];
  fill(elG, { href: g[0], img: `assets/games/${g[2]}.svg`, kicker: 'Jogo do dia no Arcade', name: g[1], meta: 'Grátis no navegador' });

  // vídeo mais recente do canal
  get('data/videos.json').then(d => {
    const v = (d && Array.isArray(d.videos) ? d.videos : []).filter(x => x && ID_RE.test(String(x.id)))
      .sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')))[0];
    if (!v) return;
    const kind = v.type === 'short' ? 'Short' : v.type === 'live' ? 'Live' : 'Gameplay';
    fill(elV, { href: `videos.html?v=${v.id}`, img: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, kicker: 'Vídeo mais recente', name: String(v.title), meta: `${kind} • ${fmtDur(v.dur)}` });
  });

  // próximo evento público; sem evento futuro -> o que está passando agora na TV 24/7
  Promise.all([get('data/agenda.json'), get('tv/playlist.json')]).then(([ag, tv]) => {
    const now = Date.now();
    const ev = (ag && Array.isArray(ag.events) ? ag.events : [])
      .filter(e => e && e.type !== 'rec' && Date.parse(e.start) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    if (ev) {
      const when = new Date(ev.start).toLocaleString('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      fill(elN, { href: 'agenda.html', kicker: 'Próximo evento', name: String(ev.title), meta: `${when} (horário de Brasília)` });
      return;
    }
    const list = (tv && Array.isArray(tv.videos) ? tv.videos : Array.isArray(tv) ? tv : []).filter(v => v && ID_RE.test(String(v.id)) && v.dur > 0);
    const total = list.reduce((s, v) => s + v.dur, 0);
    if (!total) return;
    let t = ((Math.floor((now - EPOCH) / 1000) % total) + total) % total, i = 0;
    while (t >= list[i].dur) { t -= list[i].dur; i++; }
    const ends = new Date(now + (list[i].dur - t) * 1000).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    fill(elN, { href: 'tv.html', kicker: 'Agora na TV 24/7 • sem eventos agendados', name: String(list[i].title), meta: `Até ${ends} (horário de Brasília)` });
  });
})();

// ====== "Como participar": botões que preenchem o formulário de contato ======
document.addEventListener('click', e => {
  const b = e.target.closest('[data-prefill]');
  if (!b) return;
  const msg = document.querySelector('#contactForm textarea[name="message"]');
  if (!msg) return;
  if (!msg.value.trim() || msg.dataset.prefilled === '1') { msg.value = b.dataset.prefill; msg.dataset.prefilled = '1'; }
  setTimeout(() => { msg.focus({ preventScroll: true }); msg.setSelectionRange(msg.value.length, msg.value.length); }, 450);
});
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('#contactForm textarea')) e.target.dataset.prefilled = '0'; });

// ====== Relógio do horário de Brasília ======
(function brtClock() {
  const els = document.querySelectorAll('[data-brt-clock]');
  if (!els.length) return;
  const tick = () => { const t = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); els.forEach(el => { el.textContent = `${t} BRT`; }); };
  tick(); setInterval(tick, 30000);
})();
