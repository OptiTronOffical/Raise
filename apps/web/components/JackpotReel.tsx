"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface JackpotReelProps {
  winningIndex: number | null;
  spinning: boolean;
  onDone?: () => void;
  itemWidth?: number;
  itemHeight?: number;
  gap?: number;
  duration?: number;
}

export function JackpotReel({ 
  winningIndex, 
  spinning, 
  onDone,
  itemWidth = 80,
  itemHeight = 80,
  gap = 12,
  duration = 1800
}: JackpotReelProps) {
  const [offset, setOffset] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generate sequence: 12 full rotations of all NFTs
  const seq = useMemo(() => {
    const out: number[] = [];
    for (let r = 0; r < 12; r++) {
      for (let i = 1; i <= 15; i++) {
        out.push(i);
      }
    }
    return out;
  }, []);

  // Center position calculation
  const centerPosition = useMemo(() => {
    if (!containerRef.current) return 240;
    return containerRef.current.clientWidth / 2 - itemWidth / 2;
  }, [itemWidth]);

  useEffect(() => {
    if (!spinning || !winningIndex) return;

    // Find the target position
    const targetIndex = (() => {
      // Look for winning index in the last 2 rotations
      const lastIndex = seq.length - 1;
      for (let i = lastIndex; i >= lastIndex - 30; i--) {
        if (seq[i] === winningIndex) {
          return i;
        }
      }
      return lastIndex; // Fallback to last item
    })();

    const targetOffset = targetIndex * (itemWidth + gap) - centerPosition;
    const startOffset = offset;
    const delta = targetOffset - startOffset;
    
    const startTime = performance.now();
    let animationFrame: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      
      setOffset(startOffset + delta * eased);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        onDone?.();
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [spinning, winningIndex, seq, itemWidth, gap, centerPosition, offset, duration, onDone]);

  const handleImageError = (nftIndex: number) => {
    setImageErrors(prev => new Set(prev).add(nftIndex));
  };

  return (
    <div 
      ref={containerRef}
      className="reelContainer"
      role="region"
      aria-label="Jackpot NFT Reel"
      aria-busy={spinning}
    >
      <div className="reelOverlay" />
      <div 
        className="reelTrack"
        style={{ transform: `translateX(${-offset}px)` }}
      >
        {seq.map((nftIndex, idx) => (
          <div
            key={`${nftIndex}-${idx}`}
            className="reelItem"
            style={{ 
              width: itemWidth, 
              height: itemHeight,
              marginRight: idx < seq.length - 1 ? gap : 0
            }}
          >
            {!imageErrors.has(nftIndex) ? (
              <Image
                src={`/nft/${nftIndex}.png`}
                alt={`NFT #${nftIndex}`}
                width={itemWidth}
                height={itemHeight}
                className="reelImage"
                onError={() => handleImageError(nftIndex)}
                priority={idx < 30} // Prioritize first 30 images
              />
            ) : (
              <div className="reelFallback">
                <span>#{nftIndex}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .reelContainer {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          padding: 12px 0;
          background: #fff;
          box-shadow: 0 12px 30px rgba(16, 24, 40, 0.1);
          margin: 16px;
        }

        .reelOverlay {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 3px;
          background: #2f7cf6;
          transform: translateX(-50%);
          z-index: 2;
          box-shadow: 0 0 10px rgba(47, 124, 246, 0.5);
        }

        .reelTrack {
          display: flex;
          padding: 0 14px;
          transition: transform 0.1s linear;
          will-change: transform;
        }

        .reelItem {
          flex-shrink: 0;
          border-radius: 16px;
          overflow: hidden;
          background: #0f172a;
          position: relative;
        }

        .reelImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .reelFallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          color: white;
          font-weight: 700;
          font-size: 18px;
        }

        @media (max-width: 640px) {
          .reelContainer {
            margin: 12px;
            border-radius: 14px;
          }
          
          .reelItem {
            border-radius: 12px;
          }
        }
      `}</style>
    </div>
  );
}