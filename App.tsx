
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Menu, 
  Search, 
  Home, 
  Flame, 
  Library, 
  Crown, 
  History, 
  Bookmark, 
  User, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  Wifi, 
  ArrowUpLeft,
  Tv
} from 'lucide-react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { ViewState, VideoData, UserSettings } from './types';
import { translations } from './translations';
import { adManager } from './services/adManager';
import { streamService } from './services/streamService';
import { VideoCard } from './components/VideoCard';
import { Sidebar } from './components/Sidebar';
import { Player } from './components/Player';
import { AdBanner } from './components/AdBanner';
import { ProModal } from './components/ProModal';
import { WebViewModal } from './components/WebViewModal';
import { SettingsView } from './components/SettingsView';
import { LiveScoreTicker } from './components/LiveScoreTicker';
import { MOCK_VIDEOS } from './constants';

// --- Skeleton Component ---
const VideoSkeleton = () => (
  <div className="flex flex-col gap-3 animate-pulse">
    <div className="w-full aspect-video bg-gray-800 rounded-lg"></div>
    <div className="flex gap-3 px-2">
      <div className="w-10 h-10 rounded-full bg-gray-800 shrink-0"></div>
      <div className="flex flex-col gap-2 w-full">
        <div className="h-4 bg-gray-800 rounded w-3/4"></div>
        <div className="h-3 bg-gray-800 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoData | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<any>(null);

  // Settings & State
  const [settings, setSettings] = useState<UserSettings>({
    country: 'US',
    language: 'en',
    incognito: false
  });
  
  const [currentPlatform, setCurrentPlatform] = useState<string>('All');
  const [loggedInPlatforms, setLoggedInPlatforms] = useState<string[]>([]);
  
  // Data State - Initialize empty, but DON'T block UI
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(false);
  
  // Local Data State
  const [history, setHistory] = useState<VideoData[]>([]);
  const [bookmarks, setBookmarks] = useState<VideoData[]>([]);
  const [loginModal, setLoginModal] = useState<{show: boolean, platform: string} | null>(null);
  const [showInterstitial, setShowInterstitial] = useState(false);

  const t = translations[settings.language] || translations['en'];

  // --- 1. CRITICAL STARTUP LOGIC ---
  useEffect(() => {
    // IMMEDIATE: Force Hide Splash
    const forceHideSplash = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await SplashScreen.hide();
            }
        } catch (e) {
            console.warn("Splash hide error (harmless)", e);
        }
    };
    forceHideSplash();
    
    // BACKUP: Timer to ensure it doesn't stay stuck
    const timer = setTimeout(forceHideSplash, 1500);

    // Load LocalStorage Safely
    try {
        const loadJSON = (key: string, fallback: any) => {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        };

        setCurrentPlatform(localStorage.getItem('streamx_active_platform') || 'All');
        setHistory(loadJSON('streamx_history', []));
        setBookmarks(loadJSON('streamx_bookmarks', []));
        setSettings(loadJSON('streamx_settings', { country: 'US', language: 'en', incognito: false }));
        setLoggedInPlatforms(loadJSON('streamx_logins', []));
        
        const expiry = localStorage.getItem('streamx_pro_expiry');
        if (expiry && new Date(expiry) > new Date()) setIsPro(true);

    } catch (e) {
        console.error("Storage corrupted, clearing...", e);
        localStorage.clear();
    }

    return () => clearTimeout(timer);
  }, []);

  // --- 2. DATA FETCHING (Decoupled from render) ---
  const fetchData = useCallback(async () => {
    // Don't set loading=true if we already have videos (prevents flashing)
    if (videos.length === 0) setLoading(true);
    setError(false);
    
    try {
        // Safety Timeout - if API hangs for 5s, show Mocks
        const fetchPromise = async () => {
             if (view === ViewState.SEARCH && searchQuery) {
                return await streamService.search(searchQuery, currentPlatform);
             } else if (view === ViewState.LIVE_SPORTS) {
                return await streamService.search('Live Cricket', 'All');
             } else {
                return await streamService.getTrending(currentPlatform, settings.country);
             }
        };

        const timeoutPromise = new Promise<VideoData[]>((resolve) => 
            setTimeout(() => resolve([]), 5000)
        );

        // Race the fetch against the timeout
        let fetchedVideos = await Promise.race([fetchPromise(), timeoutPromise]);

        if (!fetchedVideos || fetchedVideos.length === 0) {
            // If empty or timeout, use mocks to prevent empty screen
             fetchedVideos = MOCK_VIDEOS;
        }

        setVideos(fetchedVideos);
    } catch (err) {
        console.error("Fetch fatal error", err);
        setVideos(MOCK_VIDEOS); // Fallback is mandatory
    } finally {
        setLoading(false);
    }
  }, [view, currentPlatform, searchQuery, settings.country]);

  // Initial Fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Persist Settings
  useEffect(() => {
    localStorage.setItem('streamx_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
      localStorage.setItem('streamx_active_platform', currentPlatform);
  }, [currentPlatform]);

  // UI Handlers
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark');
  };

  const handleVideoClick = (video: VideoData) => {
    if (!isPro && adManager.checkAndIncrement()) {
        setShowInterstitial(true);
        setTimeout(() => {
            setShowInterstitial(false);
            setCurrentVideo(video);
        }, 3000);
    } else {
        setCurrentVideo(video);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setShowSuggestions(false);
      if (searchQuery.trim()) {
          setView(ViewState.SEARCH);
      }
  };

  // --- RENDER HELPERS ---

  const renderContent = () => {
    // Settings View
    if (view === ViewState.SETTINGS_PRIVACY) {
        return (
            <SettingsView 
                history={history}
                onClearHistory={() => { setHistory([]); localStorage.removeItem('streamx_history'); }}
                incognito={settings.incognito}
                toggleIncognito={() => setSettings(prev => ({ ...prev, incognito: !prev.incognito }))}
                onBack={() => setView(ViewState.HOME)}
                onVideoClick={handleVideoClick}
                language={settings.language}
            />
        );
    }

    // Loading State (Skeleton)
    if (loading && videos.length === 0) {
        return (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => <VideoSkeleton key={i} />)}
            </div>
        );
    }

    // Error State
    if (error && videos.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
                <AlertTriangle size={40} className="text-red-500 mb-4" />
                <h3 className="text-lg font-bold dark:text-white mb-2">Connection Issue</h3>
                <button onClick={fetchData} className="bg-primary text-white px-6 py-2 rounded-full font-bold mt-2">
                    Retry
                </button>
            </div>
        );
    }

    // Main Content
    let title = view === ViewState.SEARCH ? `Results: "${searchQuery}"` : 
                view === ViewState.TRENDING ? t.trendingNow : 
                view === ViewState.LIVE_SPORTS ? t.liveCricket : t.whatsNew;

    return (
        <div className="pb-24 animate-fade-in">
            {view === ViewState.LIVE_SPORTS && <LiveScoreTicker />}
            
            <div className="px-4 py-3">
                <h2 className="text-lg font-bold dark:text-white mb-2">{title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videos.map(video => (
                        <VideoCard key={video.id} video={video} onClick={handleVideoClick} />
                    ))}
                </div>
            </div>
        </div>
    );
  };

  // --- APP SHELL (Always Rendered) ---
  return (
    <div className={`min-h-screen bg-white dark:bg-oled-black transition-colors duration-200`}>
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-primary shadow-md">
        <div className="flex items-center gap-3 px-3 py-3">
          <button onClick={() => setIsSidebarOpen(true)} className="text-white p-1 active:scale-95 transition-transform">
            <Menu size={24} />
          </button>
          
          <div className="flex-1 relative">
            <form onSubmit={handleSearchSubmit} className="bg-white/20 rounded-lg flex items-center px-3 py-2">
                <Search size={18} className="text-white/80 mr-2" />
                <input 
                    type="text" 
                    placeholder={t.searchPlaceholder}
                    className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-white/70"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </form>
          </div>

          {!isPro && (
            <button onClick={() => setShowProModal(true)} className="bg-yellow-400 text-black px-3 py-1.5 rounded-full flex items-center gap-1 text-xs font-bold">
              <Crown size={12} fill="black" /> {t.proBadge}
            </button>
          )}
        </div>
      </div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onLoginRequest={(p) => setLoginModal({ show: true, platform: p })}
        onPlatformSelect={setCurrentPlatform}
        settings={settings}
        onUpdateSettings={(s) => setSettings({ ...settings, ...s })}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenPrivacy={() => setView(ViewState.SETTINGS_PRIVACY)}
        loggedInPlatforms={loggedInPlatforms}
        onOpenLiveSports={() => setView(ViewState.LIVE_SPORTS)}
      />
      
      {/* Main Area */}
      <main className="max-w-4xl mx-auto min-h-screen relative">
        {renderContent()}
        <AdBanner isPro={isPro} position="bottom" />
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-surface border-t border-gray-200 dark:border-gray-800 flex justify-around items-center py-2 z-40 pb-[max(env(safe-area-inset-bottom),10px)]">
         {[
           { id: ViewState.HOME, icon: Home, label: t.home },
           { id: ViewState.TRENDING, icon: Flame, label: t.trending },
           { id: ViewState.SUBSCRIPTIONS, icon: User, label: t.subscriptions },
           { id: ViewState.LIBRARY, icon: Library, label: t.library }
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setView(tab.id)}
             className={`flex flex-col items-center p-2 ${view === tab.id ? 'text-primary' : 'text-gray-500'}`}
           >
             <tab.icon size={22} fill={view === tab.id ? 'currentColor' : 'none'} />
             <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
           </button>
         ))}
      </div>

      {/* Modals */}
      {currentVideo && (
        <Player 
          video={currentVideo} 
          onClose={() => setCurrentVideo(null)} 
          isPro={isPro}
          onAddToHistory={(v) => {
             const newHist = [v, ...history.filter(h => h.id !== v.id)].slice(0, 50);
             setHistory(newHist);
             localStorage.setItem('streamx_history', JSON.stringify(newHist));
          }}
          onToggleBookmark={(v) => {
             const exists = bookmarks.some(b => b.id === v.id);
             const newBk = exists ? bookmarks.filter(b => b.id !== v.id) : [v, ...bookmarks];
             setBookmarks(newBk);
             localStorage.setItem('streamx_bookmarks', JSON.stringify(newBk));
          }}
          isBookmarked={bookmarks.some(b => b.id === currentVideo.id)}
        />
      )}

      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} onSubscribe={() => setIsPro(true)} language={settings.language} />
      )}

      {loginModal && (
        <WebViewModal platform={loginModal.platform} onClose={() => setLoginModal(null)} onLoginSuccess={() => {
            const newLogins = [...loggedInPlatforms, loginModal.platform];
            setLoggedInPlatforms(newLogins);
            localStorage.setItem('streamx_logins', JSON.stringify(newLogins));
            setLoginModal(null);
        }} language={settings.language} />
      )}

      {showInterstitial && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4">
             <div className="text-white">Ad Loading...</div>
        </div>
      )}
    </div>
  );
}

export default App;
