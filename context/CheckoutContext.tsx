import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { CartItem, useCart } from './CartContext';

// Interfaces and CHECKOUT_STEPS_PATHS remain the same
interface CustomerAddress {
  fullAddress: string;
  lat: number;
  lng: number;
  cep?: string;
  numero?: string;
  complemento?: string;
  referencia?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface CheckoutData {
  nome: string;
  telefone: string;
  tipoPedido: string; // "retirada" ou "entrega"
  endereco: CustomerAddress | null;
  formaPagamento: string;
  trocoPara: string;
  observacoes: string;
  currentCep?: string;
  deliveryFee?: number;
  isAddressValidForDelivery?: boolean | null;
  addressValidationMessage?: string;
  scheduleSelection?: any;
}

export const CHECKOUT_STEPS_PATHS = {
  CARRINHO: '/carrinho',
  CONTATO: '/checkout/contato',
  TIPO_PEDIDO: '/checkout/tipo-pedido',
  ENDERECO: '/checkout/endereco',
  PAGAMENTO: '/checkout/pagamento',
  REVISAO: '/checkout/revisao',
};

interface CheckoutContextType {
  checkoutData: CheckoutData;
  setCheckoutData: React.Dispatch<React.SetStateAction<CheckoutData>>;
  updateCheckoutField: <K extends keyof CheckoutData>(field: K, value: CheckoutData[K]) => void; // Helper function
  currentStepPath: string;
  navigateToNextStep: (currentPath: string) => void;
  navigateToPrevStep: (currentPath: string) => void;
  resetCheckout: () => void;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

const initialCheckoutData: CheckoutData = {
  nome: '',
  telefone: '',
  tipoPedido: '',
  endereco: null,
  formaPagamento: '',
  trocoPara: '',
  observacoes: '',
  currentCep: '',
  deliveryFee: 0,
  isAddressValidForDelivery: null,
  addressValidationMessage: '',
};

// Helper function to safely parse JSON from localStorage
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue; // Avoid server-side errors
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  } catch (error) {
    console.error(`Failed to parse ${key} from localStorage`, error);
    localStorage.removeItem(key); // Clear corrupted data
    return defaultValue;
  }
};

export const CheckoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state directly by reading from localStorage
  const [checkoutData, setCheckoutData] = useState<CheckoutData>(() => {
    const loadedData = loadFromLocalStorage<CheckoutData>('checkoutData', initialCheckoutData);
    // Integrate userCep loading here if it exists and checkoutData doesn't have it
    const storedCep = typeof window !== 'undefined' ? localStorage.getItem('userCep') : null;
    if (storedCep && !loadedData.currentCep) {
      loadedData.currentCep = storedCep;
    }
    return loadedData;
  });

  const [currentStepPath, setCurrentStepPath] = useState<string>(CHECKOUT_STEPS_PATHS.CARRINHO);
  const router = useRouter();
  const { cartItems } = useCart();

  // Remove the initial useEffect for loading, as it's handled by useState initializer

  // Salvar dados do checkout no localStorage sempre que mudar
  useEffect(() => {
    // Prevent saving initial empty state if it hasn't been modified yet
    // Or simply save every time - depends on desired behavior
    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
  }, [checkoutData]);

  // Atualizar o currentStepPath com base na rota atual do Next.js
  useEffect(() => {
    setCurrentStepPath(router.pathname);
  }, [router.pathname]);

  const stepOrder = [
    CHECKOUT_STEPS_PATHS.CARRINHO,
    CHECKOUT_STEPS_PATHS.CONTATO,
    CHECKOUT_STEPS_PATHS.TIPO_PEDIDO,
    CHECKOUT_STEPS_PATHS.ENDERECO,
    CHECKOUT_STEPS_PATHS.PAGAMENTO,
    CHECKOUT_STEPS_PATHS.REVISAO,
  ];

  const navigateToNextStep = useCallback((currentPath: string) => {
    if (cartItems.length === 0 && currentPath !== CHECKOUT_STEPS_PATHS.CARRINHO) {
        router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
        return;
    }
    
    // Lógica especial para pular o endereço se for retirada
    if (currentPath === CHECKOUT_STEPS_PATHS.TIPO_PEDIDO && checkoutData.tipoPedido === 'retirada') {
      router.push(CHECKOUT_STEPS_PATHS.PAGAMENTO);
      return;
    }
    
    const currentIndex = stepOrder.indexOf(currentPath);
    if (currentIndex < stepOrder.length - 1) {
      router.push(stepOrder[currentIndex + 1]);
    }
  }, [cartItems, router, checkoutData.tipoPedido]); // Added checkoutData.tipoPedido dependency

  const navigateToPrevStep = useCallback((currentPath: string) => {
    // Lógica especial para voltar do pagamento para tipo de pedido se for retirada
    if (currentPath === CHECKOUT_STEPS_PATHS.PAGAMENTO && checkoutData.tipoPedido === 'retirada') {
      router.push(CHECKOUT_STEPS_PATHS.TIPO_PEDIDO);
      return;
    }
    
    const currentIndex = stepOrder.indexOf(currentPath);
    if (currentIndex > 0) {
      router.push(stepOrder[currentIndex - 1]);
    }
  }, [router, checkoutData.tipoPedido]); // Added checkoutData.tipoPedido dependency

  const resetCheckout = useCallback(() => {
    setCheckoutData(initialCheckoutData);
    localStorage.removeItem('checkoutData');
    // Optionally clear userCep too, or keep it as before
    // localStorage.removeItem('userCep');
    router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
  }, [router]); // Added dependency

  // Helper function to update specific fields without replacing the whole object
  const updateCheckoutField = useCallback(<K extends keyof CheckoutData>(field: K, value: CheckoutData[K]) => {
    setCheckoutData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <CheckoutContext.Provider value={{
      checkoutData,
      setCheckoutData, // Keep direct set if needed, but prefer updateCheckoutField
      updateCheckoutField,
      currentStepPath,
      navigateToNextStep,
      navigateToPrevStep,
      resetCheckout
    }}>
      {children}
    </CheckoutContext.Provider>
  );
};

export const useCheckout = (): CheckoutContextType => {
  const context = useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
};

