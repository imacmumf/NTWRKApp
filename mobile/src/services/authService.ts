// Auth is now handled by Clerk's hooks directly in screens:
//   useSignIn() — for sign-in flow
//   useSignUp() — for sign-up flow
//   useClerk().signOut() — for sign-out
//   useAuth().getToken() — for API auth headers
//
// This file is no longer needed. Auth logic lives in the screens.

export {};
