import { useCheckout } from '@/context/CheckoutContext';
import { ScheduleSelection } from '@/lib/scheduleTypes';
import TimeWindowSelector from '@/components/checkout/TimeWindowSelector';
import { useEffect, useState, useRef } from 'react';
import styles from '@/styles/CheckoutFlow.module.css';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isWithinOperatingHours, weekdayFromDate, formatDateKey } from '@/lib/scheduleTypes';

// Componente para integrar o TimeWindowSelector na página de revisão
const ScheduleDeliverySection = () => {
  const { checkoutData, setCheckoutData } = useCheckout();
  const [scheduleSelection, setScheduleSelection] = useState<ScheduleSelection | null>(
    checkoutData.scheduleSelection || null
  );
  const [isRequired, setIsRequired] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Verificar se o agendamento é obrigatório
  useEffect(() => {
    const checkIfSchedulingRequired = async () => {
      try {
        const configRef = doc(db, 'config', 'deliveryConfig');
        const docSnap = await getDoc(configRef);
        
        if (docSnap.exists() && docSnap.data().schedule) {
          const scheduleConfig = docSnap.data().schedule;
          
          // Se o modo for agendamento, sempre é obrigatório
          if (scheduleConfig.mode === 'agendamento') {
            setIsRequired(true);
            return;
          }
          
          // Se for híbrido e estiver fora do horário, é obrigatório
          if (scheduleConfig.mode === 'hibrido') {
            const now = new Date();
            const isOperating = isWithinOperatingHours(now, scheduleConfig);
            setIsRequired(!isOperating);
            return;
          }
          
          setIsRequired(false);
        }
      } catch (err) {
        console.error("Erro ao verificar configurações de agendamento: ", err);
        setIsRequired(false);
      }
    };
    
    checkIfSchedulingRequired();
  }, []);

  // Atualizar o contexto de checkout quando a seleção mudar
  useEffect(() => {
    setCheckoutData(prev => ({
      ...prev,
      scheduleSelection
    }));
  }, [scheduleSelection, setCheckoutData]);

  const handleScheduleSelection = (selection: ScheduleSelection | null) => {
    setScheduleSelection(selection);
  };

  // Determinar o tipo de agendamento baseado no tipo de pedido
  const tipoAgendamento = checkoutData.tipoPedido === 'retirada' ? 'retirada' : 'entrega';

  return (
    <div 
      id="scheduleDeliverySection" 
      className={styles.scheduleDeliverySection}
      ref={sectionRef}
      data-required={isRequired}
    >
      <TimeWindowSelector 
        onSelect={handleScheduleSelection}
        initialSelection={scheduleSelection}
        tipoAgendamento={tipoAgendamento}
      />
    </div>
  );
};

export default ScheduleDeliverySection;
