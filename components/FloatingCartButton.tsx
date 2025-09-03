import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCart } from '@/context/CartContext';
import styles from '@/styles/FloatingCartButton.module.css';
import { FaShoppingBag } from 'react-icons/fa';

const FloatingCartButton: React.FC = () => {
  const { cartItems, getCartTotal } = useCart();
  const router = useRouter();

  // Não mostrar o botão na página do carrinho ou em qualquer etapa do checkout
  if (
    router.pathname === '/carrinho' || 
    router.pathname === '/checkout/contato' ||
    router.pathname === '/checkout/endereco' ||
    router.pathname === '/checkout/pagamento' ||
    router.pathname === '/checkout/revisao' ||
    router.pathname.startsWith('/checkout/')
  ) {
    return null;
  }

  // Não mostrar se o carrinho estiver vazio ou indefinido
  if (!cartItems || cartItems.length === 0) {
    return null;
  }

  const totalPrice = getCartTotal();

  return (
    <Link href="/carrinho" passHref legacyBehavior>
      <a className={styles.floatingButton}>
        <FaShoppingBag size={24} />
       
        <span className={styles.totalPrice}>
          R$ {totalPrice.toFixed(2).replace('.', ',')}
        </span>
      </a>
    </Link>
  );
};

export default FloatingCartButton;
