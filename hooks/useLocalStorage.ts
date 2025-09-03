import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Estado para armazenar nosso valor
  // Passar a função de estado inicial para useState para que a lógica seja executada apenas uma vez
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Obter do local storage pela chave
      const item = window.localStorage.getItem(key);
      // Parsear o JSON armazenado ou, se não existir, retornar initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // Se houver erro, também retornar initialValue
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // useEffect para atualizar o localStorage quando o estado storedValue mudar
  // Isso é semelhante ao componentDidUpdate ou [] com dependência
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Permitir que o valor seja uma função para ter a mesma API que useState
        const valueToStore = storedValue instanceof Function ? storedValue(storedValue) : storedValue;
        // Salvar estado
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        // Um log mais detalhado pode ser útil aqui
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;

