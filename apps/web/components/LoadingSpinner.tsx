interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}

export function LoadingSpinner({ size = 'medium', text }: LoadingSpinnerProps) {
  const sizes = {
    small: '20px',
    medium: '32px',
    large: '48px'
  };

  return (
    <div className="spinnerContainer">
      <div 
        className="spinner"
        style={{ width: sizes[size], height: sizes[size] }}
      />
      {text && <div className="spinnerText">{text}</div>}
      
      <style jsx>{`
        .spinnerContainer {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
        }
        
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .spinnerText {
          margin-top: 16px;
          color: #64748b;
          font-size: 14px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}