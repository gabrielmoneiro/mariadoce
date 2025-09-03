import React, { useState, useCallback, useEffect } from 'react';
import styles from '@/styles/AddressAutocomplete.module.css';

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface AddressAutocompleteProps {
  onAddressSelect: (address: {
    fullAddress: string;
    lat: number;
    lng: number;
    cep?: string;
  }) => void;
  initialValue?: string;
}

interface ViaCepData {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  cep?: string;
  erro?: boolean;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
    wikidata?: string;
  }>;
  properties?: {
    address?: string; // Mapbox might not always have a simple 'address.postcode'
    short_code?: string;
  };
  address?: string; // Sometimes address number is here
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ onAddressSelect, initialValue }) => {
  const [inputValue, setInputValue] = useState(initialValue || "");
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMapboxSuggestions = async (query: string) => {
    if (!MAPBOX_ACCESS_TOKEN) {
      setError('Chave de API do Mapbox não configurada.');
      console.error('Mapbox Access Token is missing.');
      return;
    }
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&limit=5&autocomplete=true&types=address,postcode,poi`
      );
      if (!response.ok) {
        throw new Error('Falha na resposta do Mapbox ao buscar sugestões');
      }
      const data = await response.json();
      setSuggestions(data.features || []);
    } catch (err: any) {
      console.error("Erro ao buscar sugestões no Mapbox: ", err);
      setError('Falha ao buscar sugestões de endereço.');
      setSuggestions([]);
    }
    setIsFetching(false);
  };

  const geocodeWithMapbox = async (query: string, cepFromViaCep?: string, isStructured: boolean = false, viaCepData?: ViaCepData) => {
    if (!MAPBOX_ACCESS_TOKEN) {
      setError('Chave de API do Mapbox não configurada.');
      console.error('Mapbox Access Token is missing.');
      return;
    }
    setIsFetching(true);
    setError(null);
    let searchQuery = query;
    if (isStructured && viaCepData) {
        // Construct a query string that Mapbox can understand for structured search
        // Mapbox prefers a single query string, but we can try to be specific.
        searchQuery = [
            viaCepData.logradouro,
            viaCepData.bairro,
            viaCepData.localidade,
            viaCepData.uf,
            viaCepData.cep
        ].filter(Boolean).join(', ');
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=BR&limit=1&types=address,postcode,locality,place`
      );
      if (!response.ok) {
        throw new Error(`Falha na resposta do Mapbox: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const firstResult = data.features[0] as MapboxFeature;
        const fullAddress = firstResult.place_name;
        const [lng, lat] = firstResult.center;
        let cep = cepFromViaCep;
        // Try to extract CEP from Mapbox context if available
        if (firstResult.context) {
            const postcodeEntry = firstResult.context.find(c => c.id.startsWith('postcode.'));
            if (postcodeEntry) {
                cep = postcodeEntry.text.replace(/\D/g, '');
            }
        }
        if (!cep && viaCepData?.cep) cep = viaCepData.cep.replace(/\D/g, '');

        setInputValue(fullAddress);
        setSuggestions([]);
        onAddressSelect({ fullAddress, lat, lng, cep });
        setError(null);
      } else {
        if (isStructured && query !== searchQuery) { // If structured search failed, try with original free text query as fallback
            console.warn("Busca estruturada com Mapbox falhou, tentando com query de texto livre original...");
            await geocodeWithMapbox(query, cepFromViaCep, false); // Fallback to original query as free text
        } else {
            throw new Error('Não foi possível encontrar coordenadas para o endereço informado (Mapbox).');
        }
      }
    } catch (err: any) {
      console.error("Erro ao geocodificar com Mapbox: ", err);
      setError(err.message || 'Falha ao obter coordenadas (Mapbox).');
      if (isStructured && query !== searchQuery) { // Fallback if structured failed
        await geocodeWithMapbox(query, cepFromViaCep, false);
      } else {
        setSuggestions([]);
      }
    }
    setIsFetching(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    const timer = setTimeout(() => {
      fetchMapboxSuggestions(value);
    }, 500);
    return () => clearTimeout(timer);
  };

  const handleSuggestionClick = async (suggestion: MapboxFeature) => {
    const fullAddress = suggestion.place_name;
    const [lng, lat] = suggestion.center;
    let cep;
    if (suggestion.context) {
        const postcodeEntry = suggestion.context.find(c => c.id.startsWith('postcode.'));
        if (postcodeEntry) {
            cep = postcodeEntry.text.replace(/\D/g, '');
        }
    }

    setInputValue(fullAddress);
    setSuggestions([]);
    onAddressSelect({ fullAddress, lat, lng, cep });
  };

  const handleInputBlur = useCallback(async () => {
    if (suggestions.length > 0 || !inputValue.trim()) {
        return;
    }

    const cepInput = inputValue.replace(/\D/g, '');
    if (cepInput.length === 8) {
      setIsFetching(true);
      setError(null);
      try {
        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cepInput}/json/`);
        if (!viaCepResponse.ok) throw new Error('Falha ao buscar CEP no ViaCEP.');
        const viaCepData: ViaCepData = await viaCepResponse.json();
        if (viaCepData.erro) throw new Error('CEP não encontrado no ViaCEP.');
        
        const addressFromViaCep = `${viaCepData.logradouro || ''}, ${viaCepData.bairro || ''}, ${viaCepData.localidade || ''}, ${viaCepData.uf || ''}`.replace(/, ,/g, ',').trim();
        setInputValue(addressFromViaCep); 
        // Use geocodeWithMapbox with structured data from ViaCEP
        await geocodeWithMapbox(addressFromViaCep, viaCepData.cep, true, viaCepData);

      } catch (err: any) {
        console.error("Erro ao processar CEP: ", err);
        setError(err.message || 'Falha ao processar o CEP.');
        setIsFetching(false);
      }
    } else if (inputValue.trim()) {
        await geocodeWithMapbox(inputValue.trim());
    }
  }, [inputValue, onAddressSelect, suggestions.length]);

  useEffect(() => {
    if (initialValue) {
        setInputValue(initialValue);
    }
  }, [initialValue]);

  return (
    <div className={styles.autocompleteContainer}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder="Digite seu CEP ou endereço para entrega"
        className={styles.input}
      />
      {isFetching && <p className={styles.loading}>A carregar...</p>}
      {error && <p className={styles.error}>{error}</p>}
      {suggestions.length > 0 && (
        <ul className={styles.suggestionsList}>
          {suggestions.map((suggestion) => (
            <li 
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className={styles.suggestionItem}
            >
              {suggestion.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;

