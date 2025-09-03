import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Menu, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import styles from '@/styles/BottomNavigation.module.css';

const BottomNavigation: React.FC = () => {
  const router = useRouter();
  const { cartItems } = useCart();
  
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const navItems = [
    {
      href: '/',
      icon: Home,
      label: 'Home',
      isActive: router.pathname === '/'
    },
    {
      href: '/#categorias',
      icon: Menu,
      label: 'Menu',
      isActive: false
    },
    {
      href: '/carrinho',
      icon: ShoppingCart,
      label: 'Carrinho',
      isActive: router.pathname === '/carrinho',
      badge: totalItems > 0 ? totalItems : undefined
    },
    {
      href: '/perfil',
      icon: User,
      label: 'Perfil',
      isActive: router.pathname === '/perfil'
    }
  ];

  return (
    <nav className={styles.bottomNav}>
      <div className={styles.bottomNavContent}>
        {navItems.map((item) => {
          const IconComponent = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${item.isActive ? styles.active : ''}`}
            >
              <div className={styles.navIconContainer}>
                <IconComponent className={styles.navIcon} size={24} />
                {item.badge && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </div>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;

