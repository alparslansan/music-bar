import { useState, useEffect, useRef } from 'react';

function App() {
  const [song, setSong] = useState(null);
  const [localVolume, setLocalVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isVisible, setIsVisible] = useState(true);
  const volumeRef = useRef(null);
  const lastInteractionRef = useRef(0);

  const sendCommand = async (payload) => {
    try {
      await chrome.runtime.sendMessage(payload);
    } catch (error) {
      console.warn("Eklenti arka plan servisi yanıt vermedi:", error);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(['touchBarVisible']);
        if (result.touchBarVisible !== undefined) {
          setIsVisible(result.touchBarVisible);
        }
      } catch (error) {}
    };
    loadSettings();

    const storageListener = (changes) => {
      if (changes.touchBarVisible) setIsVisible(changes.touchBarVisible.newValue);
    };
    chrome.storage.onChanged.addListener(storageListener);

    const fetchInitialData = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_SONG' });
        if (response) {
          setSong(response.song || null);
          if (response.volume !== undefined) setLocalVolume(response.volume);
        }
      } catch (error) {}
    };
    fetchInitialData();

    const messageListener = (message) => {
      if (message.type === 'BROADCAST_SONG') {
        if (!message.payload) {
          setSong(null);
          return;
        }

        setSong(prev => {
          const preservedCover = message.payload.cover || (prev?.title === message.payload.title ? prev.cover : null);
          
          if (Date.now() - lastInteractionRef.current < 2500) {
             return prev ? { ...message.payload, isPlaying: prev.isPlaying, cover: preservedCover } : { ...message.payload, cover: preservedCover };
          } else {
             return { ...message.payload, cover: preservedCover };
          }
        });
      }
      if (message.type === 'SYNC_VOLUME') {
        if (Date.now() - lastInteractionRef.current > 2500) setLocalVolume(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  useEffect(() => {
    let interval;
    let attempts = 0;

    if (song && !song.cover) {
      interval = setInterval(async () => {
        attempts++;
        try {
          const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_SONG' });
          if (response?.song?.cover) {
            setSong(prev => ({ ...prev, cover: response.song.cover }));
            clearInterval(interval);
          }
        } catch (error) {}

        if (attempts >= 10) clearInterval(interval); 
      }, 1000); 
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [song?.title]); 

  const hasSong = !!song; 
  useEffect(() => {
    const volContainer = volumeRef.current;
    if (!volContainer) return;

    const handleWheel = (e) => {
      e.preventDefault(); 
      lastInteractionRef.current = Date.now(); 
      setLocalVolume((prev) => {
        let currentVolInt = Math.round(prev * 100);
        let newVolInt = currentVolInt + (e.deltaY < 0 ? 2 : -2);
        newVolInt = Math.max(0, Math.min(100, newVolInt)); 
        let newVol = newVolInt / 100; 
        sendCommand({ type: 'SEND_COMMAND', action: 'setVolume', value: newVol });
        return newVol;
      });
    };

    volContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => volContainer.removeEventListener('wheel', handleWheel);
  }, [hasSong]); 

  const handleControl = (action) => sendCommand({ type: 'SEND_COMMAND', action });

  const handlePlayPause = () => {
    lastInteractionRef.current = Date.now(); 
    handleControl('playPause');
    setSong((prev) => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
  };

  const handleSliderChange = (e) => {
    lastInteractionRef.current = Date.now(); 
    const newVol = parseInt(e.target.value) / 100;
    setLocalVolume(newVol);
    sendCommand({ type: 'SEND_COMMAND', action: 'setVolume', value: newVol });
  };

  const toggleMute = () => {
    lastInteractionRef.current = Date.now(); 
    if (localVolume > 0) {
      setPrevVolume(localVolume);
      setLocalVolume(0);
      sendCommand({ type: 'SEND_COMMAND', action: 'setVolume', value: 0 });
    } else {
      const volToSet = prevVolume > 0 ? prevVolume : 1;
      setLocalVolume(volToSet);
      sendCommand({ type: 'SEND_COMMAND', action: 'setVolume', value: volToSet });
    }
  };

  const toggleVisibility = async (val) => {
    setIsVisible(val);
    try { await chrome.storage.local.set({ touchBarVisible: val }); } catch (error) {}
  };

  if (!song) return null;

  // Servise göre ilerleme rengi ve uzun başlık kontrolü
  const themeColors = {
    spotify: { stroke: '#1DB954', background: 'bg-[#1DB954]' },
    youtube: { stroke: '#FF0000', background: 'bg-[#FF0000]' },
    apple: { stroke: '#FA243C', background: 'bg-[#FA243C]' },
  };
  const theme = themeColors[song.source] || themeColors.spotify;
  const themeColorClass = theme.stroke;
  const themeColorBg = theme.background;
  const isLongTitle = song.title && song.title.length > 25;

  // Dairesel Bar Hesaplamaları (Sadece Mini Kapsül için)
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - ((song.progress || 0) / 100) * circumference;

  return (
    <>
      <style>{`
        .touch-bar-font, .touch-bar-font * {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol" !important;
          letter-spacing: normal !important;
        }
        @keyframes slideUpFade { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: inline-block; white-space: nowrap; animation: marquee 12s linear infinite; }
        .animate-marquee:hover { animation-play-state: paused; }
        
        input[type=range].custom-slider { -webkit-appearance: none; appearance: none; background: transparent; width: 70px; }
        input[type=range].custom-slider:focus { outline: none; }
        input[type=range].custom-slider::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: rgba(255, 255, 255, 0.4); border-radius: 2px; transition: background 0.2s ease; }
        input[type=range].custom-slider:hover::-webkit-slider-runnable-track { background: rgba(255, 255, 255, 0.6); }
        input[type=range].custom-slider::-webkit-slider-thumb { height: 12px; width: 12px; border-radius: 50%; background: #ffffff; cursor: pointer; -webkit-appearance: none; margin-top: -4px; box-shadow: 0 1px 4px rgba(0,0,0,0.5); transition: transform 0.1s cubic-bezier(0.16, 1, 0.3, 1); }
        input[type=range].custom-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        input[type=range].custom-slider::-moz-range-track { width: 100%; height: 4px; cursor: pointer; background: rgba(255, 255, 255, 0.4); border-radius: 2px; transition: background 0.2s ease; }
        input[type=range].custom-slider:hover::-moz-range-track { background: rgba(255, 255, 255, 0.6); }
        input[type=range].custom-slider::-moz-range-thumb { height: 12px; width: 12px; border: none; border-radius: 50%; background: #ffffff; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.5); transition: transform 0.1s cubic-bezier(0.16, 1, 0.3, 1); }
        input[type=range].custom-slider::-moz-range-thumb:hover { transform: scale(1.2); }
      `}</style>

      {/* YENİ VE GÜNCELLENMİŞ MİNİ KAPSÜL MODU */}
      <div
        className={`touch-bar-font absolute bottom-[8px] left-0 right-0 mx-auto w-fit h-[44px] bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center p-[4px] pr-[8px] shadow-xl pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-50 gap-[8px] ${
          isVisible ? 'translate-y-[50px] opacity-0 pointer-events-none scale-90' : 'translate-y-0 opacity-100 scale-100'
        }`}
      >
        {/* Sol Taraf: Albüm Kapağı (Tıklayınca Ana Barı Açar) */}
        <div onClick={() => toggleVisibility(true)} className="w-[36px] h-[36px] rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 transition-all shadow-md group relative" title="Show Music Bar">
          {song.cover ? <img src={song.cover} alt="album" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/20"></div>}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <svg className="w-[16px] h-[16px] text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
          </div>
        </div>

        {/* Sağ Taraf: Oynat/Durdur Butonu ve Etrafını Saran İlerleme Halkası */}
        <div className="relative w-[36px] h-[36px] flex items-center justify-center">
          
          {/* Çember Çizimi (SVG) */}
          <svg className="absolute w-full h-full transform -rotate-90 pointer-events-none">
            {/* Silik Arka Plan Halkası */}
            <circle cx="18" cy="18" r={radius} fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            {/* Dolanan İlerleme Halkası */}
            <circle 
              cx="18" cy="18" r={radius} fill="transparent" 
              stroke={themeColorClass} // Spotify için Yeşil, YouTube için Kırmızı
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className={`transition-[stroke-dashoffset] ease-linear ${song.isPlaying ? 'duration-1000' : 'duration-100'}`}
            />
          </svg>

          {/* Merkezdeki Oynat / Durdur Butonu */}
          <button onClick={handlePlayPause} className="cursor-pointer transition-all opacity-80 hover:opacity-100 flex items-center justify-center active:scale-90 text-white z-10 w-full h-full rounded-full" title={song.isPlaying ? "Duraklat" : "Oynat"}>
            {song.isPlaying ? (
               <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
               <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

        </div>
      </div>


      {/* ANA TAM EKRAN BAR (Aynı kaldı) */}
      <div 
        className={`touch-bar-font animate-slide-up absolute bottom-[8px] left-0 right-0 mx-auto w-[95%] max-w-[1200px] h-[40px] bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center px-[20px] text-white text-[12px] shadow-xl pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[150%] !opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute top-0 left-[20px] right-[20px] h-[1.5px] bg-white/5 rounded-full overflow-hidden mt-[1px]">
          <div className={`h-full ${themeColorBg} transition-[width] ease-linear ${song.isPlaying ? 'duration-1000' : 'duration-100'}`} style={{ width: `${song.progress || 0}%` }}></div>
        </div>

        <div className="flex-1 flex justify-start items-center h-full pt-[2px]">
          <div className="flex items-center gap-[12px] min-w-[200px] max-w-[250px] overflow-hidden relative">
            {song.cover && <img src={song.cover} alt="album" className="w-[24px] h-[24px] rounded object-cover shadow z-10 bg-black/40" />}
            <div className="flex flex-col overflow-hidden w-full">
              {isLongTitle ? (
                <div className="animate-marquee cursor-default"><span className="font-semibold tracking-tight mr-[32px]">{song.title}</span><span className="font-semibold tracking-tight mr-[32px]">{song.title}</span></div>
              ) : (
                <div className="cursor-default truncate"><span className="font-semibold tracking-tight">{song.title}</span></div>
              )}
              <span className="text-[9px] opacity-50 leading-tight truncate">{song.artist}</span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex justify-center items-center gap-[16px] h-full pt-[2px]">
            <button onClick={() => handleControl('prev')} className="cursor-pointer transition-all opacity-70 hover:opacity-100 flex items-center justify-center active:scale-90"><svg className="w-[16px] h-[16px]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
            <button onClick={handlePlayPause} className="cursor-pointer transition-all opacity-90 hover:opacity-100 flex items-center justify-center active:scale-90">
              {song.isPlaying ? <svg className="w-[20px] h-[20px]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-[20px] h-[20px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </button>
            <button onClick={() => handleControl('next')} className="cursor-pointer transition-all opacity-70 hover:opacity-100 flex items-center justify-center active:scale-90"><svg className="w-[16px] h-[16px]" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
        </div>

        <div className="flex-1 flex justify-end items-center h-full pt-[2px]">
          <div ref={volumeRef} className="flex items-center gap-[10px] pl-[20px] border-l border-white/10 opacity-80 hover:opacity-100 transition-opacity min-w-[120px] justify-end">
            <button onClick={toggleMute} className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer active:scale-90 flex items-center justify-center" title={localVolume > 0 ? "Mute" : "Unmute"}>
              {localVolume > 0 ? <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"></path></svg> : <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM16.707 7.293a1 1 0 00-1.414-1.414l-2 2-2-2a1 1 0 10-1.414 1.414l2 2-2 2a1 1 0 101.414 1.414l2-2 2 2a1 1 0 001.414-1.414l-2-2 2-2z" clipRule="evenodd"></path></svg>}
            </button>
            <input type="range" min="0" max="100" step="1" value={Math.round(localVolume * 100)} onChange={handleSliderChange} className="custom-slider" />
          </div>

          <div className="flex items-center border-l border-white/10 pl-[12px] ml-[12px] h-[20px]">
            <button onClick={() => toggleVisibility(false)} className="opacity-50 hover:opacity-100 transition-all cursor-pointer active:scale-90 flex items-center justify-center w-[20px] h-[20px] rounded-full hover:bg-white/10" title="Hidden Music Bar">
              <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
