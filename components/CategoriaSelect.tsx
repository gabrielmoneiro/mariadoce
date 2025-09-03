import React, { useState, useEffect } from 'react';


interface Category {
  id: string;
  name: string;
}

interface CategoriaSelectProps {
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  showNewCategoryInput: boolean;
  onToggleNewCategoryInput: (show: boolean) => void;
  newCategoryName: string;
  onNewCategoryNameChange: (name: string) => void;
  onAddNewCategory: () => void;
  existingCategories: Category[];
}

const CategoriaSelectFixed: React.FC<CategoriaSelectProps> = ({
  selectedCategoryId,
  onCategoryChange,
  showNewCategoryInput,
  onToggleNewCategoryInput,
  newCategoryName,
  onNewCategoryNameChange,
  onAddNewCategory,
  existingCategories,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategories(existingCategories);
    setLoading(false);
  }, [existingCategories]);

  return (
    <div className="categoria-select-group">
      <label htmlFor="category">Categoria:</label>
      <select
        id="category"
        value={selectedCategoryId}
        onChange={(e) => onCategoryChange(e.target.value)}
        required
      >
        <option value="">Selecione uma categoria</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onToggleNewCategoryInput(!showNewCategoryInput)}
      >
        {showNewCategoryInput ? 'Cancelar Nova Categoria' : 'Adicionar Nova Categoria'}
      </button>

      {showNewCategoryInput && (
        <div className="new-category-input-group">
          <input
            type="text"
            placeholder="Nome da nova categoria"
            value={newCategoryName}
            onChange={(e) => onNewCategoryNameChange(e.target.value)}
          />
          <button type="button" onClick={onAddNewCategory}>
            Criar Categoria
          </button>
        </div>
      )}

      {loading && <p>A carregar categorias...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default CategoriaSelectFixed;
