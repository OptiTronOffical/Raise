"use client";
import { useRouter } from "next/navigation";
import { backButton, close, haptic } from "../lib/telegram";

interface TopBarProps {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

export function TopBar({ showBack = false, onBack, title = "Raise TON", subtitle = "Jackpot Game" }: TopBarProps) {
  const router = useRouter();

  const handleBack = () => {
    haptic.impact('light');
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleClose = () => {
    haptic.impact('medium');
    close();
  };

  const handleMenu = () => {
    haptic.selection();
    // Could open a menu or emit an event
    console.log('Menu clicked');
  };

  return (
    <div className="topBar">
      <div className="topBarLeft">
        {showBack ? (
          <button className="iconButton" onClick={handleBack} aria-label="Go back">
            ←
          </button>
        ) : (
          <button className="iconButton" onClick={handleClose} aria-label="Close app">
            ✕
          </button>
        )}
      </div>

      <div className="topBarCenter">
        <div className="title">{title}</div>
        <div className="subtitle">{subtitle}</div>
      </div>

      <div className="topBarRight">
        <button className="iconButton" onClick={handleMenu} aria-label="Menu">
          ⋯
        </button>
      </div>

      <style jsx>{`
        .topBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #eef2f6;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .topBarLeft, .topBarRight {
          flex: 0 0 auto;
        }

        .topBarCenter {
          flex: 1;
          text-align: center;
        }

        .iconButton {
          width: 40px;
          height: 40px;
          border: none;
          background: transparent;
          border-radius: 12px;
          font-size: 20px;
          color: #1e293b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .iconButton:hover {
          background: #f1f5f9;
        }

        .iconButton:active {
          transform: scale(0.95);
        }

        .title {
          font-weight: 700;
          font-size: 18px;
          color: #0f172a;
          line-height: 1.2;
        }

        .subtitle {
          font-size: 12px;
          color: #64748b;
          line-height: 1.2;
        }

        @media (max-width: 640px) {
          .topBar {
            padding: 8px 12px;
          }

          .iconButton {
            width: 36px;
            height: 36px;
            font-size: 18px;
          }

          .title {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}