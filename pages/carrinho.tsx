import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { useCheckout, CHECKOUT_STEPS_PATHS } from "@/context/CheckoutContext";
import styles from "@/styles/Carrinho.module.css";
import Link from "next/link";
import { useRouter } from "next/router";
import BottomNavigationNew from "@/components/BottomNavigation-new";

const CarrinhoPage = () => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length > 0) {
      router.push(CHECKOUT_STEPS_PATHS.CONTATO);
    }
  };

  const renderCartItemsList = () => (
    <section className={styles.cartItemsSection}>
      <h2 className={styles.sectionTitle}>Seu Pedido</h2>
      {cartItems.length === 0 ? (
        <div className={styles.containerEmpty}>
          <h2>Seu carrinho está vazio.</h2>
          <p>Adicione produtos ao seu carrinho para continuar.</p>
          <Link href="/" legacyBehavior>
            <a className={styles.continueShoppingButton}>Continuar Comprando</a>
          </Link>
        </div>
      ) : (
        <>
          <table className={styles.cartTable}>
            <thead>
              <tr>
                <th className={styles.tableHeaderImage}>Imagem</th>
                <th className={styles.tableHeaderName}>Produto</th>
                <th className={styles.tableHeaderSize}>Tamanho</th>
                <th className={styles.tableHeaderAddons}>Adicionais</th>
                <th className={styles.tableHeaderQuantity}>Qtd.</th>
                <th className={styles.tableHeaderSubtotal}>Subtotal</th>
                <th className={styles.tableHeaderActions}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.id + (item.tamanhoSelecionado || "")} className={styles.cartItemRow}>
                  <td className={styles.cartItemImageCell} data-label="Imagem">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} width={60} height={60} className={styles.cartItemImage} />
                    ) : (
                      <div className={styles.imagePlaceholder}>Sem Imagem</div>
                    )}
                  </td>
                  <td className={styles.cartItemName} data-label="Produto">{item.name}</td>
                  <td className={styles.cartItemSize} data-label="Tamanho">{item.tamanhoSelecionado || "Único"}</td>
                  <td className={styles.cartItemAddons} data-label="Adicionais">{item.adicionaisSelecionados || "-"}</td>
                  <td className={styles.cartItemQuantity} data-label="Qtd.">
                    <div className={styles.quantityControl}>
                      <button 
                        onClick={() => handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                        className={styles.quantityButton}
                        aria-label="Diminuir quantidade"
                      >
                        <img src="/assets/minus-icon.png" alt="Diminuir" width="16" height="16" />
                      </button>
                      <span className={styles.quantityDisplay}>{item.quantity}</span>
                      <button 
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className={styles.quantityButton}
                        aria-label="Aumentar quantidade"
                      >
                        <img src="/assets/plus-icon.png" alt="Aumentar" width="16" height="16" />
                      </button>
                    </div>
                  </td>
                  <td className={styles.cartItemSubtotal} data-label="Subtotal">R$ {(item.price * item.quantity).toFixed(2)}</td>
                  <td className={styles.cartItemActions} data-label="Ações">
                    <button onClick={() => removeFromCart(item.id)} className={styles.removeButton} aria-label={`Remover ${item.name} do carrinho`}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.cartTotalRow}>
                <td colSpan={5} className={styles.cartTotalLabel} data-label="">Total do Pedido:</td>
                <td className={styles.cartTotalPrice} data-label="Total">R$ {getCartTotal().toFixed(2)}</td>
                <td data-label=""></td>
              </tr>
            </tfoot>
          </table>
          <div className={styles.cartActionsContainer}>
            <button onClick={clearCart} className={styles.clearCartButton}>Limpar Carrinho</button>
            <Link href="/" legacyBehavior>
              <a className={styles.continueShoppingButton}>Continuar Comprando</a>
            </Link>
          </div>
          {/* Botão para iniciar o checkout - Visível em todos os dispositivos */}
          <button onClick={handleProceedToCheckout} className={styles.proceedToCheckoutButton}>
            Finalizar Pedido
          </button>
        </>
      )}
    </section>
  );

  return (
    <div className={styles.carrinhoContainer}>
      <h1 className={styles.pageTitle}>Sacola de Compras</h1>
      {renderCartItemsList()}
      {isMobile && cartItems.length > 0 && (
        <div className={styles.fixedCartFooter}>
          <button onClick={handleProceedToCheckout} className={styles.fixedCartFooterButton} disabled={cartItems.length === 0}>
            Finalizar Pedido (R$ {getCartTotal().toFixed(2)})
          </button>
        </div>
      )}
      <BottomNavigationNew />
    </div>
  );
};

export default CarrinhoPage;
