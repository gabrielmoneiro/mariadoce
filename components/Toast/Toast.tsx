import React, { useEffect, useState, memo } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

// Use memo to prevent unnecessary re-renders if props haven't changed
const Toast: React.FC<ToastProps> = memo(({ message, type, onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Timer to automatically close the toast after the duration
    const timer = setTimeout(() => {
      // Start fade-out animation (optional, requires CSS changes)
      // For simplicity, we'll just call onClose directly
      setIsVisible(false);
      // Give time for potential fade-out animation before removing from DOM via onClose
      const closeTimer = setTimeout(onClose, 300); // Adjust timing based on animation
      return () => clearTimeout(closeTimer);
    }, duration);

    // Cleanup function to clear the timer if the component unmounts or duration/onClose changes
    return () => {
      clearTimeout(timer);
    };
  // onClose should be stable if wrapped in useCallback in the provider
  }, [onClose, duration]);

  const handleManualClose = () => {
    setIsVisible(false);
    // Give time for potential fade-out animation before removing from DOM via onClose
    const closeTimer = setTimeout(onClose, 300); // Adjust timing based on animation
     // No need to clear closeTimer here as the component will unmount
  };

  // Optional: Add a CSS class for fade-out effect when isVisible is false
  const toastClasses = `${styles.toast} ${styles[type]} ${!isVisible ? styles.fadeOut : ''}`;

  // Render null if not visible (or let CSS handle display: none based on fadeOut class)
  // if (!isVisible) { // Let CSS handle hiding during fade-out
  //   return null;
  // }

  const icon = type === 'success' ? '🎉' : '⚠️';

  return (
    <div className={toastClasses}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.message}>{message}</span>
      <button className={styles.closeButton} onClick={handleManualClose}>
        &times;
      </button>
    </div>
  );
});

Toast.displayName = 'Toast'; // Add display name for better debugging

export default Toast;

// Função auxiliar para compatibilidade com código legado
// Esta função permite usar showToast diretamente sem o hook useToast
export const showToast = (options: { message: string; type: 'success' | 'error'; duration?: number }) => {
  // Criar um evento customizado para comunicar com o ToastProvider
  const event = new CustomEvent('showToast', {
    detail: options
  });
  
  // Disparar o evento no window para que o ToastProvider possa capturar
  if (typeof window !== 'undefined') {
    window.dispatchEvent(event);
  }
};

