import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/styles/ProdutoCard-ifood.module.css';

interface OpcaoAdicional {
  nome: string;
  preco?: number;
  limiteMaximo?: number;
}

interface TamanhoPreco {
  tamanho: string;
  preco: number;
  precoOriginal?: number;
  desconto?: number;
  emPromocao?: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  tamanhosPrecos?: TamanhoPreco[];
  price?: number;
  sizes?: string[];
  categoryName?: string;
  addons?: OpcaoAdicional[];
  highlight: boolean;
  imageUrl?: string;
  pedidoCount?: number;
  createdAt?: string;
  lastUpdated?: string;
  // Campos antigos para retrocompatibilidade
  originalPrice?: number;
  discountPercentage?: number;
  isOnSale?: boolean;
}

interface ProdutoCardProps {
  product: Product;
}

const ProdutoCardIFood: React.FC<ProdutoCardProps> = ({ product }) => {
  const getDisplayPrice = (): React.ReactElement => {
    // NOVA ESTRUTURA: Verificar tamanhosPrecos com promoção
    if (product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      const tamanhosComPromocao = product.tamanhosPrecos.filter(tp => tp.emPromocao);
      
      if (tamanhosComPromocao.length > 0) {
        // Há promoções - mostrar preço promocional
        const precoPromocional = Math.min(...tamanhosComPromocao.map(tp => tp.preco));
        const precoOriginal = Math.min(...tamanhosComPromocao.map(tp => tp.precoOriginal || tp.preco));
        const desconto = tamanhosComPromocao[0].desconto || 0;
        const isMultiplePrice = product.tamanhosPrecos.length > 1;
        
        return (
          <div className={styles.priceContainer}>
            <div className={styles.priceInfo}>
              <span className={styles.originalPrice}>
                R$ {precoOriginal.toFixed(2)}
              </span>
              <span className={styles.currentPrice}>
                {isMultiplePrice ? `A partir de ` : ''}R$ {precoPromocional.toFixed(2)}
              </span>
            </div>
          </div>
        );
      } else {
        // Sem promoção - mostrar preço normal
        const prices = product.tamanhosPrecos.map(tp => tp.preco).filter(p => typeof p === 'number');
        if (prices.length === 0) return <span>Preço Indisponível</span>;
        
        const currentPrice = Math.min(...prices);
        const isMultiplePrice = prices.length > 1;
        
        return (
          <span className={styles.currentPrice}>
            {isMultiplePrice ? `A partir de ` : ''}R$ {currentPrice.toFixed(2)}
          </span>
        );
      }
    }
    
    // ESTRUTURA ANTIGA: Retrocompatibilidade
    if (product.isOnSale && product.originalPrice && product.discountPercentage) {
      const discountedPrice = product.originalPrice * (1 - product.discountPercentage / 100);
      
      return (
        <div className={styles.priceContainer}>
          <div className={styles.priceInfo}>
            <span className={styles.originalPrice}>
              R$ {product.originalPrice.toFixed(2)}
            </span>
            <span className={styles.currentPrice}>
              R$ {discountedPrice.toFixed(2)}
            </span>
          </div>
        </div>
      );
    } else if (typeof product.price === 'number') {
      return (
        <span className={styles.currentPrice}>
          R$ {product.price.toFixed(2)}
        </span>
      );
    }

    return <span>Preço Indisponível</span>;
  };

  const getDiscountBadge = (): React.ReactElement | null => {
    // NOVA ESTRUTURA: Verificar tamanhosPrecos com promoção
    if (product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      const tamanhosComPromocao = product.tamanhosPrecos.filter(tp => tp.emPromocao);
      
      if (tamanhosComPromocao.length > 0) {
        const desconto = tamanhosComPromocao[0].desconto || 0;
        return (
          <div className={styles.discountBadge}>
            -{desconto}%
          </div>
        );
      }
    }
    
    // ESTRUTURA ANTIGA: Retrocompatibilidade
    if (product.isOnSale && product.discountPercentage) {
      return (
        <div className={styles.discountBadge}>
          -{product.discountPercentage}%
        </div>
      );
    }

    return null;
  };

  return (
    <Link href={`/produto/${product.id}`} passHref className={styles.cardLink}>
      <div className={styles.card}>
        {product.imageUrl && (
          <div className={styles.imageContainer}>
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={300}
              height={200}
              className={styles.image}
              priority={product.highlight}
            />
            {getDiscountBadge()}
          </div>
        )}
        <div className={styles.content}>
          <h3 className={styles.name}>{product.name}</h3>
          <div className={styles.price}>{getDisplayPrice()}</div>
          {product.description && (
            <p className={styles.description}>{product.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProdutoCardIFood;

