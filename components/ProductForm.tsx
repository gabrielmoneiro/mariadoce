import React, { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, getDocs, deleteField } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import styles from '@/styles/ProductForm.module.css';
import CategoriaSelect from './CategoriaSelect';

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
}

interface ProductFormProps {
  productToEdit?: Product | null;
  onFormSubmit: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ productToEdit, onFormSubmit }) => {
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
  const [newCategoryName, setNewCategoryName] = useState('');
  const [existingInternalCategories, setExistingInternalCategories] = useState<CategoryInternal[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [addons, setAddons] = useState<OpcaoAdicional[]>([]);
  const [highlight, setHighlight] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        setExistingInternalCategories(categoriesList);
      } catch (err) {
        console.error("Erro ao buscar categorias internas: ", err);
      }
    };
    fetchInternalCategories();
  }, []);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setDescription(productToEdit.description);
      setSelectedCategoryId(productToEdit.categoryId);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setAddons(productToEdit.addons || []);
      setHighlight(productToEdit.highlight);
      setImageFile(null);

      if (productToEdit.tamanhosPrecos && productToEdit.tamanhosPrecos.length > 0) {
        if (productToEdit.tamanhosPrecos[0].hasOwnProperty('emPromocao')) {
          setTamanhosPrecos(productToEdit.tamanhosPrecos);
        } else {
          const tamanhosComPromocao = productToEdit.tamanhosPrecos.map(tp => ({
            ...tp,
            precoOriginal: productToEdit.isOnSale ? productToEdit.originalPrice : undefined,
            desconto: productToEdit.isOnSale ? productToEdit.discountPercentage : undefined,
            emPromocao: productToEdit.isOnSale || false
          }));
          setTamanhosPrecos(tamanhosComPromocao);
        }
      } else if (productToEdit.price !== undefined && productToEdit.sizes && productToEdit.sizes.length > 0) {
        const tamanhosComPromocao = productToEdit.sizes.map(s => ({
          tamanho: s,
          preco: productToEdit.price as number,
          precoOriginal: productToEdit.isOnSale ? productToEdit.originalPrice : undefined,
          desconto: productToEdit.isOnSale ? productToEdit.discountPercentage : undefined,
          emPromocao: productToEdit.isOnSale || false
        }));
        setTamanhosPrecos(tamanhosComPromocao);
      } else if (productToEdit.price !== undefined) {
        setTamanhosPrecos([{
          tamanho: 'Único',
          preco: productToEdit.price as number,
          precoOriginal: productToEdit.isOnSale ? productToEdit.originalPrice : undefined,
          desconto: productToEdit.isOnSale ? productToEdit.discountPercentage : undefined,
          emPromocao: productToEdit.isOnSale || false
        }]);
      }
    } else {
      setName('');
      setDescription('');
      setTamanhosPrecos([{ tamanho: '', preco: 0, precoOriginal: undefined, desconto: undefined, emPromocao: false }]);
      setSelectedCategoryId('');
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setAddons([]);
      setHighlight(false);
      setImageFile(null);
    }
  }, [productToEdit]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]);
  };

  const handleTamanhoPrecoChange = (index: number, field: keyof TamanhoPreco, value: string | number | boolean) => {
    const novosTamanhosPrecos = [...tamanhosPrecos];
    const tamanhoAtual = { ...novosTamanhosPrecos[index] };

    if (field === 'preco' || field === 'precoOriginal' || field === 'desconto') {
      let numericValue: number;
      if (typeof value === 'string') {
        numericValue = parseFloat(value) || 0;
      } else if (typeof value === 'number') {
        numericValue = value;
      } else {
        numericValue = 0; // Trata boolean ou outros tipos inesperados para campos numéricos
      }
      tamanhoAtual[field] = numericValue;
    } else if (field === 'emPromocao') {
      tamanhoAtual[field] = value as boolean;
    } else {
      tamanhoAtual[field] = value as any;
    }

    if (field === 'emPromocao') {
      if (value === true) {
        tamanhoAtual.precoOriginal = tamanhoAtual.preco;
        tamanhoAtual.desconto = 10;
        tamanhoAtual.preco = Math.round(tamanhoAtual.precoOriginal * (1 - tamanhoAtual.desconto / 100) * 100) / 100;
      } else {
        if (tamanhoAtual.precoOriginal) tamanhoAtual.preco = tamanhoAtual.precoOriginal;
        tamanhoAtual.precoOriginal = undefined;
        tamanhoAtual.desconto = undefined;
      }
    } else if (field === 'desconto' && tamanhoAtual.emPromocao && tamanhoAtual.precoOriginal) {
      tamanhoAtual.preco = Math.round(tamanhoAtual.precoOriginal * (1 - tamanhoAtual.desconto! / 100) * 100) / 100;
    } else if (field === 'precoOriginal' && tamanhoAtual.emPromocao && tamanhoAtual.desconto) {
      tamanhoAtual.preco = Math.round(tamanhoAtual.precoOriginal! * (1 - tamanhoAtual.desconto / 100) * 100) / 100;
    }

    novosTamanhosPrecos[index] = tamanhoAtual;
    setTamanhosPrecos(novosTamanhosPrecos);
  };

  const adicionarNovoTamanhoPreco = () => {
    setTamanhosPrecos([...tamanhosPrecos, { tamanho: '', preco: 0, precoOriginal: undefined, desconto: undefined, emPromocao: false }]);
  };

  const removerTamanhoPreco = (index: number) => {
    if (tamanhosPrecos.length <= 1) return setError("Deve haver pelo menos um tamanho e preço.");
    const novosTamanhosPrecos = tamanhosPrecos.filter((_, i) => i !== index);
    setTamanhosPrecos(novosTamanhosPrecos);
    setError(null);
  };

  const handleAddonsChange = (index: number, field: keyof OpcaoAdicional, value: string | number) => {
    const novosAddons = [...addons];
    if (field === 'preco' || field === 'limiteMaximo') {
      novosAddons[index] = { ...novosAddons[index], [field]: value === '' ? null : Number(value) };
    } else {
      novosAddons[index] = { ...novosAddons[index], [field]: value as string };
    }
    setAddons(novosAddons);
  };

  const adicionarNovoAddon = () => setAddons([...addons, { nome: '', preco: undefined, limiteMaximo: undefined }]);
  const removerAddon = (index: number) => setAddons(addons.filter((_, i) => i !== index));

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return setError('O nome da nova categoria não pode estar vazio.');
    const trimmedNewCategoryName = newCategoryName.trim().toLowerCase();
    const categoriaExistente = existingInternalCategories.find(cat => cat.name.toLowerCase() === trimmedNewCategoryName);
    if (categoriaExistente) {
      setSelectedCategoryId(categoriaExistente.id);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      return;
    }
    try {
      const categoriesCol = collection(db, 'categories');
      const docRef = await addDoc(categoriesCol, { name: newCategoryName.trim() });
      setExistingInternalCategories([...existingInternalCategories, { id: docRef.id, name: newCategoryName.trim() }]);
      setSelectedCategoryId(docRef.id);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setError(null);
    } catch (err) {
      console.error("Erro ao adicionar nova categoria: ", err);
      setError('Falha ao adicionar nova categoria.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (tamanhosPrecos.some(tp => !tp.tamanho.trim() || tp.preco <= 0)) return setError('Todos os tamanhos devem ter um nome e um preço maior que zero.');
    if (tamanhosPrecos.length === 0) return setError('Deve haver pelo menos um tamanho e preço definido.');

    setIsSubmitting(true);
    setError(null);

    let imageUrlToSave = productToEdit?.imageUrl || '';
    try {
      if (imageFile) {
        const storageRef = ref(storage, `productImages/${Date.now()}_${imageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            snapshot => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
            error => reject(error),
            () => resolve()
          );
        });
        imageUrlToSave = await getDownloadURL(storageRef);
      }

      const productData: Product = {
        name,
        description,
        tamanhosPrecos,
        categoryId: selectedCategoryId,
        addons,
        highlight,
        imageUrl: imageUrlToSave,
      };

      if (productToEdit?.id) {
        const productDocRef = doc(db, 'products', productToEdit.id);
        await updateDoc(productDocRef, productData as any);
      } else {
        const productsCol = collection(db, 'products');
        await addDoc(productsCol, { ...productData, createdAt: serverTimestamp() });
      }

      onFormSubmit();
    } catch (err) {
      console.error("Erro ao salvar produto: ", err);
      setError('Falha ao salvar produto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <p className={styles.error}>{error}</p>}
      <input type="text" placeholder="Nome do produto" value={name} onChange={e => setName(e.target.value)} required />
      <textarea placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} />

      <CategoriaSelect
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        existingCategories={existingInternalCategories}
        showNewCategoryInput={showNewCategoryInput}
        onToggleNewCategoryInput={setShowNewCategoryInput}
        newCategoryName={newCategoryName}
        onNewCategoryNameChange={setNewCategoryName}
        onAddNewCategory={handleAddNewCategory}
      />

      {tamanhosPrecos.map((tp, index) => (
        <div key={index} className={styles.tamanhoPrecoRow}>
          <input
            type="text"
            placeholder="Tamanho"
            value={tp.tamanho}
            onChange={e => handleTamanhoPrecoChange(index, 'tamanho', e.target.value)}
          />
          <input
            type="number"
            placeholder="Preço"
            value={tp.preco}
            onChange={e => handleTamanhoPrecoChange(index, 'preco', e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={tp.emPromocao || false}
              onChange={e => handleTamanhoPrecoChange(index, 'emPromocao', e.target.checked)}
            />
            Em promoção
          </label>
          {tamanhosPrecos.length > 1 && <button type="button" onClick={() => removerTamanhoPreco(index)}>Remover</button>}
        </div>
      ))}
      <button type="button" onClick={adicionarNovoTamanhoPreco}>Adicionar Tamanho</button>

      <div className={styles.addons}>
        {addons.map((addon, index) => (
          <div key={index}>
            <input
              type="text"
              placeholder="Nome do adicional"
              value={addon.nome}
              onChange={e => handleAddonsChange(index, 'nome', e.target.value)}
            />
            <input
              type="number"
              placeholder="Preço"
              value={addon.preco || ''}
              onChange={e => handleAddonsChange(index, 'preco', e.target.value)}
            />
            <input
              type="number"
              placeholder="Limite máximo"
              value={addon.limiteMaximo || ''}
              onChange={e => handleAddonsChange(index, 'limiteMaximo', e.target.value)}
            />
            <button type="button" onClick={() => removerAddon(index)}>Remover</button>
          </div>
        ))}
        <button type="button" onClick={adicionarNovoAddon}>Adicionar Adicional</button>
      </div>

      <label>
        <input type="checkbox" checked={highlight} onChange={e => setHighlight(e.target.checked)} />
        Destaque
      </label>

      <input type="file" accept="image/*" onChange={handleImageChange} />
      {uploadProgress > 0 && <p>Progresso do upload: {uploadProgress}%</p>}

      <button type="submit" disabled={isSubmitting}>{productToEdit ? 'Atualizar Produto' : 'Adicionar Produto'}</button>
    </form>
  );
};

export default ProductForm;
