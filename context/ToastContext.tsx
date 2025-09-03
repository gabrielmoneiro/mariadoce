import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react'; // Import useEffect
import ReactDOM from 'react-dom';
import Toast from '@/components/Toast/Toast';
import styles from '@/components/Toast/Toast.module.css';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type: 'success' | 'error', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'error', duration: number = 5000) => {
    const id = toastIdCounter++;
    // Ensure portalContainer exists before adding toasts (might be needed if addToast is called very early)
    if (portalContainer) {
        setToasts((prevToasts) => [...prevToasts, { id, message, type, duration }]);
    } else {
        // Fallback or queueing mechanism if needed, though useEffect should set it quickly
        console.warn("Toast portal container not ready yet.");
    }
  }, [portalContainer]); // Add portalContainer as dependency

  // Use useEffect to ensure DOM manipulation only happens on the client-side
  useEffect(() => {
    // Check if running on the client
    if (typeof document !== 'undefined') {
      let container = document.getElementById('toast-portal-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-portal-container';
        container.className = styles.toastContainerMain; // Apply necessary styles for positioning
        document.body.appendChild(container);
      }
      setPortalContainer(container);

      // Listener para eventos customizados de toast
      const handleShowToast = (event: CustomEvent) => {
        const { message, type, duration } = event.detail;
        addToast(message, type, duration);
      };

      window.addEventListener('showToast', handleShowToast as EventListener);

      // Cleanup function
      return () => {
        window.removeEventListener('showToast', handleShowToast as EventListener);
      };
    }
  }, [addToast]); // Adicionar addToast como dependência

  const removeToast = useCallback((id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Render toasts via portal only if portalContainer is ready */}
      {portalContainer && ReactDOM.createPortal(
        toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        )),
        portalContainer
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

