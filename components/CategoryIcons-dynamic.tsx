import React, { useState, useEffect } from 'react';
import { Coffee, Milk, Cake, ShoppingBag, Cookie, IceCream, Utensils } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from '@/styles/CategoryIcons.module.css';

interface Category {
  id: string;
  name: string;
}

interface CategoryIconsProps {
  onCategorySelect?: (category: string) => void;
}

// Mapeamento de ícones para categorias comuns
const getCategoryIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  
  if (name.includes('café') || name.includes('coffee') || name.includes('cappuccino')) {
    return Coffee;
  }
  if (name.includes('milkshake') || name.includes('milk') || name.includes('leite')) {
    return Milk;
  }
  if (name.includes('bolo') || name.includes('torta') || name.includes('cake') || name.includes('doce')) {
    return Cake;
  }
  if (name.includes('cookie') || name.includes('biscoito')) {
    return Cookie;
  }
  if (name.includes('sorvete') || name.includes('gelado') || name.includes('ice')) {
    return IceCream;
  }
  if (name.includes('comida') || name.includes('prato') || name.includes('refeição')) {
    return Utensils;
  }
  
  // Ícone padrão
  return ShoppingBag;
};

const CategoryIconsDynamic: React.FC<CategoryIconsProps> = ({ onCategorySelect }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const categoriesCol = collection(db, 'categories');
      const categorySnapshot = await getDocs(categoriesCol);
      const categoriesList = categorySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Category[];
      
      // Ordenar categorias alfabeticamente
      setCategories(categoriesList.sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
    } catch (err) {
      console.error("Erro ao buscar categorias: ", err);
      setError("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    if (onCategorySelect) {
      onCategorySelect(categoryName);
    }
  };

  if (loading) {
    return (
      <section className={styles.categoriesSection}>
        <div className={styles.loading}>Carregando categorias...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.categoriesSection}>
        <div className={styles.error}>
          {error}
          <button onClick={fetchCategories} className={styles.retryButton}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className={styles.categoriesSection}>
        <div className={styles.emptyState}>
          Nenhuma categoria encontrada
        </div>
      </section>
    );
  }

  return (
    <section className={styles.categoriesSection}>
      <div className={styles.categoriesGrid}>
        {categories.map((category) => {
          const IconComponent = getCategoryIcon(category.name);
          
          return (
            <button
              key={category.id}
              className={styles.categoryItem}
              onClick={() => handleCategoryClick(category.name)}
              title={`Ver produtos da categoria: ${category.name}`}
            >
              <IconComponent className={styles.categoryIcon} size={48} />
              <span className={styles.categoryTitle}>
                {category.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryIconsDynamic;

