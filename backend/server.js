const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

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

// Spotify API configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `${BACKEND_BASE_URL}/api/spotify/callback`;

// In-memory storage for tokens (in production, use a database)
const userTokens = new Map();

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
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
  }

  try {
    const tokenData = await getUserAccessToken(code);
    
    // Generate a short-lived JWT containing the Spotify tokens
    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    };
    const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    
    // Redirect to frontend with token in URL
    res.redirect(`${process.env.FRONTEND_URL}?token=${jwtToken}`);
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});

app.get('/api/spotify/songs', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('JWT verification failed:', err);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    let { access_token, refresh_token, expires_at } = payload;
    if (Date.now() > expires_at) {
      try {
        const newTokenData = await refreshUserAccessToken(refresh_token);
        access_token = newTokenData.access_token;
        expires_at = Date.now() + (newTokenData.expires_in * 1000);
        if (newTokenData.refresh_token) {
          refresh_token = newTokenData.refresh_token;
        }
      } catch (error) {
        console.error('Token refresh failed:', error.response?.data || error.message);
        return res.status(401).json({ error: 'Token refresh failed', details: error.response?.data || error.message });
      }
    }
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        },
        params: {
          limit: 5,
          time_range: 'short_term'
        }
      });
      const songs = response.data.items.map((track) => ({
        name: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        albumArt: track.album.images[0]?.url || null,
        spotifyUrl: track.external_urls.spotify
      }));
      res.json({ songs });
    } catch (error) {
      console.error('Error fetching top songs:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch top songs', details: error.response?.data || error.message });
    }
  } catch (error) {
    console.error('Unexpected error in /api/spotify/songs:', error);
    res.status(500).json({ error: 'Unexpected error', details: error.message });
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