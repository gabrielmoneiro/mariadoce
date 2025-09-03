import React, { useState, useEffect } from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import { doc, getDoc, collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCart } from '@/context/CartContext';
import styles from '@/styles/ProdutoDetalhe.module.css';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext'; // Importar useToast

interface OpcaoAdicional {
  nome: string;
  preco?: number;
  limiteMaximo?: number;
}

interface TamanhoPreco {
  tamanho: string;
  preco: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  tamanhosPrecos?: (TamanhoPreco & { desconto?: number; emPromocao?: boolean; precoOriginal?: number; })[];
  price?: number; // Retrocompatibilidade
  sizes?: string[]; // Retrocompatibilidade
  categoryName?: string;
  addons: OpcaoAdicional[];
  highlight: boolean;
  imageUrl?: string;
  pedidoCount?: number;
  createdAt?: string;
  lastUpdated?: string;
  // Campos de desconto
  originalPrice?: number;
  discountPercentage?: number;
  isOnSale?: boolean;
}

interface ProdutoDetalheProps {
  product: Product | null;
}

interface AdicionalSelecionado {
  nome: string;
  preco: number;
  quantidade: number;
}

const serializeProductData = (productData: any): Product => {
  const data = { ...productData };
  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  if (!data.addons) {
    data.addons = [];
  }
  if ((!data.tamanhosPrecos || data.tamanhosPrecos.length === 0) && data.price !== undefined) {
    if (data.sizes && data.sizes.length > 0) {
      data.tamanhosPrecos = data.sizes.map((s: string) => ({ tamanho: s, preco: data.price as number }));
    } else {
      data.tamanhosPrecos = [{ tamanho: 'Único', preco: data.price as number }];
    }
  }
  if (!data.tamanhosPrecos) {
    data.tamanhosPrecos = [];
  }
  return data as Product;
};

