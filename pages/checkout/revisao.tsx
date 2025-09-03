import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useCheckout, CHECKOUT_STEPS_PATHS } from "@/context/CheckoutContext";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/router";
import { formatPedidoWhatsApp } from "@/lib/formatPedidoAgendado";
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, getDoc } from "firebase/firestore";
import checkoutStyles from "@/styles/CheckoutFlow.module.css";
import styles from "@/styles/Carrinho.module.css"; // Para o container principal e título
import { showErrorToast, showSuccessToast } from "@/utils/toastUtils"; // Importar utilitários de toast
import ScheduleDeliverySection from "@/components/checkout/ScheduleDeliverySection";

const PAYMENT_METHODS = [
  { id: "dinheiro", label: "💰 Dinheiro" },
  { id: "credito", label: "💳 Cartão de Crédito (na entrega)" },
  { id: "debito", label: "💳 Cartão de Débito (na entrega)" },
  { id: "pix", label: "🧾 Pix" },
];

const RevisaoPage = () => {
  const { checkoutData, setCheckoutData, navigateToPrevStep, resetCheckout } = useCheckout();
  const { cartItems, getCartTotal, clearCart, updateQuantity, removeFromCart } = useCart();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (cartItems.length === 0 && !isSubmitting) { // Adicionado !isSubmitting para evitar redirect durante o submit
      router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
    }
    
    // Redirect to tipo-pedido if no tipo is selected
    if (!checkoutData.tipoPedido) {
      router.push(CHECKOUT_STEPS_PATHS.TIPO_PEDIDO);
    }
    
    if (!checkoutData.nome || !checkoutData.formaPagamento) {
        // router.push(CHECKOUT_STEPS_PATHS.CONTATO);
    }
    
    // Verificar se endereço é necessário para entrega
    if (checkoutData.tipoPedido === 'entrega' && !checkoutData.endereco) {
        // router.push(CHECKOUT_STEPS_PATHS.ENDERECO);
    }
  }, [cartItems, router, checkoutData, isSubmitting]);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
  };

  const handleFinalCheckout = async () => {
    if (cartItems.length === 0) {
      showErrorToast("Seu carrinho está vazio.");
      return;
    }
    
    // Verificar se o agendamento é obrigatório e se foi selecionado
    const isSchedulingRequired = () => {
      // Obter o componente TimeWindowSelector para verificar
      const timeWindowSelector = document.getElementById('scheduleDeliverySection');
      if (timeWindowSelector && timeWindowSelector.getAttribute('data-required') === 'true') {
        return true;
      }
      return false;
    };
    
    // Se o agendamento for obrigatório, verificar se foi selecionado
    if (isSchedulingRequired() && (!checkoutData.scheduleSelection || !checkoutData.scheduleSelection.date || !checkoutData.scheduleSelection.timeWindow)) {
      showErrorToast("Por favor, selecione uma data e horário para agendamento da entrega.");
      // Rolar até a seção de agendamento
      const scheduleSection = document.getElementById('scheduleDeliverySection');
      if (scheduleSection) {
        scheduleSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setIsSubmitting(true);
    setPageError(null);

    try {
      const enderecoFormatado = checkoutData.tipoPedido === 'entrega' && checkoutData.endereco
        ? `${checkoutData.endereco.fullAddress}${checkoutData.endereco.numero ? ", Nº " + checkoutData.endereco.numero : ""}${checkoutData.endereco.complemento ? ", Compl: " + checkoutData.endereco.complemento : ""}${checkoutData.endereco.bairro ? ", Bairro: " + checkoutData.endereco.bairro : ""}${checkoutData.endereco.cidade ? ", Cidade: " + checkoutData.endereco.cidade : ""}${checkoutData.endereco.estado ? " - " + checkoutData.endereco.estado : ""}${checkoutData.endereco.cep ? ", CEP: " + checkoutData.endereco.cep : ""}${checkoutData.endereco.referencia ? ". Ref: " + checkoutData.endereco.referencia : ""}`
        : "Retirada na loja";

      const totalPedidoComFrete = getCartTotal() + (checkoutData.tipoPedido === 'entrega' ? (checkoutData.deliveryFee || 0) : 0);

      const mensagem = formatPedidoWhatsApp(
        cartItems,
        checkoutData.nome,
        enderecoFormatado,
        totalPedidoComFrete,
        checkoutData.telefone,
        PAYMENT_METHODS.find((pm) => pm.id === checkoutData.formaPagamento)?.label || checkoutData.formaPagamento,
        checkoutData.trocoPara,
        checkoutData.observacoes,
        checkoutData.tipoPedido === 'entrega' ? (checkoutData.deliveryFee || 0) : 0,
        checkoutData.scheduleSelection,
        checkoutData.tipoPedido
      );
      const numeroWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5511991697219"; // Fallback para o número fornecido

      if (!numeroWhatsApp) {
        throw new Error("Número de WhatsApp não configurado.");
      }
      const whatsappUrl = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem )}`;

      const updatePromises = cartItems.map(async (item) => {
        const productRef = doc(db, "products", item.id);
        try {
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            return updateDoc(productRef, { pedidoCount: increment(item.quantity) });
          } else {
            console.warn(`Produto com ID ${item.id} não encontrado no Firebase. Não será atualizado.`);
            return Promise.resolve();
          }
        } catch (error) {
          console.error(`Erro ao verificar ou atualizar produto ${item.id}:`, error);
          return Promise.resolve();
        }
      });

      await Promise.all(updatePromises);

      window.open(whatsappUrl, "_blank");
      clearCart();
      resetCheckout();
      showSuccessToast("Pedido enviado via WhatsApp! Obrigado!");
      router.push("/");
    } catch (error: any) {
      console.error("Erro ao finalizar pedido:", error);
      showErrorToast(error.message || "Ocorreu um erro ao finalizar seu pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrev = () => {
    navigateToPrevStep(CHECKOUT_STEPS_PATHS.REVISAO);
  };
  
  const renderCartReviewItems = () => (
    <div className={checkoutStyles.reviewCartItemsContainer}>
      {cartItems.map(item => (
        <div key={item.id + (item.tamanhoSelecionado || 	null)} className={checkoutStyles.reviewCartItem}>
          {item.imageUrl && (
            <Image src={item.imageUrl} alt={item.name} width={50} height={50} className={checkoutStyles.reviewItemImage} />
          )}
          <div className={checkoutStyles.reviewItemDetails}>
            <span className={checkoutStyles.reviewItemName}>{item.name} (x{item.quantity})</span>
            {item.tamanhoSelecionado && <span className={checkoutStyles.reviewItemVariant}>Tamanho: {item.tamanhoSelecionado}</span>}
            {item.adicionaisSelecionados && <span className={checkoutStyles.reviewItemVariant}>Adicionais: {item.adicionaisSelecionados}</span>}
          </div>
          <span className={checkoutStyles.reviewItemPrice}>R$ {(item.price * item.quantity).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );

  if (cartItems.length === 0 && !isSubmitting) {
    return (
        <div className={styles.containerEmpty}>
            <h2>Seu carrinho está vazio.</h2>
            <p>Adicione produtos ao seu carrinho para continuar.</p>
            <Link href="/" legacyBehavior><a className={styles.continueShoppingButton}>Continuar Comprando</a></Link>
        </div>
    );
  }

  const totalPedidoComFrete = getCartTotal() + (checkoutData.deliveryFee || 0);
  const subtotalPedido = getCartTotal();

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Finalizar Pedido - Revisão</h1>
      <div className={checkoutStyles.checkoutProgress}>
        <Link href={CHECKOUT_STEPS_PATHS.CONTATO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Contato</a></Link>
        <Link href={CHECKOUT_STEPS_PATHS.TIPO_PEDIDO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Tipo</a></Link>
        {checkoutData.tipoPedido === 'entrega' && (
          <Link href={CHECKOUT_STEPS_PATHS.ENDERECO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Endereço</a></Link>
        )}
        <Link href={CHECKOUT_STEPS_PATHS.PAGAMENTO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Pagamento</a></Link>
        <div className={`${checkoutStyles.progressStep} ${checkoutStyles.active}`}>Revisão</div>
      </div>

      <div className={checkoutStyles.stepContainer}>
        <h3 className={checkoutStyles.stepTitle}>
          {checkoutData.tipoPedido === 'retirada' ? 'Etapa 4: Revise Seu Pedido' : 'Etapa 5: Revise Seu Pedido'}
        </h3>
        
        <div className={checkoutStyles.reviewSection}>
          <h4>Itens do Pedido:</h4>
          {renderCartReviewItems()}
          <div style={{marginTop: '1rem', textAlign: 'right'}}>
            <p><strong>Subtotal dos Produtos:</strong> R$ {subtotalPedido.toFixed(2)}</p>
          </div>
        </div>

        <div className={checkoutStyles.reviewSection}>
          <h4>Informações de Contato:</h4>
          <p><strong>Nome:</strong> {checkoutData.nome}</p>
          <p><strong>Telefone:</strong> {checkoutData.telefone}</p>
        </div>

        <div className={checkoutStyles.reviewSection}>
          <h4>{checkoutData.tipoPedido === 'retirada' ? 'Tipo de Pedido:' : 'Endereço de Entrega:'}</h4>
          {checkoutData.tipoPedido === 'retirada' ? (
            <p>🏪 <strong>Retirada na Loja</strong></p>
          ) : (
            <>
              {checkoutData.endereco && (
                <p>
                  {checkoutData.endereco.fullAddress}
                  {checkoutData.endereco.numero ? `, Nº ${checkoutData.endereco.numero}` : ""}
                  {checkoutData.endereco.complemento ? `, ${checkoutData.endereco.complemento}` : ""}
                  {checkoutData.endereco.bairro ? `, ${checkoutData.endereco.bairro}` : ""}
                  {checkoutData.endereco.referencia ? <>  
<em>Ref: {checkoutData.endereco.referencia}</em></> : ""}
                </p>
              )}
              {checkoutData.deliveryFee !== undefined && (
                <div className={checkoutStyles.deliveryFeeHighlight}>
                  <strong>Taxa de Entrega:</strong> R$ {checkoutData.deliveryFee.toFixed(2)}
                </div>
              )}
            </>
          )}
        </div>

        <div className={checkoutStyles.reviewSection}>
          <h4>Forma de Pagamento:</h4>
          <p>{PAYMENT_METHODS.find((pm) => pm.id === checkoutData.formaPagamento)?.label || "Não selecionada"}</p>
          {checkoutData.formaPagamento === "dinheiro" && checkoutData.trocoPara && (
            <p><strong>Troco para:</strong> R$ {checkoutData.trocoPara}</p>
          )}
        </div>
        
        <div className={checkoutStyles.reviewSection}>
          <h4>Agendamento de {checkoutData.tipoPedido === 'retirada' ? 'Retirada' : 'Entrega'}:</h4>
          <ScheduleDeliverySection />
        </div>

        <div className={checkoutStyles.formGroup}>
            <label htmlFor="observacoes">Observações Adicionais:</label>
            <textarea 
                id="observacoes" 
                value={checkoutData.observacoes} 
                onChange={(e) => setCheckoutData(prev => ({...prev, observacoes: e.target.value}))} 
                rows={3}
                className={checkoutStyles.textareaField}
                placeholder={`Alguma observação sobre o pedido ou ${checkoutData.tipoPedido === 'retirada' ? 'retirada' : 'entrega'}?`}
            />
        </div>

        <div className={checkoutStyles.reviewSection}>
          <h4>Resumo do Pedido:</h4>
          <div style={{marginBottom: '0.5rem'}}>
            <p><strong>Subtotal dos Produtos:</strong> R$ {subtotalPedido.toFixed(2)}</p>
            {checkoutData.tipoPedido === 'entrega' && (
              <p><strong>Taxa de Entrega:</strong> R$ {(checkoutData.deliveryFee || 0).toFixed(2)}</p>
            )}
          </div>
          <p className={checkoutStyles.finalTotal}>Total a Pagar: R$ {totalPedidoComFrete.toFixed(2)}</p>
        </div>

        {pageError && <p className={checkoutStyles.checkoutError}>{pageError}</p>} 
        
        {/* Botões de navegação para desktop - sempre visíveis */}
        <div className={checkoutStyles.navigationButtons}>
          <button onClick={handlePrev} className={`${checkoutStyles.secondaryButton} ${checkoutStyles.navButton}`}>Voltar: Pagamento</button>
          <button onClick={handleFinalCheckout} disabled={isSubmitting} className={`${checkoutStyles.actionButton} ${isSubmitting ? checkoutStyles.disabledButton : ""}`}>
            {isSubmitting ? "Enviando Pedido..." : 
              <>
                <img src="/assets/icons8-whatsapp-50.svg" alt="WhatsApp Icon" style={{ width: "24px", height: "24px", marginRight: "8px", verticalAlign: "middle" }} />
                Enviar Pedido
              </>
            }
          </button>
        </div>
      </div>

      {/* Botão fixo no rodapé para mobile */}
      {isMobile && (
        <div className={checkoutStyles.fixedFooterButtonContainer}>
          <button 
            onClick={handleFinalCheckout} 
            disabled={isSubmitting} 
            className={checkoutStyles.fixedFooterButton}
          >
            {isSubmitting ? "Enviando..." : 
              <>
                <img src="/assets/icons8-whatsapp-50.svg" alt="WhatsApp Icon" style={{ width: "24px", height: "24px", marginRight: "8px", verticalAlign: "middle" }} />
                Enviar Pedido
              </>
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default RevisaoPage;
