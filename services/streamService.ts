
import { VideoData } from '../types';
import { Capacitor } from '@capacitor/core';
import { 
    MOCK_VIDEOS, 
    MOCK_TIKTOK_VIDEOS, 
    MOCK_RUMBLE_VIDEOS, 
    MOCK_PEERTUBE_VIDEOS 
} from '../constants';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.vic.click',
  'https://piped-api.garudalinux.org'
];

let activeInstanceIndex = 0;

const formatViews = (views: number): string => {
  if (!views) return '0';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

const formatDuration = (seconds: number): string => {
  if (!seconds) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Safe wrapper for CapacitorHttp
async function nativeFetch(url: string) {
    // Timeout Promise
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request Timeout")), 5000)
    );

    const performFetch = async () => {
        if (Capacitor.isNativePlatform()) {
            const CapacitorHttp = (window as any).Capacitor?.Plugins?.CapacitorHttp;
            if (CapacitorHttp) {
                const response = await CapacitorHttp.get({ 
                    url, 
                    headers: { 'User-Agent': 'Mozilla/5.0 (Android 10)' }
                });
                if (response.status === 200) return response.data;
                throw new Error(`Status ${response.status}`);
            }
        }
        // Web Fallback
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        return await res.json();
    };

    return await Promise.race([performFetch(), timeout]);
}

async function fetchWithRotation(path: string) {
  let attempts = 0;
  while (attempts < 2) {
    const instance = PIPED_INSTANCES[activeInstanceIndex];
    try {
      return await nativeFetch(`${instance}${path}`);
    } catch (e) {
      activeInstanceIndex = (activeInstanceIndex + 1) % PIPED_INSTANCES.length;
      attempts++;
    }
  }
  throw new Error("All instances failed");
}

export const streamService = {
  async getTrending(platform: string, country: string = 'US'): Promise<VideoData[]> {
    try {
      if (platform === 'YouTube' || platform === 'All') {
        const data = await fetchWithRotation(`/trending?region=${country}`);
        return data.map((v: any) => ({
           id: v.url?.split('v=')[1] || '0',
           title: v.title,
           uploader: v.uploaderName,
           views: formatViews(v.views),
           date: v.uploadedDate || 'Recently',
           duration: formatDuration(v.duration),
           thumbnail: v.thumbnail,
           platform: 'YouTube',
           avatar: v.uploaderAvatar
        }));
      }
      return MOCK_VIDEOS;
    } catch (e) {
      console.warn("API Error, returning mocks", e);
      return MOCK_VIDEOS;
    }
  },

  async search(query: string, platform: string): Promise<VideoData[]> {
    try {
        if (platform === 'YouTube' || platform === 'All') {
            const data = await fetchWithRotation(`/search?q=${encodeURIComponent(query)}&filter=all`);
            return data.items
                .filter((i: any) => i.type === 'stream')
                .map((v: any) => ({
                    id: v.url.split('v=')[1],
                    title: v.title,
                    uploader: v.uploaderName,
                    views: formatViews(v.views),
                    date: v.uploadedDate || 'Recently',
                    duration: formatDuration(v.duration),
                    thumbnail: v.thumbnail,
                    platform: 'YouTube',
                    avatar: v.uploaderAvatar
                }));
        }
        // Fallback filter mocks
        return MOCK_VIDEOS.filter(v => v.title.toLowerCase().includes(query.toLowerCase()));
    } catch (e) {
        return MOCK_VIDEOS;
    }
  },
  
  async getSuggestions(query: string) {
      try { return await fetchWithRotation(`/suggestions?query=${encodeURIComponent(query)}`); } 
      catch { return []; }
  },

  async getStreamUrl(id: string, platform: string) {
      try {
        const data = await fetchWithRotation(`/streams/${id}`);
        return data.hls || data.videoStreams?.[0]?.url || null;
      } catch {
        return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      }
  }
};
