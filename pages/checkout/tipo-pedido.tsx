import React, { useState, useEffect } from "react";
import { useCheckout, CHECKOUT_STEPS_PATHS } from "@/context/CheckoutContext";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/router";
import checkoutStyles from "@/styles/CheckoutFlow.module.css";
import tipoPedidoStyles from "@/styles/TipoPedido.module.css";
import styles from "@/styles/Carrinho.module.css";
import { useToast } from "@/context/ToastContext";

const TipoPedidoPage = () => {
  const { checkoutData, updateCheckoutField, navigateToNextStep, navigateToPrevStep } = useCheckout();
  const { cartItems } = useCart();
  const { addToast } = useToast();
  const router = useRouter();

  const [tipoPedido, setTipoPedido] = useState(checkoutData.tipoPedido || "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (cartItems.length === 0) {
      router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
    }
  }, [cartItems, router]);

  const handleTipoPedidoChange = (tipo: string) => {
    setTipoPedido(tipo);
    if (fieldErrors.tipoPedido) {
      setFieldErrors(prev => ({ ...prev, tipoPedido: "" }));
    }
  };

  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    if (!tipoPedido) {
      errors.tipoPedido = "Por favor, selecione o tipo de pedido.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setPageError("Por favor, selecione uma opção.");
      addToast("Por favor, selecione o tipo de pedido.", "error");
      return false;
    }
    setPageError(null);
    return true;
  };

 const handleNext = () => {
  if (validateStep()) {
    updateCheckoutField("tipoPedido", tipoPedido);
    
    // Se for retirada, pular a página de endereço e ir direto para pagamento
    if (tipoPedido === "retirada") {
      // Limpar dados de endereço e frete se existirem
      updateCheckoutField("endereco", null);
      updateCheckoutField("deliveryFee", 0);
      updateCheckoutField("isAddressValidForDelivery", null);
      updateCheckoutField("addressValidationMessage", "");
      router.push(CHECKOUT_STEPS_PATHS.PAGAMENTO);
    } else {
      // Se for entrega, ir para a página de endereço
      // O erro está aqui. Em vez de passar a página de destino, passamos a página atual para que o contexto determine a próxima.
      navigateToNextStep(CHECKOUT_STEPS_PATHS.TIPO_PEDIDO);
    }
    }
  };

  const handlePrev = () => {
    updateCheckoutField("tipoPedido", tipoPedido);
    navigateToPrevStep(CHECKOUT_STEPS_PATHS.ENDERECO);
  };

  if (cartItems.length === 0) {
    return (
      <div className={styles.containerEmpty}>
        <h2>Seu carrinho está vazio.</h2>
        <p>Adicione produtos ao seu carrinho para continuar.</p>
        <Link href="/" legacyBehavior>
          <a className={styles.continueShoppingButton}>Continuar Comprando</a>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Finalizar Pedido - Tipo de Pedido</h1>
      <div className={checkoutStyles.checkoutProgress}>
        <Link href={CHECKOUT_STEPS_PATHS.CONTATO} legacyBehavior>
          <a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Contato</a>
        </Link>
        <div className={`${checkoutStyles.progressStep} ${checkoutStyles.active}`}>Tipo</div>
        <div className={checkoutStyles.progressStep}>Pagamento</div>
        <div className={checkoutStyles.progressStep}>Revisão</div>
      </div>

      <div className={checkoutStyles.stepContainer}>
        <h3 className={checkoutStyles.stepTitle}>Etapa 2: Tipo de Pedido</h3>
        <p className={tipoPedidoStyles.stepDescription}>
          Escolha como você gostaria de receber seu pedido:
        </p>
        
        {pageError && <p className={checkoutStyles.checkoutError}>{pageError}</p>}
        
        <div className={checkoutStyles.formGroup}>
          <div className={tipoPedidoStyles.tipoPedidoContainer}>
            <button
              className={`${tipoPedidoStyles.tipoPedidoButton} ${tipoPedido === "retirada" ? tipoPedidoStyles.selected : ""}`}
              onClick={() => handleTipoPedidoChange("retirada")}
            >
              <div className={tipoPedidoStyles.tipoPedidoIcon}>🏪</div>
              <div className={tipoPedidoStyles.tipoPedidoContent}>
                <h4>Retirada na Loja</h4>
                <p>Retire seu pedido diretamente em nossa loja</p>
                <small>Sem taxa de entrega</small>
              </div>
            </button>

            <button
              className={`${tipoPedidoStyles.tipoPedidoButton} ${tipoPedido === "entrega" ? tipoPedidoStyles.selected : ""}`}
              onClick={() => handleTipoPedidoChange("entrega")}
            >
              <div className={tipoPedidoStyles.tipoPedidoIcon}>🚚</div>
              <div className={tipoPedidoStyles.tipoPedidoContent}>
                <h4>Entrega em Casa</h4>
                <p>Receba seu pedido no conforto da sua casa</p>
                <small>Taxa de entrega pode ser aplicada</small>
              </div>
            </button>
          </div>
          {fieldErrors.tipoPedido && <p className={checkoutStyles.errorTextHelper}>{fieldErrors.tipoPedido}</p>}
        </div>

        <div className={checkoutStyles.navigationButtons}>
          <button
            onClick={handlePrev}
            className={`${checkoutStyles.secondaryButton} ${checkoutStyles.navButton}`}
          >
            Voltar: Contato
          </button>
          <button
            onClick={handleNext}
            className={checkoutStyles.actionButton}
            disabled={!tipoPedido}
          >
            {tipoPedido === "retirada" ? "Próximo: Pagamento" : "Próximo: Endereço"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TipoPedidoPage;

