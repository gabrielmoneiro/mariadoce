import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import styles from '@/styles/AdminSettings.module.css';
import ScheduleSettings from '@/components/admin/ScheduleSettings';
// Removidas importações do mapbox-gl

interface DeliveryConfig {
  radius: number | "";
  storeAddress: string;
  storeNumber: string;
  storeComplement: string;
  storeFullAddress?: string;
  storeLat: number | null;
  storeLng: number | null;
  // Adicionar campos para Mapbox se necessário, como custo por km, etc.
  deliveryFeePerKm?: number;
  minDeliveryDistanceForFee?: number; // e.g., 3km
}

interface ViaCepData {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  cep?: string;
  erro?: boolean;
}

const AdminSettingsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  const [radius, setRadius] = useState<number | "">(""); // Manter por enquanto, pode ser removido/adaptado depois
  const [storeAddressInput, setStoreAddressInput] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [storeComplement, setStoreComplement] = useState("");
  const [storeFullAddress, setStoreFullAddress] = useState<string>("");
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState<number | "">("");
  const [minDeliveryDistanceForFee, setMinDeliveryDistanceForFee] = useState<number | "">(3);

  const [isLoading, setIsLoading] = useState(true); // Loading para dados da config
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [manualLocationAdjusted, setManualLocationAdjusted] = useState(false);

  // Mapbox API key mantido para geocodificação
  const MAPBOX_API_KEY = "pk.eyJ1IjoiZ2FicmllbG1vbnRlaXIwNyIsImEiOiJjbWFoMDQ2Y3cwNm16Mm5waXBlNnBhYmo2In0.0kmvJR1q-lIGCtif7dPsPQ";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/admin/login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return; // Não carregar configs se não estiver autenticado

    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const configRef = doc(db, 'config', 'deliveryConfig');
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const configData = docSnap.data() as DeliveryConfig;
          setRadius(configData.radius || "");
          setStoreAddressInput(configData.storeAddress || "");
          setStoreNumber(configData.storeNumber || "");
          setStoreComplement(configData.storeComplement || "");
          setStoreFullAddress(configData.storeFullAddress || "");
          setStoreLat(configData.storeLat || null);
          setStoreLng(configData.storeLng || null);
          setDeliveryFeePerKm(configData.deliveryFeePerKm || "");
          setMinDeliveryDistanceForFee(configData.minDeliveryDistanceForFee !== undefined ? configData.minDeliveryDistanceForFee : 3);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de entrega: ", err);
        setError("Falha ao carregar as configurações existentes.");
      }
      setIsLoading(false);
    };
    fetchConfig();
  }, [user]);

  // Função para obter endereço a partir de coordenadas (geocodificação reversa)
  const fetchAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_API_KEY}&language=pt-BR`);
      
      if (!response.ok) {
        throw new Error(`Falha na resposta do Mapbox: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data && data.features && data.features.length > 0) {
        setStoreFullAddress(data.features[0].place_name);
      }
    } catch (err: any) {
      console.error("Erro na geocodificação reversa: ", err);
      // Não definimos erro aqui para não interromper o fluxo do usuário
    }
  };

  const fetchCoordinatesFromMapbox = async (addressQuery: string) => {
    setIsFetchingAddress(true);
    setError(null);
    try {
      // Adicionar número e complemento se disponíveis
      let fullQuery = addressQuery;
      if (storeNumber) {
        fullQuery += `, ${storeNumber}`;
      }
      
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullQuery)}.json?access_token=${MAPBOX_API_KEY}&country=BR&language=pt-BR&limit=1`);
      
      if (!response.ok) {
        throw new Error(`Falha na resposta do Mapbox: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data && data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setStoreLng(lng);
        setStoreLat(lat);
        setStoreFullAddress(data.features[0].place_name);
        setManualLocationAdjusted(false);
        setError(null);
      } else {
        throw new Error('Nenhum resultado encontrado no Mapbox para o endereço fornecido.');
      }
    } catch (err: any) {
      console.error("Erro ao buscar coordenadas no Mapbox: ", err);
      // Tentar com Nominatim como fallback
      await fetchCoordinatesFromNominatimFreeText(addressQuery);
    }
    setIsFetchingAddress(false);
  };

  const fetchCoordinatesFromNominatimStructured = async (viaCepData: ViaCepData) => {
    setIsFetchingAddress(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (viaCepData.logradouro) params.append("street", `${viaCepData.logradouro}${storeNumber ? ` ${storeNumber}` : ''}`);
      if (viaCepData.localidade) params.append("city", viaCepData.localidade);
      if (viaCepData.uf) params.append("state", viaCepData.uf);
      params.append("country", "BR");
      params.append("format", "json");
      params.append("limit", "1");
      params.append("addressdetails", "1");

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Falha na resposta do Nominatim (estruturado): ${response.statusText}`);
      }
      const nominatimData = await response.json();
      if (nominatimData && nominatimData.length > 0) {
        setStoreLat(parseFloat(nominatimData[0].lat));
        setStoreLng(parseFloat(nominatimData[0].lon));
        setStoreFullAddress(nominatimData[0].display_name);
        setManualLocationAdjusted(false);
        setError(null);
      } else {
        // Tentar com Mapbox primeiro
        const fullAddress = `${viaCepData.logradouro || ''}, ${storeNumber || ''}, ${viaCepData.bairro || ''}, ${viaCepData.localidade || ''}, ${viaCepData.uf || ''}`.replace(/, ,/g, ',').trim();
        await fetchCoordinatesFromMapbox(fullAddress);
      }
    } catch (err: any) {
      console.error("Erro ao buscar coordenadas no Nominatim (estruturado): ", err);
      setError(`Falha ao obter coordenadas: ${err.message}`);
      setStoreLat(null);
      setStoreLng(null);
      if (viaCepData.logradouro) {
        setStoreFullAddress(`${viaCepData.logradouro}, ${storeNumber || ''}, ${viaCepData.bairro || ''}, ${viaCepData.localidade || ''} - ${viaCepData.uf || ''}`.replace(/, ,/g, ',').trim());
      }
    }
    setIsFetchingAddress(false);
  };

  const fetchCoordinatesFromNominatimFreeText = async (addressQuery: string) => {
    setIsFetchingAddress(true);
    setError(null);
    try {
      // Adicionar número e complemento se disponíveis
      let fullQuery = addressQuery;
      if (storeNumber) {
        fullQuery += ` ${storeNumber}`;
      }
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1&countrycodes=br&addressdetails=1`);
      if (!response.ok) {
        throw new Error(`Falha na resposta do Nominatim (texto livre): ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.length > 0) {
        setStoreLat(parseFloat(data[0].lat));
        setStoreLng(parseFloat(data[0].lon));
        setStoreFullAddress(data[0].display_name);
        setManualLocationAdjusted(false);
        setError(null);
      } else {
        throw new Error('Nenhum resultado encontrado no Nominatim para o endereço fornecido (texto livre).');
      }
    } catch (err: any) {
      console.error("Erro ao buscar coordenadas no Nominatim (texto livre): ", err);
      setError(`Falha ao obter coordenadas (texto livre): ${err.message}`);
      setStoreLat(null);
      setStoreLng(null);
      setStoreFullAddress(addressQuery);
    }
    setIsFetchingAddress(false);
  };

  const handleCepBlur = useCallback(async () => {
    const cepInput = storeAddressInput.replace(/\D/g, '');
    if (cepInput.length === 8) {
      setIsFetchingAddress(true);
      setError(null);
      setSuccessMessage(null);
      setStoreLat(null);
      setStoreLng(null);
      setStoreFullAddress("");
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepInput}/json/`);
        if (!response.ok) {
          throw new Error('Falha na resposta do ViaCEP');
        }
        const data: ViaCepData = await response.json();
        if (data.erro) {
          throw new Error('CEP não encontrado no ViaCEP.');
        }
        const viaCepAddress = `${data.logradouro || ''}, ${storeNumber || ''}, ${data.bairro || ''}, ${data.localidade || ''} - ${data.uf || ''}`.replace(/, ,/g, ',').trim();
        setStoreFullAddress(viaCepAddress);
        await fetchCoordinatesFromNominatimStructured(data);
      } catch (err: any) {
        console.error("Erro ao processar CEP: ", err);
        setError(`Falha ao processar CEP: ${err.message}`);
        setStoreLat(null);
        setStoreLng(null);
      }
      setIsFetchingAddress(false);
    } else if (storeAddressInput.trim() !== "" && !/\d{5}-?\d{3}/.test(storeAddressInput)) {
        await fetchCoordinatesFromMapbox(storeAddressInput.trim());
    }
  }, [storeAddressInput, storeNumber]);

  const handleAddressSearch = async () => {
    if (!storeAddressInput.trim()) {
      setError("Por favor, insira um endereço para buscar.");
      return;
    }
    
    // Construir o endereço completo com número e complemento
    let fullAddress = storeAddressInput.trim();
    if (storeNumber) {
      fullAddress += `, ${storeNumber}`;
    }
    
    await fetchCoordinatesFromMapbox(fullAddress);
  };

  // Função para ajustar manualmente as coordenadas
  const handleManualCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'lat' | 'lng') => {
    const value = e.target.value;
    if (value === '') {
      type === 'lat' ? setStoreLat(null) : setStoreLng(null);
      return;
    }
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      if (type === 'lat') {
        setStoreLat(numValue);
      } else {
        setStoreLng(numValue);
      }
      setManualLocationAdjusted(true);
    }
  };

  // Função para atualizar o endereço após ajuste manual das coordenadas
  const handleUpdateAddressFromCoordinates = async () => {
    if (storeLat !== null && storeLng !== null) {
      await fetchAddressFromCoordinates(storeLat, storeLng);
    }
  };

  const handleSaveConfig = async () => {
    if (radius === "" || !storeAddressInput.trim() || deliveryFeePerKm === "" || minDeliveryDistanceForFee === "") {
      setError("Por favor, preencha todos os campos obrigatórios: Raio (mesmo que não usado para frete por rota), Endereço da Loja, Taxa de entrega por KM e Distância mínima para taxa.");
      return;
    }
    if (storeLat === null || storeLng === null) {
        setError("Não foi possível obter as coordenadas para o endereço da loja. Verifique o endereço e tente novamente.");
        return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const configToSave: DeliveryConfig = {
        radius: Number(radius),
        storeAddress: storeAddressInput,
        storeNumber,
        storeComplement,
        storeFullAddress: storeFullAddress, 
        storeLat,
        storeLng,
        deliveryFeePerKm: Number(deliveryFeePerKm),
        minDeliveryDistanceForFee: Number(minDeliveryDistanceForFee),
      };
      const configRef = doc(db, 'config', 'deliveryConfig');
      await setDoc(configRef, configToSave, { merge: true });
      setSuccessMessage("Configurações de entrega guardadas com sucesso!");
    } catch (err) {
      console.error("Erro ao guardar configurações de entrega: ", err);
      setError("Falha ao guardar as configurações. Tente novamente.");
    }
    setIsSaving(false);
  };

  if (authLoading || (user && isLoading)) {
    return <div className={styles.container}><p>A carregar...</p></div>;
  }

  if (!user) {
    // O useEffect já faz o redirect, mas este é um fallback.
    return <div className={styles.container}><p>A redirecionar para o login...</p></div>;
  }

  // URL para mapa estático do OpenStreetMap
  const staticMapUrl = storeLat && storeLng 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${storeLng-0.01}%2C${storeLat-0.01}%2C${storeLng+0.01}%2C${storeLat+0.01}&layer=mapnik&marker=${storeLat}%2C${storeLng}`
    : '';

  return (
    <div className={styles.container}>
      <h1>Configurações de Entrega e Frete</h1>
      {error && <p className={styles.error}>{error}</p>}
      {successMessage && <p className={styles.success}>{successMessage}</p>}
      
      <ScheduleSettings 
        onSave={() => setSuccessMessage("Configurações de agendamento salvas com sucesso!")}
        onError={(errorMsg) => setError(errorMsg)}
      />
      
      <div className={styles.formGroup}>
        <label htmlFor="storeAddressInput">Endereço da Loja (CEP ou Endereço Completo):</label>
        <input 
          type="text"
          id="storeAddressInput"
          value={storeAddressInput}
          onChange={(e) => setStoreAddressInput(e.target.value)}
          onBlur={handleCepBlur}
          placeholder="Digite o CEP ou o endereço completo da loja"
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="storeNumber">Número:</label>
          <input 
            type="text"
            id="storeNumber"
            value={storeNumber}
            onChange={(e) => setStoreNumber(e.target.value)}
            placeholder="Ex: 123"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="storeComplement">Complemento:</label>
          <input 
            type="text"
            id="storeComplement"
            value={storeComplement}
            onChange={(e) => setStoreComplement(e.target.value)}
            placeholder="Ex: Sala 101"
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <button 
          onClick={handleAddressSearch} 
          disabled={isFetchingAddress || !storeAddressInput.trim()} 
          className={styles.searchButton}
        >
          {isFetchingAddress ? 'Buscando...' : 'Buscar Endereço'}
        </button>
      </div>

      {isFetchingAddress && <p className={styles.info}>A procurar endereço da loja...</p>}
      {storeFullAddress && !isFetchingAddress && (
        <p className={styles.addressDetails}>
          Endereço da loja encontrado: {storeFullAddress}
          {manualLocationAdjusted && <span className={styles.manualAdjustment}> (Ajustado manualmente)</span>}
        </p>
      )}
      {storeLat && storeLng && !isFetchingAddress && (
        <p className={styles.coordsInfo}>Coordenadas da loja: Latitude: {storeLat.toFixed(6)}, Longitude: {storeLng.toFixed(6)}</p>
      )}

      {/* Mapa estático e ajuste manual de coordenadas */}
      {storeLat && storeLng && (
        <div className={styles.mapContainer}>
          <h3>Localização da Loja</h3>
          
          {/* Mapa estático do OpenStreetMap */}
          <div className={styles.staticMapContainer}>
            <iframe 
              src={staticMapUrl}
              width="100%" 
              height="300" 
              frameBorder="0" 
              scrolling="no" 
              marginHeight={0} 
              marginWidth={0} 
              title="Mapa da localização da loja"
              className={styles.staticMap}
            ></iframe>
          </div>
          
          <div className={styles.manualCoordinatesContainer}>
            <h4>Ajuste Manual de Coordenadas</h4>
            <p className={styles.mapInstructions}>
              Você pode ajustar manualmente as coordenadas para maior precisão.
            </p>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="latitudeInput">Latitude:</label>
                <input 
                  type="number" 
                  id="latitudeInput"
                  value={storeLat || ''}
                  onChange={(e) => handleManualCoordinateChange(e, 'lat')}
                  step="0.000001"
                  className={styles.coordinateInput}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="longitudeInput">Longitude:</label>
                <input 
                  type="number" 
                  id="longitudeInput"
                  value={storeLng || ''}
                  onChange={(e) => handleManualCoordinateChange(e, 'lng')}
                  step="0.000001"
                  className={styles.coordinateInput}
                />
              </div>
            </div>
            
            <button 
              onClick={handleUpdateAddressFromCoordinates}
              className={styles.updateButton}
              disabled={storeLat === null || storeLng === null}
            >
              Atualizar Endereço a partir das Coordenadas
            </button>
          </div>
        </div>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="minDeliveryDistanceForFee">Distância Mínima para Cobrança de Frete por Rota (km):</label>
        <input 
          type="number"
          id="minDeliveryDistanceForFee"
          value={minDeliveryDistanceForFee}
          onChange={(e) => setMinDeliveryDistanceForFee(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Ex: 3"
          min="0"
        />
         <span className={styles.helperText}>Distância (em KM) a partir da qual o frete por rota será calculado. Abaixo disso, pode-se aplicar outra lógica ou frete fixo (não implementado aqui).</span>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="deliveryFeePerKm">Taxa de Entrega por KM (R$) (para distâncias acima da mínima):</label>
        <input 
          type="number"
          id="deliveryFeePerKm"
          value={deliveryFeePerKm}
          onChange={(e) => setDeliveryFeePerKm(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Ex: 2.50"
          min="0"
          step="0.01"
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="radius">Raio de Entrega (km) - Fallback/Alternativo:</label>
        <input 
          type="number"
          id="radius"
          value={radius}
          onChange={(e) => setRadius(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Ex: 5"
          min="0"
        />
        <span className={styles.helperText}>Este raio pode ser usado como um fallback ou para uma lógica de entrega diferente, se o cálculo por rota não for aplicável.</span>
      </div>

      <p className={styles.info}>
        <strong>Nota:</strong> O cálculo de frete exato usando a rota será aplicado no carrinho/checkout para o endereço do cliente.
        Aqui configuramos os parâmetros base para esse cálculo (endereço da loja, taxa por km, distância mínima).
      </p>

      <button onClick={handleSaveConfig} disabled={isSaving || isFetchingAddress} className={styles.saveButton}>
        {isSaving ? 'A guardar...' : 'Guardar Configurações'}
      </button>
    </div>
  );
};

export default AdminSettingsPage;
