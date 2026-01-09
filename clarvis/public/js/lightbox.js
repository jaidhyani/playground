const $ = (sel) => document.querySelector(sel);

let lightboxEl = null;

export function initLightbox() {
  if (lightboxEl) return;

  lightboxEl = document.createElement('div');
  lightboxEl.id = 'lightbox';
  lightboxEl.className = 'lightbox hidden';
  lightboxEl.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-container">
      <img class="lightbox-image" src="" alt="">
      <button class="lightbox-close">✕</button>
    </div>
  `;

  document.body.appendChild(lightboxEl);

  lightboxEl.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
  lightboxEl.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightboxEl.classList.contains('hidden')) {
      closeLightbox();
    }
  });
}

export function openLightbox(src) {
  if (!lightboxEl) initLightbox();

  const img = lightboxEl.querySelector('.lightbox-image');
  img.src = src;
  lightboxEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.classList.add('hidden');
  document.body.style.overflow = '';
}

export function handleImageClick(e) {
  const img = e.target.closest('.message-image');
  if (img) {
    e.preventDefault();
    openLightbox(img.src);
  }
}
