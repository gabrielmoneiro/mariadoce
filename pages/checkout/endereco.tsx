import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"; // Added useCallback, useMemo
import { useCheckout, CHECKOUT_STEPS_PATHS } from "@/context/CheckoutContext";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/router";
import AddressCepFlow from "@/components/AddressCepFlow";
import { getRouteDistance } from "@/lib/mapboxService";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import checkoutStyles from "@/styles/CheckoutFlow.module.css";
import styles from "@/styles/Carrinho.module.css";
import { useToast } from "@/context/ToastContext"; // Import useToast hook

// Interfaces remain the same
interface CustomerAddress {
  fullAddress: string;
  lat: number;
  lng: number;
  cep?: string;
  numero?: string;
  complemento?: string;
  referencia?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface DeliveryConfig {
  radius: number;
  storeLat: number | null;
  storeLng: number | null;
  storeFullAddress?: string;
  deliveryFeePerKm?: number;
  minDeliveryDistanceForFee?: number;
}

const EnderecoPage = () => {
  const {
    checkoutData,
    setCheckoutData, // Keep for direct updates if needed
    updateCheckoutField, // Use helper for single field updates
    navigateToNextStep,
    navigateToPrevStep
  } = useCheckout();
  const { cartItems } = useCart();
  const { addToast } = useToast(); // Use the hook
  const router = useRouter();

  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);
  // Local state derived from context for easier management within the component
  const [isAddressValidForDelivery, setIsAddressValidForDelivery] = useState<boolean | null>(checkoutData.isAddressValidForDelivery ?? null);
  const [addressValidationMessage, setAddressValidationMessage] = useState<string>(checkoutData.addressValidationMessage || "");
  const [deliveryFee, setDeliveryFee] = useState<number>(checkoutData.deliveryFee || 0);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [lastCepForFreight, setLastCepForFreight] = useState<string | null>(null); // Keep track of last CEP used for calculation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);

  const isNextDisabled = useMemo(() => {
      return isCalculatingRoute || !isAddressValidForDelivery || !checkoutData.endereco?.numero?.trim();
  }, [isCalculatingRoute, isAddressValidForDelivery, checkoutData.endereco?.numero]);

  const numeroInputRef = useRef<HTMLInputElement>(null);
  const MAPBOX_API_KEY = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

  // Redirect if cart is empty
  useEffect(() => {
    if (cartItems.length === 0) {
      router.push(CHECKOUT_STEPS_PATHS.CARRINHO);
    }
    
    // Redirect to tipo-pedido if no tipo is selected
    if (!checkoutData.tipoPedido) {
      router.push(CHECKOUT_STEPS_PATHS.TIPO_PEDIDO);
    }
    
    // Redirect to pagamento if tipo is retirada (skip endereco)
    if (checkoutData.tipoPedido === 'retirada') {
      router.push(CHECKOUT_STEPS_PATHS.PAGAMENTO);
    }
  }, [cartItems, router, checkoutData.tipoPedido]);

