# Wordflect Web Project Structure

**Version**: 1.0.107 (Web Implementation)
**Last Updated**: December 2024

## Directory Layout
```
wordflect-website/
├── src/                    # App source code (Next.js App Router)
│   ├── app/                # Next.js 14 App Router pages
│   │   ├── api/            # API routes (proxies, contact)
│   │   │   ├── proxy-word-definition/  # CORS proxy for word definitions
│   │   │   ├── proxy-stats/           # CORS proxy for user stats
│   │   │   └── contact/               # Contact form handler
│   │   ├── play/           # Main game page
│   │   ├── dashboard/      # User dashboard
│   │   ├── profile/        # User profile page
│   │   ├── signin/         # Authentication page
│   │   ├── faq/            # FAQ page
│   │   ├── tips/           # Game tips page
│   │   ├── news/           # News/updates page
│   │   ├── support/        # Support page
│   │   ├── privacy/        # Privacy policy
│   │   ├── terms/          # Terms of service
│   │   └── layout.tsx      # Root layout
│   ├── services/           # API service layer
│   │   └── api.ts          # Main API service with authentication
│   └── config/             # Configuration files
│       └── api.ts          # API configuration and endpoints
├── public/                 # Static assets
│   ├── words.json         # Word list for validation
│   ├── favicon files      # Various favicon formats
│   └── icons/             # App icons and images
├── package.json           # Project dependencies (Next.js 15.3.4)
├── next.config.ts         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── README.md              # This documentation
```

## Project Goals & Current Status

### ✅ Completed Features
- **Full Game Implementation**: Complete word-finding game with 5x8 grid
- **User Authentication**: Sign in with Wordflect credentials
- **Mission System**: Daily/weekly missions with progress tracking
- **Power-ups**: Hint, Shuffle, and Freeze abilities
- **Responsive Design**: Works on desktop and mobile browsers
- **API Integration**: Full backend integration with CORS proxy solutions
- **User Dashboard**: Profile display with stats and achievements
- **Legal Pages**: Privacy policy, terms of service, FAQ, support

### 🎯 Current Focus
- **Performance Optimization**: Faster loading and smoother gameplay
- **Mobile Experience**: Enhanced touch interactions and mobile UI
- **Feature Parity**: Aligning web features with mobile app where possible
- **User Experience**: Improved animations and visual feedback

### 🚀 Future Enhancements
- **Battle Mode**: Real-time multiplayer competitions (mobile feature)
- **Frame System**: Avatar customization with frames (mobile feature)
- **Leaderboards**: Global and friend leaderboards (mobile feature)
- **Perfect Clear System**: Advanced scoring mechanics (mobile feature)

## Tech Stack
- **Framework:** Next.js (React, TypeScript)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel (recommended)
- **Collaboration:** GitHub ([https://github.com/RarefiedAir24/wordflect-website.git](https://github.com/RarefiedAir24/wordflect-website.git))

## Onboarding & Collaboration
- Clone the repo: `git clone https://github.com/RarefiedAir24/wordflect-website.git`
- Use standard git workflow: `git pull`, `git add .`, `git commit -m "message"`, `git push`
- Start the dev server with `npm run dev`
- Update `src/pages/index.tsx` for the homepage
- Add new pages in `src/pages/`
- Add API calls in `src/services/api.ts`
- Keep this file updated as the website grows

---

## Backend/API Reference: Full Wordflect App Structure & API

This website connects to the main Wordflect backend for user authentication, stats, and gameplay data.

- **For the complete backend/API documentation, data models, and app structure, see:**
  [../wordflect/PROJECT_STRUCTURE.md](../wordflect/PROJECT_STRUCTURE.md)

### How to Use the Main App Markdown
- The main app's markdown is the single source of truth for backend endpoints, data models, and app structure.
- To find information, open the markdown and search for keywords (e.g., `frames`, `battle`, `auth`, `leaderboard`, `missions`).
- Use the API Endpoint Reference section for request/response examples and integration details.
- As the website grows, refer to the main app's markdown for adding new features or troubleshooting backend connectivity.

---

*This markdown is the source of truth for the website's structure, goals, and path forward. For backend and API details, always refer to the main Wordflect project's documentation linked above.*


## 🎮 Game Mechanics Reference

### Timer Reward System (v1.0.86+)

For website content, features, or game explanations, here are the current timer reward mechanics:

| Word Length | Time Reward |
|-------------|-------------|
| 3 letters   | +1 second   |
| 4 letters   | +2 seconds  |
| 5 letters   | +3 seconds  |
| 6 letters   | +4 seconds  |
| 7 letters   | +5 seconds  |
| 8 letters   | +6 seconds  |
| 9+ letters  | +0 seconds  |

**Level Up Timer**: When a player reaches a new level, the timer continues from its current value (no reset).

**Notes for Website Content**:
- No level-based time bonuses
- No other time rewards outside of word length
- Timer is capped at 120 seconds maximum
- Level progression does not reset the timer

**Implementation**: See `../wordflect/src/screens/Gamescreen.tsx` in the `handleWordSubmit()` function.
