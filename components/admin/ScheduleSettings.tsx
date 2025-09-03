import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from '@/styles/AdminSettings.module.css';
import { 
  ScheduleConfig, 
  OperationMode, 
  Weekday, 
  TimeSlot,
  SpecialDateConfig,
  getDefaultScheduleConfig
} from '@/lib/scheduleTypes';

interface ScheduleSettingsProps {
  onSave?: () => void;
  onError?: (error: string) => void;
}

const WEEKDAYS_PT = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo'
};

const OPERATION_MODES = [
  { id: 'pronta_entrega', label: 'Pronta Entrega' },
  { id: 'agendamento', label: 'Agendamento' },
  { id: 'hibrido', label: 'Híbrido' }
];

const SPECIAL_DATE_MODES = [
  { id: 'fechado', label: 'Fechado' },
  { id: 'pronta_entrega', label: 'Pronta Entrega' },
  { id: 'agendamento', label: 'Agendamento' },
  { id: 'hibrido', label: 'Híbrido' }
];

const ScheduleSettings: React.FC<ScheduleSettingsProps> = ({ onSave, onError }) => {
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(getDefaultScheduleConfig());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para nova data especial
  const [newSpecialDate, setNewSpecialDate] = useState<string>('');
  const [newSpecialDateMode, setNewSpecialDateMode] = useState<OperationMode | 'fechado'>('fechado');
  const [newSpecialDateSlots, setNewSpecialDateSlots] = useState<TimeSlot[]>(['09:00-10:00']);
  
  // Estado para novo slot de horário (para dias da semana ou datas especiais)
  const [newTimeSlot, setNewTimeSlot] = useState<{start: string, end: string}>({
    start: '09:00',
    end: '10:00'
  });
  
  // Estado para edição de data especial
  const [editingSpecialDate, setEditingSpecialDate] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduleConfig();
  }, []);

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
      if (onError) onError("Falha ao carregar as configurações de agendamento.");
    }
    setIsLoading(false);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const configRef = doc(db, 'config', 'deliveryConfig');
      await setDoc(configRef, { schedule: scheduleConfig }, { merge: true });
      setSuccessMessage("Configurações de agendamento salvas com sucesso!");
      if (onSave) onSave();
    } catch (err) {
      console.error("Erro ao salvar configurações de agendamento: ", err);
      setError("Falha ao salvar as configurações. Tente novamente.");
      if (onError) onError("Falha ao salvar as configurações de agendamento.");
    }
    
    setIsSaving(false);
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as OperationMode;
    setScheduleConfig(prev => ({
      ...prev,
      mode: value
    }));
  };

  const handleMinDaysAheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setScheduleConfig(prev => ({
        ...prev,
        minDaysAhead: value
      }));
    }
  };

  const handleMaxDaysAheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setScheduleConfig(prev => ({
        ...prev,
        maxDaysAhead: value
      }));
    }
  };

  const handleWindowDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setScheduleConfig(prev => ({
        ...prev,
        windowDurationMinutes: value
      }));
    }
  };

  const addTimeSlotToWeekday = (weekday: Weekday) => {
    const newSlot = `${newTimeSlot.start}-${newTimeSlot.end}`;
    
    // Verificar se o slot já existe
    if (scheduleConfig.weekly[weekday].includes(newSlot)) {
      setError(`Este horário já existe para ${WEEKDAYS_PT[weekday]}.`);
      return;
    }
    
    setScheduleConfig(prev => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [weekday]: [...prev.weekly[weekday], newSlot].sort()
      }
    }));
  };

  const removeTimeSlotFromWeekday = (weekday: Weekday, slotToRemove: string) => {
    setScheduleConfig(prev => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [weekday]: prev.weekly[weekday].filter(slot => slot !== slotToRemove)
      }
    }));
  };

  const handleAddSpecialDate = () => {
    if (!newSpecialDate) {
      setError("Selecione uma data para adicionar.");
      return;
    }
    
    // Verificar se a data já existe
    if (scheduleConfig.specialDates[newSpecialDate]) {
      setError("Esta data especial já está configurada.");
      return;
    }
    
    let slots: TimeSlot[] = [];
    
    // Se não for fechado, adicionar os slots
    if (newSpecialDateMode !== 'fechado') {
      slots = newSpecialDateSlots;
    }
    
    setScheduleConfig(prev => ({
      ...prev,
      specialDates: {
        ...prev.specialDates,
        [newSpecialDate]: {
          mode: newSpecialDateMode,
          slots: slots
        }
      }
    }));
    
    // Limpar campos
    setNewSpecialDate('');
    setNewSpecialDateMode('fechado');
    setNewSpecialDateSlots(['09:00-10:00']);
  };

  const removeSpecialDate = (dateToRemove: string) => {
    const { [dateToRemove]: _, ...remainingDates } = scheduleConfig.specialDates;
    
    setScheduleConfig(prev => ({
      ...prev,
      specialDates: remainingDates
    }));
    
    if (editingSpecialDate === dateToRemove) {
      setEditingSpecialDate(null);
    }
  };

  const addTimeSlotToSpecialDate = (date: string) => {
    const newSlot = `${newTimeSlot.start}-${newTimeSlot.end}`;
    
    // Verificar se o slot já existe
    if (scheduleConfig.specialDates[date].slots.includes(newSlot)) {
      setError(`Este horário já existe para a data ${date}.`);
      return;
    }
    
    setScheduleConfig(prev => ({
      ...prev,
      specialDates: {
        ...prev.specialDates,
        [date]: {
          ...prev.specialDates[date],
          slots: [...prev.specialDates[date].slots, newSlot].sort()
        }
      }
    }));
  };

  const removeTimeSlotFromSpecialDate = (date: string, slotToRemove: string) => {
    setScheduleConfig(prev => ({
      ...prev,
      specialDates: {
        ...prev.specialDates,
        [date]: {
          ...prev.specialDates[date],
          slots: prev.specialDates[date].slots.filter(slot => slot !== slotToRemove)
        }
      }
    }));
  };

  const handleSpecialDateModeChange = (date: string, mode: OperationMode | 'fechado') => {
    setScheduleConfig(prev => ({
      ...prev,
      specialDates: {
        ...prev.specialDates,
        [date]: {
          ...prev.specialDates[date],
          mode: mode
        }
      }
    }));
  };

  const formatTimeSlot = (slot: string) => {
    return slot.replace('-', ' - ');
  };

  if (isLoading) {
    return <div className={styles.loadingContainer}>Carregando configurações de agendamento...</div>;
  }

  return (
    <div className={styles.scheduleSettingsContainer}>
      <h2>Configurações de Agendamento</h2>
      
      {error && <p className={styles.error}>{error}</p>}
      {successMessage && <p className={styles.success}>{successMessage}</p>}
      
      <div className={styles.formSection}>
        <h3>Modo de Operação</h3>
        <div className={styles.formGroup}>
          <label htmlFor="operationMode">Selecione o modo de operação:</label>
          <select 
            id="operationMode" 
            value={scheduleConfig.mode} 
            onChange={handleModeChange}
            className={styles.selectField}
          >
            {OPERATION_MODES.map(mode => (
              <option key={mode.id} value={mode.id}>{mode.label}</option>
            ))}
          </select>
        </div>
        
        <div className={styles.modeDescription}>
          {scheduleConfig.mode === 'pronta_entrega' && (
            <p>Modo <strong>Pronta Entrega</strong>: Libera apenas pedidos imediatos durante o horário de funcionamento.</p>
          )}
          {scheduleConfig.mode === 'agendamento' && (
            <p>Modo <strong>Agendamento</strong>: Só aceita pedidos agendados em time windows futuros.</p>
          )}
          {scheduleConfig.mode === 'hibrido' && (
            <p>Modo <strong>Híbrido</strong>: Aceita pronta entrega dentro do horário e agendamento fora dele.</p>
          )}
        </div>
      </div>
      
      <div className={styles.formSection}>
        <h3>Configuração de Time Windows</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="minDaysAhead">Tempo mínimo de antecedência (dias):</label>
            <input 
              type="number" 
              id="minDaysAhead" 
              value={scheduleConfig.minDaysAhead} 
              onChange={handleMinDaysAheadChange}
              min="0"
              className={styles.inputField}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="maxDaysAhead">Tempo máximo de antecedência (dias):</label>
            <input 
              type="number" 
              id="maxDaysAhead" 
              value={scheduleConfig.maxDaysAhead} 
              onChange={handleMaxDaysAheadChange}
              min="1"
              className={styles.inputField}
            />
          </div>
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="windowDuration">Duração padrão do time window (minutos):</label>
          <input 
            type="number" 
            id="windowDuration" 
            value={scheduleConfig.windowDurationMinutes} 
            onChange={handleWindowDurationChange}
            min="15"
            step="15"
            className={styles.inputField}
          />
        </div>
      </div>
      
      <div className={styles.formSection}>
        <h3>Horários Semanais</h3>
        
        <div className={styles.timeSlotControls}>
          <div className={styles.formGroup}>
            <label>Novo horário:</label>
            <div className={styles.timeInputGroup}>
              <input 
                type="time" 
                value={newTimeSlot.start} 
                onChange={(e) => setNewTimeSlot(prev => ({ ...prev, start: e.target.value }))}
                className={styles.timeInput}
              />
              <span>até</span>
              <input 
                type="time" 
                value={newTimeSlot.end} 
                onChange={(e) => setNewTimeSlot(prev => ({ ...prev, end: e.target.value }))}
                className={styles.timeInput}
              />
            </div>
          </div>
        </div>
        
        {Object.entries(WEEKDAYS_PT).map(([day, label]) => (
          <div key={day} className={styles.weekdaySection}>
            <h4>{label}</h4>
            <div className={styles.timeSlotList}>
              {scheduleConfig.weekly[day as Weekday].length > 0 ? (
                scheduleConfig.weekly[day as Weekday].map((slot, index) => (
                  <div key={index} className={styles.timeSlotItem}>
                    <span>{formatTimeSlot(slot)}</span>
                    <button 
                      onClick={() => removeTimeSlotFromWeekday(day as Weekday, slot)}
                      className={styles.removeButton}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.noSlotsMessage}>Nenhum horário configurado</p>
              )}
            </div>
            <button 
              onClick={() => addTimeSlotToWeekday(day as Weekday)}
              className={styles.addButton}
              type="button"
            >
              Adicionar Horário
            </button>
          </div>
        ))}
      </div>
      
      <div className={styles.formSection}>
        <h3>Datas Especiais</h3>
        
        <div className={styles.specialDateControls}>
          <div className={styles.formGroup}>
            <label htmlFor="newSpecialDate">Nova data especial:</label>
            <input 
              type="date" 
              id="newSpecialDate" 
              value={newSpecialDate} 
              onChange={(e) => setNewSpecialDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="newSpecialDateMode">Modo de operação:</label>
            <select 
              id="newSpecialDateMode" 
              value={newSpecialDateMode} 
              onChange={(e) => setNewSpecialDateMode(e.target.value as OperationMode | 'fechado')}
              className={styles.selectField}
            >
              {SPECIAL_DATE_MODES.map(mode => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>
          </div>
          
          {newSpecialDateMode !== 'fechado' && (
            <div className={styles.timeSlotControls}>
              <div className={styles.formGroup}>
                <label>Horários:</label>
                <div className={styles.timeInputGroup}>
                  <input 
                    type="time" 
                    value={newTimeSlot.start} 
                    onChange={(e) => setNewTimeSlot(prev => ({ ...prev, start: e.target.value }))}
                    className={styles.timeInput}
                  />
                  <span>até</span>
                  <input 
                    type="time" 
                    value={newTimeSlot.end} 
                    onChange={(e) => setNewTimeSlot(prev => ({ ...prev, end: e.target.value }))}
                    className={styles.timeInput}
                  />
                </div>
                <button 
                  onClick={() => {
                    const newSlot = `${newTimeSlot.start}-${newTimeSlot.end}`;
                    if (!newSpecialDateSlots.includes(newSlot)) {
                      setNewSpecialDateSlots(prev => [...prev, newSlot].sort());
                    }
                  }}
                  className={styles.addButton}
                  type="button"
                >
                  Adicionar Horário
                </button>
              </div>
              
              <div className={styles.timeSlotList}>
                {newSpecialDateSlots.map((slot, index) => (
                  <div key={index} className={styles.timeSlotItem}>
                    <span>{formatTimeSlot(slot)}</span>
                    <button 
                      onClick={() => setNewSpecialDateSlots(prev => prev.filter(s => s !== slot))}
                      className={styles.removeButton}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button 
            onClick={handleAddSpecialDate}
            className={styles.addButton}
            type="button"
          >
            Adicionar Data Especial
          </button>
        </div>
        
        <div className={styles.specialDatesList}>
          <h4>Datas especiais configuradas:</h4>
          {Object.keys(scheduleConfig.specialDates).length > 0 ? (
            Object.entries(scheduleConfig.specialDates).map(([date, config]) => (
              <div key={date} className={styles.specialDateItem}>
                <div className={styles.specialDateHeader}>
                  <h5>{new Date(date).toLocaleDateString('pt-BR')}</h5>
                  <div className={styles.specialDateActions}>
                    <button 
                      onClick={() => setEditingSpecialDate(editingSpecialDate === date ? null : date)}
                      className={styles.editButton}
                      type="button"
                    >
                      {editingSpecialDate === date ? 'Fechar' : 'Editar'}
                    </button>
                    <button 
                      onClick={() => removeSpecialDate(date)}
                      className={styles.removeButton}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                
                <div className={styles.specialDateInfo}>
                  <p>
                    <strong>Modo:</strong> {
                      config.mode === 'fechado' ? 'Fechado' :
                      config.mode === 'pronta_entrega' ? 'Pronta Entrega' :
                      config.mode === 'agendamento' ? 'Agendamento' : 'Híbrido'
                    }
                  </p>
                  
                  {config.mode !== 'fechado' && (
                    <div className={styles.specialDateSlots}>
                      <p><strong>Horários:</strong></p>
                      {config.slots.length > 0 ? (
                        <ul>
                          {config.slots.map((slot, index) => (
                            <li key={index}>{formatTimeSlot(slot)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>Nenhum horário configurado</p>
                      )}
                    </div>
                  )}
                </div>
                
                {editingSpecialDate === date && (
                  <div className={styles.specialDateEditForm}>
                    <div className={styles.formGroup}>
                      <label htmlFor={`mode-${date}`}>Modo de operação:</label>
                      <select 
                        id={`mode-${date}`} 
                        value={config.mode} 
                        onChange={(e) => handleSpecialDateModeChange(date, e.target.value as OperationMode | 'fechado')}
                        className={styles.selectField}
                      >
                        {SPECIAL_DATE_MODES.map(mode => (
                          <option key={mode.id} value={mode.id}>{mode.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {config.mode !== 'fechado' && (
                      <div className={styles.timeSlotControls}>
                        <div className={styles.formGroup}>
                          <label>Adicionar horário:</label>
                          <div className={styles.timeInputGroup}>
                            <input 
                              type="time" 
                              value={newTimeSlot.start} 
                              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, start: e.target.value }))}
                              className={styles.timeInput}
                            />
                            <span>até</span>
                            <input 
                              type="time" 
                              value={newTimeSlot.end} 
                              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, end: e.target.value }))}
                              className={styles.timeInput}
                            />
                          </div>
                          <button 
                            onClick={() => addTimeSlotToSpecialDate(date)}
                            className={styles.addButton}
                            type="button"
                          >
                            Adicionar Horário
                          </button>
                        </div>
                        
                        <div className={styles.timeSlotList}>
                          {config.slots.map((slot, index) => (
                            <div key={index} className={styles.timeSlotItem}>
                              <span>{formatTimeSlot(slot)}</span>
                              <button 
                                onClick={() => removeTimeSlotFromSpecialDate(date, slot)}
                                className={styles.removeButton}
                                type="button"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className={styles.noSpecialDatesMessage}>Nenhuma data especial configurada</p>
          )}
        </div>
      </div>
      
      <div className={styles.formActions}>
        <button 
          onClick={handleSaveConfig}
          disabled={isSaving}
          className={styles.saveButton}
          type="button"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
};

export default ScheduleSettings;
