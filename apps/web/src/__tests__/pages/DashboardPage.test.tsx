import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from '../../pages/DashboardPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useAuth
const mockUser = { uid: 'user-123', displayName: 'Test User', photoURL: 'https://photo.url' };
const mockLogout = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    logout: mockLogout,
  }),
}));

// Mock Firebase Firestore
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-board-id' });
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
let snapshotCallback: ((snapshot: unknown) => void) | null = null;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
  onSnapshot: vi.fn((_, callback: (snapshot: unknown) => void) => {
    snapshotCallback = callback;
    // Simulate empty board list initially
    callback({
      forEach: () => {},
    });
    return vi.fn(); // unsubscribe
  }),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotCallback = null;
  });

  it('renders the dashboard header', () => {
    render(<DashboardPage />);
    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
  });

  it('displays user display name', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows Sign Out button', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('calls logout when Sign Out is clicked', async () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByText('Sign Out'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('shows the board title input', () => {
    render(<DashboardPage />);
    expect(screen.getByPlaceholderText('Enter board title...')).toBeInTheDocument();
  });

  it('shows + New Board button disabled initially (empty title)', () => {
    render(<DashboardPage />);
    const btn = screen.getByText('+ New Board');
    expect(btn).toBeDisabled();
  });

  it('enables + New Board button when title is entered', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = screen.getByPlaceholderText('Enter board title...');
    await user.type(input, 'My Board');

    const btn = screen.getByText('+ New Board');
    expect(btn).not.toBeDisabled();
  });

  it('creates board and navigates when + New Board is clicked', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = screen.getByPlaceholderText('Enter board title...');
    await user.type(input, 'Test Board');

    fireEvent.click(screen.getByText('+ New Board'));

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/board/new-board-id');
    });
  });

  it('creates board on Enter key', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = screen.getByPlaceholderText('Enter board title...');
    await user.type(input, 'Test Board{Enter}');

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
    });
  });

  it('does not create board when title is empty (just spaces)', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const input = screen.getByPlaceholderText('Enter board title...');
    await user.type(input, '   {Enter}');

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('shows My Boards and Shared with Me tabs', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/My Boards/)).toBeInTheDocument();
    expect(screen.getByText(/Shared with Me/)).toBeInTheDocument();
  });

  it('shows empty state message for My Boards', () => {
    render(<DashboardPage />);
    expect(screen.getByText('No boards yet. Create one to get started!')).toBeInTheDocument();
  });

  it('shows empty state message for Shared tab', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByText(/Shared with Me/));
    expect(screen.getByText('No shared boards yet. Join a board using a board ID!')).toBeInTheDocument();
  });

  it('shows Join Board button', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Join Board')).toBeInTheDocument();
  });

  it('renders boards from snapshot', () => {
    render(<DashboardPage />);

    // Simulate boards arriving via snapshot — wrapped in act() for state update
    act(() => {
      if (snapshotCallback) {
        const boards = [
          { id: 'board-1', data: () => ({ title: 'Board One', createdBy: 'user-123', createdAt: Date.now() }) },
          { id: 'board-2', data: () => ({ title: 'Board Two', createdBy: 'other-user', createdAt: Date.now() }) },
        ];
        snapshotCallback({
          forEach: (cb: (doc: unknown) => void) => boards.forEach(cb),
        });
      }
    });

    expect(screen.getByText('Board One')).toBeInTheDocument();
  });

  it('navigates to board when card is clicked', () => {
    render(<DashboardPage />);

    act(() => {
      if (snapshotCallback) {
        const boards = [
          { id: 'board-1', data: () => ({ title: 'Board One', createdBy: 'user-123', createdAt: Date.now() }) },
        ];
        snapshotCallback({
          forEach: (cb: (doc: unknown) => void) => boards.forEach(cb),
        });
      }
    });

    fireEvent.click(screen.getByText('Board One'));
    expect(mockNavigate).toHaveBeenCalledWith('/board/board-1');
  });

  it('shows delete button only on boards created by the user', () => {
    render(<DashboardPage />);

    act(() => {
      if (snapshotCallback) {
        const boards = [
          { id: 'board-1', data: () => ({ title: 'My Board', createdBy: 'user-123', createdAt: Date.now() }) },
        ];
        snapshotCallback({
          forEach: (cb: (doc: unknown) => void) => boards.forEach(cb),
        });
      }
    });

    expect(screen.getByTitle('Delete board')).toBeInTheDocument();
  });

  it('does not show delete button on shared boards', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    act(() => {
      if (snapshotCallback) {
        const boards = [
          { id: 'board-2', data: () => ({ title: 'Shared Board', createdBy: 'other-user', createdAt: Date.now() }) },
        ];
        snapshotCallback({
          forEach: (cb: (doc: unknown) => void) => boards.forEach(cb),
        });
      }
    });

    // Switch to Shared tab
    await user.click(screen.getByText(/Shared with Me/));

    expect(screen.queryByTitle('Delete board')).not.toBeInTheDocument();
  });
});
