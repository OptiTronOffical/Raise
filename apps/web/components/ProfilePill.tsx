export function ProfilePill({ username }:{ username:string }) {
  return (
    <div className="profilePill">
      <div className="avatar" />
      <div style={{fontWeight:900}}>{username}</div>
    </div>
  );
}
