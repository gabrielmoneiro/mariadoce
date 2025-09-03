// Utilitário para normalizar nomes de categorias e mapear variações
export const normalizeCategoryName = (categoryName: string): string => {
  const normalized = categoryName.toLowerCase().trim();
  
  // Mapeamento de variações comuns para nomes padronizados
  const categoryMappings: { [key: string]: string } = {
    'cafe': 'Cafés',
    'cafes': 'Cafés',
    'coffee': 'Cafés',
    'cappuccino': 'Cafés',
    'cappuccinos': 'Cafés',
    'café': 'Cafés',
    'cafés': 'Cafés',
    'milkshake': 'Milkshakes',
    'milkshakes': 'Milkshakes',
    'milk shake': 'Milkshakes',
    'milk shakes': 'Milkshakes',
    'bolo': 'Bolos',
    'bolos': 'Bolos',
    'torta': 'Tortas',
    'tortas': 'Tortas',
    'cake': 'Bolos',
    'cakes': 'Bolos',
    'doce': 'Doces',
    'doces': 'Doces',
    'sobremesa': 'Sobremesas',
    'sobremesas': 'Sobremesas',
    'dessert': 'Sobremesas',
    'desserts': 'Sobremesas'
  };

  return categoryMappings[normalized] || categoryName;
};

// Função para verificar se um produto pertence a uma categoria
export const productBelongsToCategory = (product: any, categoryName: string): boolean => {
  const productCategory = product.category || product.categoryName || '';
  const normalizedProductCategory = normalizeCategoryName(productCategory);
  const normalizedSearchCategory = normalizeCategoryName(categoryName);
  
  return normalizedProductCategory === normalizedSearchCategory ||
         productCategory.toLowerCase() === categoryName.toLowerCase();
};

// Função para obter todas as variações de uma categoria
export const getCategoryVariations = (categoryName: string): string[] => {
  const normalized = normalizeCategoryName(categoryName);
  const variations: string[] = [categoryName, normalized];
  
  // Adicionar variações específicas baseadas na categoria normalizada
  switch (normalized) {
    case 'Cafés':
      variations.push('Café', 'Coffee', 'Cappuccino', 'Cappuccinos');
      break;
    case 'Milkshakes':
      variations.push('Milkshake', 'Milk Shake', 'Milk Shakes');
      break;
    case 'Bolos':
      variations.push('Bolo', 'Cake', 'Cakes');
      break;
    case 'Tortas':
      variations.push('Torta');
      break;
  }
  
  return [...new Set(variations)]; // Remove duplicatas
};

