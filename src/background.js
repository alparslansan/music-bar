let currentSong = null;
let activeMediaTabId = null;
let globalVolume = 1; 

let lastProcessedCoverUrl = null;
let cachedBase64Cover = null;

// Resmi Base64 metnine çeviren Truva Atı
async function fetchAndConvertToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${blob.type};base64,${btoa(binary)}`;
  } catch (e) {
    console.error("Base64 çeviri hatası:", e);
    return url; 
  }
}

// Acımasız Temizlik Motoru
function clearMediaState() {
  currentSong = null;
  activeMediaTabId = null; // Anında sıfırla ki yoldaki zombi veriler iptal olsun
  lastProcessedCoverUrl = null;
  cachedBase64Cover = null;
  
  chrome.storage.local.remove(['activeMediaTabId']);
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'BROADCAST_SONG', payload: null }).catch(() => {});
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MEDIA_UPDATE') {
    if (sender.tab && sender.tab.id) {
        activeMediaTabId = sender.tab.id;
        chrome.storage.local.set({ activeMediaTabId: sender.tab.id });
    }
    
    let incomingSong = message.payload;

    if (!incomingSong) {
        clearMediaState();
        return true;
    }
    
    // 1. SES SENKRONİZASYONU
    if (incomingSong.volume !== undefined) {
      if (Math.abs(globalVolume - incomingSong.volume) > 0.02) {
        globalVolume = incomingSong.volume;
        chrome.tabs.query({}, (tabs) => {
          if (activeMediaTabId === null) return; // Zombi Kalkanı
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'SYNC_VOLUME', payload: globalVolume }).catch(() => {});
          });
        });
      }
    }
    
    // 2. CSP BYPASS İŞLEMİ
    if (incomingSong.cover) {
      if (incomingSong.cover !== lastProcessedCoverUrl) {
        fetchAndConvertToBase64(incomingSong.cover).then(base64Str => {
          if (activeMediaTabId === null) return; // Zombi Kalkanı: Sekme kapandıysa Base64'ü çöpe at!

          cachedBase64Cover = base64Str; 
          lastProcessedCoverUrl = incomingSong.cover; 
          
          incomingSong.cover = cachedBase64Cover; 
          currentSong = incomingSong;
          
          chrome.tabs.query({}, (tabs) => {
            if (activeMediaTabId === null) return; // Zombi Kalkanı
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, { type: 'BROADCAST_SONG', payload: currentSong }).catch(() => {});
            });
          });
        });
        return true; 
      } else {
        incomingSong.cover = cachedBase64Cover;
      }
    }
    
    currentSong = incomingSong;
    chrome.tabs.query({}, (tabs) => {
      if (activeMediaTabId === null) return; // Zombi Kalkanı: Yoldaki veriyi durdur
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'BROADCAST_SONG', payload: currentSong }).catch(() => {});
      });
    });
  }

  if (message.type === 'SEND_COMMAND') {
    if (message.action === 'setVolume') {
      globalVolume = message.value;
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'SYNC_VOLUME', payload: globalVolume }).catch(() => {});
        });
      });
    }

    chrome.storage.local.get(['activeMediaTabId'], (result) => {
      if (result.activeMediaTabId) {
        chrome.tabs.sendMessage(result.activeMediaTabId, { 
          type: 'MEDIA_COMMAND', action: message.action, value: message.value 
        }).catch(() => {});
      }
    });
  }

  if (message.type === 'GET_CURRENT_SONG') {
    sendResponse({ song: currentSong, volume: globalVolume });
  }
  
  return true; 
});

// YENİ: Anlık (Senkron) Sekme Kapatma Kontrolü
chrome.tabs.onRemoved.addListener((tabId) => {
  // Önce anlık belleğe bak (milisaniyelik hız)
  if (activeMediaTabId === tabId) {
    clearMediaState();
  } else {
    // Bulamazsa kalıcı hafızaya bak (Uyku modu ihtimaline karşı)
    chrome.storage.local.get(['activeMediaTabId'], (result) => {
      if (result.activeMediaTabId === tabId) {
        clearMediaState();
      }
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const isStillMediaSite = changeInfo.url.includes('spotify.com') || changeInfo.url.includes('youtube.com') || changeInfo.url.includes('music.apple.com');
    
    if (activeMediaTabId === tabId) {
       if (!isStillMediaSite) clearMediaState();
    } else {
       chrome.storage.local.get(['activeMediaTabId'], (result) => {
        if (result.activeMediaTabId === tabId) {
          if (!isStillMediaSite) clearMediaState();
        }
      });
    }
  }
});
