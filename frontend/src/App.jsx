import { useState, useEffect } from 'react'
import './App.css'

// Determine backend URL for local and production
const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3001';
  }
  return 'https://monthwrapped.onrender.com';
};

const backendUrl = getBackendUrl();

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [topSongs, setTopSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Helper to get token from localStorage
  const getToken = () => localStorage.getItem('spotify_token')

  // On mount, check for token in URL or localStorage
  useEffect(() => {
    // Check for token in URL
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      localStorage.setItem('spotify_token', token)
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    checkAuthStatus()
  }, [])

  const connectToSpotify = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${backendUrl}/api/spotify/connect`, {
        method: 'GET',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.authUrl) {
          window.location.href = data.authUrl
        }
      } else {
        setError('Failed to connect to Spotify')
      }
    } catch (err) {
      setError('Error connecting to Spotify: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const checkAuthStatus = async () => {
    const token = getToken()
    if (!token) {
      setIsConnected(false)
      setTopSongs([])
      return
    }
    try {
      const response = await fetch(`${backendUrl}/api/spotify/songs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.newToken) {
          localStorage.setItem('spotify_token', data.newToken)
        }
        setTopSongs(data.songs)
        setIsConnected(true)
        setError('')
      } else {
        // Try to parse error message
        let errorMsg = 'Session expired or invalid. Please reconnect to Spotify.'
        try {
          const errData = await response.json()
          if (errData && errData.error) errorMsg = errData.error
          if (errData && errData.details) errorMsg += `: ${errData.details}`
        } catch {}
        setError(errorMsg)
        setIsConnected(false)
        setTopSongs([])
        localStorage.removeItem('spotify_token')
      }
    } catch (err) {
      setIsConnected(false)
      setTopSongs([])
      setError('Network error. Please try again.')
      localStorage.removeItem('spotify_token')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('spotify_token')
    setIsConnected(false)
    setTopSongs([])
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Month Wrapped
          </h1>
          <p className="text-gray-600">
            Discover your top songs from the past month
          </p>
        </div>
        {error && (
          <div className="mb-4 text-center text-red-600 font-semibold">
            {error}
          </div>
        )}
        {!isConnected ? (
          <div className="text-center">
            <button
              onClick={connectToSpotify}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 flex items-center justify-center mx-auto"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm4.61 14.44c-1.25 1.25-2.89 1.88-4.61 1.88s-3.36-.63-4.61-1.88c-1.25-1.25-1.88-2.89-1.88-4.61s.63-3.36 1.88-4.61c1.25-1.25 2.89-1.88 4.61-1.88s3.36.63 4.61 1.88c1.25 1.25 1.88 2.89 1.88 4.61s-.63 3.36-1.88 4.61z"/>
                  </svg>
                  Connect to Spotify
                </div>
              )}
            </button>
          </div>
        ) : (
      <div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Your Top Songs This Month
              </h2>
              <p className="text-gray-600 text-sm">
                Based on your listening history
              </p>
            </div>
            {topSongs.length > 0 ? (
              <div className="space-y-3">
                {topSongs.map((song, index) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm mr-3">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{song.name}</h3>
                      <p className="text-sm text-gray-600">{song.artist}</p>
                    </div>
                    {song.albumArt && (
                      <img 
                        src={song.albumArt} 
                        alt={`${song.name} album art`}
                        className="w-12 h-12 rounded-md object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>No songs found. Start listening to music on Spotify!</p>
      </div>
            )}
            <button
              onClick={handleLogout}
              className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Disconnect
        </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
