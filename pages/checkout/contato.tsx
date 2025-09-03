import React, { useState, useEffect } from "react";
import { useCheckout, CHECKOUT_STEPS_PATHS } from "@/context/CheckoutContext";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/router";
import useLocalStorage from "@/hooks/useLocalStorage"; // Importar o hook
import checkoutStyles from "@/styles/CheckoutFlow.module.css";
import styles from "@/styles/Carrinho.module.css";

const ContatoPage = () => {
  const { checkoutData, setCheckoutData, navigateToNextStep, navigateToPrevStep } = useCheckout();
  const { cartItems } = useCart();
  const router = useRouter();

  // Usar useLocalStorage para o nome também, para consistência, ou manter como está se não for requisito.
  const [nome, setNome] = useLocalStorage<string>("customerName", checkoutData.nome || "");
  // Usar useLocalStorage para o telefone
  const [telefone, setTelefone] = useLocalStorage<string>("customerPhone", checkoutData.telefone || "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (cartItems.length === 0) {
      router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
    }
    // Sincronizar o estado do hook com o contexto do checkout na montagem, se necessário
    // ou garantir que o contexto seja a fonte da verdade inicial para o hook.
    // A inicialização do useLocalStorage já tenta pegar de checkoutData.telefone
  }, [cartItems, router]);

  // Atualizar o contexto do checkout quando o nome do localStorage mudar
  useEffect(() => {
    setCheckoutData(prev => ({ ...prev, nome }));
  }, [nome, setCheckoutData]);

  // Atualizar o contexto do checkout quando o telefone do localStorage mudar
  useEffect(() => {
    setCheckoutData(prev => ({ ...prev, telefone }));
  }, [telefone, setCheckoutData]);


  const formatPhoneNumber = (value: string): string => {
    if (!value) return value;
    const phoneNumber = value.replace(/\D/g, "");
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 3) return `(${phoneNumber}`;
    if (phoneNumberLength < 8) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7, 11)}`;
  };

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNome(newName); // Atualiza o hook useLocalStorage e o localStorage
    if (fieldErrors.nome) {
      setFieldErrors(prev => ({ ...prev, nome: "" }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhoneNumber = formatPhoneNumber(e.target.value);
    setTelefone(formattedPhoneNumber); // Atualiza o hook useLocalStorage e o localStorage
    if (fieldErrors.telefone) {
      setFieldErrors(prev => ({ ...prev, telefone: "" }));
    }
  };

  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    if (!nome.trim()) {
      errors.nome = "Por favor, preencha o seu nome completo.";
    }
    const phoneDigits = telefone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      errors.telefone = "Por favor, preencha um número de telefone válido (com DDD).";
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
      // Os dados já foram atualizados no CheckoutContext através dos useEffects
      // que escutam as mudanças em `nome` e `telefone` (vindos do useLocalStorage)
      navigateToNextStep(CHECKOUT_STEPS_PATHS.CONTATO);
    }
  };
  
  const handlePrev = () => {
    // Os dados já estão no CheckoutContext e localStorage
    navigateToPrevStep(CHECKOUT_STEPS_PATHS.CONTATO); // Volta para o carrinho
  };

  if (cartItems.length === 0 && router.pathname === CHECKOUT_STEPS_PATHS.CONTATO) { // Adicionar verificação de pathname para evitar loop
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
      <h1 className={styles.pageTitle}>Finalizar Pedido - Contato</h1>
      
      <div className={checkoutStyles.checkoutProgress}>
        <Link href={CHECKOUT_STEPS_PATHS.CONTATO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.active}`}>Contato</a></Link>
        <Link href={CHECKOUT_STEPS_PATHS.TIPO_PEDIDO} legacyBehavior><a className={checkoutStyles.progressStep}>Tipo</a></Link>
        <Link href={CHECKOUT_STEPS_PATHS.PAGAMENTO} legacyBehavior><a className={checkoutStyles.progressStep}>Pagamento</a></Link>
        <Link href={CHECKOUT_STEPS_PATHS.REVISAO} legacyBehavior><a className={checkoutStyles.progressStep}>Revisão</a></Link>
      </div>

      <div className={checkoutStyles.stepContainer}>
        <h3 className={checkoutStyles.stepTitle}>Etapa 1: Suas Informações de Contato</h3>
        <div className={checkoutStyles.formGrid}>
          <div className={checkoutStyles.formGroup}>
            <label htmlFor="nome">Nome Completo:</label>
            <input
              type="text"
              id="nome"
              value={nome} // Valor do hook useLocalStorage
              onChange={handleNomeChange} // Usa a nova função
              required
              placeholder="Seu nome completo"
              className={`${checkoutStyles.inputField} ${fieldErrors.nome ? checkoutStyles.inputError : ""}`}
            />
            {fieldErrors.nome && <p className={checkoutStyles.errorTextHelper}>{fieldErrors.nome}</p>}
          </div>
          <div className={checkoutStyles.formGroup}>
            <label htmlFor="telefone">Telefone (WhatsApp):</label>
            <input
              type="tel"
              id="telefone"
              value={telefone} // Valor do hook useLocalStorage
              onChange={handlePhoneChange} // Usa a nova função
              required
              placeholder="(XX) XXXXX-XXXX"
              className={`${checkoutStyles.inputField} ${fieldErrors.telefone ? checkoutStyles.inputError : ""}`}
              maxLength={15}
            />
            {fieldErrors.telefone && <p className={checkoutStyles.errorTextHelper}>{fieldErrors.telefone}</p>}
          </div>
        </div>
        {pageError && Object.keys(fieldErrors).length > 0 && <p className={checkoutStyles.checkoutError}>{pageError}</p>}
        
        <div className={checkoutStyles.navigationButtons}>
            <button onClick={handlePrev} className={`${checkoutStyles.secondaryButton} ${checkoutStyles.navButton}`}>Voltar ao Carrinho</button>
            <button onClick={handleNext} className={checkoutStyles.actionButton}>Próximo: Tipo de Pedido</button>
        </div>
      </div>
    </div>
  );
};

export default ContatoPage;

