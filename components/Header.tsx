import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ShoppingCart, Menu as MenuIcon, X as XIcon, MessageCircle, Home } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import styles from '@/styles/Header.module.css';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { cartItems } = useCart();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  const isCheckoutPage = router.pathname.startsWith('/checkout/');

  useEffect(() => {
    setIsClient(true);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const totalItems = isClient ? cartItems.reduce((sum, item) => sum + item.quantity, 0) : 0;

  const openWhatsApp = () => {
    const phoneNumber = '5511991697219';
    const message = 'Olá! Gostaria de fazer um pedido.';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        {/* Menu hambúrguer à esquerda */}
        <div className={styles.menuSection}>
          <button
            className={styles.menuButton}
            onClick={toggleMobileMenu}
            aria-label="Abrir menu"
          >
            <MenuIcon size={24} />
          </button>
        </div>

        {/* Logo no centro */}
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink}>
            <img 
              src="/maria-doce-logo.png" 
              alt="Maria Doce" 
              className={styles.logo}
            />
          </Link>
        </div>

        {/* Carrinho à direita */}
        <div className={styles.cartSection}>
          {!isCheckoutPage && (
            <Link href="/carrinho" className={styles.cartIconContainer} title="Carrinho">
              <ShoppingCart size={24} />
              {isClient && totalItems > 0 && (
                <span className={styles.cartBadge}>{totalItems}</span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Menu lateral */}
      <div className={`${styles.sideMenu} ${isMobileMenuOpen ? styles.sideMenuOpen : ''}`}>
        <div className={styles.sideMenuHeader}>
          <button
            className={styles.closeMenuButton}
            onClick={toggleMobileMenu}
            aria-label="Fechar menu"
          >
            <XIcon size={24} />
          </button>
        </div>
        
        <nav className={styles.sideMenuNav}>
          <Link
            href="/"
            className={styles.sideMenuLink}
            onClick={toggleMobileMenu}
          >
            <Home size={20} />
            Início
          </Link>
          
          <button
            className={styles.sideMenuWhatsappButton}
            onClick={() => {
              openWhatsApp();
              toggleMobileMenu();
            }}
          >
            <MessageCircle size={20} />
            WhatsApp
          </button>
        </nav>
      </div>

      {/* Overlay para fechar menu */}
      {isMobileMenuOpen && (
        <div 
          className={styles.menuOverlay}
          onClick={toggleMobileMenu}
        />
      )}
    </header>
  );
};

export default Header;

