import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceBar } from '../../components/PresenceBar';

describe('PresenceBar', () => {
  it('renders nothing but no online count when no users', () => {
    render(<PresenceBar users={[]} />);
    expect(screen.queryByText(/online/)).not.toBeInTheDocument();
  });

  it('renders user avatars with photos', () => {
    const users = [
      { uid: '1', displayName: 'Alice', photoURL: 'https://example.com/alice.jpg', color: '#FF6B6B', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    // alt="" gives role="presentation", so query by tag instead
    const img = screen.getByTitle('Alice').querySelector('img');
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute('src', 'https://example.com/alice.jpg');
  });

  it('renders user initials when no photo', () => {
    const users = [
      { uid: '1', displayName: 'Bob', color: '#4ECDC4', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('shows online count', () => {
    const users = [
      { uid: '1', displayName: 'Alice', color: '#FF6B6B', isOnline: true },
      { uid: '2', displayName: 'Bob', color: '#4ECDC4', isOnline: true },
      { uid: '3', displayName: 'Charlie', color: '#45B7D1', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    expect(screen.getByText('3 online')).toBeInTheDocument();
  });

  it('renders user with display name as title attribute', () => {
    const users = [
      { uid: '1', displayName: 'Alice', color: '#FF6B6B', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    expect(screen.getByTitle('Alice')).toBeInTheDocument();
  });

  it('uses user color for avatar border', () => {
    const users = [
      { uid: '1', displayName: 'Alice', color: '#FF6B6B', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    const avatar = screen.getByTitle('Alice');
    // Verify the avatar element has the user's color in its border style
    const styleAttr = avatar.getAttribute('style') || '';
    expect(styleAttr).toContain('rgb(255, 107, 107)');
    expect(styleAttr).toContain('border');
  });

  it('shows ? when displayName is empty', () => {
    const users = [
      { uid: '1', displayName: '', color: '#FF6B6B', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('handles multiple users correctly', () => {
    const users = [
      { uid: '1', displayName: 'Alice', photoURL: 'https://a.com/1.jpg', color: '#FF6B6B', isOnline: true },
      { uid: '2', displayName: 'Bob', color: '#4ECDC4', isOnline: true },
    ];
    render(<PresenceBar users={users} />);

    expect(screen.getByText('2 online')).toBeInTheDocument();
    expect(screen.getByTitle('Alice')).toBeInTheDocument();
    expect(screen.getByTitle('Bob')).toBeInTheDocument();
  });
});
