// Scripts específicos da página inicial (index.html)
// Header, menu mobile e ano do rodapé ficam em layout.js; formulário em forms.js.

// Sombra no header ao rolar
const header = document.querySelector('.site-header');
if (header) {
  window.addEventListener('scroll', () => {
    header.style.boxShadow = window.scrollY > 10 ? '0 8px 20px rgba(0,0,0,.35)' : 'none';
  }, { passive: true });
}

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
