import type { AppProps } from 'next/app';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CartProvider } from '@/context/CartContext';
import { CheckoutProvider } from '@/context/CheckoutContext';
import { ToastProvider } from '@/context/ToastContext'; // Importar o ToastProvider
import FloatingCartButton from '@/components/FloatingCartButton';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <CartProvider>
      <CheckoutProvider>
        <ToastProvider> {/* Envolver com ToastProvider */}
          <Header />
          <main style={{ minHeight: '80vh', padding: '1rem' }}>
            <Component {...pageProps} />
          </main>
          <FloatingCartButton />
          <Footer />
          {/* O container do portal de toasts será criado pelo ToastProvider no document.body */}
        </ToastProvider>
      </CheckoutProvider>
    </CartProvider>
  );
}

export default MyApp;

