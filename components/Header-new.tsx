import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ShoppingCart, Menu as MenuIcon, X as XIcon, MessageCircle } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import styles from '@/styles/Header-new.module.css';

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
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logoLink}>
            <span className={styles.siteTitle}>MariaDoce</span>
          </Link>
        </div>

        <nav className={`${styles.navLinks} ${isMobileMenuOpen ? styles.open : ''}`}>
          <Link
            href="/"
            className={styles.navLink}
            onClick={isMobileMenuOpen ? toggleMobileMenu : undefined}
          >
            Início
          </Link>
          <button
            className={`${styles.whatsappButton} ${styles.mobileOnly}`}
            onClick={() => {
              openWhatsApp();
              if (isMobileMenuOpen) toggleMobileMenu();
            }}
          >
            <MessageCircle size={20} />
            WhatsApp
          </button>
        </nav>

        <div className={styles.headerActions}>
          {!isCheckoutPage && (
            <Link href="/carrinho" className={styles.cartIconContainer} title="Carrinho">
              <ShoppingCart size={24} />
              {isClient && totalItems > 0 && (
                <span className={styles.cartBadge}>{totalItems}</span>
              )}
            </Link>
          )}

          <button
            className={styles.mobileMenuButton}
            onClick={toggleMobileMenu}
            aria-label="Abrir menu"
          >
            {isMobileMenuOpen ? <XIcon size={28} /> : <MenuIcon size={28} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

