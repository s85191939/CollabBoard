interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  color: string;
  isOnline: boolean;
}

interface Props {
  users: PresenceUser[];
}

export function PresenceBar({ users }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      {users.map((u) => (
        <div
          key={u.uid}
          title={u.displayName}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `2px solid ${u.color}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: u.photoURL ? 'transparent' : u.color,
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          {u.photoURL ? (
            <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            u.displayName?.charAt(0)?.toUpperCase() || '?'
          )}
        </div>
      ))}
      {users.length > 0 && (
        <span style={{ color: '#a0a0b0', fontSize: '0.75rem', marginLeft: '0.3rem' }}>
          {users.length} online
        </span>
      )}
    </div>
  );
}