  // Fetch delivery config on mount
  useEffect(() => {
    const fetchDeliveryConfig = async () => {
      try {
        const configRef = doc(db, "config", "deliveryConfig");
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const config = docSnap.data() as DeliveryConfig;
          setDeliveryConfig({
            ...config,
            // Ensure defaults if fields are missing
            radius: config.radius ?? 10, // Default 10km radius
            storeLat: config.storeLat ?? null,
            storeLng: config.storeLng ?? null,
            minDeliveryDistanceForFee: config.minDeliveryDistanceForFee !== undefined ? config.minDeliveryDistanceForFee * 1000 : 3000, // Default 3km in meters
            deliveryFeePerKm: config.deliveryFeePerKm ?? 0, // Default 0 fee
          });
        } else {
          setPageError("Configuração de entrega não encontrada. Contacte o suporte.");
          addToast("Erro: Configuração de entrega não encontrada.", "error");
        }
      } catch (error) {
        console.error("Erro ao carregar configuração de entrega:", error);
        setPageError("Erro ao carregar dados de entrega. Tente mais tarde.");
        addToast("Erro ao carregar dados de entrega.", "error");
      }
    };
    fetchDeliveryConfig();
  }, [addToast]); // Added addToast dependency

  // Update local state when context changes (e.g., navigating back)
  useEffect(() => {
    setIsAddressValidForDelivery(checkoutData.isAddressValidForDelivery ?? null);
    setAddressValidationMessage(checkoutData.addressValidationMessage || "");
    setDeliveryFee(checkoutData.deliveryFee || 0);
  }, [checkoutData.isAddressValidForDelivery, checkoutData.addressValidationMessage, checkoutData.deliveryFee]);

  // Callback for CEP changes from AddressCepFlow
  const handleCepChangeCallback = useCallback((newCep: string) => {
    updateCheckoutField("currentCep", newCep);
    localStorage.setItem("userCep", newCep); // Salvar CEP no localStorage

    // If CEP changed significantly, reset validation and fee
    if (lastCepForFreight && newCep.replace(/\D/g, "") !== lastCepForFreight.replace(/\D/g, "")) {
      const message = "CEP alterado. Confirme o endereço para recalcular o frete.";
      setDeliveryFee(0);
      setIsAddressValidForDelivery(null);
      setAddressValidationMessage(message);
      setLastCepForFreight(null);
      // Update context
      updateCheckoutField("deliveryFee", 0);
      updateCheckoutField("isAddressValidForDelivery", null);
      updateCheckoutField("addressValidationMessage", message);
    }
  }, [updateCheckoutField, lastCepForFreight]);

  // Function to calculate fee and validate address (memoized)
  const calculateDeliveryFeeAndValidateAddress = useCallback(async (address: CustomerAddress | null) => {
    if (!address || address.lat === undefined || address.lng === undefined) {
      const message = "Endereço ou coordenadas inválidos.";
      setAddressValidationMessage(message);
      setIsAddressValidForDelivery(false);
      setDeliveryFee(0);
      updateCheckoutField("deliveryFee", 0);
      updateCheckoutField("isAddressValidForDelivery", false);
      updateCheckoutField("addressValidationMessage", message);
      return false; // Indicate failure
    }
    if (!deliveryConfig || deliveryConfig.storeLat === null || deliveryConfig.storeLng === null) {
      const message = "Configuração de entrega da loja incompleta.";
      setAddressValidationMessage(message);
      setIsAddressValidForDelivery(false);
      setDeliveryFee(0);
      updateCheckoutField("deliveryFee", 0);
      updateCheckoutField("isAddressValidForDelivery", false);
      updateCheckoutField("addressValidationMessage", message);
      addToast("Erro na configuração de entrega da loja.", "error");
      return false; // Indicate failure
    }

    setIsCalculatingRoute(true);
    const calculatingMessage = "Calculando rota e taxa de entrega...";
    setAddressValidationMessage(calculatingMessage);
    setDeliveryFee(0);
    setIsAddressValidForDelivery(null);
    updateCheckoutField("deliveryFee", 0);
    updateCheckoutField("isAddressValidForDelivery", null);
    updateCheckoutField("addressValidationMessage", calculatingMessage);

    let routeDistanceMeters: number | null = null;
    try {
        routeDistanceMeters = await getRouteDistance(
            deliveryConfig.storeLng,
            deliveryConfig.storeLat,
            address.lng,
            address.lat,
            MAPBOX_API_KEY,
            "mapbox/driving" // Changed to driving for potentially more realistic road distance
        );
    } catch (error) {
        console.error("Mapbox API error:", error);
        addToast("Erro ao calcular rota (Mapbox).", "error");
    }

    setIsCalculatingRoute(false);

    let newDeliveryFee = 0;
    let newIsAddressValid = false;
    let newValidationMessage = "";

    if (routeDistanceMeters !== null) {
      const routeDistanceKm = routeDistanceMeters / 1000;
      const feePerKm = deliveryConfig.deliveryFeePerKm || 0;
      const maxDeliveryRadiusKm = deliveryConfig.radius || 10;
      const minDistanceForFeeMeters = deliveryConfig.minDeliveryDistanceForFee || 0;

      // Check if within max radius (allow some buffer, e.g., 1.5x)
      if (routeDistanceKm > maxDeliveryRadiusKm * 1.5) {
        newValidationMessage = `Lamentamos, este endereço está muito distante (${routeDistanceKm.toFixed(1)} km). Raio máximo: ${maxDeliveryRadiusKm} km.`;
        newIsAddressValid = false;
      } else {
          newIsAddressValid = true; // Address is deliverable
          if (routeDistanceMeters > minDistanceForFeeMeters && feePerKm > 0) {
              newDeliveryFee = routeDistanceKm * feePerKm;
              // Round fee to sensible value (e.g., nearest 0.50)
              newDeliveryFee = Math.round(newDeliveryFee * 2) / 2;
              newValidationMessage = `Entrega disponível! Distância: ${routeDistanceKm.toFixed(1)} km. Frete: R$ ${newDeliveryFee.toFixed(2)}.`;
          } else {
              newDeliveryFee = 0;
              newValidationMessage = `Entrega disponível! Distância: ${routeDistanceKm.toFixed(1)} km. Sem taxa de frete.`;
          }
      }
      if (address.cep) setLastCepForFreight(address.cep);
    } else {
      newValidationMessage = "Não foi possível calcular a rota. Verifique o endereço ou tente novamente.";
      newIsAddressValid = false;
      setLastCepForFreight(null);
    }

    setDeliveryFee(newDeliveryFee);
    setIsAddressValidForDelivery(newIsAddressValid);
    setAddressValidationMessage(newValidationMessage);
    updateCheckoutField("deliveryFee", newDeliveryFee);
    updateCheckoutField("isAddressValidForDelivery", newIsAddressValid);
    updateCheckoutField("addressValidationMessage", newValidationMessage);

    return newIsAddressValid; // Return validation status

  }, [deliveryConfig, MAPBOX_API_KEY, updateCheckoutField, addToast]);

  // Handler for address selection from AddressCepFlow
  const handleAddressSelect = useCallback(async (selectedAddress: CustomerAddress, focusOnNumero: boolean) => {
    updateCheckoutField("endereco", selectedAddress);
    if (selectedAddress.cep) {
      updateCheckoutField("currentCep", selectedAddress.cep);
      localStorage.setItem("userCep", selectedAddress.cep);
    }

    // Recalculate fee if CEP changed or validation hasn\'t happened yet
    const cepChanged = selectedAddress.cep && selectedAddress.cep.replace(/\D/g, "") !== (lastCepForFreight || "").replace(/\D/g, "");
    if (cepChanged || isAddressValidForDelivery === null) {
      const isValid = await calculateDeliveryFeeAndValidateAddress(selectedAddress);
      // If valid and has number, navigate after a delay
      if (isValid && selectedAddress.numero) {
          setTimeout(() => {
              navigateToNextStep(CHECKOUT_STEPS_PATHS.ENDERECO);
              addToast("Endereço confirmado!", "success", 2000);
          }, 800);
      }
    } else if (isAddressValidForDelivery && selectedAddress.numero) {
        // Address already validated, CEP didn\'t change, just navigate if number exists
        setTimeout(() => {
            navigateToNextStep(CHECKOUT_STEPS_PATHS.ENDERECO);
            addToast("Endereço confirmado!", "success", 2000);
        }, 800);
    }

    if (focusOnNumero && numeroInputRef.current) {
      numeroInputRef.current.focus();
    }
  }, [updateCheckoutField, lastCepForFreight, isAddressValidForDelivery, calculateDeliveryFeeAndValidateAddress, navigateToNextStep, addToast]);

  // Handlers for numero, complemento, referencia changes
  const handleNumeroChange = useCallback((numero: string) => {
    updateCheckoutField("endereco", checkoutData.endereco ? { ...checkoutData.endereco, numero } : { numero } as CustomerAddress);
    if (fieldErrors.numero) {
      setFieldErrors(prev => ({ ...prev, numero: "" }));
    }
    // Consider auto-navigation only on explicit button click now
  }, [updateCheckoutField, checkoutData.endereco, fieldErrors.numero]);

  const handleComplementoChange = useCallback((complemento: string) => {
    updateCheckoutField("endereco", checkoutData.endereco ? { ...checkoutData.endereco, complemento } : { complemento } as CustomerAddress);
  }, [updateCheckoutField, checkoutData.endereco]);

  const handleReferenciaChange = useCallback((referencia: string) => {
    updateCheckoutField("endereco", checkoutData.endereco ? { ...checkoutData.endereco, referencia } : { referencia } as CustomerAddress);
  }, [updateCheckoutField, checkoutData.endereco]);

  // Validate step before proceeding
  const validateStep = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!checkoutData.endereco || !isAddressValidForDelivery) {
      errors.address = addressValidationMessage || "Forneça e valide um endereço de entrega dentro da nossa área.";
      addToast(errors.address, "error");
    }
    if (checkoutData.endereco && !checkoutData.endereco.numero?.trim()) {
      errors.numero = "O número do endereço é obrigatório.";
      addToast(errors.numero, "error");
    }
    setFieldErrors(errors);
    setPageError(Object.keys(errors).length > 0 ? (errors.address || errors.numero) : null);
    return Object.keys(errors).length === 0;
  }, [checkoutData.endereco, isAddressValidForDelivery, addressValidationMessage, addToast]);

  const handleNext = useCallback(() => {
    if (validateStep()) {
      navigateToNextStep(CHECKOUT_STEPS_PATHS.ENDERECO);
    }
  }, [validateStep, navigateToNextStep]);

  const handlePrev = useCallback(() => {
    navigateToPrevStep(CHECKOUT_STEPS_PATHS.ENDERECO);
  }, [navigateToPrevStep]);

  // Render logic
  if (cartItems.length === 0 && !router.isReady) { // Avoid rendering empty cart message during initial load
      return <div className={styles.loadingContainer}>Carregando...</div>; // Or some placeholder
  }

  if (cartItems.length === 0 && router.isReady) {
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
      <h1 className={styles.pageTitle}>Finalizar Pedido - Endereço</h1>
      <div className={checkoutStyles.checkoutProgress}>
        <Link href={CHECKOUT_STEPS_PATHS.CONTATO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Contato</a></Link>
        <Link href={CHECKOUT_STEPS_PATHS.TIPO_PEDIDO} legacyBehavior><a className={`${checkoutStyles.progressStep} ${checkoutStyles.completed}`}>Tipo</a></Link>
        <div className={`${checkoutStyles.progressStep} ${checkoutStyles.active}`}>Endereço</div>
        <div className={checkoutStyles.progressStep}>Pagamento</div>
        <div className={checkoutStyles.progressStep}>Revisão</div>
      </div>

      <div className={checkoutStyles.stepContainer}>
        <h3 className={checkoutStyles.stepTitle}>Etapa 3: Endereço de Entrega</h3>
        {pageError && <p className={checkoutStyles.checkoutError}>{pageError}</p>}
        <AddressCepFlow
          onAddressSelect={handleAddressSelect}
          initialCep={checkoutData.currentCep}
          onNumeroChange={handleNumeroChange}
          onComplementoChange={handleComplementoChange}
          onReferenciaChange={handleReferenciaChange}
          numeroValue={checkoutData.endereco?.numero || ""}
          complementoValue={checkoutData.endereco?.complemento || ""}
          referenciaValue={checkoutData.endereco?.referencia || ""}
          numeroInputRef={numeroInputRef}
          onCepChange={handleCepChangeCallback}
        />
        {isCalculatingRoute && <p className={checkoutStyles.infoMessage}>Calculando rota e taxa de entrega...</p>}
        {addressValidationMessage && !isCalculatingRoute && (
          <p className={`${checkoutStyles.validationMessage} ${isAddressValidForDelivery ? checkoutStyles.addressValid : checkoutStyles.addressInvalid}`}>
            {addressValidationMessage}
          </p>
        )}
        {/* Removed redundant error display, handled by AddressCepFlow or pageError */}



        {deliveryFee > 0 && isAddressValidForDelivery && (
          <div className={checkoutStyles.deliveryFeeDisplay}>
            <p>Taxa de Entrega: <strong>R$ {deliveryFee.toFixed(2)}</strong></p>
          </div>
        )}

        <div className={checkoutStyles.navigationButtons}>
          <button
            type="button"
            onClick={handlePrev}
            className={checkoutStyles.prevButton}
          >
            Voltar: Tipo de Pedido
          </button>
          <button
            type="button"
            onClick={handleNext}
            className={checkoutStyles.nextButton}
            disabled={isNextDisabled}
          >
            Continuar para Pagamento
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnderecoPage;