const ProdutoDetalhePage: React.FC<ProdutoDetalheProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { addToast } = useToast(); // Usar o hook useToast
  const [selectedTamanhoPreco, setSelectedTamanhoPreco] = useState<TamanhoPreco | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, AdicionalSelecionado>>({});
  const [quantidadeProduto, setQuantidadeProduto] = useState(1);
  const [error, setError] = useState<string | null>(null); // Mantido para erros de limite de adicionais

  useEffect(() => {
    if (product && product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      setSelectedTamanhoPreco(product.tamanhosPrecos[0]);
    } else if (product && product.price !== undefined) {
        setSelectedTamanhoPreco({ tamanho: 'Único', preco: product.price });
    }
  }, [product]);

  if (!product) {
    return (
      <div className={styles.container}>
        <p className={styles.notFound}>Produto não encontrado.</p>
      </div>
    );
  }

  const handleTamanhoChange = (tamanhoPreco: TamanhoPreco) => {
    setSelectedTamanhoPreco(tamanhoPreco);
  };

  const handleAddonChange = (addon: OpcaoAdicional, change: number) => {
    setSelectedAddons(prev => {
      const current = prev[addon.nome] || { nome: addon.nome, preco: addon.preco || 0, quantidade: 0 };
      let newQuantity = current.quantidade + change;
      if (addon.limiteMaximo !== undefined && newQuantity > addon.limiteMaximo) {
        newQuantity = addon.limiteMaximo;
        setError(`Limite máximo de ${addon.limiteMaximo} para ${addon.nome} atingido.`);
        addToast(`Limite máximo de ${addon.limiteMaximo} para ${addon.nome}.`, 'error');
      } else if (newQuantity < 0) {
        newQuantity = 0;
        setError(null);
      } else {
        setError(null);
      }
      if (newQuantity === 0) {
        const { [addon.nome]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addon.nome]: { ...current, quantidade: newQuantity } };
    });
  };

  const calcularPrecoTotalAddons = () => {
    return Object.values(selectedAddons).reduce((total, ad) => total + (ad.preco * ad.quantidade), 0);
  };

  const getPrecoBaseAtual = (): number => {
    let basePrice = 0;
    
    if (selectedTamanhoPreco) {
      basePrice = selectedTamanhoPreco.preco;
      // Se o tamanho selecionado está em promoção, usar o preço com desconto
      if ((selectedTamanhoPreco as any).emPromocao && (selectedTamanhoPreco as any).precoOriginal) {
        return selectedTamanhoPreco.preco;
      }
    } else if (product?.price) {
      basePrice = product.price;
    }
    
    // Se o produto está em promoção (estrutura antiga), aplicar desconto
    if (product?.isOnSale && product?.originalPrice && product?.discountPercentage) {
      const discountedPrice = product.originalPrice * (1 - product.discountPercentage / 100);
      return discountedPrice;
    }
    
    return basePrice;
  };

  const handleAddToCart = () => {
    if (quantidadeProduto <= 0) {
        addToast("Quantidade deve ser ao menos 1.", 'error');
        return;
    }
    if (!selectedTamanhoPreco && (!product.tamanhosPrecos || product.tamanhosPrecos.length > 0) && product.price === undefined && product.tamanhosPrecos?.[0]?.tamanho !== 'Único') {
        addToast("Selecione um tamanho.", 'error');
        return;
    }

    const precoBaseDoTamanho = getPrecoBaseAtual();
    const precoTotalDosAddons = calcularPrecoTotalAddons();
    const precoUnitarioComAddons = precoBaseDoTamanho + precoTotalDosAddons; 

    const itemToAdd = {
      id: product.id,
      name: `${product.name}${selectedTamanhoPreco && selectedTamanhoPreco.tamanho !== 'Único' ? ' (' + selectedTamanhoPreco.tamanho + ')' : ''}`,
      price: precoUnitarioComAddons,
      imageUrl: product.imageUrl,
      quantity: quantidadeProduto,
      tamanhoSelecionado: selectedTamanhoPreco?.tamanho,
      adicionaisSelecionados: Object.values(selectedAddons).filter(ad => ad.quantidade > 0)
                                  .map(ad => `${ad.nome} (x${ad.quantidade})`)
                                  .join(', '),
    };
    addToCart(itemToAdd);
    addToast(`${itemToAdd.name} (x${quantidadeProduto}) adicionado!`, 'success');
  };

  const precoBaseExibicao = getPrecoBaseAtual();
  const precoTotalCarrinho = (precoBaseExibicao * quantidadeProduto) + (calcularPrecoTotalAddons() * quantidadeProduto);

  return (
    <div className={styles.container}>
      <div className={styles.imageColumn}>
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} width={500} height={500} className={styles.productImage} priority />
        ) : (
          <div className={styles.imagePlaceholder}>Sem imagem</div>
        )}
      </div>
      <div className={styles.detailsColumn}>
        <h1 className={styles.productName}>{product.name}</h1>
        {product.categoryName && <p className={styles.categoryName}>Categoria: {product.categoryName}</p>}
        <p className={styles.productDescription}>{product.description}</p>

        {product.tamanhosPrecos && product.tamanhosPrecos.length > 0 && product.tamanhosPrecos[0].tamanho !== 'Único' && (
          <div className={styles.tamanhosSection}>
            <h3>Tamanho:</h3>
            <div className={styles.tamanhosOptions}>
              {product.tamanhosPrecos.map((tp) => (
                <button 
                  key={tp.tamanho}
                  onClick={() => handleTamanhoChange(tp)}
                  className={`${styles.tamanhoButton} ${selectedTamanhoPreco?.tamanho === tp.tamanho ? styles.selected : ''}`}
                >
                  {tp.tamanho} - R$ {tp.preco.toFixed(2)}
                  {(tp as any).emPromocao && (tp as any).desconto && (tp as any).desconto > 0 && (
                    <span className={styles.discountBadgeSmall}>-{(tp as any).desconto}%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {((!product.tamanhosPrecos || product.tamanhosPrecos.length === 0) || (product.tamanhosPrecos && product.tamanhosPrecos.length > 0 && product.tamanhosPrecos[0].tamanho === 'Único')) && product.price !== undefined && (
          <div className={styles.priceSection}>
            {product.isOnSale && product.originalPrice && product.discountPercentage ? (
              <div className={styles.discountPriceContainer}>
                <div className={styles.discountBadge}>
                  -{product.discountPercentage}% OFF
                </div>
                <div className={styles.priceInfo}>
                  <span className={styles.originalPrice}>
                    De: R$ {product.originalPrice.toFixed(2)}
                  </span>
                  <span className={styles.currentPrice}>
                    Por: R$ {(product.originalPrice * (1 - product.discountPercentage / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <p className={styles.productPrice}>Preço: R$ {product.price.toFixed(2)}</p>
            )}
          </div>
        )}

           {selectedTamanhoPreco && (selectedTamanhoPreco as any).emPromocao && (selectedTamanhoPreco as any).precoOriginal && (selectedTamanhoPreco as any).desconto > 0 && (
          <div className={styles.discountPriceContainer}>
            <div className={styles.discountBadge}>
              -{(selectedTamanhoPreco as any).desconto}% OFF
            </div>
            <div className={styles.priceComparison}>
              <span className={styles.originalPrice}>R$ {(selectedTamanhoPreco as any).precoOriginal.toFixed(2)}</span>
              <span className={styles.currentPrice}>
                Por: R$ {selectedTamanhoPreco.preco.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {selectedTamanhoPreco && !(selectedTamanhoPreco as any).emPromocao && product.tamanhosPrecos && product.tamanhosPrecos.length > 0 && product.tamanhosPrecos[0].tamanho !== 'Único' && (
            <p className={styles.productPrice}>Preço Selecionado: R$ {selectedTamanhoPreco.preco.toFixed(2)}</p>
        )}

        {product.addons && product.addons.length > 0 && (
          <div className={styles.adicionaisSection}>
            <h3>Adicionais:</h3>
            {/* O erro de limite de adicionais já usa showToast, mas o <p> pode ser mantido ou removido */}
            {error && <p className={styles.errorMessage}>{error}</p>} 
            {product.addons.map((addon, index) => (
              <div key={index} className={styles.adicionalItem}>
                <span>{addon.nome} {addon.preco ? `(+ R$ ${addon.preco.toFixed(2)})` : ''}</span>
                <div className={styles.adicionalControls}>
                  <button 
                    onClick={() => handleAddonChange(addon, -1)}
                    className={styles.quantityButton}
                    disabled={(selectedAddons[addon.nome]?.quantidade || 0) === 0}
                    aria-label="Diminuir quantidade do adicional"
                  >
                    <img src="/assets/minus-icon.png" alt="Diminuir" width="16" height="16" />
                  </button>
                  <span className={styles.quantityDisplay}>{selectedAddons[addon.nome]?.quantidade || 0}</span>
                  <button 
                    onClick={() => handleAddonChange(addon, 1)}
                    className={styles.quantityButton}
                    disabled={addon.limiteMaximo !== undefined && (selectedAddons[addon.nome]?.quantidade || 0) >= addon.limiteMaximo}
                    aria-label="Aumentar quantidade do adicional"
                  >
                    <img src="/assets/plus-icon.png" alt="Aumentar" width="16" height="16" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={styles.quantitySelector}>
          <label htmlFor="quantidadeProduto">Quantidade:</label>
          <div className={styles.quantityControl}>
            <button 
              onClick={() => setQuantidadeProduto(Math.max(1, quantidadeProduto - 1))}
              className={styles.quantityButton}
              aria-label="Diminuir quantidade"
            >
              <img src="/assets/minus-icon.png" alt="Diminuir" width="16" height="16" />
            </button>
            <span className={styles.quantityDisplay}>{quantidadeProduto}</span>
            <button 
              onClick={() => setQuantidadeProduto(quantidadeProduto + 1)}
              className={styles.quantityButton}
              aria-label="Aumentar quantidade"
            >
              <img src="/assets/plus-icon.png" alt="Aumentar" width="16" height="16" />
            </button>
          </div>
        </div>
        <button 
            onClick={handleAddToCart} 
            className={styles.addToCartButton}
            disabled={!selectedTamanhoPreco && (!product.tamanhosPrecos || product.tamanhosPrecos.length > 0) && product.price === undefined && product.tamanhosPrecos?.[0]?.tamanho !== 'Único'}
        >
          Adicionar ao Carrinho (Total: R$ {precoTotalCarrinho.toFixed(2)})
        </button>
        {product.createdAt && <p className={styles.dateInfo}>Adicionado em: {new Date(product.createdAt).toLocaleDateString()}</p>}
        {product.lastUpdated && <p className={styles.dateInfo}>Última atualização: {new Date(product.lastUpdated).toLocaleDateString()}</p>}
      </div>
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const productsCol = collection(db, 'products');
  const productSnapshot = await getDocs(productsCol);
  const paths = productSnapshot.docs.map(doc => ({
    params: { id: doc.id },
  }));
  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const productId = context.params?.id as string;
  if (!productId) {
    return { notFound: true };
  }
  try {
    const productDocRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productDocRef);

    if (!productDoc.exists()) {
      return { notFound: true };
    }
    const product = serializeProductData({ id: productDoc.id, ...productDoc.data() });

    // Adicionar lógica para buscar dados de promoção para tamanhosPrecos
    if (product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      product.tamanhosPrecos = product.tamanhosPrecos.map(tp => {
        // Supondo que os campos de promoção (desconto, emPromocao, precoOriginal) venham diretamente do Firestore
        // ou que você tenha uma lógica para calculá-los aqui se não vierem
        // Por exemplo, se eles estiverem aninhados dentro de cada item de tamanhoPreco no Firestore
        const firestoreData = productDoc.data()?.tamanhosPrecos?.find((fsTp: any) => fsTp.tamanho === tp.tamanho);
        return {
          ...tp,
          desconto: firestoreData?.desconto || 0,
          emPromocao: firestoreData?.emPromocao || false,
          precoOriginal: firestoreData?.precoOriginal || tp.preco,
        };
      });
    }

    return {
      props: { product },
      revalidate: 60, 
    };
  } catch (error) {
    console.error("Erro ao buscar produto para página de detalhe:", error);
    return { notFound: true }; 
  }
};

export default ProdutoDetalhePage;