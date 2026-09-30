const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
};

setInterval(() => {
  let progress = 0;
  let volume = 1;
  let isPlaying = false; 

  // --- KESİN ÇÖZÜM 1: Tarayıcının kendi medya yöneticisine sor ---
  if (navigator.mediaSession && navigator.mediaSession.playbackState) {
    isPlaying = navigator.mediaSession.playbackState === 'playing';
  }

  // --- KESİN ÇÖZÜM 2: Spotify'ın butonunu gizlice oku (Eğer üstteki başarısız olursa) ---
  const playPauseBtn = document.querySelector('[data-testid="control-button-playpause"]');
  if (playPauseBtn) {
    const ariaLabel = playPauseBtn.getAttribute('aria-label');
    // Eğer butonun açıklamasında Duraklat veya Pause yazıyorsa şarkı çalıyordur!
    if (ariaLabel && (ariaLabel.toLowerCase().includes('duraklat') || ariaLabel.toLowerCase().includes('pause'))) {
      isPlaying = true;
    }
  }

  // Süre okuma
  const posEl = document.querySelector('[data-testid="playback-position"]');
  const durEl = document.querySelector('[data-testid="playback-duration"]');
  if (posEl && durEl) {
    const pos = timeToSeconds(posEl.textContent);
    const dur = timeToSeconds(durEl.textContent);
    if (dur > 0) progress = (pos / dur) * 100;
  }

  // Ses okuma
  const rangeInput = document.querySelector('[data-testid="volume-bar"] input[type="range"]');
  if (rangeInput) {
    const max = parseFloat(rangeInput.max) || 1;
    volume = parseFloat(rangeInput.value) / max;
  }

  if (navigator.mediaSession && navigator.mediaSession.metadata) {
    const { title, artist, artwork } = navigator.mediaSession.metadata;
    const coverUrl = artwork && artwork.length > 0 ? artwork[0].src : null;

    chrome.runtime.sendMessage({
      type: 'MEDIA_UPDATE',
      payload: { title, artist, cover: coverUrl, source: 'spotify', progress, volume, isPlaying } 
    });
  }
}, 1000);

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'MEDIA_COMMAND') {
    
    if (request.action === 'setVolume') {
      // TAKTİK 1: Spotify'ın erişilebilirlik için kullandığı gizli Range Input'u bul
      const rangeInput = document.querySelector('[data-testid="volume-bar"] input[type="range"]');
      
      if (rangeInput) {
        // React'in korumasını kırmak için Tarayıcının "Native (Doğrudan)" setter'ını çağırıyoruz
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        // Eğer Spotify 0-100 kullanıyorsa diye input'un max değerini kontrol ediyoruz
        const max = parseFloat(rangeInput.max) || 1; 
        
        nativeInputValueSetter.call(rangeInput, request.value * max);
        rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
        rangeInput.dispatchEvent(new Event('change', { bubbles: true }));
      } 
      else {
        // TAKTİK 2: Range bulunamazsa Tam Teşekküllü Click Kombosu gönder
        const volumeBar = document.querySelector('[data-testid="volume-bar"]');
        if (volumeBar) {
          const rect = volumeBar.getBoundingClientRect();
          const clickX = rect.left + (rect.width * request.value);
          const clickY = rect.top + (rect.height / 2);
          
          const opts = { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY, view: window };
          
          // Gerçek bir parmak dokunuşu simülasyonu
          volumeBar.dispatchEvent(new PointerEvent('pointerdown', opts));
          volumeBar.dispatchEvent(new MouseEvent('mousedown', opts));
          volumeBar.dispatchEvent(new PointerEvent('pointerup', opts));
          volumeBar.dispatchEvent(new MouseEvent('mouseup', opts));
          volumeBar.dispatchEvent(new MouseEvent('click', opts));
        }
      }
    } 
    else {
      let selector = "";
      switch (request.action) {
        case 'playPause': selector = '[data-testid="control-button-playpause"]'; break;
        case 'next': selector = '[data-testid="control-button-skip-forward"]'; break;
        case 'prev': selector = '[data-testid="control-button-skip-back"]'; break;
      }
      const button = document.querySelector(selector);
      if (button) button.click();
    }
  }
});