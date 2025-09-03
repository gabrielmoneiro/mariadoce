import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import styles from '@/styles/AdminSettings.module.css';
import ScheduleSettings from '@/components/admin/ScheduleSettings';

// Interfaces existentes
interface DeliveryConfig {
  radius: number | "";
  storeAddress: string;
  storeNumber: string;
  storeComplement: string;
  storeFullAddress?: string;
  storeLat: number | null;
  storeLng: number | null;
  deliveryFeePerKm?: number;
  minDeliveryDistanceForFee?: number;
}

interface ViaCepData {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  cep?: string;
  erro?: boolean;
}

// Novas interfaces para o sistema melhorado
interface TamanhoPreco {
  tamanho: string;
  preco: number;
  descricao?: string;
}

interface GrupoTamanho {
  id: string;
  nome: string;
  descricao?: string;
  tamanhos: TamanhoPreco[];
  ativo: boolean;
}

interface CupomDesconto {
  id: string;
  codigo: string;
  tipo: 'percentual' | 'valor_fixo';
  valor: number;
  valorMinimo?: number;
  usoMaximo?: number;
  usoAtual: number;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
}

type TabType = 'loja' | 'horarios' | 'tamanhos' | 'promocoes';

const AdminSettingsImproved = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('loja');
  const router = useRouter();

  // Estados para configurações de loja
  const [radius, setRadius] = useState<number | "">(""); 
  const [storeAddressInput, setStoreAddressInput] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [storeComplement, setStoreComplement] = useState("");
  const [storeFullAddress, setStoreFullAddress] = useState<string>("");
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState<number | "">("");
  const [minDeliveryDistanceForFee, setMinDeliveryDistanceForFee] = useState<number | "">(3);

  // Estados para grupos de tamanhos
  const [gruposTamanhos, setGruposTamanhos] = useState<GrupoTamanho[]>([]);
  const [editingGrupo, setEditingGrupo] = useState<GrupoTamanho | null>(null);
  const [showGrupoForm, setShowGrupoForm] = useState(false);

  // Estados para cupons de desconto
  const [cuponsDesconto, setCuponsDesconto] = useState<CupomDesconto[]>([]);
  const [editingCupom, setEditingCupom] = useState<CupomDesconto | null>(null);
  const [showCupomForm, setShowCupomForm] = useState(false);

  // Estados gerais
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [manualLocationAdjusted, setManualLocationAdjusted] = useState(false);

  const MAPBOX_API_KEY = "pk.eyJ1IjoiZ2FicmllbG1vbnRlaXIwNyIsImEiOiJjbWFoMDQ2Y3cwNm16Mm5waXBlNnBhYmo2In0.0kmvJR1q-lIGCtif7dPsPQ";

  // Efeitos de autenticação e carregamento
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
    if (!user) return;
    fetchAllConfigs();
  }, [user]);

  const fetchAllConfigs = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchDeliveryConfig(),
        fetchGruposTamanhos(),
        fetchCuponsDesconto()
      ]);
    } catch (err) {
      console.error("Erro ao carregar configurações: ", err);
      setError("Falha ao carregar as configurações.");
    }
    setIsLoading(false);
  };

  const fetchDeliveryConfig = async () => {
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
    }
  };

  const fetchGruposTamanhos = async () => {
    try {
      const gruposCol = collection(db, 'gruposTamanhos');
      const gruposSnapshot = await getDocs(gruposCol);
      const gruposList = gruposSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GrupoTamanho));
      setGruposTamanhos(gruposList);
    } catch (err) {
      console.error("Erro ao carregar grupos de tamanhos: ", err);
    }
  };

  const fetchCuponsDesconto = async () => {
    try {
      const cuponsCol = collection(db, 'cuponsDesconto');
      const cuponsSnapshot = await getDocs(cuponsCol);
      const cuponsList = cuponsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CupomDesconto));
      setCuponsDesconto(cuponsList);
    } catch (err) {
      console.error("Erro ao carregar cupons de desconto: ", err);
    }
  };

  // Funções para geocodificação (mantidas do arquivo original)
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
    }
  };

  const fetchCoordinatesFromMapbox = async (addressQuery: string) => {
    setIsFetchingAddress(true);
    setError(null);
    try {
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
      setError(`Falha ao obter coordenadas: ${err.message}`);
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
        await fetchCoordinatesFromMapbox(viaCepAddress);
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
    
    let fullAddress = storeAddressInput.trim();
    if (storeNumber) {
      fullAddress += `, ${storeNumber}`;
    }
    
    await fetchCoordinatesFromMapbox(fullAddress);
  };

  // Funções para salvar configurações
  const handleSaveDeliveryConfig = async () => {
    if (radius === "" || !storeAddressInput.trim() || deliveryFeePerKm === "" || minDeliveryDistanceForFee === "") {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (storeLat === null || storeLng === null) {
        setError("Não foi possível obter as coordenadas para o endereço da loja.");
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
      setSuccessMessage("Configurações de entrega salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar configurações de entrega: ", err);
      setError("Falha ao salvar as configurações. Tente novamente.");
    }
    setIsSaving(false);
  };

  // Funções para grupos de tamanhos
  const handleSaveGrupoTamanho = async (grupo: Omit<GrupoTamanho, 'id'>) => {
    try {
      if (editingGrupo) {
        const grupoRef = doc(db, 'gruposTamanhos', editingGrupo.id);
        await updateDoc(grupoRef, grupo);
        setSuccessMessage("Grupo de tamanhos atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'gruposTamanhos'), grupo);
        setSuccessMessage("Grupo de tamanhos criado com sucesso!");
      }
      await fetchGruposTamanhos();
      setShowGrupoForm(false);
      setEditingGrupo(null);
    } catch (err) {
      console.error("Erro ao salvar grupo de tamanhos: ", err);
      setError("Falha ao salvar grupo de tamanhos.");
    }
  };

  const handleDeleteGrupoTamanho = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este grupo de tamanhos?")) {
      try {
        await deleteDoc(doc(db, 'gruposTamanhos', id));
        await fetchGruposTamanhos();
        setSuccessMessage("Grupo de tamanhos excluído com sucesso!");
      } catch (err) {
        console.error("Erro ao excluir grupo de tamanhos: ", err);
        setError("Falha ao excluir grupo de tamanhos.");
      }
    }
  };

  // Funções para cupons de desconto
  const handleSaveCupomDesconto = async (cupom: Omit<CupomDesconto, 'id'>) => {
    try {
      if (editingCupom) {
        const cupomRef = doc(db, 'cuponsDesconto', editingCupom.id);
        await updateDoc(cupomRef, cupom);
        setSuccessMessage("Cupom de desconto atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'cuponsDesconto'), cupom);
        setSuccessMessage("Cupom de desconto criado com sucesso!");
      }
      await fetchCuponsDesconto();
      setShowCupomForm(false);
      setEditingCupom(null);
    } catch (err) {
      console.error("Erro ao salvar cupom de desconto: ", err);
      setError("Falha ao salvar cupom de desconto.");
    }
  };

  const handleDeleteCupomDesconto = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este cupom de desconto?")) {
      try {
        await deleteDoc(doc(db, 'cuponsDesconto', id));
        await fetchCuponsDesconto();
        setSuccessMessage("Cupom de desconto excluído com sucesso!");
      } catch (err) {
        console.error("Erro ao excluir cupom de desconto: ", err);
        setError("Falha ao excluir cupom de desconto.");
      }
    }
  };

  if (authLoading || (user && isLoading)) {
    return <div className={styles.container}><p>A carregar...</p></div>;
  }

  if (!user) {
    return <div className={styles.container}><p>A redirecionar para o login...</p></div>;
  }

  const staticMapUrl = storeLat && storeLng 
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${storeLng-0.01}%2C${storeLat-0.01}%2C${storeLng+0.01}%2C${storeLat+0.01}&layer=mapnik&marker=${storeLat}%2C${storeLng}`
    : '';

  return (
    <div className={styles.container}>
      <h1>Configurações do Sistema</h1>
      {error && <p className={styles.error}>{error}</p>}
      {successMessage && <p className={styles.success}>{successMessage}</p>}
      
      {/* Sistema de Abas */}
      <div className={styles.tabContainer}>
        <div className={styles.tabButtons}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'loja' ? styles.active : ''}`}
            onClick={() => setActiveTab('loja')}
          >
            🏪 Loja & Entrega
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'horarios' ? styles.active : ''}`}
            onClick={() => setActiveTab('horarios')}
          >
            🕒 Horários
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'tamanhos' ? styles.active : ''}`}
            onClick={() => setActiveTab('tamanhos')}
          >
            📏 Tamanhos
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'promocoes' ? styles.active : ''}`}
            onClick={() => setActiveTab('promocoes')}
          >
            🎯 Promoções
          </button>
        </div>

        <div className={styles.tabContent}>
          {/* Aba Loja & Entrega */}
          {activeTab === 'loja' && (
            <div className={styles.tabPanel}>
              <h2>Configurações de Loja e Entrega</h2>
              
              <div className={styles.formGroup}>
                <label htmlFor="storeAddressInput">Endereço da Loja (CEP ou Endereço Completo):</label>
                <input 
                  type="text"
                  id="storeAddressInput"
                  value={storeAddressInput}
                  onChange={(e) => setStoreAddressInput(e.target.value)}
                  onBlur={handleCepBlur}
                  placeholder="Digite o CEP ou o endereço completo da loja"
                  className={styles.inputField}
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
                    className={styles.inputField}
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
                    className={styles.inputField}
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

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="radius">Raio de Entrega (km):</label>
                  <input 
                    type="number"
                    id="radius"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 10"
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="deliveryFeePerKm">Taxa de entrega por KM (R$):</label>
                  <input 
                    type="number"
                    step="0.01"
                    id="deliveryFeePerKm"
                    value={deliveryFeePerKm}
                    onChange={(e) => setDeliveryFeePerKm(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 2.50"
                    className={styles.inputField}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="minDeliveryDistanceForFee">Distância mínima para taxa (km):</label>
                <input 
                  type="number"
                  step="0.1"
                  id="minDeliveryDistanceForFee"
                  value={minDeliveryDistanceForFee}
                  onChange={(e) => setMinDeliveryDistanceForFee(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 3"
                  className={styles.inputField}
                />
              </div>

              {staticMapUrl && (
                <div className={styles.mapContainer}>
                  <h3>Localização da Loja</h3>
                  <iframe 
                    src={staticMapUrl}
                    width="100%" 
                    height="300"
                    style={{ border: 'none', borderRadius: '8px' }}
                    title="Mapa da localização da loja"
                  />
                </div>
              )}

              <div className={styles.formActions}>
                <button 
                  onClick={handleSaveDeliveryConfig}
                  disabled={isSaving}
                  className={styles.saveButton}
                >
                  {isSaving ? 'Salvando...' : 'Salvar Configurações de Loja'}
                </button>
              </div>
            </div>
          )}

          {/* Aba Horários */}
          {activeTab === 'horarios' && (
            <div className={styles.tabPanel}>
              <ScheduleSettings 
                onSave={() => setSuccessMessage("Configurações de agendamento salvas com sucesso!")}
                onError={(errorMsg) => setError(errorMsg)}
              />
            </div>
          )}

          {/* Aba Tamanhos */}
          {activeTab === 'tamanhos' && (
            <div className={styles.tabPanel}>
              <div className={styles.sectionHeader}>
                <h2>Gestão de Grupos de Tamanhos</h2>
                <button 
                  onClick={() => {
                    setEditingGrupo(null);
                    setShowGrupoForm(true);
                  }}
                  className={styles.addButton}
                >
                  + Novo Grupo
                </button>
              </div>

              {showGrupoForm && (
                <GrupoTamanhoForm 
                  grupo={editingGrupo}
                  onSave={handleSaveGrupoTamanho}
                  onCancel={() => {
                    setShowGrupoForm(false);
                    setEditingGrupo(null);
                  }}
                />
              )}

              <div className={styles.gruposList}>
                {gruposTamanhos.map(grupo => (
                  <div key={grupo.id} className={styles.grupoCard}>
                    <div className={styles.grupoHeader}>
                      <h3>{grupo.nome}</h3>
                      <div className={styles.grupoActions}>
                        <button 
                          onClick={() => {
                            setEditingGrupo(grupo);
                            setShowGrupoForm(true);
                          }}
                          className={styles.editButton}
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteGrupoTamanho(grupo.id)}
                          className={styles.removeButton}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                    {grupo.descricao && <p className={styles.grupoDescription}>{grupo.descricao}</p>}
                    <div className={styles.tamanhosList}>
                      {grupo.tamanhos.map((tamanho, index) => (
                        <div key={index} className={styles.tamanhoItem}>
                          <span className={styles.tamanhoNome}>{tamanho.tamanho}</span>
                          {tamanho.descricao && <span className={styles.tamanhoDesc}>({tamanho.descricao})</span>}
                          <span className={styles.tamanhoPreco}>R$ {tamanho.preco.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.grupoStatus}>
                      Status: <span className={grupo.ativo ? styles.ativo : styles.inativo}>
                        {grupo.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {gruposTamanhos.length === 0 && (
                <div className={styles.emptyState}>
                  <p>Nenhum grupo de tamanhos configurado.</p>
                  <p>Crie seu primeiro grupo para organizar os tamanhos dos seus produtos.</p>
                </div>
              )}
            </div>
          )}

          {/* Aba Promoções */}
          {activeTab === 'promocoes' && (
            <div className={styles.tabPanel}>
              <div className={styles.sectionHeader}>
                <h2>Sistema de Promoções</h2>
                <button 
                  onClick={() => {
                    setEditingCupom(null);
                    setShowCupomForm(true);
                  }}
                  className={styles.addButton}
                >
                  + Novo Cupom
                </button>
              </div>

              {showCupomForm && (
                <CupomDescontoForm 
                  cupom={editingCupom}
                  onSave={handleSaveCupomDesconto}
                  onCancel={() => {
                    setShowCupomForm(false);
                    setEditingCupom(null);
                  }}
                />
              )}

              <div className={styles.cupomsList}>
                {cuponsDesconto.map(cupom => (
                  <div key={cupom.id} className={styles.cupomCard}>
                    <div className={styles.cupomHeader}>
                      <h3>{cupom.codigo}</h3>
                      <div className={styles.cupomActions}>
                        <button 
                          onClick={() => {
                            setEditingCupom(cupom);
                            setShowCupomForm(true);
                          }}
                          className={styles.editButton}
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteCupomDesconto(cupom.id)}
                          className={styles.removeButton}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                    <div className={styles.cupomDetails}>
                      <p>
                        <strong>Desconto:</strong> {cupom.tipo === 'percentual' ? `${cupom.valor}%` : `R$ ${cupom.valor.toFixed(2)}`}
                      </p>
                      {cupom.valorMinimo && (
                        <p><strong>Valor mínimo:</strong> R$ {cupom.valorMinimo.toFixed(2)}</p>
                      )}
                      <p><strong>Período:</strong> {cupom.dataInicio} até {cupom.dataFim}</p>
                      {cupom.usoMaximo && (
                        <p><strong>Uso:</strong> {cupom.usoAtual}/{cupom.usoMaximo}</p>
                      )}
                    </div>
                    <div className={styles.cupomStatus}>
                      Status: <span className={cupom.ativo ? styles.ativo : styles.inativo}>
                        {cupom.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {cuponsDesconto.length === 0 && (
                <div className={styles.emptyState}>
                  <p>Nenhum cupom de desconto configurado.</p>
                  <p>Crie seu primeiro cupom para oferecer promoções aos seus clientes.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente para formulário de grupo de tamanhos
const GrupoTamanhoForm: React.FC<{
  grupo: GrupoTamanho | null;
  onSave: (grupo: Omit<GrupoTamanho, 'id'>) => void;
  onCancel: () => void;
}> = ({ grupo, onSave, onCancel }) => {
  const [nome, setNome] = useState(grupo?.nome || '');
  const [descricao, setDescricao] = useState(grupo?.descricao || '');
  const [tamanhos, setTamanhos] = useState<TamanhoPreco[]>(grupo?.tamanhos || []);
  const [ativo, setAtivo] = useState(grupo?.ativo ?? true);

  const handleAddTamanho = () => {
    setTamanhos([...tamanhos, { tamanho: '', preco: 0, descricao: '' }]);
  };

  const handleRemoveTamanho = (index: number) => {
    setTamanhos(tamanhos.filter((_, i) => i !== index));
  };

  const handleTamanhoChange = (index: number, field: keyof TamanhoPreco, value: string | number) => {
    const newTamanhos = [...tamanhos];
    newTamanhos[index] = { ...newTamanhos[index], [field]: value };
    setTamanhos(newTamanhos);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Nome do grupo é obrigatório');
      return;
    }
    if (tamanhos.length === 0) {
      alert('Adicione pelo menos um tamanho');
      return;
    }
    
    onSave({
      nome: nome.trim(),
      descricao: descricao.trim(),
      tamanhos: tamanhos.filter(t => t.tamanho.trim() && t.preco > 0),
      ativo
    });
  };

  return (
    <div className={styles.formModal}>
      <form onSubmit={handleSubmit} className={styles.grupoForm}>
        <h3>{grupo ? 'Editar Grupo' : 'Novo Grupo'} de Tamanhos</h3>
        
        <div className={styles.formGroup}>
          <label>Nome do Grupo:</label>
          <input 
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Pizzas, Bebidas, Sobremesas"
            className={styles.inputField}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label>Descrição (opcional):</label>
          <input 
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição do grupo"
            className={styles.inputField}
          />
        </div>

        <div className={styles.formGroup}>
          <label>
            <input 
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Grupo ativo
          </label>
        </div>

        <div className={styles.tamanhosSection}>
          <div className={styles.sectionHeader}>
            <h4>Tamanhos</h4>
            <button type="button" onClick={handleAddTamanho} className={styles.addButton}>
              + Adicionar Tamanho
            </button>
          </div>

          {tamanhos.map((tamanho, index) => (
            <div key={index} className={styles.tamanhoFormRow}>
              <input 
                type="text"
                value={tamanho.tamanho}
                onChange={(e) => handleTamanhoChange(index, 'tamanho', e.target.value)}
                placeholder="Nome do tamanho"
                className={styles.inputField}
              />
              <input 
                type="text"
                value={tamanho.descricao}
                onChange={(e) => handleTamanhoChange(index, 'descricao', e.target.value)}
                placeholder="Descrição (ex: 25cm)"
                className={styles.inputField}
              />
              <input 
                type="number"
                step="0.01"
                value={tamanho.preco}
                onChange={(e) => handleTamanhoChange(index, 'preco', Number(e.target.value))}
                placeholder="Preço"
                className={styles.inputField}
              />
              <button 
                type="button"
                onClick={() => handleRemoveTamanho(index)}
                className={styles.removeButton}
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <div className={styles.formActions}>
          <button type="button" onClick={onCancel} className={styles.cancelButton}>
            Cancelar
          </button>
          <button type="submit" className={styles.saveButton}>
            {grupo ? 'Atualizar' : 'Criar'} Grupo
          </button>
        </div>
      </form>
    </div>
  );
};

// Componente para formulário de cupom de desconto
const CupomDescontoForm: React.FC<{
  cupom: CupomDesconto | null;
  onSave: (cupom: Omit<CupomDesconto, 'id'>) => void;
  onCancel: () => void;
}> = ({ cupom, onSave, onCancel }) => {
  const [codigo, setCodigo] = useState(cupom?.codigo || '');
  const [tipo, setTipo] = useState<'percentual' | 'valor_fixo'>(cupom?.tipo || 'percentual');
  const [valor, setValor] = useState(cupom?.valor || 0);
  const [valorMinimo, setValorMinimo] = useState(cupom?.valorMinimo || '');
  const [usoMaximo, setUsoMaximo] = useState(cupom?.usoMaximo || '');
  const [dataInicio, setDataInicio] = useState(cupom?.dataInicio || '');
  const [dataFim, setDataFim] = useState(cupom?.dataFim || '');
  const [ativo, setAtivo] = useState(cupom?.ativo ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) {
      alert('Código do cupom é obrigatório');
      return;
    }
    if (valor <= 0) {
      alert('Valor do desconto deve ser maior que zero');
      return;
    }
    if (!dataInicio || !dataFim) {
      alert('Datas de início e fim são obrigatórias');
      return;
    }
    
    onSave({
      codigo: codigo.trim().toUpperCase(),
      tipo,
      valor,
      valorMinimo: valorMinimo ? Number(valorMinimo) : undefined,
      usoMaximo: usoMaximo ? Number(usoMaximo) : undefined,
      usoAtual: cupom?.usoAtual || 0,
      dataInicio,
      dataFim,
      ativo
    });
  };

  return (
    <div className={styles.formModal}>
      <form onSubmit={handleSubmit} className={styles.cupomForm}>
        <h3>{cupom ? 'Editar Cupom' : 'Novo Cupom'} de Desconto</h3>
        
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Código do Cupom:</label>
            <input 
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: PIZZA10"
              className={styles.inputField}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Tipo de Desconto:</label>
            <select 
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'percentual' | 'valor_fixo')}
              className={styles.selectField}
            >
              <option value="percentual">Percentual (%)</option>
              <option value="valor_fixo">Valor Fixo (R$)</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Valor do Desconto:</label>
            <input 
              type="number"
              step={tipo === 'percentual' ? '1' : '0.01'}
              value={valor}
              onChange={(e) => setValor(Number(e.target.value))}
              placeholder={tipo === 'percentual' ? 'Ex: 10' : 'Ex: 10.00'}
              className={styles.inputField}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Valor Mínimo (opcional):</label>
            <input 
              type="number"
              step="0.01"
              value={valorMinimo}
              onChange={(e) => setValorMinimo(e.target.value)}
              placeholder="Ex: 50.00"
              className={styles.inputField}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Data de Início:</label>
            <input 
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className={styles.inputField}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Data de Fim:</label>
            <input 
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className={styles.inputField}
              required
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Uso Máximo (opcional):</label>
            <input 
              type="number"
              value={usoMaximo}
              onChange={(e) => setUsoMaximo(e.target.value)}
              placeholder="Ex: 100"
              className={styles.inputField}
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <input 
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Cupom ativo
            </label>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" onClick={onCancel} className={styles.cancelButton}>
            Cancelar
          </button>
          <button type="submit" className={styles.saveButton}>
            {cupom ? 'Atualizar' : 'Criar'} Cupom
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettingsImproved;

