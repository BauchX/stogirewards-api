# StogiRewards YouTube API

Simple Express API that fetches and caches YouTube videos from configured channels.

## Features

- Fetches videos from multiple YouTube channels
- 15-minute cache to reduce API calls
- Automatic cache refresh
- CORS support

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `YOUTUBE_API_KEY` - Your YouTube Data API v3 key
- `YOUTUBE_CHANNEL_IDS` - Comma-separated channel IDs

### 3. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable "YouTube Data API v3"
4. Create API credentials (API Key)
5. Copy the key to your `.env`

### 4. Find Channel IDs

- Go to the YouTube channel
- Click "About" or check the URL
- Channel ID format: `UC...` (24 characters)

### 5. Run

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + cache status |
| `/api/videos` | GET | Get all cached videos |
| `/api/videos/latest?limit=20` | GET | Get latest N videos |
| `/api/refresh` | POST | Force cache refresh |

### Response Format

```json
{
  "success": true,
  "count": 20,
  "cacheAge": 300,
  "videos": [
    {
      "id": "abc123",
      "title": "Video Title",
      "description": "...",
      "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      "channelTitle": "Channel Name",
      "publishedAt": "2025-01-15T10:00:00Z",
      "url": "https://www.youtube.com/watch?v=abc123"
    }
  ]
}
```

## Deployment (PM2 on Keruza VPS)

### 1. SSH into server

```bash
ssh -i ~/.ssh/id_ed25519_jake root@51.222.28.144
```

### 2. Clone repository

```bash
cd /var/www
git clone https://github.com/BauchX/stogirewards-api.git
cd stogirewards-api
```

### 3. Install and configure

```bash
npm install
cp .env.example .env
nano .env  # Add your API key and channel IDs
```

### 4. Setup PM2

```bash
# Start with PM2
pm2 start src/index.js --name stogirewards-api

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
```

### 5. (Optional) Nginx reverse proxy

Add to your nginx config:

```nginx
location /api/ {
    proxy_pass http://localhost:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

## License

MIT
