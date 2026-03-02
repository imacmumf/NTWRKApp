# NTWRK App

## Overview
NTWRK lets users discover how they're connected to others through mutual contacts — a permission-based social graph built from phone contacts, powered by Neo4j.

## Tech Stack
- **Mobile**: React Native + Expo (TypeScript)
- **Auth**: Clerk (email/password with email verification)
- **Backend**: Node.js + Express + TypeScript
- **Database**: Neo4j (graph database for contact networks)
- **Infrastructure**: Docker Compose

## Project Structure
```
NTWRK_APP/
├── mobile/                 # React Native mobile app
│   ├── App.tsx             # Root component with ClerkProvider
│   ├── src/
│   │   ├── contexts/       # Re-exports Clerk hooks
│   │   ├── navigation/     # Stack navigators (Auth + App)
│   │   ├── screens/        # AuthScreen, HomeScreen, ContactsScreen, etc.
│   │   └── services/       # API service layer
│   └── .env.example        # Environment variables template
├── backend/                # Express API server
│   ├── src/
│   │   ├── config/         # Neo4j setup
│   │   ├── middleware/      # Clerk JWT verification
│   │   └── routes/         # contacts, network, users
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml      # Backend + Neo4j containers
└── .gitignore
```

## Setup

### 1. Clerk
1. Create a Clerk application at https://dashboard.clerk.com
2. Enable Email/Password sign-in under **User & Authentication → Email, Phone, Username**
3. Copy your **Publishable Key** into `mobile/.env`
4. Copy your **Secret Key** into `backend/.env`

### 2. Mobile App
```bash
cd mobile
cp .env.example .env   # Fill in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
npm install            # Automatically patches expo-modules-core for Swift 6 compat
npx expo start --ios
```

### 3. Backend + Neo4j
```bash
cp backend/.env.example backend/.env   # Fill in CLERK_SECRET_KEY
docker-compose up -d
```

### 4. Xcode 16.4+ / Swift 6 Compatibility

Xcode 16.4+ ships Swift 6.2 which defaults to Swift 6 language mode. `expo-modules-core@55.x`
is not yet compatible. Two automated fixes are in place:

1. **Expo Config Plugin** (`plugins/withSwift59.js`): Injects `SWIFT_VERSION = '5.9'` into the
   Podfile `post_install` hook. Survives `npx expo prebuild --clean`.

2. **Postinstall Script** (`scripts/patch-swift6.sh`): Removes `@MainActor` conformance
   attributes from two Swift files in `node_modules/expo-modules-core`. Runs automatically
   on `npm install`.

> **Note**: These fixes can be removed once `expo-modules-core` ships a Swift 6-compatible release.

### 5. API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/contacts/sync` | Sync phone contacts to graph |
| GET | `/api/network/connection/:uid` | Find shortest path to user |
| GET | `/api/users/search?q=name` | Search users by name/email |

All API endpoints (except health) require a `Bearer <clerk-session-token>` header.
# NTWRKApp
