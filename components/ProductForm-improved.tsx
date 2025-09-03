import React, { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs, deleteField } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import styles from '@/styles/ProductForm-improved.module.css';
import CategoryManager from './admin/CategoryManager';

interface OpcaoAdicional {
  nome: string;
  preco?: number;
  limiteMaximo?: number;
}

interface CategoryInternal {
  id: string;
  name: string;
}

interface TamanhoPreco {
  tamanho: string;
  preco: number;
  precoOriginal?: number;
  desconto?: number;
  emPromocao?: boolean;
}

interface Product {
  id?: string;
  name: string;
  description: string;
  tamanhosPrecos: TamanhoPreco[];
  categoryId: string;
  categoryName?: string;
  addons: OpcaoAdicional[];
  highlight: boolean;
  imageUrl?: string;
  pedidoCount?: number;
  price?: number; 
  sizes?: string[];
  originalPrice?: number;
  discountPercentage?: number;
  isOnSale?: boolean;
  category?: string; // Para compatibilidade
}

interface ProductFormProps {
  productToEdit?: Product | null;
  onFormSubmit: () => void;
}

const ProductFormImproved: React.FC<ProductFormProps> = ({ productToEdit, onFormSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tamanhosPrecos, setTamanhosPrecos] = useState<TamanhoPreco[]>([{ 
    tamanho: '', 
    preco: 0,
    precoOriginal: undefined,
    desconto: undefined,
    emPromocao: false
  }]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [existingInternalCategories, setExistingInternalCategories] = useState<CategoryInternal[]>([]);
  const [addons, setAddons] = useState<OpcaoAdicional[]>([]);
  const [highlight, setHighlight] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  useEffect(() => {
    fetchInternalCategories();
  }, []);

  const fetchInternalCategories = async () => {
    try {
      const categoriesCol = collection(db, 'categories');
      const categorySnapshot = await getDocs(categoriesCol);
      const categoriesList = categorySnapshot.docs
        .map(doc => {
          const data = doc.data();
          if (data && typeof data.name === 'string') {
            return { id: doc.id, name: data.name } as CategoryInternal;
          }
          return null;
        })
        .filter(cat => cat !== null) as CategoryInternal[];
      setExistingInternalCategories(categoriesList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error("Erro ao buscar categorias internas: ", err);
    }
  };

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setDescription(productToEdit.description);
      setSelectedCategoryId(productToEdit.categoryId);
      setAddons(productToEdit.addons || []);
      setHighlight(productToEdit.highlight);
      
      if (productToEdit.tamanhosPrecos && productToEdit.tamanhosPrecos.length > 0) {
        setTamanhosPrecos(productToEdit.tamanhosPrecos);
      } else if (productToEdit.price !== undefined) {
        setTamanhosPrecos([{
          tamanho: 'Único',
          preco: productToEdit.price,
          precoOriginal: productToEdit.originalPrice,
          desconto: productToEdit.discountPercentage,
          emPromocao: productToEdit.isOnSale || false
        }]);
      }
    }
  }, [productToEdit]);

  const handleTamanhoPrecoChange = (index: number, field: keyof TamanhoPreco, value: any) => {
    const newTamanhosPrecos = [...tamanhosPrecos];
    newTamanhosPrecos[index] = { ...newTamanhosPrecos[index], [field]: value };
    setTamanhosPrecos(newTamanhosPrecos);
  };

  const addTamanhoPreco = () => {
    setTamanhosPrecos([...tamanhosPrecos, { 
      tamanho: '', 
      preco: 0,
      precoOriginal: undefined,
      desconto: undefined,
      emPromocao: false
    }]);
  };

  const removeTamanhoPreco = (index: number) => {
    if (tamanhosPrecos.length > 1) {
      setTamanhosPrecos(tamanhosPrecos.filter((_, i) => i !== index));
    }
  };

  const handleAddonChange = (index: number, field: keyof OpcaoAdicional, value: any) => {
    const newAddons = [...addons];
    newAddons[index] = { ...newAddons[index], [field]: value };
    setAddons(newAddons);
  };

  const addAddon = () => {
    setAddons([...addons, { nome: '', preco: 0, limiteMaximo: 1 }]);
  };

  const removeAddon = (index: number) => {
    setAddons(addons.filter((_, i) => i !== index));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Erro no upload:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCategoryId) {
      setError('Por favor, selecione uma categoria');
      return;
    }

    const selectedCategory = existingInternalCategories.find(cat => cat.id === selectedCategoryId);
    if (!selectedCategory) {
      setError('Categoria selecionada não encontrada');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl = productToEdit?.imageUrl;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      // Preparar dados do produto
      const productData: any = {
        name: name.trim(),
        description: description.trim(),
        categoryId: selectedCategoryId,
        categoryName: selectedCategory.name,
        category: selectedCategory.name, // Para compatibilidade
        tamanhosPrecos,
        addons: addons.filter(addon => addon.nome.trim() !== ''),
        highlight,
        lastUpdated: serverTimestamp(),
      };

      // Adicionar campos de compatibilidade
      if (tamanhosPrecos.length === 1) {
        productData.price = tamanhosPrecos[0].preco;
        productData.sizes = [tamanhosPrecos[0].tamanho];
        if (tamanhosPrecos[0].precoOriginal) {
          productData.originalPrice = tamanhosPrecos[0].precoOriginal;
        }
        if (tamanhosPrecos[0].desconto) {
          productData.discountPercentage = tamanhosPrecos[0].desconto;
        }
        productData.isOnSale = tamanhosPrecos[0].emPromocao;
      } else {
        productData.sizes = tamanhosPrecos.map(tp => tp.tamanho);
        productData.price = Math.min(...tamanhosPrecos.map(tp => tp.preco));
      }

      if (imageUrl) {
        productData.imageUrl = imageUrl;
      }

      if (productToEdit?.id) {
        // Atualizar produto existente
        const productRef = doc(db, 'products', productToEdit.id);
        await updateDoc(productRef, productData);
      } else {
        // Criar novo produto
        productData.createdAt = serverTimestamp();
        productData.pedidoCount = 0;
        const productsCol = collection(db, 'products');
        await addDoc(productsCol, productData);
      }

      // Reset form
      setName('');
      setDescription('');
      setTamanhosPrecos([{ tamanho: '', preco: 0, precoOriginal: undefined, desconto: undefined, emPromocao: false }]);
      setSelectedCategoryId('');
      setAddons([]);
      setHighlight(false);
      setImageFile(null);
      setUploadProgress(0);

      onFormSubmit();
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
      setError('Erro ao salvar produto. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategoryChange = () => {
    fetchInternalCategories();
    setShowCategoryManager(false);
  };

  return (
    <div className={styles.productForm}>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="name">Nome do Produto:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Descrição:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.formGroup}>
          <div className={styles.categoryHeader}>
            <label htmlFor="category">Categoria:</label>
            <button
              type="button"
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className={styles.manageCategoriesButton}
            >
              {showCategoryManager ? 'Ocultar' : 'Gerenciar Categorias'}
            </button>
          </div>
          
          {showCategoryManager && (
            <div className={styles.categoryManagerContainer}>
              <CategoryManager onCategoryChange={handleCategoryChange} />
            </div>
          )}
          
          <select
            id="category"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            required
            className={styles.select}
          >
            <option value="">Selecione uma categoria</option>
            {existingInternalCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tamanhos e Preços */}
        <div className={styles.formGroup}>
          <label>Tamanhos e Preços:</label>
          {tamanhosPrecos.map((tamanhoPreco, index) => (
            <div key={index} className={styles.tamanhoPrecoGroup}>
              <input
                type="text"
                placeholder="Tamanho (ex: Pequeno, Médio, Grande)"
                value={tamanhoPreco.tamanho}
                onChange={(e) => handleTamanhoPrecoChange(index, 'tamanho', e.target.value)}
                required
                className={styles.input}
              />
              <input
                type="number"
                placeholder="Preço"
                value={tamanhoPreco.preco}
                onChange={(e) => handleTamanhoPrecoChange(index, 'preco', parseFloat(e.target.value) || 0)}
                required
                min="0"
                step="0.01"
                className={styles.input}
              />
              <input
                type="number"
                placeholder="Preço Original (opcional)"
                value={tamanhoPreco.precoOriginal || ''}
                onChange={(e) => handleTamanhoPrecoChange(index, 'precoOriginal', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                step="0.01"
                className={styles.input}
              />
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={tamanhoPreco.emPromocao}
                  onChange={(e) => handleTamanhoPrecoChange(index, 'emPromocao', e.target.checked)}
                />
                Em Promoção
              </label>
              {tamanhosPrecos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTamanhoPreco(index)}
                  className={styles.removeButton}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addTamanhoPreco}
            className={styles.addButton}
          >
            Adicionar Tamanho
          </button>
        </div>

        {/* Adicionais */}
        <div className={styles.formGroup}>
          <label>Adicionais (Opcionais):</label>
          {addons.map((addon, index) => (
            <div key={index} className={styles.addonGroup}>
              <input
                type="text"
                placeholder="Nome do adicional"
                value={addon.nome}
                onChange={(e) => handleAddonChange(index, 'nome', e.target.value)}
                className={styles.input}
              />
              <input
                type="number"
                placeholder="Preço adicional"
                value={addon.preco || ''}
                onChange={(e) => handleAddonChange(index, 'preco', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                step="0.01"
                className={styles.input}
              />
              <input
                type="number"
                placeholder="Limite máximo"
                value={addon.limiteMaximo || ''}
                onChange={(e) => handleAddonChange(index, 'limiteMaximo', e.target.value ? parseInt(e.target.value) : undefined)}
                min="1"
                className={styles.input}
              />
              <button
                type="button"
                onClick={() => removeAddon(index)}
                className={styles.removeButton}
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAddon}
            className={styles.addButton}
          >
            Adicionar Adicional
          </button>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
            />
            Produto em Destaque
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="image">Imagem do Produto:</label>
          <input
            type="file"
            id="image"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className={styles.fileInput}
          />
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={styles.submitButton}
        >
          {isSubmitting ? 'Salvando...' : (productToEdit ? 'Atualizar Produto' : 'Criar Produto')}
        </button>
      </form>
    </div>
  );
};

export default ProductFormImproved;

