// CUSTOM CURSOR
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
let mx=0, my=0, rx=0, ry=0;

document.addEventListener('mousemove', e => {
  mx=e.clientX;
  my=e.clientY;
  cursor.style.left=mx+'px';
  cursor.style.top=my+'px';
});

function animateRing(){
  rx+=(mx-rx)*.12;
  ry+=(my-ry)*.12;
  ring.style.left=rx+'px';
  ring.style.top=ry+'px';
  requestAnimationFrame(animateRing);
}
animateRing();

// Hover effects for cursor
document.querySelectorAll('button,a,.step,.feat-row,.fstat,.upload-box,.modal-close').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.width='18px';
    cursor.style.height='18px';
    ring.style.width='52px';
    ring.style.height='52px';
    ring.style.opacity='.6';
  });
  el.addEventListener('mouseleave', () => {
    cursor.style.width='10px';
    cursor.style.height='10px';
    ring.style.width='36px';
    ring.style.height='36px';
    ring.style.opacity='1';
  });
});

// NAV SCROLL EFFECT
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
});

// SCROLL REVEAL
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
