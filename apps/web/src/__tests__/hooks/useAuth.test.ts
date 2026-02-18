import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';

// Mock Firebase Auth
const mockOnAuthStateChanged = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock('../../lib/firebase', () => ({
  auth: {},
  googleProvider: {},
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no user, calls callback immediately
    mockOnAuthStateChanged.mockImplementation((_, callback: (user: unknown) => void) => {
      callback(null);
      return vi.fn(); // unsubscribe
    });
  });

  it('starts in loading state', () => {
    // Don't call the callback immediately to keep loading=true
    mockOnAuthStateChanged.mockImplementation(() => vi.fn());

    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('sets user when auth state changes to logged in', () => {
    const mockUser = { uid: 'user-123', displayName: 'Test User', email: 'test@example.com' };
    mockOnAuthStateChanged.mockImplementation((_, callback: (user: unknown) => void) => {
      callback(mockUser);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
  });

  it('sets user to null when logged out', () => {
    mockOnAuthStateChanged.mockImplementation((_, callback: (user: unknown) => void) => {
      callback(null);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('signInWithGoogle calls signInWithPopup', async () => {
    mockSignInWithPopup.mockResolvedValue({ user: { uid: 'user-123' } });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('signInWithGoogle handles errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignInWithPopup.mockRejectedValue(new Error('Auth failed'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    // Should not throw — error is caught internally
    expect(consoleSpy).toHaveBeenCalledWith('Sign in error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('logout calls signOut', async () => {
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('logout handles errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSignOut.mockRejectedValue(new Error('Sign out failed'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Sign out error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('unsubscribes from auth state on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnAuthStateChanged.mockImplementation(() => unsubscribe);

    const { unmount } = renderHook(() => useAuth());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
