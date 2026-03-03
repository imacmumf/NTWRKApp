// AuthContext is no longer needed with Clerk.
// Clerk provides its own hooks: useAuth(), useUser(), useClerk()
// This file re-exports Clerk hooks for convenience.

export { useAuth, useUser } from '@clerk/clerk-expo';
