import { createAuthClient } from 'better-auth/client';

// Default base path /api/auth matches the Worker route. Same-origin production
// calls and Vite's local /api proxy mean no CORS or cross-domain cookie config.
export const authClient = createAuthClient();
