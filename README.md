# TimezoneSync Backend

Express.js backend for the TimezoneSync application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=3001
```

3. Start the development server:
```bash
npm start
```

## Deployment

This project is automatically deployed to Render when changes are pushed to the main branch.

### Required Secrets for GitHub Actions

Add the following secrets to your GitHub repository:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Your JWT secret key
- `RENDER_SERVICE_ID`: Your Render service ID
- `RENDER_API_KEY`: Your Render API key

## API Endpoints

- `POST /api/auth/signup`: Register a new user
- `POST /api/auth/login`: Login user
- `GET /api/profile/:username`: Get user profile
- `GET /api/timezone/diff/:username`: Get timezone difference

## Available Scripts

- `npm start`: Runs the server
- `npm test`: Runs the test suite
- `npm run dev`: Runs the server in development mode with nodemon 