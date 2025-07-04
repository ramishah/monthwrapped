const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${PORT}`;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL // allow production frontend
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `${BACKEND_BASE_URL}/api/spotify/callback`;

// In-memory storage for tokens (in production, use a database)
const userTokens = new Map();

// Helper function to get Spotify access token
async function getSpotifyAccessToken() {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
}

// Helper function to get user access token using authorization code
async function getUserAccessToken(code) {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting user access token:', error);
    throw error;
  }
}

// Helper function to refresh user access token
async function refreshUserAccessToken(refreshToken) {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error refreshing user access token:', error);
    throw error;
  }
}

// Routes
app.get('/api/spotify/connect', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}` +
    `&scope=${encodeURIComponent('user-top-read')}` +
    `&show_dialog=true`;

  res.json({ authUrl });
});

app.get('/api/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
  }

  try {
    const tokenData = await getUserAccessToken(code);
    
    // Store tokens (in production, store in database with user ID)
    const sessionId = state || Math.random().toString(36).substring(7);
    userTokens.set(sessionId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    });

    // Set a cookie to identify the user session
    res.cookie('spotify_session', sessionId, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.redirect(`${process.env.FRONTEND_URL}`);
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

app.get('/api/spotify/songs', async (req, res) => {
  const sessionId = req.cookies?.spotify_session;
  
  if (!sessionId || !userTokens.has(sessionId)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userToken = userTokens.get(sessionId);
  
  // Check if token is expired and refresh if needed
  if (Date.now() > userToken.expires_at) {
    try {
      const newTokenData = await refreshUserAccessToken(userToken.refresh_token);
      userToken.access_token = newTokenData.access_token;
      userToken.expires_at = Date.now() + (newTokenData.expires_in * 1000);
      if (newTokenData.refresh_token) {
        userToken.refresh_token = newTokenData.refresh_token;
      }
      userTokens.set(sessionId, userToken);
    } catch (error) {
      userTokens.delete(sessionId);
      return res.status(401).json({ error: 'Token refresh failed' });
    }
  }

  try {
    // Get user's top tracks from the last month
    const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: {
        'Authorization': `Bearer ${userToken.access_token}`
      },
      params: {
        limit: 5,
        time_range: 'short_term' // Last 4 weeks
      }
    });

    const songs = response.data.items.map((track, index) => ({
      name: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      albumArt: track.album.images[0]?.url || null,
      spotifyUrl: track.external_urls.spotify
    }));

    res.json({ songs });
  } catch (error) {
    console.error('Error fetching top songs:', error);
    res.status(500).json({ error: 'Failed to fetch top songs' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Backend base URL: ${BACKEND_BASE_URL}`);
  console.log(`Frontend should be running on ${BACKEND_BASE_URL.replace(/:[0-9]+$/, ':5173')}`);
  console.log(`Make sure to set up your Spotify API credentials in .env file`);
}); 