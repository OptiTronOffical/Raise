"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "../lib/telegram";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  ariaLabel: string;
}

const items: NavItem[] = [
  { href: "/", label: "Home", icon: "🏠", ariaLabel: "Go to home page" },
  { href: "/bonuses", label: "Bonuses", icon: "🎁", ariaLabel: "View bonuses" },
  { href: "/referrals", label: "Referrals", icon: "👥", ariaLabel: "View referrals" },
  { href: "/transactions", label: "History", icon: "🕘", ariaLabel: "View transaction history" }
];

export function BottomNav() {
  const pathname = usePathname();

  const handleClick = () => {
    haptic.selection();
  };

  return (
    <nav className="bottomNav" aria-label="Main navigation">
      <div className="bottomNavInner">
        {items.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`navItem ${isActive ? 'active' : ''}`}
              aria-label={item.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
              onClick={handleClick}
            >
              <span className="navIcon" aria-hidden="true">{item.icon}</span>
              <span className="navLabel">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .bottomNav {
          position: sticky;
          bottom: 0;
          background: white;
          border-top: 1px solid #eef2f6;
          padding: 8px 16px;
          z-index: 100;
        }

        .bottomNavInner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 400px;
          margin: 0 auto;
        }

        .navItem {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border-radius: 12px;
          text-decoration: none;
          color: #94a3b8;
          transition: all 0.2s;
          min-width: 64px;
        }

        .navItem:hover {
          background: #f8fafc;
        }

        .navItem:active {
          transform: scale(0.95);
        }

        .navItem.active {
          color: #2f7cf6;
        }

        .navIcon {
          font-size: 22px;
          line-height: 1;
        }

        .navLabel {
          font-size: 11px;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .bottomNav {
            padding: 4px 8px;
          }

          .navItem {
            padding: 6px 8px;
            min-width: 56px;
          }

          .navIcon {
            font-size: 20px;
          }

          .navLabel {
            font-size: 10px;
          }
        }
      `}</style>
    </nav>
  );
}