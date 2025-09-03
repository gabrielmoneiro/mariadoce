import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import BottomNavigationNew from '@/components/BottomNavigation-new';
import { MapPin, Phone, Mail, User, Edit3, Save, X } from 'lucide-react';
import styles from '@/styles/Informacoes.module.css';

interface UserInfo {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  cep: string;
  cidade: string;
  bairro: string;
  numero: string;
  complemento: string;
  referencia: string;
  estado: string;
}

const InformacoesPage: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    cep: '',
    cidade: '',
    bairro: '',
    numero: '',
    complemento: '',
    referencia: '',
    estado: ''
  });
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  useEffect(() => {
    // Carregar dados do localStorage (unificando com checkout)
    const loadUserData = () => {
      const savedInfo = localStorage.getItem('userInfo');
      const customerName = localStorage.getItem('customerName');
      const customerPhone = localStorage.getItem('customerPhone');
      const checkoutData = localStorage.getItem('checkoutData');
      
      let userData = {
        nome: '',
        telefone: '',
        email: '',
        endereco: '',
        cep: '',
        cidade: '',
        bairro: '',
        numero: '',
        complemento: '',
        referencia: '',
        estado: ''
      };

      // Carregar dados salvos anteriormente
      if (savedInfo) {
        try {
          userData = { ...userData, ...JSON.parse(savedInfo) };
        } catch (error) {
          console.error('Erro ao carregar informações do usuário:', error);
        }
      }

      // Unificar com dados do checkout
      if (customerName) {
        userData.nome = customerName.replace(/"/g, '');
      }
      
      if (customerPhone) {
        userData.telefone = customerPhone.replace(/"/g, '');
      }

      if (checkoutData) {
        try {
          const checkout = JSON.parse(checkoutData);
          if (checkout.nome) userData.nome = checkout.nome;
          if (checkout.telefone) userData.telefone = checkout.telefone;
          if (checkout.endereco) {
            userData.endereco = checkout.endereco.fullAddress || '';
            userData.cep = checkout.endereco.cep || '';
            userData.cidade = checkout.endereco.cidade || '';
            userData.bairro = checkout.endereco.bairro || '';
            userData.numero = checkout.endereco.numero || '';
            userData.complemento = checkout.endereco.complemento || '';
            userData.referencia = checkout.endereco.referencia || '';
            userData.estado = checkout.endereco.estado || '';
          }
        } catch (error) {
          console.error('Erro ao carregar dados do checkout:', error);
        }
      }

      setUserInfo(userData);
    };

    loadUserData();
  }, []);

  const saveUserInfo = (updatedInfo: UserInfo) => {
    // Salvar no localStorage principal
    localStorage.setItem('userInfo', JSON.stringify(updatedInfo));
    
    // Sincronizar com dados do checkout
    localStorage.setItem('customerName', JSON.stringify(updatedInfo.nome));
    localStorage.setItem('customerPhone', JSON.stringify(updatedInfo.telefone));
    
    // Atualizar dados do checkout se existirem
    const checkoutData = localStorage.getItem('checkoutData');
    if (checkoutData) {
      try {
        const checkout = JSON.parse(checkoutData);
        checkout.nome = updatedInfo.nome;
        checkout.telefone = updatedInfo.telefone;
        
        if (!checkout.endereco) {
          checkout.endereco = {};
        }
        
        checkout.endereco.fullAddress = updatedInfo.endereco;
        checkout.endereco.cep = updatedInfo.cep;
        checkout.endereco.cidade = updatedInfo.cidade;
        checkout.endereco.bairro = updatedInfo.bairro;
        checkout.endereco.numero = updatedInfo.numero;
        checkout.endereco.complemento = updatedInfo.complemento;
        checkout.endereco.referencia = updatedInfo.referencia;
        checkout.endereco.estado = updatedInfo.estado;
        
        localStorage.setItem('checkoutData', JSON.stringify(checkout));
      } catch (error) {
        console.error('Erro ao sincronizar com checkout:', error);
      }
    }
    
    setUserInfo(updatedInfo);
  };

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSave = (field: string) => {
    const updatedInfo = { ...userInfo, [field]: tempValue };
    saveUserInfo(updatedInfo);
    setEditingField(null);
    setTempValue('');
  };

  const handleCancel = () => {
    setEditingField(null);
    setTempValue('');
  };

  const formatCEP = (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const InfoField: React.FC<{
    label: string;
    field: string;
    value: string;
    icon: React.ReactNode;
    type?: string;
    placeholder?: string;
  }> = ({ label, field, value, icon, type = 'text', placeholder }) => {
    const isEditing = editingField === field;
    
    return (
      <div className={styles.infoField}>
        <div className={styles.fieldHeader}>
          <div className={styles.fieldLabel}>
            {icon}
            <span>{label}</span>
          </div>
          {!isEditing && (
            <button
              className={styles.editButton}
              onClick={() => handleEdit(field, value)}
            >
              <Edit3 size={16} />
            </button>
          )}
        </div>
        
        <div className={styles.fieldContent}>
          {isEditing ? (
            <div className={styles.editContainer}>
              <input
                type={type}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                placeholder={placeholder}
                className={styles.editInput}
                autoFocus
              />
              <div className={styles.editActions}>
                <button
                  className={styles.saveButton}
                  onClick={() => handleSave(field)}
                >
                  <Save size={16} />
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={handleCancel}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <span className={styles.fieldValue}>
              {value || 'Não informado'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Minhas Informações - Maria Doce</title>
        <meta name="description" content="Gerencie suas informações pessoais" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>📋 Minhas Informações</h1>
            <p className={styles.subtitle}>
              Gerencie seus dados pessoais e de entrega
            </p>
          </div>

          <div className={styles.infoSections}>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Dados Pessoais</h2>
              
              <InfoField
                label="Nome Completo"
                field="nome"
                value={userInfo.nome}
                icon={<User size={20} />}
                placeholder="Digite seu nome completo"
              />
              
              <InfoField
                label="Telefone"
                field="telefone"
                value={formatPhone(userInfo.telefone)}
                icon={<Phone size={20} />}
                type="tel"
                placeholder="(11) 99999-9999"
              />
              
              <InfoField
                label="E-mail"
                field="email"
                value={userInfo.email}
                icon={<Mail size={20} />}
                type="email"
                placeholder="seu@email.com"
              />
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Endereço de Entrega</h2>
              
              <InfoField
                label="CEP"
                field="cep"
                value={formatCEP(userInfo.cep)}
                icon={<MapPin size={20} />}
                placeholder="00000-000"
              />
              
              <InfoField
                label="Endereço"
                field="endereco"
                value={userInfo.endereco}
                icon={<MapPin size={20} />}
                placeholder="Rua, Avenida, etc."
              />
              
              <InfoField
                label="Número"
                field="numero"
                value={userInfo.numero}
                icon={<MapPin size={20} />}
                placeholder="123"
              />
              
              <InfoField
                label="Bairro"
                field="bairro"
                value={userInfo.bairro}
                icon={<MapPin size={20} />}
                placeholder="Nome do bairro"
              />
              
              <InfoField
                label="Cidade"
                field="cidade"
                value={userInfo.cidade}
                icon={<MapPin size={20} />}
                placeholder="Nome da cidade"
              />
              
              <InfoField
                label="Estado"
                field="estado"
                value={userInfo.estado}
                icon={<MapPin size={20} />}
                placeholder="SP, RJ, MG, etc."
              />
              
              <InfoField
                label="Complemento"
                field="complemento"
                value={userInfo.complemento}
                icon={<MapPin size={20} />}
                placeholder="Apartamento, bloco, etc. (opcional)"
              />
              
              <InfoField
                label="Referência"
                field="referencia"
                value={userInfo.referencia}
                icon={<MapPin size={20} />}
                placeholder="Ponto de referência (opcional)"
              />
            </div>
          </div>

          <div className={styles.footer}>
            <p className={styles.footerText}>
              ℹ️ Suas informações são salvas localmente no seu navegador
            </p>
          </div>
        </div>
      </main>

      <BottomNavigationNew />
    </>
  );
};

export default InformacoesPage;

