# Wordflect-Website Project Structure

## Directory Layout
```
wordflect-website/
├── src/                # App source code (pages, components, services, etc.)
├── public/             # Static assets (images, icons, etc.)
├── styles/             # Tailwind and global CSS
├── package.json        # Project dependencies
├── tailwind.config.js  # Tailwind config
├── next.config.js      # Next.js config
├── ...                 # Other config and setup files
```

## Project Goals & Path Forward
- Launch a professional, public-facing website for Wordflect
- Support App Store submission (landing, privacy, support)
- Enable user login with Wordflect credentials (connects to backend API)
- Display user stats after login
- Lay the foundation for future gameplay and interactive features
- Ensure the site is easy to update, maintain, and scale
- Enable multi-device collaboration via GitHub

## MVP Outline
- **Landing/Homepage:** Logo, tagline, hero section, App Store/TestFlight CTA, screenshots/features
- **Navigation:** Home, FAQ, Tips, News/Updates, Contact/Support
- **User Authentication:** Login page (calls backend API), secure session management
- **User Dashboard:** Display user stats (pulled from backend), profile info
- **Compliance:** Privacy Policy, Terms, cookie notice
- **Footer:** Social links, copyright, support

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

**Level Up Timer Reset**: When a player reaches a new level, the timer resets to exactly 2 minutes (120 seconds).

**Notes for Website Content**:
- No level-based time bonuses
- No other time rewards outside of word length
- Timer is capped at 120 seconds maximum
- Level progression resets timer to exactly 120 seconds

**Implementation**: See `../wordflect/src/screens/Gamescreen.tsx` in the `handleWordSubmit()` function.
