// Tipos para configuração de agendamento e time windows

export type OperationMode = 'pronta_entrega' | 'agendamento' | 'hibrido';

export type TimeSlot = string; // Formato "HH:MM-HH:MM", ex: "08:00-09:00"

export type WeekdaySlots = {
  [key in Weekday]: TimeSlot[];
};

export type Weekday = 
  'monday' | 
  'tuesday' | 
  'wednesday' | 
  'thursday' | 
  'friday' | 
  'saturday' | 
  'sunday';

export type SpecialDateConfig = {
  slots: TimeSlot[];
  mode: OperationMode | 'fechado';
};

export type SpecialDates = {
  [date: string]: SpecialDateConfig; // Formato da chave: "YYYY-MM-DD"
};

export interface ScheduleConfig {
  mode: OperationMode;
  weekly: WeekdaySlots;
  specialDates: SpecialDates;
  minDaysAhead: number;
  maxDaysAhead: number;
  windowDurationMinutes: number;
}

// Tipo para representar um time window disponível para seleção
export interface AvailableTimeWindow {
  start: string; // Formato "HH:MM"
  end: string;   // Formato "HH:MM"
  display: string; // Formato "HH:MM - HH:MM"
  date: string;  // Formato "YYYY-MM-DD"
}

// Tipo para representar a seleção de agendamento no checkout
export interface ScheduleSelection {
  date: string; // Formato "YYYY-MM-DD"
  timeWindow: string; // Formato "HH:MM-HH:MM"
}

// Funções auxiliares para manipulação de datas e horários
export const weekdayFromDate = (date: Date): Weekday => {
  const days: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0]; // Retorna "YYYY-MM-DD"
};

export const formatTimeDisplay = (timeSlot: string): string => {
  // Converte "08:00-09:00" para "08:00 - 09:00"
  return timeSlot.replace('-', ' - ');
};

export const isWithinOperatingHours = (
  currentDate: Date, 
  config: ScheduleConfig
): boolean => {
  const dateKey = formatDateKey(currentDate);
  const weekday = weekdayFromDate(currentDate);
  const currentTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;
  
  // Verificar datas especiais primeiro
  if (config.specialDates[dateKey]) {
    const specialConfig = config.specialDates[dateKey];
    if (specialConfig.mode === 'fechado') {
      return false;
    }
    
    // Verificar se o horário atual está dentro de algum slot da data especial
    return specialConfig.slots.some(slot => {
      const [start, end] = slot.split('-');
      return currentTime >= start && currentTime <= end;
    });
  }
  
  // Verificar horários semanais regulares
  return config.weekly[weekday].some(slot => {
    const [start, end] = slot.split('-');
    return currentTime >= start && currentTime <= end;
  });
};

export const getDefaultScheduleConfig = (): ScheduleConfig => {
  return {
    mode: 'pronta_entrega',
    weekly: {
      monday: ['08:00-12:00', '14:00-18:00'],
      tuesday: ['08:00-12:00', '14:00-18:00'],
      wednesday: ['08:00-12:00', '14:00-18:00'],
      thursday: ['08:00-12:00', '14:00-18:00'],
      friday: ['08:00-12:00', '14:00-18:00'],
      saturday: ['08:00-12:00'],
      sunday: []
    },
    specialDates: {},
    minDaysAhead: 1,
    maxDaysAhead: 7,
    windowDurationMinutes: 60
  };
};
