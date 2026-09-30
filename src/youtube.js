setInterval(() => {
  let progress = 0;
  let volume = 1;
  let isPlaying = false;

  // --- KESİN ÇÖZÜM 1: Tarayıcı Medya Yöneticisi ---
  if (navigator.mediaSession && navigator.mediaSession.playbackState) {
    isPlaying = navigator.mediaSession.playbackState === 'playing';
  }

  const video = document.querySelector('video');
  if (video && video.duration > 0) {
    progress = (video.currentTime / video.duration) * 100;
    volume = video.volume;
    
    // --- KESİN ÇÖZÜM 2: Videonun kendi durumu ---
    // Eğer üstteki yöntem sonuç vermezse videoya bak
    if (navigator.mediaSession.playbackState === 'none' || !navigator.mediaSession.playbackState) {
      isPlaying = !video.paused;
    }
  }

  if (navigator.mediaSession && navigator.mediaSession.metadata) {
    const { title, artist, artwork } = navigator.mediaSession.metadata;
    const coverUrl = artwork && artwork.length > 0 ? artwork[0].src : null;

    chrome.runtime.sendMessage({
      type: 'MEDIA_UPDATE',
      payload: { title, artist, cover: coverUrl, source: 'youtube', progress, volume, isPlaying }
    });
  }
}, 1000);

chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'MEDIA_COMMAND') {
    const video = document.querySelector('video');
    
    if (request.action === 'setVolume' && video) {
      video.volume = request.value;
    } else {
      let selector = "";
      switch (request.action) {
        case 'playPause': selector = '#play-pause-button'; break;
        case 'next': selector = '.next-button'; break;
        case 'prev': selector = '.previous-button'; break;
      }
      const button = document.querySelector(selector);
      if (button) button.click();
    }
  }
});