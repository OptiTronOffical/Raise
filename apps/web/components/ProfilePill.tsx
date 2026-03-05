"use client";
import { useState } from "react";
import { getCurrentUser } from "../lib/telegram";

interface ProfilePillProps {
  username?: string;
  avatarUrl?: string;
  onClick?: () => void;
}

export function ProfilePill({ username: propUsername, avatarUrl, onClick }: ProfilePillProps) {
  const [imageError, setImageError] = useState(false);
  
  // Get user from Telegram if not provided
  const telegramUser = getCurrentUser();
  const displayUsername = propUsername || telegramUser?.username || telegramUser?.first_name || "User";
  const displayAvatar = avatarUrl || telegramUser?.photo_url;
  
  // Generate initials from username
  const initials = displayUsername
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div 
      className="profilePill" 
      onClick={onClick}
      role={onClick ? "button" : "presentation"}
      tabIndex={onClick ? 0 : -1}
    >
      <div className="avatar">
        {displayAvatar && !imageError ? (
          <img 
            src={displayAvatar} 
            alt={displayUsername}
            onError={() => setImageError(true)}
            className="avatarImage"
          />
        ) : (
          <div className="avatarFallback">{initials}</div>
        )}
      </div>
      <div className="username">{displayUsername}</div>

      <style jsx>{`
        .profilePill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 6px;
          background: white;
          border-radius: 40px;
          border: 1px solid #e2e8f0;
          cursor: ${onClick ? 'pointer' : 'default'};
          transition: all 0.2s;
        }

        .profilePill:hover {
          ${onClick ? 'background: #f8fafc; transform: translateY(-1px);' : ''}
        }

        .profilePill:active {
          ${onClick ? 'transform: translateY(0);' : ''}
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          overflow: hidden;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatarImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatarFallback {
          color: white;
          font-weight: 600;
          font-size: 14px;
        }

        .username {
          font-weight: 600;
          font-size: 14px;
          color: #0f172a;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}