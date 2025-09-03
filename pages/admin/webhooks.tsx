import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, DocumentData, QueryDocumentSnapshot, Timestamp, where, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '@/styles/AdminWebhooks.module.css';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
}

// CORREÇÃO: Definindo um tipo mais específico para o requestPayload
interface WebhookRequestPayload {
  event: string;
  timestamp: string;
  data: {
    message: string;
    source: string;
  };
}

interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failure';
  statusCode?: number;
  // CORREÇÃO: Utilizando a interface mais específica
  requestPayload: WebhookRequestPayload;
  // CORREÇÃO: O tipo `any` foi substituído por `Record<string, any>`
  responseData?: Record<string, any>;
  errorMessage?: string;
  timestamp: Date;
}

const AdminWebhooks = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    active: true
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const router = useRouter();

  const availableEvents = [
    'pedido.novo',
    'pedido.atualizado',
    'pedido.cancelado',
    'pedido.entregue',
    'cliente.novo',
    'mensagem.recebida'
  ];

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
      setError('Falha na verificação de autenticação. Por favor, tente novamente.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'webhooks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const webhooksData: Webhook[] = [];
      querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        webhooksData.push({
          id: docSnap.id,
          name: data.name || '',
          url: data.url || '',
          secret: data.secret || '',
          events: data.events || [],
          active: data.active !== undefined ? data.active : true,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastTriggered: data.lastTriggered?.toDate() || null,
          successCount: data.successCount || 0,
          failureCount: data.failureCount || 0
        });
      });
      setWebhooks(webhooksData);
    }, (error) => {
      console.error("Erro ao buscar webhooks: ", error);
      setError('Falha ao carregar webhooks.');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedWebhook) return;

    const q = query(
      collection(db, 'webhookLogs'),
      where('webhookId', '==', selectedWebhook),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const logsData: WebhookLog[] = [];
      querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        logsData.push({
          id: docSnap.id,
          webhookId: data.webhookId,
          event: data.event || '',
          status: data.status || 'failure',
          statusCode: data.statusCode,
          requestPayload: data.requestPayload || {},
          responseData: data.responseData,
          errorMessage: data.errorMessage,
          timestamp: data.timestamp?.toDate() || new Date()
        });
      });
      setWebhookLogs(logsData);
    }, (error) => {
      console.error("Erro ao buscar logs de webhook: ", error);
      setError('Falha ao carregar logs de webhook.');
    });
    
    return () => unsubscribe();
  }, [user, selectedWebhook]);

  const handleGoToDashboard = () => {
    router.push('/admin/dashboard');
  };

  const handleGoToSettings = () => {
    router.push('/admin/settings');
  };

  const handleAddNewWebhook = () => {
    setEditingWebhook(null);
    setFormData({
      name: '',
      url: '',
      secret: '',
      events: [],
      active: true
    });
    setShowForm(true);
  };

  const handleEditWebhook = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      active: webhook.active
    });
    setShowForm(true);
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este webhook?')) {
      try {
        await deleteDoc(doc(db, 'webhooks', webhookId));
        setSuccess('Webhook excluído com sucesso!');
        setTimeout(() => setSuccess(null), 3000);
      } catch (error) {
        console.error('Erro ao excluir webhook: ', error);
        setError('Falha ao excluir webhook.');
      }
    }
  };

  const handleToggleWebhookStatus = async (webhook: Webhook) => {
    try {
      await updateDoc(doc(db, 'webhooks', webhook.id), {
        active: !webhook.active
      });
      setSuccess(`Webhook ${!webhook.active ? 'ativado' : 'desativado'} com sucesso!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erro ao atualizar status do webhook: ', error);
      setError('Falha ao atualizar status do webhook.');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleEventToggle = (event: string) => {
    setFormData(prev => {
      const events = [...prev.events];
      if (events.includes(event)) {
        return { ...prev, events: events.filter(e => e !== event) };
      } else {
        return { ...prev, events: [...events, event] };
      }
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.url || formData.events.length === 0) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      if (editingWebhook) {
        await updateDoc(doc(db, 'webhooks', editingWebhook.id), {
          name: formData.name,
          url: formData.url,
          secret: formData.secret,
          events: formData.events,
          active: formData.active,
          updatedAt: Timestamp.now()
        });
        setSuccess('Webhook atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'webhooks'), {
          name: formData.name,
          url: formData.url,
          secret: formData.secret,
          events: formData.events,
          active: formData.active,
          createdAt: Timestamp.now(),
          successCount: 0,
          failureCount: 0
        });
        setSuccess('Webhook criado com sucesso!');
      }
      
      setShowForm(false);
      setEditingWebhook(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erro ao salvar webhook: ', error);
      setError('Falha ao salvar webhook.');
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    try {
      // Criar um documento de log para o teste
      await addDoc(collection(db, 'webhookLogs'), {
        webhookId: webhook.id,
        event: 'webhook.test',
        status: 'pending',
        requestPayload: {
          event: 'webhook.test',
          timestamp: new Date().toISOString(),
          data: {
            message: 'Este é um teste de webhook',
            source: 'Painel Administrativo'
          }
        },
        timestamp: Timestamp.now()
      });

      // Chamar a API para testar o webhook
      const response = await fetch('/api/webhook/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookId: webhook.id,
          url: webhook.url,
          secret: webhook.secret
        }),
      });

      if (response.ok) {
        setSuccess('Teste de webhook enviado com sucesso!');
      } else {
        const data = await response.json();
        setError(`Falha no teste: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao testar webhook: ', error);
      setError('Falha ao testar webhook.');
    }
  };

  const handleViewLogs = (webhookId: string) => {
    setSelectedWebhook(webhookId === selectedWebhook ? null : webhookId);
  };

  if (loading) {
    return <div className={styles.loadingContainer}>Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.webhooksContainer}>
      <div className={styles.header}>
        <h2>Gerenciamento de Webhooks</h2>
        <div className={styles.headerButtons}>
          <button onClick={handleGoToDashboard} className={styles.navButton}>
            Dashboard
          </button>
          <button onClick={handleGoToSettings} className={styles.navButton}>
            Configurações
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.alertError}>
          <p>{error}</p>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className={styles.alertSuccess}>
          <p>{success}</p>
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      <div className={styles.webhooksSection}>
        <div className={styles.sectionHeader}>
          <h3>Webhooks Configurados</h3>
          <button onClick={handleAddNewWebhook} className={styles.addButton}>
            + Adicionar Novo Webhook
          </button>
        </div>

        {showForm && (
          <div className={styles.formContainer}>
            <h4>{editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}</h4>
            <form onSubmit={handleFormSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Nome do Webhook*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Ex: Notificação de Pedidos"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="url">URL do Webhook*</label>
                <input
                  type="url"
                  id="url"
                  name="url"
                  value={formData.url}
                  onChange={handleFormChange}
                  placeholder="https://seu-n8n.com/webhook/pedido"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="secret">Token Secreto</label>
                <input
                  type="text"
                  id="secret"
                  name="secret"
                  value={formData.secret}
                  onChange={handleFormChange}
                  placeholder="Token secreto para autenticação"
                />
                <small>Usado para autenticar requisições com cabeçalho Authorization: Bearer [token]</small>
              </div>

              <div className={styles.formGroup}>
                <label>Eventos*</label>
                <div className={styles.eventsGrid}>
                  {availableEvents.map(event => (
                    <div key={event} className={styles.eventCheckbox}>
                      <input
                        type="checkbox"
                        id={`event-${event}`}
                        checked={formData.events.includes(event )}
                        onChange={() => handleEventToggle(event)}
                      />
                      <label htmlFor={`event-${event}`}>{event}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    id="active"
                    name="active"
                    checked={formData.active}
                    onChange={handleCheckboxChange}
                  />
                  <label htmlFor="active">Ativo</label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowForm(false)} className={styles.cancelButton}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveButton}>
                  {editingWebhook ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {webhooks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nenhum webhook configurado.</p>
            <p>Clique em "Adicionar Novo Webhook" para começar.</p>
          </div>
        ) : (
          <div className={styles.webhooksList}>
            {webhooks.map(webhook => (
              <div key={webhook.id} className={styles.webhookCard}>
                <div className={styles.webhookHeader}>
                  <div className={styles.webhookTitle}>
                    <h4>{webhook.name}</h4>
                    <span className={webhook.active ? styles.statusActive : styles.statusInactive}>
                      {webhook.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className={styles.webhookActions}>
                    <button 
                      onClick={() => handleToggleWebhookStatus(webhook)} 
                      className={webhook.active ? styles.deactivateButton : styles.activateButton}
                    >
                      {webhook.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleTestWebhook(webhook)} className={styles.testButton}>
                      Testar
                    </button>
                    <button onClick={() => handleEditWebhook(webhook)} className={styles.editButton}>
                      Editar
                    </button>
                    <button onClick={() => handleDeleteWebhook(webhook.id)} className={styles.deleteButton}>
                      Excluir
                    </button>
                  </div>
                </div>
                
                <div className={styles.webhookDetails}>
                  <div className={styles.detailItem}>
                    <strong>URL:</strong> {webhook.url}
                  </div>
                  <div className={styles.detailItem}>
                    <strong>Eventos:</strong> {webhook.events.join(', ')}
                  </div>
                  <div className={styles.detailItem}>
                    <strong>Token:</strong> {webhook.secret ? '••••••••' : 'Não configurado'}
                  </div>
                  <div className={styles.detailStats}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Sucesso:</span>
                      <span className={styles.statValue}>{webhook.successCount}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Falhas:</span>
                      <span className={styles.statValue}>{webhook.failureCount}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Último Acionamento:</span>
                      <span className={styles.statValue}>
                        {webhook.lastTriggered 
                          ? new Date(webhook.lastTriggered).toLocaleString() 
                          : 'Nunca'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.webhookFooter}>
                  <button 
                    onClick={() => handleViewLogs(webhook.id)} 
                    className={styles.viewLogsButton}
                  >
                    {selectedWebhook === webhook.id ? 'Ocultar Logs' : 'Ver Logs'}
                  </button>
                </div>

                {selectedWebhook === webhook.id && (
                  <div className={styles.logsSection}>
                    <h5>Logs de Execução</h5>
                    {webhookLogs.length === 0 ? (
                      <p>Nenhum log disponível para este webhook.</p>
                    ) : (
                      <div className={styles.logsTable}>
                        <table>
                          <thead>
                            <tr>
                              <th>Data/Hora</th>
                              <th>Evento</th>
                              <th>Status</th>
                              <th>Código</th>
                              <th>Detalhes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {webhookLogs.map(log => (
                              <tr key={log.id} className={log.status === 'success' ? styles.successRow : styles.failureRow}>
                                <td>{new Date(log.timestamp).toLocaleString()}</td>
                                <td>{log.event}</td>
                                <td>{log.status === 'success' ? 'Sucesso' : 'Falha'}</td>
                                <td>{log.statusCode || '-'}</td>
                                <td>
                                  {log.status === 'failure' && log.errorMessage ? (
                                    <span title={log.errorMessage}>
                                      {log.errorMessage.substring(0, 30)}
                                      {log.errorMessage.length > 30 ? '...' : ''}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.webhookInfo}>
        <h3>Sobre Webhooks</h3>
        <p>
          Webhooks permitem que seu sistema notifique automaticamente outros serviços quando eventos específicos ocorrem.
          Por exemplo, você pode configurar um webhook para notificar o n8n quando um novo pedido for registrado.
        </p>
        <h4>Como funciona:</h4>
        <ol>
          <li>Configure um webhook com uma URL de destino e selecione os eventos que deseja monitorar</li>
          <li>Quando um evento ocorre, nosso sistema envia uma requisição POST para a URL configurada</li>
          <li>O sistema de destino processa a requisição e responde</li>
        </ol>
        <h4>Formato da requisição:</h4>
        <pre>
{`{
  "event": "pedido.novo",
  "timestamp": "2025-05-22T00:37:42Z",
  "data": {
    // Dados específicos do evento
  }
}`}
        </pre>
        <p>
          <strong>Dica de segurança:</strong> Sempre use um token secreto para autenticar as requisições de webhook.
        </p>
      </div>
    </div>
  );
};

export default AdminWebhooks;