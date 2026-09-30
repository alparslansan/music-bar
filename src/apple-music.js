const getMediaElement = () => document.querySelector('audio, video');

const getArtwork = () => {
  const artwork = navigator.mediaSession?.metadata?.artwork;
  // Apple Music birden fazla boyut gönderir; en yüksek çözünürlüklü olanı tercih et.
  return artwork?.at(-1)?.src || artwork?.[0]?.src || null;
};

// Parça geçiş kontrolleri iç içe açık Shadow DOM köklerinde bulunabilir.
const queryPlayerTree = (root, selector) => {
  const matches = Array.from(root.querySelectorAll(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) matches.push(...queryPlayerTree(element.shadowRoot, selector));
  }
  return matches;
};

const getTrackButton = (action) => {
  const player = document.querySelector('[data-testid="player-bar"]')
    || document.querySelector('amp-chrome-player');
  if (!player) return null;

  const direction = action === 'next' ? 'next' : 'previous';
  const controls = queryPlayerTree(player, 'amp-playback-controls-item-skip');
  // querySelectorAll kökün kendi Shadow DOM'una girmez.
  if (player.shadowRoot) {
    controls.push(...queryPlayerTree(player.shadowRoot, 'amp-playback-controls-item-skip'));
  }
  for (const control of controls) {
    const roots = [control, control.shadowRoot].filter(Boolean);
    for (const root of roots) {
      const button = root.querySelector(`button.button--${direction}`);
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        return button;
      }
    }
  }
  return null;
};

const getButton = (action) => {
  if (action === 'next' || action === 'prev') return getTrackButton(action);
  // Güncel Apple Music arayüzünde gerçek düğmeler player-bar içindeki özel
  // bileşenlerdedir. Aramayı bu alanla sınırlandırmak, sayfadaki bir albümün
  // veya parça kartının "Play" düğmesine yanlışlıkla basılmasını engeller.
  const selectors = {
    playPause: [
      '[data-testid="player-bar"] amp-playback-controls-play button:not([aria-hidden="true"]):not([disabled])',
      '[data-testid="player-bar"] .playback-play__play:not([aria-hidden="true"]):not([disabled])',
      '[data-testid="player-bar"] .playback-play__pause:not([aria-hidden="true"]):not([disabled])',
    ],
  };

  const directMatch = selectors[action]
    ?.map(selector => document.querySelector(selector))
    .find(Boolean);
  if (directMatch) return directMatch;

  // Eski Apple Music sürümü için aynı kontroller Shadow DOM altında kalabilir.
  const chromePlayer = document.querySelector('amp-chrome-player');
  const controlsRoot = chromePlayer?.shadowRoot
    ?.querySelector('apple-music-playback-controls')?.shadowRoot;
  if (!controlsRoot) return null;

  const fallback = {
    playPause: '[data-testid="play-pause-button"]',
  };

  return controlsRoot.querySelector(fallback[action]);
};

setInterval(() => {
  const media = getMediaElement();
  const metadata = navigator.mediaSession?.metadata;

  if (!metadata) return;

  const duration = media?.duration;
  const progress = Number.isFinite(duration) && duration > 0
    ? (media.currentTime / duration) * 100
    : 0;
  const isPlaying = media
    ? !media.paused
    : navigator.mediaSession?.playbackState === 'playing';

  chrome.runtime.sendMessage({
    type: 'MEDIA_UPDATE',
    payload: {
      title: metadata.title,
      artist: metadata.artist,
      cover: getArtwork(),
      source: 'apple',
      progress,
      volume: media?.volume ?? 1,
      isPlaying,
    },
  });
}, 1000);

chrome.runtime.onMessage.addListener((request) => {
  if (request.type !== 'MEDIA_COMMAND') return;

  const media = getMediaElement();

  if (request.action === 'setVolume' && media) {
    media.volume = Math.max(0, Math.min(1, request.value));
    return;
  }

  // Oynatma ve parça geçişi Apple Music'in kendi denetimlerini tetikler.
  getButton(request.action)?.click();
});
