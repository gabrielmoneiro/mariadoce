import React, { useState, useEffect } from 'react';
import { GetStaticProps } from 'next';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/router';
import { Search } from 'lucide-react';
import styles from '@/styles/Home.module.css';
import ProdutoCardIFood from '@/components/ProdutoCard-ifood';
import { productBelongsToCategory } from '@/utils/categoryUtils';

import CategoryIconsDynamic from '@/components/CategoryIcons-dynamic';
import BottomNavigationNew from '@/components/BottomNavigation-new';
 // Importar o componente Header

interface OpcaoAdicional {
  nome: string;
  preco?: number;
  limiteMaximo?: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string; 
  categoryId?: string; // Adicionado para armazenar o ID da categoria
  sizes: string[];
  addons: OpcaoAdicional[];
  highlight: boolean;
  imageUrl?: string;
  pedidoCount?: number;
  createdAt?: string; 
  lastUpdated?: string;
  originalPrice?: number; // Preço original antes do desconto
  discountPercentage?: number; // Porcentagem de desconto
  isOnSale?: boolean; // Se o produto está em promoção
  tamanhosPrecos?: any[]; // Para compatibilidade com ProdutoCard
}

interface HomeProps {
  allProducts: Product[]; // Passar todos os produtos para filtragem no cliente
  initialCategories: { id: string; name: string }[]; // Alterado para incluir ID e nome
}

const serializeProductData = (productData: any): Product => {
  const data = { ...productData };
  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  if (!data.addons) data.addons = [];
  if (!data.sizes) data.sizes = [];
  return data as Product;
};

const Home: React.FC<HomeProps> = ({ allProducts, initialCategories }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Agora armazena o ID da categoria
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null); // Para exibir o nome
  const [searchTerm, setSearchTerm] = useState<string>('');
  const router = useRouter();

  // Mapeamento de IDs para nomes de categorias para exibição
  const [categoryNamesMap, setCategoryNamesMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    initialCategories.forEach(cat => {
      map.set(cat.id, cat.name);
    });
    setCategoryNamesMap(map);
  }, [initialCategories]);

  useEffect(() => {
    if (selectedCategory && categoryNamesMap.has(selectedCategory)) {
      setSelectedCategoryName(categoryNamesMap.get(selectedCategory)!);
    } else {
      setSelectedCategoryName(null);
    }
  }, [selectedCategory, categoryNamesMap]);

  // Atualizar o termo de pesquisa quando a query mudar
  useEffect(() => {
    const searchQuery = router.query.search as string;
    if (searchQuery) {
      setSearchTerm(searchQuery);
    } else {
      setSearchTerm('');
    }
  }, [router.query.search]);

  // Função para filtrar produtos por pesquisa
  const filterProductsBySearch = (products: Product[], term: string): Product[] => {
    if (!term.trim()) return products;
    
    const searchTermLower = term.toLowerCase().trim();
    return products.filter(product => {
      const name = product.name || '';
      const description = product.description || '';
      const category = product.category || ''; // Nome da categoria antiga
      const categoryName = (product as any).categoryName || ''; // Nome da categoria antiga
      
      return name.toLowerCase().includes(searchTermLower) ||
             description.toLowerCase().includes(searchTermLower) ||
             category.toLowerCase().includes(searchTermLower) ||
             categoryName.toLowerCase().includes(searchTermLower);
    });
  };

  // Aplicar filtros de categoria e pesquisa
  let filteredProducts = allProducts;
  
  // Primeiro filtrar por categoria se selecionada (agora usando ID)
  if (selectedCategory) {
    filteredProducts = filteredProducts.filter(p => 
      productBelongsToCategory(p, selectedCategory)
    );
  }
  
  // Depois filtrar por pesquisa se houver termo
  if (searchTerm) {
    filteredProducts = filterProductsBySearch(filteredProducts, searchTerm);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/?search=${encodeURIComponent(searchTerm.trim())}`, undefined, { shallow: true });
    }
  };

  const handleCategorySelect = (categoryId: string) => { // Recebe o ID da categoria
    setSelectedCategory(categoryId);
    setSearchTerm('');
    router.push('/', undefined, { shallow: true });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    router.push('/', undefined, { shallow: true });
  };

  return (
    <div className={styles.pageContainer}>

      <div className={styles.mainContent}>
        {/* Search Section */}
        <section className={styles.searchSection}>
          <form onSubmit={handleSearch} className={styles.searchContainer}>
            <input
              type="text"
              placeholder="O que vai adoçar seu dia hoje?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <Search className={styles.searchIcon} size={20} />
          </form>
        </section>



        {/* Categories Section - Only show if no search */}
        {!searchTerm && (
          <CategoryIconsDynamic onCategorySelect={handleCategorySelect} />
        )}

        {/* Products Section */}
        <section className={styles.productsSection}>
          {searchTerm && (
            <div className={styles.searchResults}>
              <h2 className={styles.searchResultsTitle}>
                Resultados para "{searchTerm}"
              </h2>
              {filteredProducts.length === 0 && (
                <div className={styles.noResults}>
                  <p>Nenhum produto encontrado</p>
                  <button 
                    onClick={clearFilters}
                    className={styles.clearFiltersButton}
                  >
                    Limpar busca
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedCategory && !searchTerm && (
            <div className={styles.searchResults}>
              <h2 className={styles.searchResultsTitle}>
                {selectedCategoryName || 'Carregando Categoria...'} {/* Exibe o nome da categoria */}
              </h2>
              <button 
                onClick={clearFilters}
                className={styles.clearFiltersButton}
              >
                Ver todos os produtos
              </button>
              {filteredProducts.length === 0 && (
                <div className={styles.noResults}>
                  <p>Nenhum produto encontrado nesta categoria</p>
                </div>
              )}
            </div>
          )}

          {filteredProducts.length > 0 && (
            <ul className={styles.productListGrid}>
              {filteredProducts.map((product) => (
                <li key={product.id}>
                  <ProdutoCardIFood product={product} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigationNew onHomeClick={clearFilters} />
    </div>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  try {
    const productsCol = collection(db, 'products');
    const productSnapshot = await getDocs(query(productsCol, orderBy('name')));

    const allProducts: Product[] = productSnapshot.docs.map(doc => 
      serializeProductData({ id: doc.id, ...doc.data() })
    );

    // Retornar as categorias com seus IDs e nomes para o frontend
    const categoriesCol = collection(db, 'categories');
    const categorySnapshot = await getDocs(categoriesCol);
    const initialCategories = categorySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

    return {
      props: {
        allProducts,
        initialCategories,
      },
      revalidate: 60, 
    };
  } catch (error) {
    console.error("Erro ao buscar produtos para props estáticas: ", error);
    return {
      props: {
        allProducts: [],
        initialCategories: [],
      },
      revalidate: 10, 
    };
  }
};

export default Home;


