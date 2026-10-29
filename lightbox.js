(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 're-lightbox';
  dialog.setAttribute('aria-label', 'Bildansicht');
  dialog.innerHTML = `<figure class="re-lightbox-stage"><img class="re-lightbox-image" alt="" draggable="false"><figcaption class="re-lightbox-description" aria-live="polite"></figcaption></figure><button class="re-lightbox-close" type="button" aria-label="Bildansicht schließen">×</button><button class="re-lightbox-prev" type="button" aria-label="Vorheriges Bild"><svg viewBox="0 0 24 36" aria-hidden="true"><path d="M19 3 4 18l15 15"/></svg></button><button class="re-lightbox-next" type="button" aria-label="Nächstes Bild"><svg viewBox="0 0 24 36" aria-hidden="true"><path d="m5 3 15 15L5 33"/></svg></button><p class="re-lightbox-count" aria-live="polite"></p><p class="re-lightbox-error" role="alert" hidden>Das Bild konnte nicht geladen werden.</p>`;
  document.body.append(dialog);
  const image = dialog.querySelector('img');
  const description = dialog.querySelector('figcaption');
  const count = dialog.querySelector('.re-lightbox-count');
  const previous = dialog.querySelector('.re-lightbox-prev');
  const next = dialog.querySelector('.re-lightbox-next');
  const close = dialog.querySelector('.re-lightbox-close');
  const error = dialog.querySelector('.re-lightbox-error');
  let items = [], index = 0, opener = null, gesture = null;

  function show(nextIndex) {
    index = (nextIndex + items.length) % items.length;
    const link = items[index];
    error.hidden = true;
    image.hidden = false;
    image.classList.remove('is-loaded');
    image.alt = link.querySelector('img')?.alt || link.dataset.caption || link.getAttribute('aria-label') || 'Vergrößertes Bild';
    image.src = link.href;
    description.textContent = link.dataset.caption || image.alt;
    count.textContent = `${index + 1} / ${items.length}`;
    count.hidden = previous.hidden = next.hidden = items.length < 2;
    if (items.length > 1) {
      const preload = new Image();
      preload.src = items[(index + 1) % items.length].href;
    }
  }
  image.addEventListener('load', () => image.classList.add('is-loaded'));
  image.addEventListener('error', () => { image.hidden = true; error.hidden = false; });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-lightbox]');
    if (!link || link.closest('.partner-list') || link.classList.contains('support-image') || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    opener = link;
    const key = link.dataset.gallery;
    items = key ? Array.from(document.querySelectorAll('a[data-lightbox]')).filter(item => item.dataset.gallery === key && !item.closest('.partner-list') && !item.classList.contains('support-image')) : [link];
    show(items.indexOf(link));
    dialog.showModal();
    document.body.classList.add('photo-viewer-open');
    close.focus();
  });
  previous.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (items.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  image.addEventListener('pointerdown', event => { gesture = { x: event.clientX, y: event.clientY }; });
  image.addEventListener('pointerup', event => {
    if (!gesture || items.length < 2) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
    gesture = null;
  });
  image.addEventListener('pointercancel', () => { gesture = null; });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('photo-viewer-open');
    image.removeAttribute('src');
    image.classList.remove('is-loaded');
    opener?.focus({ preventScroll: true });
    items = [];
  });
})();
