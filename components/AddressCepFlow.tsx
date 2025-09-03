import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from '@/styles/AddressCepFlow.module.css';

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const LOCAL_STORAGE_CEP_KEY = 'userCep';

interface AddressCepFlowProps {
  onAddressSelect: (address: {
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
  }, focusOnNumero: boolean) => void;
  initialCep?: string; // Este prop pode ser usado para carregar um CEP inicial, mas localStorage terá precedência
  onNumeroChange: (value: string) => void;
  onComplementoChange: (value: string) => void;
  onReferenciaChange: (value: string) => void;
  numeroValue: string;
  complementoValue: string;
  referenciaValue: string;
  numeroInputRef: React.RefObject<HTMLInputElement | null>;
  onCepChange: (cep: string) => void; // Callback para notificar mudança de CEP para controle de frete
}

interface ViaCepData {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  cep?: string;
  erro?: boolean;
}

interface AddressFormData {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

const AddressCepFlow: React.FC<AddressCepFlowProps> = ({ 
    onAddressSelect, 
    initialCep = '',
    onNumeroChange,
    onComplementoChange,
    onReferenciaChange,
    numeroValue,
    complementoValue,
    referenciaValue,
    numeroInputRef,
    onCepChange
}) => {
  const [step, setStep] = useState(1);
  const [cepInput, setCepInput] = useState('');
  const [addressDataFromCep, setAddressDataFromCep] = useState<Omit<AddressFormData, 'numero' | 'complemento' | 'pontoReferencia'> | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar CEP do localStorage na montagem inicial
  useEffect(() => {
    const storedCep = localStorage.getItem(LOCAL_STORAGE_CEP_KEY);
    if (storedCep) {
      setCepInput(storedCep);
      // Poderia disparar a busca automaticamente se desejado, mas vamos deixar o usuário clicar
      // onCepChange(storedCep); // Notifica o CEP carregado
    } else if (initialCep) {
        setCepInput(initialCep);
        // onCepChange(initialCep);
    }
  }, [initialCep]); // Dependência em initialCep mantida, mas localStorage tem prioridade

  const handleCepInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const onlyNumbers = value.replace(/\D/g, '');
    let maskedValue = onlyNumbers;
    if (onlyNumbers.length > 5) {
      maskedValue = `${onlyNumbers.slice(0, 5)}-${onlyNumbers.slice(5, 8)}`;
    }
    setCepInput(maskedValue.slice(0, 9));
  };

