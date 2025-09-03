import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the structure of a cart item
export interface CartItem {
  id: string; // Product ID
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  tamanhoSelecionado?: string; // Adicionado para o tamanho do produto
  adicionaisSelecionados?: string; // Adicionado para os adicionais (simplificado como string)
}

// Define the context type
interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'> & { tamanhoSelecionado?: string; adicionaisSelecionados?: string; }) => void; // Ajustado para aceitar os novos campos
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

// Create the context with a default value (can be undefined or null initially)
const CartContext = createContext<CartContextType | undefined>(undefined);

// Create a provider component
interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on initial render
  useEffect(() => {
    const storedCart = localStorage.getItem('shoppingCart');
    if (storedCart) {
      try {
        setCartItems(JSON.parse(storedCart));
      } catch (error) {
        console.error("Failed to parse cart from localStorage", error);
        localStorage.removeItem('shoppingCart'); // Clear invalid data
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (itemToAdd: Omit<CartItem, 'quantity'> & { tamanhoSelecionado?: string; adicionaisSelecionados?: string; }) => {
    setCartItems(prevItems => {
      // Check if item with the same ID, tamanho, and adicionais already exists
      // For simplicity here, we'll use ID as the primary check as before, but a more robust check would compare all relevant attributes.
      const existingItem = prevItems.find(item => item.id === itemToAdd.id && item.tamanhoSelecionado === itemToAdd.tamanhoSelecionado /* && compare adicionais */);
      if (existingItem) {
        // Increase quantity if item already exists
        return prevItems.map(item =>
          item.id === itemToAdd.id && item.tamanhoSelecionado === itemToAdd.tamanhoSelecionado
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new item with quantity 1
        return [...prevItems, { ...itemToAdd, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    // Se os itens podem ter o mesmo ID mas tamanhos/adicionais diferentes, a remoção precisaria de um identificador único por linha do carrinho.
    // Por agora, vamos manter a remoção pelo ID do produto, o que removeria todas as variantes desse produto.
    // Para uma granularidade maior, cada linha do carrinho precisaria de um UUID único.
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    // Similar à remoção, se houver itens com mesmo ID mas variantes diferentes, isso atualizaria o primeiro encontrado ou precisaria de um ID de linha.
    // Assumindo que o ID é único para a variante no carrinho por enquanto.
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item
      ).filter(item => item.quantity > 0) // Remove item if quantity is 0
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

// Create a custom hook to use the cart context
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

