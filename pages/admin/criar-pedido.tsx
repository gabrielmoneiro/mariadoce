import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/context/ToastContext';
import AddressCepFlow from '@/components/AddressCepFlow';
import { getRouteDistance } from '@/lib/mapboxService';
import styles from '@/styles/AdminCriarPedido.module.css'; // Criar este ficheiro CSS
import { PedidoDataInput } from '@/lib/schemas/pedidoSchema'; // Reutilizar schema se possível

// Interfaces (adaptadas dos ficheiros analisados)
interface Cliente {
  nome: string;
  telefone: string;
}

interface EnderecoEntrega {
  fullAddress: string;
  lat: number | null;
  lng: number | null;
  cep?: string;
  numero?: string;
  complemento?: string;
  referencia?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface TamanhoPreco {
  tamanho: string;
  preco: number;
}

interface OpcaoAdicional {
  nome: string;
  preco?: number;
  limiteMaximo?: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  tamanhosPrecos: TamanhoPreco[];
  categoryId: string;
  categoryName?: string;
  addons: OpcaoAdicional[];
  imageUrl?: string;
}

interface ItemPedidoForm {
  productId: string;
  productName: string;
  tamanho: string;
  quantidade: number;
  precoUnitario: number;
  adicionaisSelecionados: { nome: string; preco: number }[];
  observacoesItem?: string;
  subtotalItem: number;
}

interface DeliveryConfig {
  storeLat: number | null;
  storeLng: number | null;
  deliveryFeePerKm?: number;
  minDeliveryDistanceForFee?: number;
}

interface ScheduleSelection {
  date: string; // Formato "YYYY-MM-DD"
  timeWindow: string; // Formato "HH:MM-HH:MM"
}

const AdminCriarPedido = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  // Form State
  const [cliente, setCliente] = useState<Cliente>({ nome: '', telefone: '' });
  const [itensPedido, setItensPedido] = useState<ItemPedidoForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedTamanho, setSelectedTamanho] = useState<TamanhoPreco | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, { nome: string; preco: number; count: number }>>(new Map());
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemObservacoes, setItemObservacoes] = useState('');

  const [enderecoEntrega, setEnderecoEntrega] = useState<EnderecoEntrega | null>(null);
  const [numeroEndereco, setNumeroEndereco] = useState('');
  const [complementoEndereco, setComplementoEndereco] = useState('');
  const [referenciaEndereco, setReferenciaEndereco] = useState('');
  const numeroInputRef = useRef<HTMLInputElement | null>(null);
  const [taxaEntrega, setTaxaEntrega] = useState<number>(0);
  const [calculatingFee, setCalculatingFee] = useState(false);

  const [tipoEntrega, setTipoEntrega] = useState<'imediata' | 'agendada'>('imediata');
  const [scheduleSelection, setScheduleSelection] = useState<ScheduleSelection | null>(null);
  // TODO: Implementar componente de seleção de agendamento se tipoEntrega === 'agendada'
  // Baseado em ScheduleSettings.tsx (que não foi encontrado, mas a lógica pode estar em AdminSettingsPage)

  const [formaPagamento, setFormaPagamento] = useState('');
  const [trocoPara, setTrocoPara] = useState('');
  const [observacoesGerais, setObservacoesGerais] = useState('');

  // Totals
  const subtotalItens = itensPedido.reduce((acc, item) => acc + item.subtotalItem, 0);
  const totalPedido = subtotalItens + taxaEntrega;

  // --- Effects --- 

  // Auth Check
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

  // Fetch Products
  useEffect(() => {
    if (!user) return;
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const productsCol = collection(db, 'products');
        const productSnapshot = await getDocs(productsCol);
        const productsList = productSnapshot.docs.map(doc => {
          const data = doc.data();
          // Basic mapping, adjust if needed based on actual Product structure
          return {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            tamanhosPrecos: data.tamanhosPrecos || [],
            categoryId: data.categoryId || '',
            categoryName: data.categoryName || '',
            addons: data.addons || [],
            imageUrl: data.imageUrl,
          } as Product;
        });
        setProducts(productsList);
      } catch (error) {
        console.error("Erro ao buscar produtos: ", error);
        addToast('Falha ao carregar produtos.', 'error');
      }
      setProductsLoading(false);
    };
    fetchProducts();
  }, [user, addToast]);

  // Fetch Delivery Config
  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      setConfigLoading(true);
      try {
        const configRef = doc(db, 'config', 'deliveryConfig');
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const configData = docSnap.data() as DeliveryConfig;
          setDeliveryConfig(configData);
        } else {
          addToast('Configurações de entrega não encontradas. Defina-as em /admin/settings.', 'error');
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de entrega: ", err);
        addToast('Falha ao carregar configurações de entrega.', 'error');
      }
      setConfigLoading(false);
    };
    fetchConfig();
  }, [user, addToast]);

  // --- Callbacks --- 

  // Address Selection from AddressCepFlow
  const handleAddressSelect = useCallback((address: EnderecoEntrega, focusOnNumero: boolean) => {
    setEnderecoEntrega(address);
    if (focusOnNumero && numeroInputRef.current) {
      numeroInputRef.current.focus();
    }
  }, []);

  // CEP Change from AddressCepFlow (for fee calculation trigger)
  const handleCepChange = useCallback(async (cep: string) => {
    // Reset fee when CEP changes
    setTaxaEntrega(0);
    // Update address state partially
    setEnderecoEntrega(prev => ({ ...(prev ?? { fullAddress: '', lat: null, lng: null }), cep }));
  }, []);

  // Calculate Delivery Fee
  const calculateFee = useCallback(async () => {
    if (!enderecoEntrega?.lat || !enderecoEntrega?.lng || !deliveryConfig?.storeLat || !deliveryConfig?.storeLng) {
      // Don't calculate if coordinates are missing
      setTaxaEntrega(0);
      return;
    }

    setCalculatingFee(true);
    try {
      const distanceMeters = await getRouteDistance(
        deliveryConfig.storeLng,
        deliveryConfig.storeLat,
        enderecoEntrega.lng,
        enderecoEntrega.lat,
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '' // Ensure you have this env var
        // Consider profile: 'mapbox/driving' or 'mapbox/cycling' based on config
      );

      if (distanceMeters !== null) {
        const distanceKm = distanceMeters / 1000;
        const feePerKm = deliveryConfig.deliveryFeePerKm ?? 0;
        const minDistance = deliveryConfig.minDeliveryDistanceForFee ?? 0;
        let calculatedFee = 0;
        if (distanceKm > minDistance && feePerKm > 0) {
          // Example: charge only for distance exceeding the minimum
          // calculatedFee = (distanceKm - minDistance) * feePerKm;
          // Or charge for the full distance if it exceeds minimum
          calculatedFee = distanceKm * feePerKm;
        }
        // Apply rounding or ceiling as needed
        setTaxaEntrega(Math.ceil(calculatedFee * 100) / 100); // Example: Round up to 2 decimal places
        addToast(`Taxa de entrega calculada: R$ ${calculatedFee.toFixed(2)}`, 'success');
      } else {
        setTaxaEntrega(0);
        addToast('Não foi possível calcular a distância para a taxa de entrega.', 'error');
      }
    } catch (error) {
      console.error("Erro ao calcular taxa de entrega: ", error);
      setTaxaEntrega(0);
      addToast('Erro ao calcular taxa de entrega.', 'error');
    } finally {
      setCalculatingFee(false);
    }
  }, [enderecoEntrega, deliveryConfig, addToast]);

  // Recalculate fee when address or config changes
  useEffect(() => {
    if (enderecoEntrega?.lat && enderecoEntrega?.lng && deliveryConfig?.storeLat && deliveryConfig?.storeLng) {
      calculateFee();
    }
  }, [enderecoEntrega, deliveryConfig, calculateFee]);

  // Product Search Filter
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add Item to Order
  const handleAddItem = () => {
    if (!selectedProduct || !selectedTamanho) {
      addToast('Selecione um produto e um tamanho.', 'error');
      return;
    }

    let precoAdicionais = 0;
    const adicionaisSelecionadosArray: { nome: string; preco: number }[] = [];
    selectedAddons.forEach((addon) => {
      for (let i = 0; i < addon.count; i++) {
        precoAdicionais += addon.preco;
        adicionaisSelecionadosArray.push({ nome: addon.nome, preco: addon.preco });
      }
    });

    const precoUnitarioTotal = selectedTamanho.preco + precoAdicionais;
    const subtotalItem = precoUnitarioTotal * itemQuantity;

    const newItem: ItemPedidoForm = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      tamanho: selectedTamanho.tamanho,
      quantidade: itemQuantity,
      precoUnitario: precoUnitarioTotal, // Preço unitário já inclui adicionais
      adicionaisSelecionados: adicionaisSelecionadosArray,
      observacoesItem: itemObservacoes,
      subtotalItem: subtotalItem,
    };

    setItensPedido([...itensPedido, newItem]);

    // Reset item selection
    setSelectedProduct(null);
    setSelectedTamanho(null);
    setSelectedAddons(new Map());
    setItemQuantity(1);
    setItemObservacoes('');
    setSearchTerm('');
  };

  // Remove Item from Order
  const handleRemoveItem = (index: number) => {
    setItensPedido(itensPedido.filter((_, i) => i !== index));
  };

  // Handle Addon Selection Change
  const handleAddonChange = (addon: OpcaoAdicional, checked: boolean) => {
    const currentAddons = new Map(selectedAddons);
    const addonKey = addon.nome;
    const currentAddonState = currentAddons.get(addonKey);
    const addonPrice = addon.preco ?? 0;
    const maxLimit = addon.limiteMaximo;

    if (checked) {
      const newCount = (currentAddonState?.count ?? 0) + 1;
      if (maxLimit === undefined || newCount <= maxLimit) {
        currentAddons.set(addonKey, { nome: addon.nome, preco: addonPrice, count: newCount });
      }
    } else {
      if (currentAddonState && currentAddonState.count > 0) {
        const newCount = currentAddonState.count - 1;
        if (newCount === 0) {
          currentAddons.delete(addonKey);
        } else {
          currentAddons.set(addonKey, { ...currentAddonState, count: newCount });
        }
      }
    }
    setSelectedAddons(currentAddons);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast('Erro: Utilizador não autenticado.', 'error');
      return;
    }
    if (itensPedido.length === 0) {
      addToast('Adicione pelo menos um item ao pedido.', 'error');
      return;
    }
    if (!enderecoEntrega?.fullAddress || !enderecoEntrega.lat || !enderecoEntrega.lng) {
      addToast('Confirme o endereço de entrega.', 'error');
      return;
    }
    if (!formaPagamento) {
      addToast('Selecione a forma de pagamento.', 'error');
      return;
    }
    if (formaPagamento === 'Dinheiro' && trocoPara) {
        const trocoNum = parseFloat(trocoPara);
        if (isNaN(trocoNum) || trocoNum < totalPedido) {
            addToast('Valor do troco inválido.', 'error');
            return;
        }
    }
    if (tipoEntrega === 'agendada' && !scheduleSelection) {
      addToast('Selecione a data e hora para o agendamento.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const pedidoParaSalvar: Omit<PedidoDataInput, 'scheduleSelection'> & { 
          dataPedido: Timestamp; 
          statusPedido: string; 
          origemPedido: string; 
          uidCliente?: string; // Adicionado para consistência, mas não obrigatório aqui
          scheduleSelection?: ScheduleSelection | null; // Adicionado
          // Valores reais calculados
          valores: { 
              subtotalItensReal: number; 
              taxaEntrega: number; 
              totalPedidoReal: number; 
              descontos?: number; 
          }
          // Itens com dados reais
          itensPedido: Array<{ 
              idProduto: string; 
              nomeProduto: string; 
              quantidade: number; 
              tamanho?: string; 
              adicionais?: string; // Simplificado para string por enquanto
              observacoesItem?: string; 
              precoUnitarioReal: number; 
              subtotalReal: number; 
          }>;
      } = {
        cliente: cliente,
        enderecoEntrega: {
          ...enderecoEntrega,
          numero: numeroEndereco, // Garantir que o número está aqui
          complemento: complementoEndereco,
          referencia: referenciaEndereco,
          lat: enderecoEntrega.lat || undefined,
          lng: enderecoEntrega.lng || undefined,
        },
        itensPedido: itensPedido.map(item => ({
          idProduto: item.productId,
          nomeProduto: item.productName,
          quantidade: item.quantidade,
          tamanho: item.tamanho,
          adicionais: item.adicionaisSelecionados.map(a => `${a.nome} (R$ ${a.preco.toFixed(2)})`).join(', '),
          observacoesItem: item.observacoesItem,
          precoUnitario: item.precoUnitario, // Já calculado incluindo adicionais
          subtotal: item.subtotalItem,
          precoUnitarioReal: item.precoUnitario,
          subtotalReal: item.subtotalItem,
        })),
        formaPagamento: formaPagamento,
        trocoPara: formaPagamento === 'Dinheiro' ? trocoPara : undefined,
        observacoesGerais: observacoesGerais,
        valores: {
          subtotalItens: subtotalItens,
          subtotalItensReal: subtotalItens,
          taxaEntrega: taxaEntrega,
          totalPedido: totalPedido,
          totalPedidoReal: totalPedido,
        },
        dataPedido: Timestamp.now(),
        statusPedido: tipoEntrega === 'agendada' ? 'Agendado' : 'Recebido', // Ou outro status inicial desejado
        origemPedido: 'AdminManual', // Identificador claro
        scheduleSelection: tipoEntrega === 'agendada' ? scheduleSelection : null,
      };

      const pedidoRef = await addDoc(collection(db, 'pedidos'), pedidoParaSalvar);
      addToast(`Pedido ${pedidoRef.id} criado com sucesso!`, 'success');

      // Reset form
      setCliente({ nome: '', telefone: '' });
      setItensPedido([]);
      setEnderecoEntrega(null);
      setNumeroEndereco('');
      setComplementoEndereco('');
      setReferenciaEndereco('');
      setTaxaEntrega(0);
      setTipoEntrega('imediata');
      setScheduleSelection(null);
      setFormaPagamento('');
      setTrocoPara('');
      setObservacoesGerais('');
      // Considerar limpar o AddressCepFlow também, se possível

    } catch (error) {
      console.error("Erro ao criar pedido: ", error);
      addToast('Falha ao criar o pedido. Verifique o console para detalhes.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render --- 

  if (authLoading || configLoading) {
    return <div className={styles.container}><p>A carregar...</p></div>;
  }

  if (!user) {
    return null; // Redirect handled by useEffect
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className={styles.container}>
      <h1>Criar Novo Pedido</h1>

      {/* Formulário de Cliente */}
      <section className={styles.formSection}>
        <h2>Dados do Cliente</h2>
        <div className={styles.formGroup}>
          <label htmlFor="clienteNome">Nome do Cliente:</label>
          <input
            type="text"
            id="clienteNome"
            value={cliente.nome}
            onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
            placeholder="Nome completo do cliente"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="clienteTelefone">Telefone do Cliente:</label>
          <input
            type="text"
            id="clienteTelefone"
            value={cliente.telefone}
            onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })}
            placeholder="(XX) XXXXX-XXXX"
          />
        </div>
      </section>

      {/* Seleção de Produtos */}
      <section className={styles.formSection}>
        <h2>Adicionar Itens ao Pedido</h2>
        <div className={styles.formGroup}>
          <label htmlFor="searchProduct">Buscar Produto:</label>
          <input
            type="text"
            id="searchProduct"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite o nome do produto"
          />
        </div>

        {productsLoading ? (
          <p>A carregar produtos...</p>
        ) : (
          <div className={styles.productList}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <div key={product.id} className={styles.productItem} onClick={() => setSelectedProduct(product)}>
                  {product.imageUrl && <img src={product.imageUrl} alt={product.name} className={styles.productImage} />}
                  <div className={styles.productInfo}>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <p>Categoría: {product.categoryName}</p>
                  </div>
                </div>
              ))
            ) : (
              <p>Nenhum produto encontrado.</p>
            )}
          </div>
        )}

        {selectedProduct && (
          <div className={styles.selectedProductCard}>
            <h3>Produto Selecionado: {selectedProduct.name}</h3>
            <div className={styles.formGroup}>
              <label htmlFor="tamanho">Tamanho:</label>
              <select
                id="tamanho"
                value={selectedTamanho?.tamanho || ''}
                onChange={(e) => setSelectedTamanho(selectedProduct.tamanhosPrecos.find(tp => tp.tamanho === e.target.value) || null)}
              >
                <option value="">Selecione um tamanho</option>
                {selectedProduct.tamanhosPrecos.map(tp => (
                  <option key={tp.tamanho} value={tp.tamanho}>
                    {tp.tamanho} - {formatCurrency(tp.preco)}
                  </option>
                ))}
              </select>
            </div>

            {selectedTamanho && selectedProduct.addons.length > 0 && (
              <div className={styles.formGroup}>
                <label>Adicionais:</label>
                <div className={styles.addonsGrid}>
                  {selectedProduct.addons.map(addon => {
                    const currentAddonState = selectedAddons.get(addon.nome);
                    const count = currentAddonState?.count || 0;
                    return (
                      <div key={addon.nome} className={styles.addonItem}>
                        <label>
                          <input
                            type="checkbox"
                            checked={count > 0}
                            onChange={(e) => handleAddonChange(addon, e.target.checked)}
                          />
                          {addon.nome} {addon.preco ? `(${formatCurrency(addon.preco)})` : ''}
                        </label>
                        {addon.limiteMaximo !== undefined && addon.limiteMaximo > 1 && (
                          <div className={styles.addonQuantityControls}>
                            <button type="button" onClick={() => handleAddonChange(addon, false)} disabled={count === 0}>-</button>
                            <span>{count}</span>
                            <button type="button" onClick={() => handleAddonChange(addon, true)} disabled={count >= (addon.limiteMaximo || Infinity)}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="quantidade">Quantidade:</label>
              <input
                type="number"
                id="quantidade"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="observacoesItem">Observações do Item:</label>
              <textarea
                id="observacoesItem"
                value={itemObservacoes}
                onChange={(e) => setItemObservacoes(e.target.value)}
                rows={2}
                placeholder="Ex: Sem cebola, molho à parte"
              />
            </div>
            <button type="button" onClick={handleAddItem} className={styles.addButton}>
              Adicionar Item
            </button>
          </div>
        )}
      </section>

      {/* Itens do Pedido */}
      <section className={styles.formSection}>
        <h2>Itens do Pedido ({itensPedido.length})</h2>
        {itensPedido.length === 0 ? (
          <p>Nenhum item adicionado ao pedido ainda.</p>
        ) : (
          <div className={styles.orderItemsList}>
            {itensPedido.map((item, index) => (
              <div key={index} className={styles.orderItemCard}>
                <div className={styles.orderItemDetails}>
                  <h3>{item.productName} ({item.tamanho}) x {item.quantidade}</h3>
                  {item.adicionaisSelecionados.length > 0 && (
                    <p>Adicionais: {item.adicionaisSelecionados.map(a => a.nome).join(', ')}</p>
                  )}
                  {item.observacoesItem && <p>Obs: {item.observacoesItem}</p>}
                  <p>Subtotal: {formatCurrency(item.subtotalItem)}</p>
                </div>
                <button type="button" onClick={() => handleRemoveItem(index)} className={styles.removeButton}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.orderSummary}>
          <p>Subtotal dos Itens: <strong>{formatCurrency(subtotalItens)}</strong></p>
          <p>Taxa de Entrega: <strong>{calculatingFee ? 'Calculando...' : formatCurrency(taxaEntrega)}</strong></p>
          <p>Total do Pedido: <strong>{formatCurrency(totalPedido)}</strong></p>
        </div>
      </section>

      {/* Endereço de Entrega */}
      <section className={styles.formSection}>
        <h2>Endereço de Entrega</h2>
        <AddressCepFlow
          onAddressSelect={handleAddressSelect}
          initialCep={enderecoEntrega?.cep || ''}
          onNumeroChange={setNumeroEndereco}
          onComplementoChange={setComplementoEndereco}
          onReferenciaChange={setReferenciaEndereco}
          numeroValue={numeroEndereco}
          complementoValue={complementoEndereco}
          referenciaValue={referenciaEndereco}
          numeroInputRef={numeroInputRef}
          onCepChange={handleCepChange}
        />
        {enderecoEntrega && (
          <div className={styles.currentAddressDisplay}>
            <p><strong>Endereço Selecionado:</strong> {enderecoEntrega.fullAddress}</p>
            <p>Número: {numeroEndereco}</p>
            {complementoEndereco && <p>Complemento: {complementoEndereco}</p>}
            {referenciaEndereco && <p>Referência: {referenciaEndereco}</p>}
          </div>
        )}
      </section>

      {/* Tipo de Entrega */}
      <section className={styles.formSection}>
        <h2>Tipo de Entrega</h2>
        <div className={styles.formGroup}>
          <label>
            <input
              type="radio"
              name="tipoEntrega"
              value="imediata"
              checked={tipoEntrega === 'imediata'}
              onChange={() => setTipoEntrega('imediata')}
            />
            Entrega Imediata
          </label>
          <label>
            <input
              type="radio"
              name="tipoEntrega"
              value="agendada"
              checked={tipoEntrega === 'agendada'}
              onChange={() => setTipoEntrega('agendada')}
            />
            Entrega Agendada
          </label>
        </div>
        {/* TODO: Adicionar componente de agendamento aqui se tipoEntrega for 'agendada' */}
      </section>

      {/* Forma de Pagamento */}
      <section className={styles.formSection}>
        <h2>Forma de Pagamento</h2>
        <div className={styles.formGroup}>
          <label htmlFor="formaPagamento">Selecione a Forma de Pagamento:</label>
          <select
            id="formaPagamento"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="CartaoCredito">Cartão de Crédito</option>
            <option value="CartaoDebito">Cartão de Débito</option>
            <option value="Pix">Pix</option>
          </select>
        </div>
        {formaPagamento === 'Dinheiro' && (
          <div className={styles.formGroup}>
            <label htmlFor="trocoPara">Troco para (opcional):</label>
            <input
              type="text"
              id="trocoPara"
              value={trocoPara}
              onChange={(e) => setTrocoPara(e.target.value)}
              placeholder="Ex: 50.00"
            />
          </div>
        )}
      </section>

      {/* Observações Gerais */}
      <section className={styles.formSection}>
        <h2>Observações Gerais</h2>
        <div className={styles.formGroup}>
          <label htmlFor="observacoesGerais">Observações:</label>
          <textarea
            id="observacoesGerais"
            value={observacoesGerais}
            onChange={(e) => setObservacoesGerais(e.target.value)}
            rows={3}
            placeholder="Observações gerais sobre o pedido ou entrega."
          />
        </div>
      </section>

      <button
        type="submit"
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Criando Pedido...' : 'Criar Pedido'}
      </button>
    </div>
  );
};

export default AdminCriarPedido;
