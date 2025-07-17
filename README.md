// Test: trigger Vercel deployment
## [Unreleased] - Row insertion now matches mobile (shifts all rows up, adds new row at bottom). Deployment trigger.
# Wordflect Web Game

A Next.js web implementation of the Wordflect word-finding game, designed to match the mobile app's functionality and user experience.

## 🎮 Game Features

### Core Gameplay
- **Word Finding**: Connect adjacent letters to form valid words (3+ letters)
- **Timer System**: 2-minute countdown with time bonuses for word completion
- **Level Progression**: Score-based leveling with timer resets
- **Row Insertion**: Dynamic board population matching mobile app timing
- **Power-ups**: Hint, Shuffle, and Freeze abilities using flectcoins

### Mission System
- **Daily/Weekly Missions**: Progress tracking for words found, scores, and games played
- **Mission Rewards**: Flectcoins awarded only through mission completions
- **Completion Logic**: Prevents repeated progress on completed missions

### Currency System
- **Flectcoins**: Earned exclusively through mission completions
- **Gems**: Premium currency for special features
- **Power-up Costs**: Hint (50), Shuffle (100), Freeze (200) flectcoins

## 🛠 Technical Implementation

### Architecture
- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom animations
- **State Management**: React hooks with useRef for game state
- **API Integration**: Custom API service with authentication

### Key Components
- **Game Board**: 5x8 grid with dynamic letter generation
- **Timer System**: Visual countdown with danger zone indicators
- **Mission Tracking**: Real-time progress updates
- **Word Validation**: Local word set with 3+ letter minimum

### API Integration
```typescript
// Authentication
apiService.signIn(credentials)
apiService.getUserProfile()

// Game Stats
apiService.updateUserStats(gameStats)

// Missions
apiService.getMissions()
apiService.completeMission(missionData)

// Word Definitions
apiService.getWordDefinition(word)
```

## 🔧 Recent Fixes & Improvements

### CORS Issues Resolution
**Problem**: API calls failed due to CORS policy blocking direct requests from `https://www.wordflect.com` to `https://api.wordflect.com`.

**Root Cause**: Browser security policy prevents cross-origin requests unless the server explicitly allows them via CORS headers.

**Solution 1: Frontend Proxy Routes (Implemented)**
Implemented Next.js API routes that act as server-side proxies to bypass CORS restrictions.

