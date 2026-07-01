/** Ohne VITE_-Variablen zeigt alles auf den lokalen Dev-Server (backend: npm run dev). */
export const config = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001',
  chatUrl: (import.meta.env.VITE_CHAT_URL as string | undefined) ?? 'http://localhost:3001/chat',
  userPoolId: import.meta.env.VITE_USER_POOL_ID as string,
  clientId: import.meta.env.VITE_USER_POOL_CLIENT_ID as string,
};