  const handleSearchCep = async () => {
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setError('CEP inválido. Por favor, insira um CEP com 8 dígitos.');
      return;
    }
    setIsFetchingCep(true);
    setError(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) {
        throw new Error('Falha ao buscar CEP. Tente novamente.');
      }
      const data: ViaCepData = await response.json();
      if (data.erro) {
        throw new Error('CEP não encontrado.');
      }
      const newAddressData = {
        rua: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
        cep: data.cep || cleanCep,
      };
      setAddressDataFromCep(newAddressData);
      localStorage.setItem(LOCAL_STORAGE_CEP_KEY, newAddressData.cep); // Salva CEP no localStorage
      onCepChange(newAddressData.cep); // Notifica mudança de CEP
      setStep(2);

    } catch (err: any) {
      console.error("Erro ao buscar CEP: ", err);
      setError(err.message || 'Ocorreu um erro ao buscar o CEP.');
      localStorage.removeItem(LOCAL_STORAGE_CEP_KEY); // Remove CEP inválido
      onCepChange(''); // Notifica que o CEP é inválido/removido
    }
    setIsFetchingCep(false);
  };

  useEffect(() => {
    if (step === 2 && numeroInputRef.current) {
        numeroInputRef.current.focus();
    }
  }, [step, numeroInputRef]);

  const geocodeWithMapbox = async (addrDataForGeocoding: AddressFormData & { numero: string; complemento?: string; pontoReferencia?: string }) => {
    if (!MAPBOX_ACCESS_TOKEN) {
      setError('Chave de API do Mapbox não configurada.');
      console.error('Mapbox Access Token is missing.');
      setIsGeocoding(false);
      return null;
    }
    setIsGeocoding(true);
    setError(null);

    const queryParts = [
      `${addrDataForGeocoding.rua}, ${addrDataForGeocoding.numero}`,
      addrDataForGeocoding.bairro,
      addrDataForGeocoding.cidade,
      addrDataForGeocoding.estado,
      `CEP ${addrDataForGeocoding.cep.replace(/\D/g, '')}`
    ];
    const searchQuery = queryParts.filter(Boolean).join(', ');

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&limit=1&types=address,postcode,locality,place`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Falha na resposta do Mapbox: ${response.statusText} - ${errorData?.message || 'Erro desconhecido'}`);
      }
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const firstResult = data.features[0] as MapboxFeature;
        const [lng, lat] = firstResult.center;
        return { lat, lng, fullAddressFromMapbox: firstResult.place_name };
      } else {
        const broaderQuery = `${addrDataForGeocoding.cidade}, ${addrDataForGeocoding.estado}, CEP ${addrDataForGeocoding.cep.replace(/\D/g, '')}`;
        const fallbackResponse = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(broaderQuery)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&limit=1&types=locality,place,postcode`
        );
        if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            if (fallbackData.features && fallbackData.features.length > 0) {
                const fallbackResult = fallbackData.features[0] as MapboxFeature;
                const [lng, lat] = fallbackResult.center;
                console.warn("Usando coordenadas de fallback (menos precisas) para: ", broaderQuery);
                return { lat, lng, fullAddressFromMapbox: fallbackResult.place_name }; 
            }
        }
        throw new Error('Não foi possível validar as coordenadas do endereço com Mapbox. Verifique os dados ou tente um endereço próximo.');
      }
    } catch (err: any) {
      console.error("Erro ao geocodificar com Mapbox: ", err);
      setError(err.message || 'Falha ao obter coordenadas.');
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleConfirmAddress = async () => {
    if (!addressDataFromCep || !numeroValue) {
      setError('Por favor, preencha o Número do endereço.');
      return;
    }
    setError(null);

    const completeAddressForGeocoding = {
        ...addressDataFromCep,
        numero: numeroValue,
        complemento: complementoValue,
        pontoReferencia: referenciaValue,
    };

    const geocodedResult = await geocodeWithMapbox(completeAddressForGeocoding);

    if (geocodedResult) {
        const finalAddressObject = {
            fullAddress: `${addressDataFromCep.rua}, ${numeroValue}`,
            lat: geocodedResult.lat,
            lng: geocodedResult.lng,
            cep: addressDataFromCep.cep,
            numero: numeroValue,
            complemento: complementoValue,
            referencia: referenciaValue,
            bairro: addressDataFromCep.bairro,
            cidade: addressDataFromCep.cidade,
            estado: addressDataFromCep.estado,
        };
        // O CEP já foi salvo no localStorage e notificado em handleSearchCep
        // Se o usuário apenas confirmar sem alterar o CEP, não precisa salvar/notificar novamente aqui
        // A menos que o CEP pudesse ser alterado nesta etapa, o que não é o caso.
        onAddressSelect(finalAddressObject, false);
        setError(null);
    } else {
        // Erro já foi setado dentro de geocodeWithMapbox
    }
  };

  const handleBackToCep = () => {
    setStep(1);
    setError(null);
    // Não limpar o addressDataFromCep aqui, pois o usuário pode querer apenas corrigir o CEP
    // O CEP em localStorage será atualizado quando uma nova busca for feita
    // setAddressDataFromCep(null); 
  };

  if (step === 1) {
    return (
      <div className={styles.cepStepContainer}>
        <h4>Endereço de entrega</h4>
        <p className={styles.cepSubtext}>Informe seu CEP para verificarmos se entregamos em sua região</p>
        <input
          type="text"
          value={cepInput}
          onChange={handleCepInputChange}
          placeholder="00000-000"
          className={styles.cepInput}
          maxLength={9}
        />
        <button onClick={handleSearchCep} disabled={isFetchingCep} className={styles.cepButton}>
          {isFetchingCep ? 'Buscando...' : 'BUSCAR CEP'}
        </button>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  if (step === 2 && addressDataFromCep) {
    return (
      <div className={styles.addressFormContainer}>
        <h4>Endereço de entrega</h4>
        <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flexGrow: 2, marginRight: '10px' }}>
                <label htmlFor="rua">Rua *</label>
                <input type="text" id="rua" name="rua" value={addressDataFromCep.rua} readOnly className={styles.readOnlyInput} />
            </div>
            <div className={styles.formGroup} style={{ flexGrow: 1 }}>
                <label htmlFor="numero">Nº *</label>
                <input 
                    type="text" 
                    id="numero" 
                    name="numero" 
                    value={numeroValue} 
                    onChange={(e) => onNumeroChange(e.target.value)} 
                    required 
                    ref={numeroInputRef}
                />
            </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="bairro">Bairro *</label>
          <input type="text" id="bairro" name="bairro" value={addressDataFromCep.bairro} readOnly className={styles.readOnlyInput} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="complemento">Complemento</label>
          <input 
            type="text" 
            id="complemento" 
            name="complemento" 
            value={complementoValue} 
            onChange={(e) => onComplementoChange(e.target.value)} 
            placeholder="Apto/Bloco/Casa" 
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="pontoReferencia">Ponto de referência</label>
          <input 
            type="text" 
            id="pontoReferencia" 
            name="pontoReferencia" 
            value={referenciaValue} 
            onChange={(e) => onReferenciaChange(e.target.value)} 
            />
        </div>
        <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flexGrow: 2, marginRight: '10px' }}>
                <label htmlFor="cidade">Cidade *</label>
                <input type="text" id="cidade" name="cidade" value={addressDataFromCep.cidade} readOnly className={styles.readOnlyInput} />
            </div>
            <div className={styles.formGroup} style={{ flexGrow: 1 }}>
                <label htmlFor="estado">Estado *</label>
                <input type="text" id="estado" name="estado" value={addressDataFromCep.estado} readOnly className={styles.readOnlyInput} />
            </div>
        </div>
        
        {error && <p className={styles.errorText}>{error}</p>}
        
        <div className={styles.formActions}>
          <button type="button" onClick={handleBackToCep} className={styles.backButton}>
            ALTERAR CEP
          </button>
          <button onClick={handleConfirmAddress} disabled={isGeocoding} className={styles.confirmButton}>
            {isGeocoding ? 'Confirmando...' : 'CONFIRMAR ENDEREÇO'}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AddressCepFlow;