#### Proxy 1: Word Definitions
```typescript
// File: /src/app/api/proxy-word-definition/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get('word');
  
  if (!word) {
    return NextResponse.json({ error: 'Missing word parameter' }, { status: 400 });
  }

  try {
    // Server-side fetch (no CORS restrictions)
    const apiRes = await fetch(`https://api.wordflect.com/word/definition?word=${encodeURIComponent(word)}`);
    const data = await apiRes.json();
    return NextResponse.json(data, { status: apiRes.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch word definition' }, { status: 500 });
  }
}
```

#### Proxy 2: User Stats Updates
```typescript
// File: /src/app/api/proxy-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wordflect.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    console.log('📤 Proxy: Forwarding update-stats request to:', `${API_BASE_URL}/user/update-stats`);
    
    const response = await fetch(`${API_BASE_URL}/user/update-stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries())
      },
      body
    });

    console.log('📥 Proxy: Response status:', response.status);
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
```

**How the Proxies Work**:
1. **Browser Request**: `https://www.wordflect.com/api/proxy-*`
2. **Server-Side Fetch**: Next.js server fetches from `https://api.wordflect.com/*`
3. **Response**: Server returns the data to browser (same origin, no CORS issue)

**Frontend Updates**:
```typescript
// Before: Direct API calls (CORS blocked)
const response = await this.makeRequest(buildApiUrl(`/word/definition?word=${word}`));
const statsResponse = await this.makeRequest(buildApiUrl('/user/update-stats'), options);

// After: Proxy calls (CORS resolved)
const response = await fetch(`/api/proxy-word-definition?word=${word}`);
const statsResponse = await fetch('/api/proxy-stats', options);
```

**API Configuration Update**:
```typescript
// File: /src/config/api.ts
export const API_CONFIG = {
  // ... other config
  ENDPOINTS: {
    // ... other endpoints
    USER_UPDATE_STATS: '/api/proxy-stats', // Use proxy to bypass CORS
  }
};
```

**Advantages of Proxy Approach**:
- ✅ **Frontend Control**: No backend changes required
- ✅ **Immediate Solution**: Can be implemented without backend coordination
- ✅ **Flexible**: Can proxy any external API calls
- ✅ **Secure**: Server-side requests maintain authentication headers
- ✅ **Comprehensive**: Covers both read (definitions) and write (stats) operations

**Disadvantages**:
- ❌ **Additional Latency**: Extra hop through proxy server
- ❌ **Server Load**: Proxy server handles all API requests
- ❌ **Maintenance**: Need to maintain proxy routes
- ❌ **Complexity**: More moving parts in the system

---

**Solution 2: Backend CORS Fix (Recommended Long-term)**

The ideal solution is to fix CORS on the backend server. Here's how the backend should be configured:

**Node.js/Express Example**:
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// Option 1: Allow specific domain
app.use('/word/definition', cors({
  origin: 'https://www.wordflect.com',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Option 2: Allow multiple domains
app.use('/word/definition', cors({
  origin: ['https://www.wordflect.com', 'https://wordflect.com'],
  credentials: true
}));

// Option 3: Manual CORS headers
app.use('/word/definition', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://www.wordflect.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
```

**Python/Flask Example**:
```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Allow specific domain
CORS(app, resources={
    r"/word/definition": {
        "origins": ["https://www.wordflect.com"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

**PHP Example**:
```php
<?php
// Add to the top of your API endpoint
header('Access-Control-Allow-Origin: https://www.wordflect.com');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
```

**Advantages of Backend Fix**:
- ✅ **Direct Communication**: No proxy latency
- ✅ **Better Performance**: Direct API calls
- ✅ **Standard Solution**: Follows web standards
- ✅ **Scalable**: No additional server load

**Implementation Steps for Backend Fix**:
1. **Identify Backend Technology**: Determine if using Node.js, Python, PHP, etc.
2. **Add CORS Middleware**: Implement appropriate CORS configuration
3. **Test Locally**: Verify CORS headers are sent correctly
4. **Deploy Backend**: Update backend with CORS fix
5. **Update Frontend**: Remove proxy and use direct API calls
6. **Monitor**: Ensure no CORS errors in production

**Recommended Migration Path**:
1. **Phase 1**: Use proxy (current implementation) for immediate fix
2. **Phase 2**: Implement backend CORS fix
3. **Phase 3**: Remove proxy and use direct API calls
4. **Phase 4**: Keep proxy as fallback for other external APIs

**Security Considerations**:
- **Specific Origins**: Only allow your domain, not `*`
- **Credentials**: Include `credentials: true` for authenticated requests
- **Methods**: Only allow necessary HTTP methods
- **Headers**: Only allow required headers
- **HTTPS**: Ensure all communication is over HTTPS

### Game Over Console Spam Fix
**Problem**: Repeated API calls causing console spam and UI glitches.

**Solution**: Added useRef guard to prevent multiple handleGameOver calls.

```typescript
const hasHandledGameOver = useRef(false);

useEffect(() => {
  if (gameOver && !submitting && !hasHandledGameOver.current) {
    hasHandledGameOver.current = true;
    handleGameOver();
  }
}, [gameOver, submitting, handleGameOver]);
```

### Excessive Flectcoin Accumulation Fix
**Problem**: Game stats were sending flectcoins balance, causing backend to award additional flectcoins.

**Solution**: Removed flectcoins from game stats entirely.

```typescript
// Before: Included flectcoins in game stats
const gameStats = {
  id: userProfile?.id,
  score,
  words: foundWords,
  flectcoins, // ❌ This caused accumulation
  gems,
  // ...
};

// After: Flectcoins only from mission completions
const gameStats = {
  id: userProfile?.id,
  score,
  words: foundWords,
  // ✅ No flectcoins field
  gems,
  // ...
};
```

### Power-up Stats Update Fix
**Problem**: Power-ups triggered "id, score, and words are required" errors.

**Solution**: Added required fields to syncCurrency function.

```typescript
const updatedStats = {
  id: userProfile.id,
  score: score,
  words: foundWords,
  flectcoins: newFlectcoins,
  gems: newGems,
};
```

## 🚀 Deployment

### Vercel Deployment
- **Automatic Deployments**: Triggered on git push to main branch
- **Environment Variables**: Configured for API endpoints
- **Build Process**: Next.js optimized build with TypeScript

### Environment Setup
```bash
# Development
npm run dev

# Production Build
npm run build
npm start
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── proxy-word-definition/     # CORS proxy for word definitions
│   │   ├── proxy-stats/              # CORS proxy for user stats updates
│   │   └── contact/                  # Contact form email handling
│   ├── play/
│   │   └── page.tsx                  # Main game component
│   └── layout.tsx
├── services/
│   └── api.ts                        # API service with authentication
└── config/
    └── api.ts                        # API configuration
```

## 🎯 Game Mechanics

### Word Validation
- Minimum 3 letters required
- Must be in local word set
- Adjacent letter connections only

### Scoring System
- 1 point per letter in word
- Time bonus: 1 second per letter
- Level progression: Exponential point requirements

### Timer System
- 2-minute initial timer
- Time bonuses for word completion
- Danger zone indicators (≤30s)
- Timer resets on level up

### Row Insertion Logic
- Dynamic timing based on filled rows
- Level scaling affects insertion speed
- Pauses during game over or freeze states

## 🔐 Authentication

### Token Management
- JWT tokens stored in localStorage
- Automatic token validation
- Graceful fallback for unauthenticated users

### API Security
- Bearer token authentication
- CORS-compliant proxy routes
- Error handling for expired tokens

## 🐛 Known Issues & Solutions

### CORS Issues
- **Status**: ✅ Resolved
- **Solution**: Proxy routes for external API calls

### Console Spam
- **Status**: ✅ Resolved  
- **Solution**: useRef guards for game over logic

### Excessive Flectcoins
- **Status**: ✅ Resolved
- **Solution**: Removed flectcoins from game stats

### TypeScript Errors
- **Status**: ✅ Resolved
- **Solution**: Proper typing for API responses

## 🚀 Future Enhancements

### Planned Features
- [ ] Real-time multiplayer
- [ ] Advanced power-ups
- [ ] Social features
- [ ] Leaderboards
- [ ] Custom themes

### Technical Improvements
- [ ] Performance optimization
- [ ] Enhanced animations
- [ ] Mobile responsiveness
- [ ] Offline support

## 📝 Development Notes

### Key Decisions
1. **Proxy Routes**: Chosen over backend CORS fixes for frontend control
2. **Mission-Only Rewards**: Flectcoins only from missions, not game completion
3. **Local Word Validation**: Reduces API calls and improves performance
4. **useRef Guards**: Prevents infinite loops in game state management

### Performance Considerations
- Word set loaded once at game start
- Efficient board state management
- Minimal API calls during gameplay
- Optimized re-renders with proper dependencies

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Status**: Production Ready ✅

## 🅰️ Letter Frequency Guardrails (Web & Mobile Standard)

### Rationale
To ensure fair and enjoyable gameplay, the board should reflect realistic English letter frequencies and prevent rare letters (Z, Q, X, J, K, V) from appearing too often or in multiples. This prevents situations where players are stuck with unplayable tiles and matches the expectations of word game players.

### Frequency Table (Based on Scrabble/English Usage)
| Letter | Frequency |
|--------|-----------|
| E      | 12.0      |
| A      | 9.0       |
| I      | 9.0       |
| O      | 8.0       |
| T      | 9.0       |
| N      | 6.7       |
| S      | 6.3       |
| H      | 6.1       |
| R      | 6.0       |
| D      | 4.3       |
| L      | 4.0       |
| U      | 4.0       |
| C      | 2.8       |
| M      | 2.4       |
| W      | 2.4       |
| F      | 2.2       |
| G      | 2.0       |
| Y      | 2.0       |
| P      | 1.9       |
| B      | 1.5       |
| V      | 0.98      |
| K      | 0.77      |
| J      | 0.15      |
| X      | 0.15      |
| Q      | 0.10      |
| Z      | 0.07      |

### Rare Letter Guardrails
- **Rare letters:** Z, Q, X, J, K, V
- **Maximum allowed on board at once:** 2
- If the board already contains 2 or more rare letters, only common letters are generated until a rare letter is used.
- Rare letter tracking resets on new game, shuffle, or replay.

### Reference Implementation (TypeScript/JavaScript)
```ts
// Frequency table
const letterFrequencies: Record<string, number> = {
  'A': 9.0, 'E': 12.0, 'I': 9.0, 'O': 8.0, 'U': 4.0,
  'T': 9.0, 'N': 6.7, 'S': 6.3, 'H': 6.1, 'R': 6.0,
  'D': 4.3, 'L': 4.0, 'C': 2.8, 'M': 2.4, 'W': 2.4,
  'F': 2.2, 'G': 2.0, 'Y': 2.0, 'P': 1.9, 'B': 1.5,
  'V': 0.98, 'K': 0.77, 'J': 0.15, 'X': 0.15, 'Q': 0.10, 'Z': 0.07
};
const rareLetters = ['Z', 'Q', 'X', 'J', 'K', 'V'];
const maxRareLettersOnBoard = 2;
let rareLettersOnBoard = new Set<string>();

function generateRandomLetter(): string {
  // ... (convert frequency table to cumulative probabilities)
  // ... (pick a letter based on random number)
}

function generateRandomLetterWithGuardrails(): string {
  if (rareLettersOnBoard.size >= maxRareLettersOnBoard) {
    // Only generate common letters
    const commonLetters = Object.keys(letterFrequencies).filter(l => !rareLetters.includes(l));
    return commonLetters[Math.floor(Math.random() * commonLetters.length)];
  }
  const letter = generateRandomLetter();
  if (rareLetters.includes(letter)) rareLettersOnBoard.add(letter);
  return letter;
}

function resetRareLetterTracking() {
  rareLettersOnBoard.clear();
}
function removeRareLetterFromTracking(letter: string) {
  if (rareLetters.includes(letter)) rareLettersOnBoard.delete(letter);
}
```

#### Example Usage in Board Generation
```ts
// When generating a new board or row:
resetRareLetterTracking();
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    board[row][col] = generateRandomLetterWithGuardrails();
  }
}
```

#### When to Reset or Update Tracking
- **On new game/replay:** Call `resetRareLetterTracking()`
- **On shuffle:** Re-scan the board and re-add any rare letters to the set
- **When a letter is used/removed:** Call `removeRareLetterFromTracking(letter)`

### Mobile Implementation Notes
- **Port the frequency table and guardrail logic to Swift/Kotlin/Flutter.**
- Use a Set or List to track rare letters on the board.
- Ensure all board generation (initial, row insert, shuffle) uses the guardrail logic.
- Reset tracking on new game, shuffle, or replay.
- Remove rare letter from tracking when it is used/removed.

#### Example (Swift-like pseudocode)
```swift
let letterFrequencies: [Character: Double] = [
  "A": 9.0, "E": 12.0, "I": 9.0, "O": 8.0, "U": 4.0,
  "T": 9.0, "N": 6.7, "S": 6.3, "H": 6.1, "R": 6.0,
  "D": 4.3, "L": 4.0, "C": 2.8, "M": 2.4, "W": 2.4,
  "F": 2.2, "G": 2.0, "Y": 2.0, "P": 1.9, "B": 1.5,
  "V": 0.98, "K": 0.77, "J": 0.15, "X": 0.15, "Q": 0.10, "Z": 0.07
]
let rareLetters: Set<Character> = ["Z", "Q", "X", "J", "K", "V"]
var rareLettersOnBoard = Set<Character>()
let maxRareLettersOnBoard = 2

func generateRandomLetterWithGuardrails() -> Character {
  if rareLettersOnBoard.count >= maxRareLettersOnBoard {
    let commonLetters = letterFrequencies.keys.filter { !rareLetters.contains($0) }
    return commonLetters.randomElement()!
  }
  let letter = generateRandomLetter() // Use frequency table logic
  if rareLetters.contains(letter) { rareLettersOnBoard.insert(letter) }
  return letter
}

func resetRareLetterTracking() { rareLettersOnBoard.removeAll() }
func removeRareLetterFromTracking(_ letter: Character) {
  if rareLetters.contains(letter) { rareLettersOnBoard.remove(letter) }
}
```

### Review Checklist for Mobile Devs
- [ ] Use the provided frequency table for all board/row generation
- [ ] Implement rare letter guardrail logic (max 2 on board)
- [ ] Reset rare letter tracking on new game, shuffle, and replay
- [ ] Remove rare letter from tracking when it is used/removed
- [ ] Test for edge cases: no more than 2 rare letters at any time

---
**This logic is now the standard for both web and mobile Wordflect.**
If you have questions or need a language-specific implementation, contact the web team or open an issue in the main repo.