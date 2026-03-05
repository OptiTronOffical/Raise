interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="errorContainer">
      <div className="errorIcon">⚠️</div>
      <div className="errorMessage">{message}</div>
      {onRetry && (
        <button className="retryButton" onClick={onRetry}>
          Try Again
        </button>
      )}
      
      <style jsx>{`
        .errorContainer {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 12px;
          padding: 20px;
          margin: 16px;
          text-align: center;
        }
        
        .errorIcon {
          font-size: 32px;
          margin-bottom: 12px;
        }
        
        .errorMessage {
          color: #ef4444;
          margin-bottom: 16px;
          font-size: 14px;
        }
        
        .retryButton {
          padding: 8px 20px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}