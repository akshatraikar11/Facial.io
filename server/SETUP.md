# Server Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Create `.env` file:**
   Create a file named `.env` in the `server` directory with the following content:
   ```
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   JWT_SECRET=your-secret-key-change-in-production
   JWT_EXPIRES_IN=7d
   DB_PATH=./data/db.json
   ADMIN_EMAIL=admin@cryo.ai
   ADMIN_PASSWORD=admin123
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

   The server should start on `http://localhost:3001`

## Troubleshooting

### CORS Issues

If you're getting CORS errors:

1. Make sure the frontend is running on `http://localhost:5173` (Vite default)
2. Check that `CORS_ORIGIN` in `.env` matches your frontend URL
3. The server now allows multiple common development origins automatically

### Port Already in Use

If port 3001 is already in use:
- Change `PORT` in `.env` to a different port (e.g., `3002`)
- Update `CORS_ORIGIN` if needed

### Dependencies Not Installed

If you see module not found errors:
```bash
cd server
npm install
```

### Database Issues

The database file will be automatically created at `./data/db.json` when the server starts.

## Testing the Server

Once running, test with:
```bash
curl http://localhost:3001/health
```

You should get: `{"status":"ok","timestamp":"..."}`
