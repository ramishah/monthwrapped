# Month Wrapped - Spotify Top Songs

A React application that connects to Spotify API to display your top 5 songs from the past month.

## Features

- 🔗 Connect to Spotify with OAuth 2.0
- 🎵 Display top 5 songs from the last 4 weeks
- 🎨 Beautiful UI with Tailwind CSS
- 🔄 Automatic token refresh
- 📱 Responsive design

## Project Structure

```
monthwrapped/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── App.jsx    # Main application component
│   │   └── index.css  # Tailwind CSS styles
│   └── package.json
├── backend/           # Express.js server
│   ├── server.js      # Main server file
│   └── package.json
└── README.md
```

## Prerequisites

Before running this application, you need to:

1. **Create a Spotify Developer Account**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Log in with your Spotify account
   - Create a new application

2. **Configure Your Spotify App**
   - In your Spotify app settings, add `http://127.0.0.1:3001/api/spotify/callback` as a Redirect URI
   - **Important**: Spotify no longer accepts `localhost` - you must use `127.0.0.1`
   - Copy your Client ID and Client Secret

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd backend
# Create .env file manually and add the following:
```

Edit the `.env` file and add your Spotify credentials:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
PORT=3001
```

### 3. Start the Application

**Terminal 1 - Start the Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Start the Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Access the Application

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:3001

## How It Works

1. **Authentication Flow:**
   - User clicks "Connect to Spotify" button
   - Backend generates Spotify authorization URL
   - User is redirected to Spotify to authorize the app
   - Spotify redirects back to our callback URL with an authorization code
   - Backend exchanges the code for access and refresh tokens
   - User is redirected back to the frontend

2. **Data Retrieval:**
   - Frontend requests top songs from backend
   - Backend uses the stored access token to call Spotify API
   - Returns top 5 songs from the last 4 weeks
   - Frontend displays the songs with album artwork

3. **Token Management:**
   - Access tokens expire after 1 hour
   - Backend automatically refreshes tokens using refresh tokens
   - Tokens are stored in memory (use a database in production)

## API Endpoints

- `GET /api/spotify/connect` - Get Spotify authorization URL
- `GET /api/spotify/callback` - Handle Spotify OAuth callback
- `GET /api/spotify/songs` - Get user's top songs
- `GET /api/health` - Health check endpoint

## Technologies Used

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Axios** - HTTP client for API calls
- **CORS** - Cross-origin resource sharing
- **Cookie Parser** - Cookie parsing middleware

## Security Notes

- This is a development setup with in-memory token storage
- For production, implement:
  - Database storage for tokens
  - HTTPS
  - Proper session management
  - Rate limiting
  - Input validation

## Troubleshooting

### Common Issues

1. **"INVALID_CLIENT: Insecure redirect URI"**
   - Make sure you're using `http://127.0.0.1:3001/api/spotify/callback` (not localhost)
   - Spotify no longer accepts `localhost` as a redirect URI
   - Use the explicit IPv4 address `127.0.0.1`

2. **"Failed to connect to Spotify"**
   - Check your Spotify Client ID and Secret in `.env`
   - Verify the redirect URI in your Spotify app settings

3. **CORS errors**
   - Ensure the backend is running on port 3001
   - Check that the frontend is running on port 5173

4. **"Not authenticated" error**
   - Clear your browser cookies
   - Try reconnecting to Spotify

### Spotify API Limits

- The Spotify API has rate limits
- The app requests top tracks with `short_term` (last 4 weeks)
- Maximum of 5 songs are displayed

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE). 