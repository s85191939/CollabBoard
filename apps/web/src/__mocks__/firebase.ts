// Mock for ../lib/firebase
import { vi } from 'vitest';

export const auth = {
  currentUser: null,
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
};

export const db = {};

export const googleProvider = {};

export default {};
