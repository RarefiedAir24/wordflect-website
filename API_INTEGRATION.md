# Wordflect Website API Integration

## Overview

The Wordflect website now integrates with the main Wordflect backend API, allowing users to sign in with their in-app credentials and view their profile data.

## Features

- ✅ **Real Authentication**: Users can sign in with their Wordflect app credentials
- ✅ **Profile Display**: Shows user stats, achievements, frames, and game data
- ✅ **Session Management**: Automatic token storage and authentication checks
- ✅ **Error Handling**: Proper error messages and authentication failure handling
- ✅ **Responsive Design**: Works on all devices with beautiful UI

## API Endpoints Used

### Authentication
- `POST /signin` - User sign in with email/password
- `GET /user/profile` - Fetch user profile data (requires authentication)

### Response Format Examples

**Sign In Response:**
```json
{
  "message": "Sign in successful",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt-token-here"
}
```

**User Profile Response:**
```json
{
  "id": "user-id",
  "username": "username",
  "email": "user@example.com",
  "profileImageUrl": "https://wordflect-profile-images.s3.us-east-2.amazonaws.com/image.jpg",
  "highestLevel": 15,
  "flectcoins": 1250,
  "points": 1250,
  "gems": 50,
  "allFoundWords": ["word1", "word2"],
  "selectedFrame": {
    "id": "spiked-steel",
    "name": "Spiked Steel",
    "imageUrl": "https://wordflect-avatar-frames.s3.us-east-2.amazonaws.com/spiked-steel.png",
    "rarity": "common",
    "isDefault": true,
    "price": 0
  },
  "gamesPlayed": 150,
  "topScore": 2500,
  "longestWord": "supercalifragilisticexpialidocious",
  "leaderboardPlacements": 5,
  "battleWins": 25,
  "battleLosses": 10,
  "firstPlaceFinishes": 3,
  "secondPlaceFinishes": 2,
  "thirdPlaceFinishes": 1
}
```

## Setup Instructions

### 1. Environment Configuration

Create a `.env.local` file in the project root:

```bash
# For production (actual deployed API)
NEXT_PUBLIC_API_URL=https://api.wordflect.com

# For development (if you have a local API)
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. API Configuration

The API configuration is managed in `src/config/api.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com',
  ENDPOINTS: {
    SIGNIN: '/signin',
    USER_PROFILE: '/user/profile',
    // ... other endpoints
  },
  TIMEOUT: 10000,
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000,
  }
};
```

### 3. Usage Examples

**Sign In:**
```typescript
import { apiService } from "@/services/api";

try {
  const result = await apiService.signIn({
    email: "user@example.com",
    password: "password"
  });
  // User is now signed in, token stored in localStorage
} catch (error) {
  console.error("Sign in failed:", error.message);
}
```

**Get User Profile:**
```typescript
import { apiService } from "@/services/api";

try {
  const profile = await apiService.getUserProfile();
  // Display user data
} catch (error) {
  console.error("Failed to load profile:", error.message);
}
```

**Check Authentication:**
```typescript
import { apiService } from "@/services/api";

if (apiService.isAuthenticated()) {
  // User is signed in
  const user = apiService.getStoredUser();
} else {
  // User needs to sign in
}
```

## File Structure

```
src/
├── services/
│   └── api.ts              # Main API service
├── config/
│   └── api.ts              # API configuration
├── app/
│   ├── signin/
│   │   └── page.tsx        # Sign in page with real API
│   ├── profile/
│   │   └── page.tsx        # Profile page with real data
│   └── page.tsx            # Homepage with auth status
```

## Error Handling

The API service includes comprehensive error handling:

- **Network errors**: Automatic retry with exponential backoff
- **Authentication errors**: Automatic token cleanup and redirect to sign in
- **Timeout errors**: Configurable timeout with retry logic
- **User-friendly messages**: Clear error messages for users

## Security Features

- **JWT Token Management**: Automatic token storage and validation
- **Token Expiration**: Automatic cleanup of expired tokens
- **Secure Headers**: Proper Authorization headers for authenticated requests
- **CORS Support**: Handles CORS headers from the backend

## Testing

To test the integration:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the sign-in page:**
   ```
   http://localhost:3000/signin
   ```

3. **Use real Wordflect credentials:**
   - Email: Your Wordflect app email
   - Password: Your Wordflect app password

4. **View your profile:**
   - After successful sign-in, you'll be redirected to `/profile`
   - Your real game data will be displayed

## Troubleshooting

### Common Issues

1. **"Sign in failed"**
   - Check if the API URL is correct in `.env.local`
   - Verify your credentials are correct
   - Check browser console for detailed error messages

2. **"Authentication failed"**
   - Token may be expired, try signing in again
   - Check if the backend API is accessible

3. **Profile not loading**
   - Check if you're properly signed in
   - Verify the API endpoint is working
   - Check browser console for errors

### Debug Mode

Enable debug logging by checking the browser console for detailed API request/response information.

## Future Enhancements

- [ ] Add sign-up functionality
- [ ] Implement password reset
- [ ] Add leaderboard integration
- [ ] Show user missions and progress
- [ ] Add frame selection interface
- [ ] Implement real-time updates

## API Documentation

For complete API documentation, see the main Wordflect project's backend documentation in `../wordflect/backend/`. 