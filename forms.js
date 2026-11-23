/* =====================================================================
 * Envio real dos formulários do site (Formspree, Web3Forms ou endpoint próprio)
 * Usado por: index.html (contato), parcerias.html, faq.html (suporte), loja.html (pedidos)
 *
 * >>> CONFIGURE AQUI <<<
 * 1) Crie o formulário no serviço escolhido:
 *    - Formspree:  https://formspree.io  -> endpoint tipo "https://formspree.io/f/abcdwxyz"
 *    - Web3Forms:  https://web3forms.com -> endpoint "https://api.web3forms.com/submit"
 *                  + preencha WEB3FORMS_ACCESS_KEY abaixo
 * 2) Cole o endpoint em FORM_CONFIG (um por formulário, ou o mesmo para todos).
 *    Também dá para definir direto no HTML: <form data-form="contato" data-endpoint="https://...">
 *    (o atributo data-endpoint tem prioridade sobre esta config).
 * 3) Teste cada formulário no site publicado e confira se o e-mail chegou.
 *
 * Enquanto o endpoint estiver vazio, NADA é enviado: o visitante vê um aviso honesto,
 * os dados continuam preenchidos e ele pode copiar, mandar por e-mail ou baixar a mensagem.
 * ===================================================================== */
(function () {
  'use strict';

  var FORM_CONFIG = {
    contato:   { endpoint: '', subject: 'Contato pelo site' },
    parcerias: { endpoint: '', subject: 'Proposta de parceria' },
    suporte:   { endpoint: '', subject: 'Ticket de suporte' },
    pedidos:   { endpoint: '', subject: 'Novo pedido na loja' }
  };
  var WEB3FORMS_ACCESS_KEY = '';           // só se usar Web3Forms (é pública, pode ficar no front)
  var FALLBACK_EMAIL = 'flloydinn@gmail.com';
  var TIMEOUT_MS = 15000;

  // ---------------------------------------------------------------------
  var isDevHost = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);

  function serviceOf(url) {
    if (/formspree\.io/i.test(url)) return 'formspree';
    if (/web3forms\.com/i.test(url)) return 'web3forms';
    return 'generic';
  }

  function getEndpoint(kind, form) {
    var attr = form && form.getAttribute('data-endpoint');
    if (attr && attr.trim()) return attr.trim();
    return (FORM_CONFIG[kind] && FORM_CONFIG[kind].endpoint || '').trim();
  }

  function subjectOf(kind, form) {
    return (form && form.getAttribute('data-subject')) || (FORM_CONFIG[kind] && FORM_CONFIG[kind].subject) || 'Mensagem do site';
  }

  /** Envia um objeto {campo: valor}. Resolve {ok:true} ou rejeita com Error (err.code = 'not_configured' | 'timeout' | 'http'). */
  function send(kind, data, opts) {
    opts = opts || {};
    var endpoint = opts.endpoint || getEndpoint(kind);
    if (!endpoint) {
      var e0 = new Error('Endpoint do formulário "' + kind + '" não configurado.');
      e0.code = 'not_configured';
      return Promise.reject(e0);
    }
    var service = serviceOf(endpoint);
    var subject = opts.subject || subjectOf(kind);
    var payload = {};
    Object.keys(data).forEach(function (k) { payload[k] = data[k]; });

    if (service === 'formspree') {
      payload._subject = subject;
    } else if (service === 'web3forms') {
      if (!WEB3FORMS_ACCESS_KEY) {
        var e1 = new Error('WEB3FORMS_ACCESS_KEY não configurada em forms.js.');
        e1.code = 'not_configured';
        return Promise.reject(e1);
      }
      payload.access_key = WEB3FORMS_ACCESS_KEY;
      payload.subject = subject;
      payload.from_name = 'Site Flloydinn Gameplay';
    } else {
      payload.subject = subject;
    }
    payload.pagina = location.href;

    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;

    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (res.ok && json.ok !== false && json.success !== false) return { ok: true, response: json };
        var msg = (json.errors && json.errors[0] && json.errors[0].message) || json.message || ('Erro ' + res.status);
        var e2 = new Error(msg); e2.code = 'http'; e2.status = res.status;
        throw e2;
      });
    }, function (err) {
      var e3 = new Error(err && err.name === 'AbortError' ? 'O servidor demorou para responder.' : 'Falha de conexão.');
      e3.code = err && err.name === 'AbortError' ? 'timeout' : 'network';
      throw e3;
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  // ---------------------------------------------------------------------
  // Fallbacks: texto legível, copiar, e-mail, download
  function toText(title, fields) {
    var lines = [title, '='.repeat(Math.min(title.length, 40))];
    fields.forEach(function (f) { if (f.value) lines.push(f.label + ': ' + f.value); });
    lines.push('', 'Enviado de: ' + location.href, 'Data: ' + new Date().toLocaleString('pt-BR'));
    return lines.join('\n');
  }
  function mailtoHref(subject, text) {
    var body = text.length > 1800 ? text.slice(0, 1800) + '\n[…]' : text;
    return 'mailto:' + FALLBACK_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }
  function downloadText(filename, text) {
    var url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  // ---------------------------------------------------------------------
  // UI de status (estilos próprios com fallback, para funcionar em qualquer página)
  function injectStyles() {
    if (document.getElementById('fforms-style')) return;
    var css =
      '.fstatus{display:none;margin-top:.2rem;padding:.75rem .85rem;border-radius:.6rem;border:1px solid var(--border,#24262b);font-weight:600;line-height:1.45}' +
      '.fstatus.is-on{display:block}' +
      '.fstatus--loading{color:var(--muted,#A6A6AD)}' +
      '.fstatus--ok{background:linear-gradient(135deg,#206a4f,#2db57f);border-color:transparent;color:#fff}' +
      '.fstatus--err{background:rgba(255,107,107,.08);border-color:rgba(255,107,107,.45);color:#ffb3b3}' +
      '.fstatus--info{background:rgba(255,200,87,.07);border-color:rgba(255,200,87,.4);color:#ffe2a8}' +
      '.fstatus p{margin:0}' +
      '.fstatus small{display:block;margin-top:.35rem;font-weight:400;opacity:.85}' +
      '.fstatus__actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.6rem}' +
      '.fstatus__actions .btn{font-size:.85rem;padding:.45rem .75rem}' +
      '.fstatus__spin{display:inline-block;width:.9em;height:.9em;margin-right:.45rem;vertical-align:-.1em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:fspin .7s linear infinite}' +
      '@keyframes fspin{to{transform:rotate(360deg)}}' +
      '[aria-invalid="true"]{border-color:#ff6b6b !important}';
    var s = document.createElement('style'); s.id = 'fforms-style'; s.textContent = css;
    document.head.appendChild(s);
  }

  function labelOf(el) {
    if (el.getAttribute('data-label')) return el.getAttribute('data-label');
    var lab = el.closest('label');
    if (lab) {
      var t = Array.prototype.filter.call(lab.childNodes, function (n) { return n.nodeType === 3; })
        .map(function (n) { return n.textContent.trim(); }).join(' ').trim();
      if (t) return t;
    }
    if (el.placeholder) return el.placeholder.replace(/\s*\*\s*$/, '').replace(/\s*\(opcional\)\s*$/i, '');
    if (el.tagName === 'SELECT' && el.options[0] && !el.options[0].value) return el.options[0].text.replace(/\s*\*\s*$/, '').replace(/\s*\(opcional\)\s*$/i, '');
    return el.name;
  }

  function enhance(form) {
    var kind = form.getAttribute('data-form');
    var btn = form.querySelector('[type="submit"]');
    var btnLabel = btn ? btn.textContent : '';
    var status = form.querySelector('[data-form-status]');
    if (!status) { status = document.createElement('div'); form.appendChild(status); }
    status.classList.add('fstatus');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    // honeypot anti-spam (invisível para pessoas)
    var hp = document.createElement('input');
    hp.type = 'text'; hp.name = '_hp'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    form.appendChild(hp);

    function fields() {
      return Array.prototype.filter.call(form.elements, function (el) {
        return el.name && el.name !== '_hp' && !el.disabled && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'submit' && el.type !== 'button';
      });
    }
    function show(type, html) {
      status.className = 'fstatus is-on fstatus--' + type;
      status.innerHTML = html;
    }
    function setBusy(b) {
      form.setAttribute('aria-busy', b ? 'true' : 'false');
      if (btn) { btn.disabled = b; btn.textContent = b ? 'Enviando…' : btnLabel; }
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function showFallback(type, message, extra) {
      var subject = subjectOf(kind, form);
      var text = toText(subject, fields().map(function (el) { return { label: labelOf(el), value: el.value.trim() }; }));
      show(type,
        '<p>' + message + '</p>' +
        (extra ? '<small>' + extra + '</small>' : '') +
        '<div class="fstatus__actions">' +
          '<a class="btn btn--small" href="' + esc(mailtoHref(subject, text)) + '">Enviar por e-mail</a>' +
          '<button type="button" class="btn btn--ghost btn--small" data-act="copy">Copiar mensagem</button>' +
          '<button type="button" class="btn btn--ghost btn--small" data-act="download">Baixar .txt</button>' +
        '</div>');
      status.querySelector('[data-act="copy"]').onclick = function (ev) {
        var b = ev.currentTarget;
        copyText(text).then(function () { b.textContent = 'Copiado ✓'; }, function () { b.textContent = 'Não foi possível copiar'; });
      };
      status.querySelector('[data-act="download"]').onclick = function () {
        downloadText('mensagem-' + (kind || 'site') + '.txt', text);
      };
    }

    form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;

      // validação (os forms usam novalidate para mensagens próprias)
      var missing = [];
      fields().forEach(function (el) {
        var v = el.value.trim();
        var bad = (el.required && !v) || (el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        if (bad) { el.setAttribute('aria-invalid', 'true'); missing.push(el); } else { el.removeAttribute('aria-invalid'); }
      });
      if (missing.length) {
        show('err', '<p>Confira: ' + missing.map(function (el) { return esc(labelOf(el)); }).join(', ') + '.</p>');
        missing[0].focus();
        return;
      }

      if (hp.value) { show('ok', '<p>Mensagem enviada!</p>'); form.reset(); return; } // bot

      var endpoint = getEndpoint(kind, form);
      if (!endpoint) {
        if (isDevHost) console.warn('[forms.js] Formulário "' + kind + '" sem endpoint. Configure FORM_CONFIG em forms.js ou data-endpoint no <form>.');
        showFallback('info',
          'O envio automático deste formulário ainda não está ativo. Seus dados continuam aqui: envie por e-mail ou copie a mensagem.',
          isDevHost ? 'Dono do site: configure o endpoint em <code>forms.js</code> (FORM_CONFIG) ou <code>data-endpoint</code> no formulário.' : '');
        track('form_fallback', { form_name: kind, reason: 'not_configured' });
        return;
      }

      var data = {};
      fields().forEach(function (el) { data[el.name] = el.value.trim(); });

      setBusy(true);
      show('loading', '<p><span class="fstatus__spin" aria-hidden="true"></span>Enviando…</p>');

      send(kind, data, { endpoint: endpoint, subject: subjectOf(kind, form) }).then(function () {
        show('ok', '<p>' + esc(form.getAttribute('data-success') || 'Mensagem enviada! Responderemos em breve.') + '</p>');
        form.reset();
        track('generate_lead', { form_name: kind });
      }, function (err) {
        if (err.code === 'not_configured' && isDevHost) console.warn('[forms.js]', err.message);
        showFallback('err',
          'Não foi possível enviar agora (' + esc(err.message) + '). Seus dados não foram perdidos: tente de novo ou use uma opção abaixo.');
        track('form_fallback', { form_name: kind, reason: err.code || 'error' });
      }).finally(function () { setBusy(false); });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-form]');
    if (!forms.length) return;
    injectStyles();
    Array.prototype.forEach.call(forms, enhance);
  }

  window.FlloydForms = {
    send: send, getEndpoint: getEndpoint, subjectOf: subjectOf,
    toText: toText, mailtoHref: mailtoHref, copyText: copyText, downloadText: downloadText,
    ensureStyles: injectStyles,
    FALLBACK_EMAIL: FALLBACK_EMAIL
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
