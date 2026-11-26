/* Avisos de novos vídeos do YouTube (Flloydinn).
 *
 * O que este arquivo faz (tudo no navegador, sem servidor):
 *   - controla o botão [data-notify-toggle] (ativar/desativar) e mostra o estado real da permissão;
 *   - guarda a preferência com FlloydStore ("fll_notif_on") e a lista de vídeos já vistos ("fll_notif_seen");
 *   - MODO LOCAL (padrão): quando a pessoa abre o site, compara data/videos.json com os vídeos já vistos
 *     e, se houver vídeo novo, mostra uma notificação pelo service worker. Não funciona com o site fechado.
 *   - MODO PUSH (opcional): se data/notificacoes.json tiver vapidPublicKey E subscribeEndpoint, também
 *     cria a inscrição Push e a envia ao seu endpoint. O disparo em segundo plano depende desse servidor
 *     (veja scripts/NOTIFICACOES.md). Sem essas duas chaves, nada é enviado para fora do navegador.
 *
 * API pública: window.FlloydNotify = { state, enable, disable, test, check }
 */
(function () {
  'use strict';
  var KEY_ON = 'fll_notif_on', KEY_SEEN = 'fll_notif_seen', KEY_CHECK = 'fll_notif_check';
  var MAX_SEEN = 60;
  var cfg = { vapidPublicKey: '', subscribeEndpoint: '', checkIntervalMin: 60 };
  var cfgPromise = null;
  var lastMsg = null; // mensagem de ajuda mostrada após uma ação da pessoa

  var store = window.FlloydStore || (function () {
    var mem = {};
    return {
      get: function (k) { try { var v = window.localStorage.getItem(k); if (v !== null) return v; } catch (e) {} return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set: function (k, v) { try { window.localStorage.setItem(k, String(v)); return; } catch (e) {} mem[k] = String(v); },
      remove: function (k) { delete mem[k]; try { window.localStorage.removeItem(k); } catch (e) {} }
    };
  })();

  function loadConfig() {
    if (!cfgPromise) {
      cfgPromise = fetch('data/notificacoes.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (c) {
          if (c && typeof c.vapidPublicKey === 'string') cfg.vapidPublicKey = c.vapidPublicKey.trim();
          if (c && typeof c.subscribeEndpoint === 'string') cfg.subscribeEndpoint = c.subscribeEndpoint.trim();
          if (c && c.checkIntervalMin > 0) cfg.checkIntervalMin = c.checkIntervalMin;
          return cfg;
        })
        .catch(function () { return cfg; });
    }
    return cfgPromise;
  }

  function pushConfigured() { return !!(cfg.vapidPublicKey && /^https:\/\//.test(cfg.subscribeEndpoint) && 'PushManager' in window); }

  /** insecure | unsupported | denied | on | off */
  function state() {
    if (!window.isSecureContext) return 'insecure';
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted' && store.get(KEY_ON) === '1') return 'on';
    return 'off';
  }

  var TEXT = {
    off: 'Receba um aviso quando sair vídeo novo no canal.',
    on: 'Avisos de novos vídeos ativados neste navegador.',
    denied: 'As notificações estão bloqueadas neste navegador.',
    unsupported: 'Este navegador não oferece notificações para sites.',
    insecure: 'Notificações só funcionam em conexão segura (https).'
  };
  var LABEL = { off: 'Ativar avisos de vídeos', on: 'Desativar avisos', denied: 'Como desbloquear', unsupported: 'Indisponível', insecure: 'Indisponível' };
  var HELP_DENIED = 'Para liberar: clique no cadeado (ou no ícone de configurações) ao lado do endereço do site, ache "Notificações" e mude para "Permitir". Depois recarregue a página e ative de novo. No celular, confira também as notificações do navegador nas configurações do aparelho.';

  function render() {
    var s = state();
    var nodes = document.querySelectorAll('[data-notify]');
    for (var i = 0; i < nodes.length; i++) {
      var box = nodes[i];
      var txt = box.querySelector('[data-notify-text]');
      var btn = box.querySelector('[data-notify-toggle]');
      var test = box.querySelector('[data-notify-test]');
      var help = box.querySelector('[data-notify-help]');
      if (txt) txt.textContent = TEXT[s];
      if (btn) {
        var label = btn.querySelector('[data-notify-label]');
        if (label) label.textContent = LABEL[s];
        btn.setAttribute('aria-pressed', s === 'on' ? 'true' : 'false');
        btn.disabled = (s === 'unsupported' || s === 'insecure');
      }
      if (test) test.hidden = s !== 'on';
      if (help) {
        if (lastMsg) { help.textContent = lastMsg; help.hidden = false; } else { help.textContent = ''; help.hidden = true; }
      }
      box.setAttribute('data-notify-state', s);
    }
  }

  function swReady() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('sw-timeout')); }, 4000); })
    ]);
  }

  function show(title, body, url, tag) {
    return swReady().then(function (reg) {
      return reg.showNotification(title, {
        body: body, icon: '/assets/pwa-192.png', badge: '/assets/favicon-32.png', tag: tag || 'flloydinn',
        lang: 'pt-BR', data: { url: url || '/videos.html' }
      });
    });
  }

  function readSeen() { try { var a = JSON.parse(store.get(KEY_SEEN) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeSeen(a) { store.set(KEY_SEEN, JSON.stringify(a.slice(0, MAX_SEEN))); }

  function fetchVideos() {
    return fetch('data/videos.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('videos ' + r.status); return r.json(); })
      .then(function (d) { return (Array.isArray(d) ? d : (d && d.videos) || []).filter(function (v) { return v && v.id; }); });
  }

  /** Compara o catálogo com os vídeos já vistos; mostra aviso se houver vídeo novo. */
  function check(force) {
    if (state() !== 'on') return Promise.resolve(0);
    return loadConfig().then(function () {
      var last = parseInt(store.get(KEY_CHECK) || '0', 10) || 0;
      if (!force && Date.now() - last < cfg.checkIntervalMin * 60000) return 0;
      store.set(KEY_CHECK, String(Date.now()));
      return fetchVideos().then(function (list) {
        var seen = readSeen();
        var ids = list.map(function (v) { return v.id; });
        if (!seen.length) { writeSeen(ids); return 0; } // primeira vez: só marca o que já existe
        var fresh = list.filter(function (v) { return seen.indexOf(v.id) === -1; });
        if (!fresh.length) return 0;
        writeSeen(ids.concat(seen.filter(function (x) { return ids.indexOf(x) === -1; })));
        var one = fresh.length === 1;
        var title = one ? 'Vídeo novo no Flloydinn' : fresh.length + ' vídeos novos no Flloydinn';
        var body = one ? String(fresh[0].title || '') : String(fresh[0].title || '') + ' e mais ' + (fresh.length - 1);
        var url = one ? '/videos.html?v=' + encodeURIComponent(fresh[0].id) : '/videos.html';
        return show(title, body, url, 'novo-video').then(function () { return fresh.length; });
      });
    }).catch(function () { return 0; });
  }

  function urlBase64ToUint8Array(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /** Só roda se o servidor de push estiver configurado em data/notificacoes.json. */
  function pushSubscribe() {
    if (!pushConfigured()) return Promise.resolve(false);
    return swReady().then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey) });
      });
    }).then(function (sub) {
      return fetch(cfg.subscribeEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), channel: '@flloydinn' }) })
        .then(function (r) { return r.ok; });
    }).catch(function () { return false; });
  }

  function pushUnsubscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve();
    return swReady().then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) { return sub ? sub.unsubscribe() : null; }).catch(function () {});
  }

  function enable() {
    var s = state();
    if (s === 'insecure' || s === 'unsupported') { lastMsg = null; render(); return Promise.resolve(s); }
    if (s === 'denied') { lastMsg = HELP_DENIED; render(); return Promise.resolve('denied'); }
    return loadConfig().then(function () {
      var ask = Notification.permission === 'granted' ? Promise.resolve('granted') : Promise.resolve(Notification.requestPermission());
      return ask;
    }).then(function (perm) {
      if (perm === 'granted') {
        store.set(KEY_ON, '1');
        return fetchVideos().then(function (list) { writeSeen(list.map(function (v) { return v.id; })); }, function () {})
          .then(function () { return pushSubscribe(); })
          .then(function (pushed) {
            lastMsg = pushed
              ? 'Pronto! Você será avisado de vídeos novos, mesmo com o site fechado.'
              : 'Pronto! Vamos avisar quando você abrir o site depois que sair um vídeo novo. Com o site fechado, o aviso depende de um servidor de push que ainda não está configurado.';
            render();
            return 'on';
          });
      }
      lastMsg = perm === 'denied' ? HELP_DENIED : 'O pedido de permissão foi fechado sem resposta. Clique em "Ativar avisos" para tentar de novo.';
      render();
      return perm;
    }).catch(function () { lastMsg = 'Não foi possível ativar as notificações agora. Tente novamente.'; render(); return 'error'; });
  }

  function disable() {
    store.set(KEY_ON, '0');
    lastMsg = 'Avisos desativados. Para bloquear de vez, use as configurações do navegador.';
    render();
    return pushUnsubscribe();
  }

  function test() {
    if (state() !== 'on') return Promise.resolve(false);
    return show('Teste: avisos do Flloydinn', 'Está funcionando. Toque aqui para abrir a página de vídeos.', '/videos.html', 'teste')
      .then(function () { lastMsg = 'Notificação de teste enviada. Se não aparecer, confira as notificações do sistema.'; render(); return true; })
      .catch(function () { lastMsg = 'Não foi possível exibir a notificação de teste.'; render(); return false; });
  }

  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-notify-toggle],[data-notify-test]') : null;
    if (!t) return;
    if (t.hasAttribute('data-notify-test')) { test(); return; }
    var s = state();
    if (s === 'on') disable(); else enable();
  }

  function init() {
    render();
    document.addEventListener('click', onClick);
    if (state() === 'on') {
      // sem competir com o carregamento da página
      var run = function () { check(false); };
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 2500);
    }
    if (window.Notification && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'notifications' }).then(function (p) { p.onchange = function () { render(); }; }).catch(function () {});
    }
  }

  window.FlloydNotify = { state: state, enable: enable, disable: disable, test: test, check: function () { return check(true); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
