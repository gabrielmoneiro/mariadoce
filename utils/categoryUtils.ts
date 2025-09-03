// Utilitário para normalizar nomes de categorias e mapear variações
// Esta função pode ser menos crítica se a filtragem for por ID, mas ainda útil para exibição.
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
    'desserts': 'Sobremesas',
    'bolos & tortas': 'Bolos & Tortas',
    'bolos e tortas': 'Bolos & Tortas',
    'cafés e cappuccinos': 'Cafés e Cappuccinos',
    'cafes e cappuccinos': 'Cafés e Cappuccinos',
  };

  return categoryMappings[normalized] || 
         normalized.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Função para verificar se um produto pertence a uma categoria pelo ID
export const productBelongsToCategory = (product: any, categoryId: string): boolean => {
  // Compara o categoryId do produto diretamente com o categoryId selecionado
  return product.categoryId === categoryId;
};

// Função para obter todas as variações de uma categoria (manter como está ou ajustar conforme necessidade)
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


