import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import ProductForm from '@/components/ProductForm';
import styles from '@/styles/AdminDashboard.module.css';
import Image from 'next/image';

interface TamanhoPreco {
  tamanho: string;
  preco: number;
  precoOriginal?: number;
  desconto?: number;
  emPromocao?: boolean;
}

// CORREÇÃO: Nova interface para o tipo de Addon
interface Addon {
  name: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  tamanhosPrecos?: TamanhoPreco[];
  price?: number; 
  sizes?: string[]; 
  categoryId?: string;
  categoryName?: string;
  addons?: Addon[]; // CORREÇÃO: Tipo 'any[]' substituído por 'Addon[]'
  highlight: boolean;
  imageUrl?: string;
  pedidoCount?: number;
  originalPrice?: number;
  discountPercentage?: number;
  isOnSale?: boolean;
}

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

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

    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData: Product[] = [];
      querySnapshot.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        // CORREÇÃO: Usando a interface Product para tipagem, eliminando o `as any`
        const data = docSnap.data() as Product; 
        const productEntry: Product = {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          tamanhosPrecos: data.tamanhosPrecos || [],
          price: data.price, 
          sizes: data.sizes, 
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          addons: data.addons || [],
          highlight: data.highlight || false,
          imageUrl: data.imageUrl,
          pedidoCount: data.pedidoCount || 0,
          originalPrice: data.originalPrice || undefined,
          discountPercentage: data.discountPercentage || undefined,
          isOnSale: data.isOnSale || false,
        };
        
        if ((!productEntry.tamanhosPrecos || productEntry.tamanhosPrecos.length === 0) && productEntry.price !== undefined && productEntry.sizes && productEntry.sizes.length > 0) {
          productEntry.tamanhosPrecos = productEntry.sizes.map(s => ({ 
            tamanho: s, 
            preco: productEntry.price as number,
            precoOriginal: productEntry.isOnSale ? productEntry.originalPrice : undefined,
            desconto: productEntry.isOnSale ? productEntry.discountPercentage : undefined,
            emPromocao: productEntry.isOnSale || false
          }));
        } else if ((!productEntry.tamanhosPrecos || productEntry.tamanhosPrecos.length === 0) && productEntry.price !== undefined) {
          productEntry.tamanhosPrecos = [{ 
            tamanho: 'Único', 
            preco: productEntry.price as number,
            precoOriginal: productEntry.isOnSale ? productEntry.originalPrice : undefined,
            desconto: productEntry.isOnSale ? productEntry.discountPercentage : undefined,
            emPromocao: productEntry.isOnSale || false
          }];
        }
        
        productsData.push(productEntry);
      });
      setProducts(productsData);
    }, (error) => {
      console.error("Erro ao buscar produtos: ", error);
      setError('Falha ao carregar produtos.');
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/admin/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setError('Falha ao fazer logout. Por favor, tente novamente.');
    }
  };

  const handleGoToSettings = () => {
    router.push('/admin/settings');
  };

  const handleAddNewProduct = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleToggleHighlight = async (productId: string, currentHighlight: boolean) => {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        highlight: !currentHighlight
      });
    } catch (error) {
      console.error('Erro ao alterar destaque do produto: ', error);
      setError('Falha ao alterar destaque do produto.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (error) {
        console.error('Erro ao excluir produto: ', error);
        setError('Falha ao excluir produto.');
      }
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const formatPriceDisplay = (product: Product): string => {
    if (product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      const tamanhosComPromocao = product.tamanhosPrecos.filter(tp => tp.emPromocao);
      
      if (tamanhosComPromocao.length > 0) {
        const precoPromocional = Math.min(...tamanhosComPromocao.map(tp => tp.preco));
        const precoOriginal = Math.min(...tamanhosComPromocao.map(tp => tp.precoOriginal || tp.preco));
        const desconto = tamanhosComPromocao[0].desconto || 0;
        
        if (product.tamanhosPrecos.length === 1) {
          return `R$ ${precoOriginal.toFixed(2)} → R$ ${precoPromocional.toFixed(2)} (${desconto}% OFF)`;
        } else {
          return `A partir de R$ ${precoPromocional.toFixed(2)} (${desconto}% OFF)`;
        }
      } else {
        const precos = product.tamanhosPrecos.map(tp => tp.preco).filter(p => typeof p === 'number');
        if (precos.length === 0) return 'Preço Indisponível';
        if (precos.length === 1) return `R$ ${precos[0].toFixed(2)}`;
        const minPrice = Math.min(...precos);
        return `A partir de R$ ${minPrice.toFixed(2)}`;
      }
    } 
    
    if (product.isOnSale && product.originalPrice && product.discountPercentage) {
      const discountedPrice = product.originalPrice * (1 - product.discountPercentage / 100);
      return `R$ ${product.originalPrice.toFixed(2)} → R$ ${discountedPrice.toFixed(2)} (${product.discountPercentage}% OFF)`;
    } else if (typeof product.price === 'number') {
      return `R$ ${product.price.toFixed(2)}`;
    }
    
    return 'Preço Indisponível';
  };

  const getPromotionInfo = (product: Product): { hasPromotion: boolean; discount: number } => {
    if (product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      const tamanhosComPromocao = product.tamanhosPrecos.filter(tp => tp.emPromocao);
      if (tamanhosComPromocao.length > 0) {
        const desconto = tamanhosComPromocao[0].desconto || 0;
        return { hasPromotion: true, discount: desconto };
      }
    }
    
    if (product.isOnSale && product.discountPercentage) {
      return { hasPromotion: true, discount: product.discountPercentage };
    }
    
    return { hasPromotion: false, discount: 0 };
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!user) {
    return null; 
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Painel de Administração</h2>
          <p>Bem-vindo, {user.email}!</p>
        </div>
        <div className={styles.headerButtons}>
          <Link href="/admin/pedidos" passHref>
            <button className={styles.settingsButton}>
              Pedidos
            </button>
          </Link>
          <Link href="/admin/webhooks" passHref>
            <button className={styles.settingsButton}>
              Webhooks
            </button>
          </Link>
          <button onClick={handleGoToSettings} className={styles.settingsButton}>
            Configurações de Entrega
          </button>
          <button onClick={handleLogout} className={styles.logoutButton}>Sair</button>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>Erro: {error}</p>}

      <div className={styles.crudSection}>
        <h3>Gerenciar Produtos</h3>
        <button onClick={handleAddNewProduct} className={styles.addButton}>
          + Adicionar Novo Produto
        </button>

        {showForm && (
          <ProductForm
            productToEdit={editingProduct as any}
            onFormSubmit={handleFormSubmit}
          />
        )}

        <div className={styles.productList}>
          <h4>Produtos Existentes</h4>
          {products.length === 0 && !loading ? (
            <p>Nenhum produto encontrado.</p>
          ) : (
            <div className={styles.tableContainer}>
              <table>
                <thead>
                  <tr>
                    <th>Imagem</th>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Preço</th>
                    <th>Promoção</th>
                    <th>Destaque</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const promotionInfo = getPromotionInfo(product);
                    return (
                      <tr key={product.id}>
                        <td>
                          {product.imageUrl && <img src={product.imageUrl} alt={product.name} width="50" />}
                        </td>
                        <td>{product.name}</td>
                        <td>{product.categoryName || 'Sem categoria'}</td> 
                        <td>{formatPriceDisplay(product)}</td>
                        <td>
                          {promotionInfo.hasPromotion ? (
                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                              {promotionInfo.discount}% OFF
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>Não</span>
                          )}
                        </td>
                        <td>{product.highlight ? 'Sim' : 'Não'}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button 
                              onClick={() => handleToggleHighlight(product.id, product.highlight)} 
                              className={product.highlight ? styles.removeHighlightButton : styles.addHighlightButton}
                            >
                              {product.highlight ? 'Tirar Destaque' : 'Destacar'}
                            </button>
                            <button onClick={() => handleEditProduct(product)} className={styles.editButton}>Editar</button>
                            <button onClick={() => handleDeleteProduct(product.id)} className={styles.deleteButton}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;