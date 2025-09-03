import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/AdminDashboard.module.css';
import transitions from '@/styles/AdminTransitions.module.css';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  highlight: boolean;
  imageUrl?: string;
}

const AdminDashboardDemo = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Simular carregamento de dados
    setTimeout(() => {
      setProducts([
        {
          id: '1',
          name: 'Produto Demo 1',
          description: 'Descrição do produto demo 1',
          price: 25.90,
          highlight: true,
          imageUrl: '/assets/logoms.png'
        },
        {
          id: '2', 
          name: 'Produto Demo 2',
          description: 'Descrição do produto demo 2',
          price: 35.50,
          highlight: false,
          imageUrl: '/assets/logoms.png'
        }
      ]);
      setIsLoading(false);
    }, 1500);
  }, []);

  const handleLogout = () => {
    router.push('/admin/login-demo');
  };

  if (isLoading) {
    return (
      <div className={`${styles.dashboardContainer} ${transitions.pageTransition}`}>
        <div className={styles.header}>
          <div>
            <div className={`${transitions.skeleton}`} style={{width: '300px', height: '40px', marginBottom: '10px'}}></div>
            <div className={`${transitions.skeleton}`} style={{width: '200px', height: '20px'}}></div>
          </div>
        </div>
        <div className={styles.crudSection}>
          <div className={`${transitions.skeleton}`} style={{width: '200px', height: '30px', marginBottom: '20px'}}></div>
          <div className={`${transitions.skeleton}`} style={{width: '150px', height: '40px', marginBottom: '20px'}}></div>
          <div className={`${transitions.skeleton}`} style={{width: '100%', height: '200px'}}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.dashboardContainer} ${transitions.pageTransition}`}>
      <div className={`${styles.header} ${transitions.slideInLeft}`}>
        <div>
          <h2>Painel Administrativo</h2>
          <p>Bem-vindo, admin@demo.com</p>
        </div>
        <div className={styles.headerButtons}>
          <Link href="/admin/pedidos-demo">
            <button className={`${styles.settingsButton} ${transitions.buttonHover}`}>Ver Pedidos</button>
          </Link>
          <button 
            onClick={handleLogout} 
            className={`${styles.logoutButton} ${transitions.buttonHover}`}
          >
            Sair
          </button>
        </div>
      </div>

      <div className={`${styles.crudSection} ${transitions.slideInRight}`}>
        <h3>Gerenciar Produtos</h3>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className={`${styles.addButton} ${transitions.buttonHover} ${transitions.scaleIn}`}
          style={{animationDelay: '0.2s'}}
        >
          {showForm ? 'Cancelar' : 'Adicionar Produto'}
        </button>

        <div className={`${styles.productList} ${transitions.fadeIn}`} style={{animationDelay: '0.3s'}}>
          <h4>Produtos Cadastrados</h4>
          <table>
            <thead>
              <tr>
                <th>Imagem</th>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Preço</th>
                <th>Destaque</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr 
                  key={product.id} 
                  className={`${transitions.tableRow} ${transitions.fadeIn}`}
                  style={{animationDelay: `${0.4 + index * 0.1}s`}}
                >
                  <td>
                    {product.imageUrl && (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className={transitions.scaleIn}
                      />
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>{product.description}</td>
                  <td>R$ {product.price.toFixed(2)}</td>
                  <td>{product.highlight ? 'Sim' : 'Não'}</td>
                  <td>
                    <button 
                      className={`${styles.editButton} ${transitions.buttonHover}`}
                      onClick={() => setEditingProduct(product)}
                    >
                      Editar
                    </button>
                    <button 
                      className={`${styles.deleteButton} ${transitions.buttonHover}`}
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir este produto?')) {
                          setProducts(products.filter(p => p.id !== product.id));
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingProduct && (
        <div className={transitions.modalOverlay} onClick={() => setEditingProduct(null)}>
          <div className={transitions.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Editar Produto</h3>
            <p>Produto: {editingProduct.name}</p>
            <p>Esta é uma demonstração. Em um sistema real, aqui seria exibido um formulário de edição.</p>
            <button 
              onClick={() => setEditingProduct(null)}
              className={`${styles.logoutButton} ${transitions.buttonHover}`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardDemo;

