import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Trash2, Plus, Edit2, Save, X } from 'lucide-react';
import styles from '@/styles/CategoryManager.module.css';

interface Category {
  id: string;
  name: string;
  createdAt?: any;
}

interface CategoryManagerProps {
  onCategoryChange?: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ onCategoryChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
        ...doc.data()
      })) as Category[];
      
      setCategories(categoriesList.sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
    } catch (err) {
      console.error("Erro ao buscar categorias: ", err);
      setError("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError("Nome da categoria é obrigatório");
      return;
    }

    // Verificar se já existe uma categoria com esse nome
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    
    if (existingCategory) {
      setError("Já existe uma categoria com esse nome");
      return;
    }

    try {
      setIsAdding(true);
      const categoriesCol = collection(db, 'categories');
      await addDoc(categoriesCol, {
        name: newCategoryName.trim(),
        createdAt: serverTimestamp()
      });
      
      setNewCategoryName('');
      setError(null);
      await fetchCategories();
      
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error("Erro ao adicionar categoria: ", err);
      setError("Erro ao adicionar categoria");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditCategory = async (categoryId: string) => {
    if (!editingName.trim()) {
      setError("Nome da categoria é obrigatório");
      return;
    }

    // Verificar se já existe uma categoria com esse nome (exceto a atual)
    const existingCategory = categories.find(
      cat => cat.name.toLowerCase() === editingName.trim().toLowerCase() && cat.id !== categoryId
    );
    
    if (existingCategory) {
      setError("Já existe uma categoria com esse nome");
      return;
    }

    try {
      const categoryRef = doc(db, 'categories', categoryId);
      await updateDoc(categoryRef, {
        name: editingName.trim()
      });
      
      setEditingId(null);
      setEditingName('');
      setError(null);
      await fetchCategories();
      
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error("Erro ao editar categoria: ", err);
      setError("Erro ao editar categoria");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // Verificar se existem produtos usando esta categoria
      const productsCol = collection(db, 'products');
      const productsQuery = query(productsCol, where('categoryId', '==', categoryId));
      const productsSnapshot = await getDocs(productsQuery);
      
      if (!productsSnapshot.empty) {
        setError(`Não é possível excluir esta categoria pois existem ${productsSnapshot.size} produto(s) associado(s) a ela. Remova ou altere a categoria dos produtos primeiro.`);
        setDeleteConfirm(null);
        return;
      }

      // Excluir a categoria
      const categoryRef = doc(db, 'categories', categoryId);
      await deleteDoc(categoryRef);
      
      setDeleteConfirm(null);
      setError(null);
      await fetchCategories();
      
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error("Erro ao excluir categoria: ", err);
      setError("Erro ao excluir categoria");
      setDeleteConfirm(null);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setError(null);
  };

  if (loading) {
    return <div className={styles.loading}>Carregando categorias...</div>;
  }

  return (
    <div className={styles.categoryManager}>
      <div className={styles.header}>
        <h3>Gerenciar Categorias</h3>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {/* Adicionar nova categoria */}
      <div className={styles.addCategory}>
        <input
          type="text"
          placeholder="Nome da nova categoria"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
          className={styles.input}
        />
        <button
          onClick={handleAddCategory}
          disabled={isAdding || !newCategoryName.trim()}
          className={styles.addButton}
        >
          <Plus size={16} />
          {isAdding ? 'Adicionando...' : 'Adicionar'}
        </button>
      </div>

      {/* Lista de categorias */}
      <div className={styles.categoriesList}>
        {categories.length === 0 ? (
          <div className={styles.emptyState}>
            Nenhuma categoria encontrada
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className={styles.categoryItem}>
              {editingId === category.id ? (
                <div className={styles.editMode}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleEditCategory(category.id)}
                    className={styles.input}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button
                      onClick={() => handleEditCategory(category.id)}
                      className={styles.saveButton}
                      title="Salvar"
                    >
                      <Save size={16} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className={styles.cancelButton}
                      title="Cancelar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.viewMode}>
                  <span className={styles.categoryName}>{category.name}</span>
                  <div className={styles.actions}>
                    <button
                      onClick={() => startEdit(category)}
                      className={styles.editButton}
                      title="Editar categoria"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(category.id)}
                      className={styles.deleteButton}
                      title="Excluir categoria"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmação de exclusão */}
              {deleteConfirm === category.id && (
                <div className={styles.deleteConfirm}>
                  <p>Tem certeza que deseja excluir a categoria "{category.name}"?</p>
                  <div className={styles.confirmActions}>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className={styles.confirmDelete}
                    >
                      Sim, excluir
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className={styles.cancelDelete}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CategoryManager;

