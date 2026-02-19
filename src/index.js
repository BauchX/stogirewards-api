import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));

app.use(express.json());

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_IDS = process.env.YOUTUBE_CHANNEL_IDS?.split(',') || [];
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in ms
const MAX_RESULTS_PER_CHANNEL = parseInt(process.env.MAX_RESULTS_PER_CHANNEL) || 10;

// Cache storage
let videoCache = {
  data: null,
  lastFetched: 0
};

/**
 * Fetch videos from a single YouTube channel
 */
async function fetchChannelVideos(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&type=video&maxResults=${MAX_RESULTS_PER_CHANNEL}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`YouTube API error for channel ${channelId}:`, response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items) {
      console.error(`No items returned for channel ${channelId}`);
      return [];
    }
    
    return data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      thumbnailMedium: item.snippet.thumbnails.medium?.url,
      thumbnailDefault: item.snippet.thumbnails.default?.url,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));
  } catch (error) {
    console.error(`Error fetching videos for channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Fetch videos from all configured channels
 */
async function fetchAllVideos() {
  if (!YOUTUBE_API_KEY) {
    console.error('YOUTUBE_API_KEY not configured');
    return [];
  }
  
  if (CHANNEL_IDS.length === 0) {
    console.error('No YOUTUBE_CHANNEL_IDS configured');
    return [];
  }
  
  console.log(`Fetching videos from ${CHANNEL_IDS.length} channel(s)...`);
  
  const videoPromises = CHANNEL_IDS.map(channelId => fetchChannelVideos(channelId.trim()));
  const results = await Promise.all(videoPromises);
  
  // Flatten and sort by publish date (newest first)
  const allVideos = results.flat().sort((a, b) => 
    new Date(b.publishedAt) - new Date(a.publishedAt)
  );
  
  console.log(`Fetched ${allVideos.length} videos total`);
  return allVideos;
}

/**
 * Get videos with caching
 */
async function getVideos(forceRefresh = false) {
  const now = Date.now();
  
  // Check if cache is valid
  if (!forceRefresh && videoCache.data && (now - videoCache.lastFetched) < CACHE_DURATION) {
    console.log('Returning cached videos');
    return videoCache.data;
  }
  
  // Fetch fresh data
  const videos = await fetchAllVideos();
  
  // Update cache
  videoCache = {
    data: videos,
    lastFetched: now
  };
  
  return videos;
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    cacheAge: videoCache.lastFetched ? Math.round((Date.now() - videoCache.lastFetched) / 1000) : null,
    channelCount: CHANNEL_IDS.length
  });
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const videos = await getVideos(forceRefresh);
    
    res.json({
      success: true,
      count: videos.length,
      cacheAge: Math.round((Date.now() - videoCache.lastFetched) / 1000),
      videos
    });
  } catch (error) {
    console.error('Error in /api/videos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos'
    });
  }
});

// Get videos with limit
app.get('/api/videos/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const videos = await getVideos();
    
    res.json({
      success: true,
      count: Math.min(videos.length, limit),
      videos: videos.slice(0, limit)
    });
  } catch (error) {
    console.error('Error in /api/videos/latest:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos'
    });
  }
});

// Refresh cache manually
app.post('/api/refresh', async (req, res) => {
  try {
    const videos = await getVideos(true);
    res.json({
      success: true,
      message: 'Cache refreshed',
      count: videos.length
    });
  } catch (error) {
    console.error('Error in /api/refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 StogiRewards API running on port ${PORT}`);
  console.log(`📺 Configured channels: ${CHANNEL_IDS.length}`);
  
  // Pre-warm cache on startup
  getVideos().then(videos => {
    console.log(`✅ Cache pre-warmed with ${videos.length} videos`);
  }).catch(err => {
    console.error('⚠️ Failed to pre-warm cache:', err.message);
  });
});
