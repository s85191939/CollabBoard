import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock import.meta.env for Firebase config
vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test.appspot.com');
vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456');
vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc');
