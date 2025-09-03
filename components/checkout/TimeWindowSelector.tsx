import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ScheduleConfig, 
  AvailableTimeWindow,
  ScheduleSelection,
  formatDateKey,
  weekdayFromDate,
  formatTimeDisplay,
  isWithinOperatingHours,
  getDefaultScheduleConfig
} from '@/lib/scheduleTypes';
import styles from '@/styles/CheckoutFlow.module.css';
import { showSuccessToast } from '@/utils/toastUtils';

interface TimeWindowSelectorProps {
  onSelect: (selection: ScheduleSelection | null) => void;
  initialSelection?: ScheduleSelection | null;
  tipoAgendamento?: string; // 'entrega' ou 'retirada'
}

const TimeWindowSelector: React.FC<TimeWindowSelectorProps> = ({ onSelect, initialSelection, tipoAgendamento = 'entrega' }) => {
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(getDefaultScheduleConfig());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<string | null>(initialSelection?.date || null);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<string | null>(initialSelection?.timeWindow || null);
  
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimeWindows, setAvailableTimeWindows] = useState<AvailableTimeWindow[]>([]);
  
  // Carregar configurações de agendamento
  useEffect(() => {
    const fetchScheduleConfig = async () => {
      setIsLoading(true);
      try {
        const configRef = doc(db, 'config', 'deliveryConfig');
        const docSnap = await getDoc(configRef);
        
        if (docSnap.exists() && docSnap.data().schedule) {
          setScheduleConfig(docSnap.data().schedule as ScheduleConfig);
        } else {
          // Usar configuração padrão se não existir
          setScheduleConfig(getDefaultScheduleConfig());
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de agendamento: ", err);
        setError("Falha ao carregar as configurações de agendamento.");
      }
      setIsLoading(false);
    };
    
    fetchScheduleConfig();
  }, []);
  
  // Gerar datas disponíveis com base na configuração
  useEffect(() => {
    if (isLoading) return;
    
    const generateAvailableDates = () => {
      const dates: string[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calcular data mínima (hoje + minDaysAhead)
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + scheduleConfig.minDaysAhead);
      
      // Calcular data máxima (hoje + maxDaysAhead)
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + scheduleConfig.maxDaysAhead);
      
      // Gerar todas as datas entre minDate e maxDate
      const currentDate = new Date(minDate);
      while (currentDate <= maxDate) {
        const dateKey = formatDateKey(currentDate);
        
        // Verificar se é uma data especial
        if (scheduleConfig.specialDates[dateKey]) {
          const specialConfig = scheduleConfig.specialDates[dateKey];
          // Adicionar apenas se não estiver fechado
          if (specialConfig.mode !== 'fechado') {
            dates.push(dateKey);
          }
        } 
        // Verificar se há horários configurados para este dia da semana
        else {
          const weekday = weekdayFromDate(currentDate);
          if (scheduleConfig.weekly[weekday].length > 0) {
            dates.push(dateKey);
          }
        }
        
        // Avançar para o próximo dia
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return dates;
    };
    
    const dates = generateAvailableDates();
    setAvailableDates(dates);
    
    // Limpar seleção se a data selecionada não estiver mais disponível
    if (selectedDate && !dates.includes(selectedDate)) {
      setSelectedDate(null);
      setSelectedTimeWindow(null);
      onSelect(null);
    }
  }, [scheduleConfig, isLoading, selectedDate, onSelect]);
  
  // Gerar time windows disponíveis para a data selecionada
  useEffect(() => {
    if (!selectedDate || isLoading) {
      setAvailableTimeWindows([]);
      return;
    }
    
    const generateTimeWindows = (date: string) => {
      const windows: AvailableTimeWindow[] = [];
      const selectedDateObj = new Date(date);
      const dateKey = formatDateKey(selectedDateObj);
      
      // Obter slots de horário para esta data
      let timeSlots: string[] = [];
      
      // Verificar se é uma data especial
      if (scheduleConfig.specialDates[dateKey]) {
        timeSlots = scheduleConfig.specialDates[dateKey].slots;
      } else {
        // Usar horários do dia da semana
        const weekday = weekdayFromDate(selectedDateObj);
        timeSlots = scheduleConfig.weekly[weekday];
      }
      
      // Para cada slot, gerar time windows com base na duração configurada
      timeSlots.forEach(slot => {
        const [startTime, endTime] = slot.split('-');
        
        // Converter para minutos desde o início do dia
        const getMinutes = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };
        
        const startMinutes = getMinutes(startTime);
        const endMinutes = getMinutes(endTime);
        
        // Gerar time windows com a duração configurada
        for (let i = startMinutes; i + scheduleConfig.windowDurationMinutes <= endMinutes; i += scheduleConfig.windowDurationMinutes) {
          const windowStart = `${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}`;
          const windowEnd = `${Math.floor((i + scheduleConfig.windowDurationMinutes) / 60).toString().padStart(2, '0')}:${((i + scheduleConfig.windowDurationMinutes) % 60).toString().padStart(2, '0')}`;
          
          windows.push({
            start: windowStart,
            end: windowEnd,
            display: `${windowStart} - ${windowEnd}`,
            date: dateKey
          });
        }
      });
      
      return windows;
    };
    
    const windows = generateTimeWindows(selectedDate);
    setAvailableTimeWindows(windows);
    
    // Limpar seleção de time window se não estiver mais disponível
    if (selectedTimeWindow) {
      const isAvailable = windows.some(window => `${window.start}-${window.end}` === selectedTimeWindow);
      if (!isAvailable) {
        setSelectedTimeWindow(null);
        onSelect({ date: selectedDate, timeWindow: '' });
      }
    }
  }, [selectedDate, scheduleConfig, isLoading, selectedTimeWindow, onSelect]);
  
  // Verificar se o modo atual permite agendamento
  const isSchedulingAllowed = () => {
    const now = new Date();
    
    // Verificar se estamos dentro do horário de funcionamento
    const isOperating = isWithinOperatingHours(now, scheduleConfig);
    
    switch (scheduleConfig.mode) {
      case 'pronta_entrega':
        return false; // Não permite agendamento
      case 'agendamento':
        return true; // Sempre permite agendamento
      case 'hibrido':
        return !isOperating; // Permite agendamento apenas fora do horário
      default:
        return false;
    }
  };
  
  // Verificar se o modo atual permite pronta entrega
  const isImmediateDeliveryAllowed = () => {
    const now = new Date();
    
    // Verificar se estamos dentro do horário de funcionamento
    const isOperating = isWithinOperatingHours(now, scheduleConfig);
    
    switch (scheduleConfig.mode) {
      case 'pronta_entrega':
        return isOperating; // Permite pronta entrega apenas dentro do horário
      case 'agendamento':
        return false; // Não permite pronta entrega
      case 'hibrido':
        return isOperating; // Permite pronta entrega apenas dentro do horário
      default:
        return false;
    }
  };
  
  // Verificar se o agendamento é obrigatório na situação atual
  const isSchedulingRequired = () => {
    // Se o modo for agendamento, sempre é obrigatório
    if (scheduleConfig.mode === 'agendamento') {
      return true;
    }
    
    // Se for híbrido e estiver fora do horário, é obrigatório
    if (scheduleConfig.mode === 'hibrido') {
      const now = new Date();
      const isOperating = isWithinOperatingHours(now, scheduleConfig);
      return !isOperating;
    }
    
    return false;
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setSelectedTimeWindow(null);
    onSelect({ date: newDate, timeWindow: '' });
  };
  
  const handleTimeWindowChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTimeWindow = e.target.value;
    setSelectedTimeWindow(newTimeWindow);
    
    if (selectedDate && newTimeWindow) {
      onSelect({ date: selectedDate, timeWindow: newTimeWindow });
      showSuccessToast(`Horário de ${tipoAgendamento} selecionado com sucesso!`);
    } else {
      onSelect(null);
    }
  };
  
  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  if (isLoading) {
    return <div className={styles.loadingContainer}>Carregando opções de agendamento...</div>;
  }
  
  if (error) {
    return <div className={styles.errorContainer}>{error}</div>;
  }
  
  // Se for apenas pronta entrega e estiver dentro do horário, não mostrar seletor
  if (!isSchedulingAllowed() && isImmediateDeliveryAllowed()) {
    return (
      <div className={styles.immediateDeliveryContainer}>
        <p className={styles.immediateDeliveryMessage}>
          <strong>Pronta {tipoAgendamento === 'retirada' ? 'Retirada' : 'Entrega'}:</strong> Seu pedido será processado imediatamente.
        </p>
      </div>
    );
  }
  
  // Se não for permitido nem agendamento nem pronta entrega
  if (!isSchedulingAllowed() && !isImmediateDeliveryAllowed()) {
    return (
      <div className={styles.closedContainer}>
        <p className={styles.closedMessage}>
          <strong>Fora do horário de atendimento.</strong> No momento não estamos aceitando pedidos.
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.timeWindowSelectorContainer}>
      <h3 className={styles.sectionTitle}>
        {isSchedulingRequired() ? `Agendar ${tipoAgendamento === 'retirada' ? 'Retirada' : 'Entrega'} (Obrigatório)` : `Agendar ${tipoAgendamento === 'retirada' ? 'Retirada' : 'Entrega'}`}
      </h3>
      
      {availableDates.length === 0 ? (
        <p className={styles.noAvailabilityMessage}>
          Não há datas disponíveis para agendamento no momento.
        </p>
      ) : (
        <>
          <div className={styles.formGroup}>
            <label htmlFor="deliveryDate">
              {isSchedulingRequired() ? 'Selecione uma data: *' : 'Selecione uma data:'}
            </label>
            <select
              id="deliveryDate"
              value={selectedDate || ''}
              onChange={handleDateChange}
              className={`${styles.selectField} ${isSchedulingRequired() && !selectedDate ? styles.requiredField : ''}`}
              required={isSchedulingRequired()}
            >
              <option value="">Selecione uma data</option>
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {formatDateDisplay(date)}
                </option>
              ))}
            </select>
            {isSchedulingRequired() && !selectedDate && (
              <p className={styles.requiredFieldMessage}>
                A seleção de data é obrigatória para prosseguir com o pedido.
              </p>
            )}
          </div>
          
          {selectedDate && (
            <div className={styles.formGroup}>
              <label htmlFor="deliveryTimeWindow">
                {isSchedulingRequired() ? 'Selecione um horário: *' : 'Selecione um horário:'}
              </label>
              <select
                id="deliveryTimeWindow"
                value={selectedTimeWindow || ''}
                onChange={handleTimeWindowChange}
                className={`${styles.selectField} ${isSchedulingRequired() && !selectedTimeWindow ? styles.requiredField : ''}`}
                required={isSchedulingRequired()}
              >
                <option value="">Selecione um horário</option>
                {availableTimeWindows.map((window, index) => (
                  <option key={index} value={`${window.start}-${window.end}`}>
                    {window.display}
                  </option>
                ))}
              </select>
              {isSchedulingRequired() && !selectedTimeWindow && selectedDate && (
                <p className={styles.requiredFieldMessage}>
                  A seleção de horário é obrigatória para prosseguir com o pedido.
                </p>
              )}
            </div>
          )}
          
          {selectedDate && selectedTimeWindow && (
            <div className={styles.selectedTimeWindow}>
              <p>
                <strong>Entrega agendada para:</strong><br />
                {formatDateDisplay(selectedDate)}, entre {formatTimeDisplay(selectedTimeWindow)}
              </p>
            </div>
          )}
          
          {isSchedulingRequired() && (!selectedDate || !selectedTimeWindow) && (
            <div className={styles.schedulingRequiredWarning}>
              <p>
                <strong>Atenção:</strong> O agendamento é obrigatório para este pedido.
                Por favor, selecione uma data e horário para prosseguir.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TimeWindowSelector;
