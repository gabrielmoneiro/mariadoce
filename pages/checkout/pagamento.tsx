import React, { useState, useEffect } from "react";
import { useCheckout, CHECKOUT_STEPS_PATHS } from "@/context/CheckoutContext";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/router";
import checkoutStyles from "@/styles/CheckoutFlow.module.css";
import styles from "@/styles/Carrinho.module.css"; // Para o container principal e título

const PAYMENT_METHODS = [
  { id: "dinheiro", label: "💰 Dinheiro" },
  { id: "credito", label: "💳 Cartão de Crédito (na entrega)" },
  { id: "debito", label: "💳 Cartão de Débito (na entrega)" },
  { id: "pix", label: "🧾 Pix" },
];

const PagamentoPage = () => {
  const { checkoutData, setCheckoutData, navigateToNextStep, navigateToPrevStep } = useCheckout();
  const { cartItems, getCartTotal } = useCart(); // getCartTotal para o troco
  const router = useRouter();

  const [formaPagamento, setFormaPagamento] = useState(checkoutData.formaPagamento || "");
  const [trocoPara, setTrocoPara] = useState(checkoutData.trocoPara || "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (cartItems.length === 0) {
      router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
    }
    
    // Redirect to tipo-pedido if no tipo is selected
    if (!checkoutData.tipoPedido) {
      router.push(CHECKOUT_STEPS_PATHS.TIPO_PEDIDO);
    }
  }, [cartItems, router, checkoutData.tipoPedido]);

  const handlePaymentMethodChange = (methodId: string) => {
    setFormaPagamento(methodId);
    if (methodId !== "dinheiro") {
      setTrocoPara(""); // Limpar troco se não for dinheiro
    }
    if (fieldErrors.formaPagamento) {
      setFieldErrors(prev => ({ ...prev, formaPagamento: "" }));
    }
  };

  const handleTrocoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTrocoPara(e.target.value.replace(/[^\d,.]/g, "").replace(".", ","));
    if (fieldErrors.trocoPara) {
      setFieldErrors(prev => ({ ...prev, trocoPara: "" }));
    }
  };

  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formaPagamento) {
      errors.formaPagamento = "Por favor, selecione uma forma de pagamento.";
    }
    if (formaPagamento === "dinheiro" && trocoPara) {
      const trocoValue = parseFloat(trocoPara.replace(",", "."));
      // Calcular total considerando se há taxa de entrega (apenas para entrega)
      const totalComFrete = getCartTotal() + (checkoutData.tipoPedido === 'entrega' ? (checkoutData.deliveryFee || 0) : 0);
      if (isNaN(trocoValue) || trocoValue < totalComFrete) {
        errors.trocoPara = `O valor do troco deve ser um número maior ou igual ao total do pedido (R$ ${totalComFrete.toFixed(2)}).`;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setPageError("Por favor, corrija os campos destacados.");
      return false;
    }
    setPageError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCheckoutData(prev => ({ ...prev, formaPagamento, trocoPara }));
      navigateToNextStep(CHECKOUT_STEPS_PATHS.PAGAMENTO);
    }
  };

  const handlePrev = () => {
    setCheckoutData(prev => ({ ...prev, formaPagamento, trocoPara }));
    navigateToPrevStep(CHECKOUT_STEPS_PATHS.PAGAMENTO);
  };

  if (cartItems.length === 0) {
    return (
        <div className={styles.containerEmpty}>
            <h2>Seu carrinho está vazio.</h2>
            <p>Adicione produtos ao seu carrinho para continuar.</p>
            <Link href="/" legacyBehavior><a className={styles.continueShoppingButton}>Continuar Comprando</a></Link>
        </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Finalizar Pedido - Pagamento</h1>
      <div className={checkoutStyles.checkoutProgress}>
        <Link href={CHECKOUT_STEPS_PATHS.CONTATO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Contato</a></Link>
        <Link href={CHECKOUT_STEPS_PATHS.TIPO_PEDIDO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Tipo</a></Link>
        {checkoutData.tipoPedido === 'entrega' && (
          <Link href={CHECKOUT_STEPS_PATHS.ENDERECO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Endereço</a></Link>
        )}
        <div className={`${checkoutStyles.progressStep} ${checkoutStyles.active}`}>Pagamento</div>
        <div className={checkoutStyles.progressStep}>Revisão</div>
      </div>

      <div className={checkoutStyles.stepContainer}>
        <h3 className={checkoutStyles.stepTitle}>
          {checkoutData.tipoPedido === 'retirada' ? 'Etapa 3: Forma de Pagamento' : 'Etapa 4: Forma de Pagamento'}
        </h3>
        <div className={checkoutStyles.formGroup}>
          <label>Selecione a forma de pagamento:</label>
          <div className={checkoutStyles.paymentOptionsContainer}>
            {PAYMENT_METHODS.map(method => (
              <button
                key={method.id}
                className={`${checkoutStyles.paymentOptionButton} ${formaPagamento === method.id ? checkoutStyles.selected : ""}`}
                onClick={() => handlePaymentMethodChange(method.id)}
              >
                {method.label.split(" ")[0]} 
                <span>{method.label.substring(method.label.indexOf(" ") + 1)}</span>
              </button>
            ))}
          </div>
          {fieldErrors.formaPagamento && <p className={checkoutStyles.errorTextHelper}>{fieldErrors.formaPagamento}</p>}
        </div>

        {formaPagamento === "dinheiro" && (
          <div className={checkoutStyles.formGroup}>
            <label htmlFor="trocoPara">Troco para (R$):</label>
            <input
              type="text"
              id="trocoPara"
              value={trocoPara}
              onChange={handleTrocoChange}
              placeholder="Ex: 50,00 (opcional)"
              className={`${checkoutStyles.inputField} ${fieldErrors.trocoPara ? checkoutStyles.inputError : ""}`}
            />
            {fieldErrors.trocoPara && <p className={checkoutStyles.errorTextHelper}>{fieldErrors.trocoPara}</p>}
          </div>
        )}
        {pageError && <p className={checkoutStyles.checkoutError}>{pageError}</p>}
        
        <div className={checkoutStyles.navigationButtons}>
          <button onClick={handlePrev} className={`${checkoutStyles.secondaryButton} ${checkoutStyles.navButton}`}>
            {checkoutData.tipoPedido === 'retirada' ? 'Voltar: Tipo de Pedido' : 'Voltar: Endereço'}
          </button>
          <button onClick={handleNext} className={checkoutStyles.actionButton}>Próximo: Revisão</button>
        </div>
      </div>
    </div>
  );
};

export default PagamentoPage;

