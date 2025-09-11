// Header effects
const header = document.querySelector('.site-header');
const hamburger = document.getElementById('hamburger');
const drawer = document.getElementById('mobileDrawer');
const year = document.getElementById('year');

year.textContent = new Date().getFullYear();

window.addEventListener('scroll', () => {
  const elevated = window.scrollY > 10;
  header.style.boxShadow = elevated ? '0 8px 20px rgba(0,0,0,.35)' : 'none';
});

// Mobile menu
const toggleDrawer = () => drawer.classList.toggle('open');
hamburger.addEventListener('click', toggleDrawer);
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => drawer.classList.remove('open')));

// Smooth scroll (links with #)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e){
    const target = document.querySelector(this.getAttribute('href'));
    if (target){
      e.preventDefault();
      window.scrollTo({ top: target.offsetTop - 64, behavior:'smooth' });
    }
  });
});

// Fake form submission
const form = document.getElementById('contactForm');
const alertBox = document.getElementById('formAlert');
form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  if(!data.name || !data.email || !data.message){
    alertBox.textContent = 'Preencha todos os campos.';
    alertBox.style.color = '#ff6b6b';
    return;
  }
  alertBox.textContent = 'Mensagem enviada! (demo)';
  alertBox.style.color = '#57d996';
  form.reset();
});
