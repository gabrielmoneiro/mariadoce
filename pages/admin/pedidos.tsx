import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  DocumentData,
  QueryDocumentSnapshot,
  orderBy,
  where,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '@/styles/AdminPedidos.module.css';
import { useToast } from '@/context/ToastContext';

// Interfaces (mantidas como antes)
interface Cliente {
  nome: string;
  telefone: string;
}

interface EnderecoEntrega {
  fullAddress: string;
  lat?: number;
  lng?: number;
  cep?: string;
  numero?: string;
  complemento?: string;
  referencia?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface ItemPedido {
  idProduto: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  tamanho?: string;
  adicionais?: string;
  observacoesItem?: string;
}

interface Pedido {
  id: string;
  cliente: Cliente;
  enderecoEntrega: EnderecoEntrega;
  itensPedido: ItemPedido[];
  formaPagamento: string;
  trocoPara?: string;
  observacoesGerais?: string;
  valores: {
    subtotalItens: number;
    taxaEntrega: number;
    totalPedido: number;
    descontos?: number;
  };
  dataPedido: Date;
  statusPedido: string;
  origemPedido?: string;
  ultimaAtualizacao?: Date;
  atualizadoPor?: string;
}

const statusOptions = [
  { value: 'Recebido', color: '#3498db', icon: '📥' },
  { value: 'Em preparação', color: '#f39c12', icon: '👨‍🍳' },
  { value: 'Saiu para entrega', color: '#2ecc71', icon: '🚚' },
  { value: 'Entregue', color: '#27ae60', icon: '✅' },
  { value: 'Cancelado', color: '#e74c3c', icon: '❌' },
  { value: 'Agendado', color: '#9b59b6', icon: '📅' }
];

const AdminPedidos = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('hoje');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/admin/login');
      }
      setLoading(false);
    }, (error) => {
      console.error('Erro na verificação de autenticação:', error);
      addToast('Falha na verificação de autenticação.', 'error');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, addToast]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const constraints: QueryConstraint[] = [];

    if (dateFilter !== 'todos') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let startDate: Date | undefined;

      if (dateFilter === 'hoje') {
        startDate = today;
      } else if (dateFilter === 'ontem') {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
      } else if (dateFilter === 'semana') {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateFilter === 'mes') {
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 1);
      }

      if (startDate) {
        constraints.push(where('dataPedido', '>=', Timestamp.fromDate(startDate)));
      }
      if (dateFilter === 'hoje') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        constraints.push(where('dataPedido', '<', Timestamp.fromDate(tomorrow)));
      }
    }

    if (statusFilter !== 'todos') {
      constraints.push(where('statusPedido', '==', statusFilter));
    }

    constraints.push(orderBy('dataPedido', 'desc'));

    const pedidosQuery = query(collection(db, 'pedidos'), ...constraints);

    const unsubscribe = onSnapshot(pedidosQuery, (querySnapshot) => {
      const pedidosData: Pedido[] = [];
      querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        const valores = data.valores || {};
        pedidosData.push({
          id: docSnap.id,
          cliente: data.cliente || { nome: 'Cliente não identificado', telefone: '' },
          enderecoEntrega: data.enderecoEntrega || { fullAddress: 'Endereço não informado' },
          // CORREÇÃO: tipando o 'item' corretamente
          itensPedido: data.itensPedido?.map((item: ItemPedido) => ({
            ...item,
            precoUnitario: (item as any).precoUnitarioReal ?? item.precoUnitario,
            subtotal: (item as any).subtotalReal ?? item.subtotal,
          })) || [],
          formaPagamento: data.formaPagamento || 'Não informado',
          trocoPara: data.trocoPara,
          observacoesGerais: data.observacoesGerais,
          valores: {
            subtotalItens: valores.subtotalItensReal ?? valores.subtotalItens ?? 0,
            taxaEntrega: valores.taxaEntrega ?? 0,
            totalPedido: valores.totalPedidoReal ?? valores.totalPedido ?? 0,
            descontos: valores.descontos,
          },
          dataPedido: data.dataPedido?.toDate() || new Date(),
          statusPedido: data.statusPedido || 'Recebido',
          origemPedido: data.origemPedido || 'WebApp',
          ultimaAtualizacao: data.ultimaAtualizacao?.toDate(),
          atualizadoPor: data.atualizadoPor
        });
      });
      setPedidos(pedidosData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar pedidos: ", error);
      addToast('Falha ao carregar pedidos.', 'error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, dateFilter, statusFilter, addToast]);

  const filteredPedidos = useMemo(() => {
    if (!searchTerm) {
      return pedidos;
    }
    const term = searchTerm.toLowerCase();
    return pedidos.filter(pedido =>
      pedido.cliente.nome.toLowerCase().includes(term) ||
      pedido.cliente.telefone.includes(term) ||
      pedido.enderecoEntrega.fullAddress.toLowerCase().includes(term) ||
      pedido.id.toLowerCase().includes(term)
    );
  }, [pedidos, searchTerm]);

  const handleGoToDashboard = useCallback(() => router.push('/admin/dashboard'), [router]);
  const handleGoToWebhooks = useCallback(() => router.push('/admin/webhooks'), [router]);
  const handleGoToSettings = useCallback(() => router.push('/admin/settings'), [router]);

  const handleViewPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
  };

  const handleCloseDetails = () => {
    setSelectedPedido(null);
  };

  const handleStatusChange = async (pedidoId: string, newStatus: string) => {
    if (!user) return;

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        statusPedido: newStatus,
        ultimaAtualizacao: Timestamp.now(),
        atualizadoPor: user.email || user.uid || 'admin'
      });

      addToast(`Status do pedido atualizado para: ${newStatus}`, 'success');

      if (selectedPedido && selectedPedido.id === pedidoId) {
        setSelectedPedido({
          ...selectedPedido,
          statusPedido: newStatus,
          ultimaAtualizacao: new Date(),
          atualizadoPor: user.email || user.uid || 'admin'
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      addToast('Falha ao atualizar status do pedido.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.color : '#999';
  };

  const getStatusIcon = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    return statusOption ? statusOption.icon : '🔄';
  };

  if (loading && pedidos.length === 0) {
    return <div className={styles.loadingContainer}>Carregando pedidos...</div>;
  }

  if (!user && !loading) {
    return null;
  }

  return (
    <div className={styles.pedidosContainer}>
      <div className={styles.header}>
        <h2>Gerenciamento de Pedidos</h2>
        <div className={styles.headerButtons}>
          <button onClick={handleGoToDashboard} className={styles.navButton}>Dashboard</button>
          <button onClick={handleGoToWebhooks} className={styles.navButton}>Webhooks</button>
          <button onClick={handleGoToSettings} className={styles.navButton}>Configurações</button>
        </div>
      </div>

      <div className={styles.filtersSection}>
        <div className={styles.filterGroup}>
          <label htmlFor="statusFilter">Status:</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="todos">Todos os status</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.value}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="dateFilter">Período:</label>
          <select
            id="dateFilter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="hoje">Hoje</option>
            <option value="ontem">Ontem</option>
            <option value="semana">Últimos 7 dias</option>
            <option value="mes">Último mês</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="searchTerm">Buscar:</label>
          <input
            id="searchTerm"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nome, telefone, endereço, ID..."
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.pedidosSection}>
        {loading && <div className={styles.loadingOverlay}>Atualizando...</div>}
        <div className={styles.pedidosList}>
          <div className={styles.pedidosHeader}>
            <span className={styles.headerCol}>ID</span>
            <span className={styles.headerCol}>Data</span>
            <span className={styles.headerCol}>Cliente</span>
            <span className={styles.headerCol}>Total</span>
            <span className={styles.headerCol}>Status</span>
            <span className={styles.headerCol}>Ações</span>
          </div>

          {filteredPedidos.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum pedido encontrado para os filtros selecionados.</p>
              {(searchTerm || statusFilter !== 'todos' || dateFilter !== 'todos') ? (
                <p>Tente ajustar os filtros para ver mais resultados.</p>
              ) : null}
            </div>
          ) : (
            filteredPedidos.map(pedido => (
              <div key={pedido.id} className={styles.pedidoRow}>
                <span className={styles.pedidoId}>{pedido.id.substring(0, 8)}...</span>
                <span className={styles.pedidoDate}>{formatDate(pedido.dataPedido)}</span>
                <span className={styles.pedidoCliente}>{pedido.cliente.nome}</span>
                <span className={styles.pedidoTotal}>{formatCurrency(pedido.valores.totalPedido)}</span>
                <span className={styles.pedidoStatus} style={{ color: getStatusColor(pedido.statusPedido) }}>
                  <span className={styles.statusIcon}>{getStatusIcon(pedido.statusPedido)}</span>
                  {pedido.statusPedido}
                </span>
                <span className={styles.pedidoActions}>
                  <button
                    onClick={() => handleViewPedido(pedido)}
                    className={styles.viewButton}
                  >
                    Ver Detalhes
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        {selectedPedido && (
          <div className={styles.pedidoDetailsOverlay}>
            <div className={styles.pedidoDetailsCard}>
              <div className={styles.detailsHeader}>
                <h3>Detalhes do Pedido</h3>
                <button onClick={handleCloseDetails} className={styles.closeButton}>×</button>
              </div>

              <div className={styles.detailsContent}>
                <div className={styles.detailsSection}>
                  <h4>Informações Gerais</h4>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><span className={styles.detailLabel}>ID:</span><span className={styles.detailValue}>{selectedPedido.id}</span></div>
                    <div className={styles.detailItem}><span className={styles.detailLabel}>Data:</span><span className={styles.detailValue}>{formatDate(selectedPedido.dataPedido)}</span></div>
                    <div className={styles.detailItem}><span className={styles.detailLabel}>Origem:</span><span className={styles.detailValue}>{selectedPedido.origemPedido}</span></div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Status:</span>
                      <div className={styles.statusSelector}>
                        <select
                          value={selectedPedido.statusPedido}
                          onChange={(e) => handleStatusChange(selectedPedido.id, e.target.value)}
                          disabled={isUpdating}
                          style={{ borderColor: getStatusColor(selectedPedido.statusPedido) }}
                        >
                          {statusOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.icon} {option.value}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {selectedPedido.ultimaAtualizacao && (
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Última atualização:</span>
                        <span className={styles.detailValue}>
                          {formatDate(selectedPedido.ultimaAtualizacao)}
                          {selectedPedido.atualizadoPor ? ` por ${selectedPedido.atualizadoPor}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <h4>Cliente</h4>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><span className={styles.detailLabel}>Nome:</span><span className={styles.detailValue}>{selectedPedido.cliente.nome}</span></div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Telefone:</span>
                      <span className={styles.detailValue}>
                        <a href={`https://wa.me/${selectedPedido.cliente.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className={styles.whatsappLink}>
                          {selectedPedido.cliente.telefone}
                        </a>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <h4>Endereço de Entrega</h4>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><span className={styles.detailLabel}>Endereço:</span><span className={styles.detailValue}>{selectedPedido.enderecoEntrega.fullAddress}</span></div>
                    {selectedPedido.enderecoEntrega.complemento && <div className={styles.detailItem}><span className={styles.detailLabel}>Complemento:</span><span className={styles.detailValue}>{selectedPedido.enderecoEntrega.complemento}</span></div>}
                    {selectedPedido.enderecoEntrega.referencia && <div className={styles.detailItem}><span className={styles.detailLabel}>Referência:</span><span className={styles.detailValue}>{selectedPedido.enderecoEntrega.referencia}</span></div>}
                    {(selectedPedido.enderecoEntrega.lat && selectedPedido.enderecoEntrega.lng) && (
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Mapa:</span>
                        <span className={styles.detailValue}>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedPedido.enderecoEntrega.lat},${selectedPedido.enderecoEntrega.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.mapLink}
                          >
                            Ver no Google Maps
                          </a>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <h4>Itens do Pedido</h4>
                  <div className={styles.itemsTable}>
                    <div className={styles.itemsHeader}>
                      <span className={styles.itemCol}>Produto</span><span className={styles.itemCol}>Detalhes</span><span className={styles.itemCol}>Qtd</span><span className={styles.itemCol}>Preço</span><span className={styles.itemCol}>Subtotal</span>
                    </div>
                    {selectedPedido.itensPedido.map((item, index) => (
                      <div key={index} className={styles.itemRow}>
                        <span className={styles.itemName}>{item.nomeProduto}</span>
                        <span className={styles.itemDetails}>
                          {item.tamanho && <span className={styles.itemSize}>Tamanho: {item.tamanho}</span>}
                          {item.adicionais && <span className={styles.itemAddons}>Adicionais: {item.adicionais}</span>}
                          {item.observacoesItem && <span className={styles.itemNotes}>Obs: {item.observacoesItem}</span>}
                        </span>
                        <span className={styles.itemQty}>{item.quantidade}</span>
                        <span className={styles.itemPrice}>{formatCurrency(item.precoUnitario)}</span>
                        <span className={styles.itemSubtotal}>{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <h4>Pagamento</h4>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}><span className={styles.detailLabel}>Forma:</span><span className={styles.detailValue}>{selectedPedido.formaPagamento}</span></div>
                    {selectedPedido.trocoPara && <div className={styles.detailItem}><span className={styles.detailLabel}>Troco para:</span><span className={styles.detailValue}>{formatCurrency(parseFloat(selectedPedido.trocoPara))}</span></div>}
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <h4>Valores</h4>
                  <div className={styles.valuesTable}>
                    <div className={styles.valueRow}><span className={styles.valueLabel}>Subtotal:</span><span className={styles.valueAmount}>{formatCurrency(selectedPedido.valores.subtotalItens)}</span></div>
                    <div className={styles.valueRow}><span className={styles.valueLabel}>Taxa Entrega:</span><span className={styles.valueAmount}>{formatCurrency(selectedPedido.valores.taxaEntrega)}</span></div>
                    {selectedPedido.valores.descontos && selectedPedido.valores.descontos > 0 && (
                      <div className={styles.valueRow}><span className={styles.valueLabel}>Descontos:</span><span className={styles.valueAmount}>-{formatCurrency(selectedPedido.valores.descontos)}</span></div>
                    )}
                    <div className={`${styles.valueRow} ${styles.totalRow}`}><span className={styles.valueLabel}>Total:</span><span className={styles.valueAmount}>{formatCurrency(selectedPedido.valores.totalPedido)}</span></div>
                  </div>
                </div>

                {selectedPedido.observacoesGerais && (
                  <div className={styles.detailsSection}>
                    <h4>Observações Gerais</h4>
                    <div className={styles.observacoesBox}>{selectedPedido.observacoesGerais}</div>
                  </div>
                )}

                <div className={styles.actionsSection}>
                  <button
                    onClick={() => window.open(`https://wa.me/${selectedPedido.cliente.telefone.replace(/\D/g, '')}?text=Olá ${selectedPedido.cliente.nome}, sobre seu pedido #${selectedPedido.id.substring(0, 8)}...`, '_blank')}
                    className={styles.whatsappButton}
                  >
                    Enviar Mensagem WhatsApp
                  </button>
                  <button onClick={handleCloseDetails} className={styles.closeDetailsButton}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPedidos;


