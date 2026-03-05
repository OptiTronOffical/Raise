interface SuccessMessageProps {
  message: string;
  onDismiss?: () => void;
  duration?: number; // Auto-dismiss duration in ms
}

export function SuccessMessage({ message, onDismiss, duration = 5000 }: SuccessMessageProps) {
  useEffect(() => {
    if (duration && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  return (
    <div className="successContainer" role="alert">
      <div className="successIcon">✅</div>
      <div className="successMessage">{message}</div>
      {onDismiss && (
        <button className="dismissButton" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
      
      <style jsx>{`
        .successContainer {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 12px;
          padding: 12px 16px;
          margin: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          animation: slideIn 0.3s ease;
        }
        
        .successIcon {
          font-size: 20px;
        }
        
        .successMessage {
          flex: 1;
          color: #166534;
          font-size: 14px;
          font-weight: 500;
        }
        
        .dismissButton {
          background: none;
          border: none;
          color: #166534;
          font-size: 20px;
          cursor: pointer;
          padding: 0 4px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .dismissButton:hover {
          opacity: 1;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}