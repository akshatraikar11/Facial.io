# Cryo-Rosette Server

Backend API server for the Cryo-Rosette face recognition attendance system.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the server directory:
   ```env
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   JWT_SECRET=your-secret-key-change-in-production
   JWT_EXPIRES_IN=7d
   DB_PATH=./data/db.json
   ADMIN_EMAIL=admin@cryo.ai
   ADMIN_PASSWORD=admin123
   ```

3. **Run the server:**
   ```bash
   npm run dev    # Development with hot reload
   npm start      # Production mode (requires build first)
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email and password
- `GET /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PATCH /api/users/:id` - Update user (requires auth)
- `DELETE /api/users/:id` - Delete user (requires auth)

### Attendance
- `GET /api/attendance` - Get attendance logs (supports query params: userId, date, startDate, endDate)
- `GET /api/attendance/today` - Get today's attendance
- `POST /api/attendance` - Create attendance log
- `DELETE /api/attendance/:id` - Delete attendance log
- `DELETE /api/attendance` - Clear all attendance

### Health Check
- `GET /health` - Server health status

## Database

Currently uses a JSON file-based database (`./data/db.json`). This can be easily replaced with PostgreSQL, MongoDB, or any other database by updating `server/src/db/index.ts`.

## Development

- TypeScript for type safety
- Express.js for routing
- Zod for input validation
- JWT for authentication
- CORS enabled for frontend integration
