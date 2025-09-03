import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/styles/ProdutoCard.module.css';

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
  originalPrice?: number;
  discountPercentage?: number;
  isOnSale?: boolean;
}

interface ProdutoCardProps {
  product: Product;
}

const ProdutoCard: React.FC<ProdutoCardProps> = ({ product }) => {
  const getDisplayPrice = (): React.ReactElement => {
    let currentPrice = 0;
    let originalPrice = 0;
    let isMultiplePrice = false;

    if (product.tamanhosPrecos && product.tamanhosPrecos.length > 0) {
      const prices = product.tamanhosPrecos.map(tp => tp.preco).filter(p => typeof p === 'number');
      if (prices.length === 0) return <span>Preço Indisponível</span>;
      currentPrice = Math.min(...prices);
      isMultiplePrice = prices.length > 1;
    } else if (typeof product.price === 'number') {
      currentPrice = product.price;
    } else {
      return <span>Preço Indisponível</span>;
    }

    if (product.isOnSale && product.originalPrice && product.discountPercentage) {
      originalPrice = product.originalPrice;
      const discountedPrice = originalPrice * (1 - product.discountPercentage / 100);
      
      return (
        <div className={styles.priceContainer}>
          <div className={styles.discountBadge}>
            -{product.discountPercentage}%
          </div>
          <div className={styles.priceInfo}>
            <span className={styles.originalPrice}>
              R$ {originalPrice.toFixed(2)}
            </span>
            <span className={styles.currentPrice}>
              {isMultiplePrice ? `A partir de ` : ''}R$ {discountedPrice.toFixed(2)}
            </span>
          </div>
        </div>
      );
    }

    return (
      <span className={styles.currentPrice}>
        {isMultiplePrice ? `A partir de ` : ''}R$ {currentPrice.toFixed(2)}
      </span>
    );
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
          </div>
        )}
        <div className={styles.content}>
          <h3 className={styles.name}>{product.name}</h3>
          <div className={styles.price}>{getDisplayPrice()}</div>
        </div>
      </div>
    </Link>
  );
};

export default ProdutoCard;
