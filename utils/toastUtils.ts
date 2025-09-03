/**
 * Utilitário centralizado para exibir toasts em toda a aplicação
 * Este arquivo fornece uma interface consistente para mostrar notificações
 */

export interface ToastOptions {
  message: string;
  type: 'success' | 'error';
  duration?: number;
}

/**
 * Função para exibir um toast
 * Funciona tanto com o hook useToast quanto com eventos customizados
 */
export const showToast = (options: ToastOptions) => {
  // Criar um evento customizado para comunicar com o ToastProvider
  const event = new CustomEvent('showToast', {
    detail: options
  });
  
  // Disparar o evento no window para que o ToastProvider possa capturar
  if (typeof window !== 'undefined') {
    window.dispatchEvent(event);
  } else {
    // Fallback para ambientes server-side (não fará nada)
    console.warn('showToast chamado em ambiente server-side');
  }
};

/**
 * Função de conveniência para toasts de sucesso
 */
export const showSuccessToast = (message: string, duration?: number) => {
  showToast({ message, type: 'success', duration });
};

/**
 * Função de conveniência para toasts de erro
 */
export const showErrorToast = (message: string, duration?: number) => {
  showToast({ message, type: 'error', duration });
};

/**
 * Hook personalizado para usar toasts de forma mais limpa
 * Retorna funções de conveniência para diferentes tipos de toast
 */
export const useToastHelpers = () => {
  return {
    showToast,
    showSuccessToast,
    showErrorToast
  };
};

