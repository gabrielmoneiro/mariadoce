import React from 'react';
import Link from 'next/link';
import { Coffee, Milk, Cake } from 'lucide-react';
import styles from '@/styles/CategoryIcons.module.css';

interface CategoryIconsProps {
  onCategorySelect?: (category: string) => void;
}

const CategoryIcons: React.FC<CategoryIconsProps> = ({ onCategorySelect }) => {
  const categories = [
    {
      id: 'cafes',
      title: 'Cafés &\nCappuccinos',
      icon: Coffee,
      category: 'Cafés'
    },
    {
      id: 'milkshakes',
      title: 'Milkshakes',
      icon: Milk,
      category: 'Milkshakes'
    },
    {
      id: 'bolos',
      title: 'Bolos & Tortas',
      icon: Cake,
      category: 'Bolos'
    }
  ];

  const handleCategoryClick = (category: string) => {
    if (onCategorySelect) {
      onCategorySelect(category);
    }
  };

  return (
    <section className={styles.categoriesSection}>
      <div className={styles.categoriesGrid}>
        {categories.map((category) => {
          const IconComponent = category.icon;
          
          return (
            <button
              key={category.id}
              className={styles.categoryItem}
              onClick={() => handleCategoryClick(category.category)}
            >
              <IconComponent className={styles.categoryIcon} size={48} />
              <span className={styles.categoryTitle}>
                {category.title.split('\n').map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < category.title.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryIcons;

