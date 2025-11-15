import React, { useState, useMemo } from 'react';
import type { Bookings, View, ConsolidatedBooking, ShiftAssignments, BookingDetails, SpecialEvents, SpecialEvent, Vacations } from '../../types';
import { SPACES, TIME_SLOTS, WORKERS } from '../../constants';
import { getWeekData, formatDateForBookingKey } from '../../utils/dateUtils';
import SunIcon from '../icons/SunIcon';
import MoonIcon from '../icons/MoonIcon';
import StarIcon from '../icons/StarIcon';
import { consolidateBookingsForDay } from '../../utils/bookingUtils';
import DownloadIcon from '../icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateCalendarPDF } from '../../utils/pdfUtils';
import PlusIcon from '../icons/PlusIcon';


interface CalendarViewProps {
    bookings: Bookings;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    setView: (view: View) => void;
    shiftAssignments: ShiftAssignments;
    specialEvents: SpecialEvents;
    vacations: Vacations;
    onAddBooking: (bookingKeys: string[], bookingDetails: BookingDetails) => Promise<boolean>;
    onSelectSpecialEvent: (event: SpecialEvent) => void;
    isReadOnly: boolean;
}

const CalendarView: React.FC<CalendarViewProps> = ({ bookings, selectedDate, onDateChange, setView, shiftAssignments, specialEvents, vacations, onAddBooking, onSelectSpecialEvent, isReadOnly }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    const [isDownloading, setIsDownloading] = useState(false);

    const isSalaOnly = (booking: ConsolidatedBooking): boolean => {
        if (!booking.keys || booking.keys.length === 0) return false;
        const spaceIds = new Set(booking.keys.map(key => key.split('-').slice(0, -4).join('-')));
        for (const id of spaceIds) {
            const spaceInfo = SPACES.find(s => s.id === id);
            if (!spaceInfo || spaceInfo.group !== 'Salas') {
                return false;
            }
        }
        return spaceIds.size > 0;
    };

    const days = useMemo(() => {
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const dayOfWeek = startOfMonth.getDay();
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        const startDate = new Date(startOfMonth);
        startDate.setDate(startDate.getDate() - offset);
        
        const calendarDays = [];
        let day = startDate;
        while (calendarDays.length < 42) {
            calendarDays.push(new Date(day));
            day.setDate(day.getDate() + 1);
        }
        return calendarDays;
    }, [currentMonth]);
    
    const weeks = useMemo(() => {
        const weekChunks = [];
        for (let i = 0; i < days.length; i += 7) {
            weekChunks.push(days.slice(i, i + 7));
        }
        return weekChunks;
    }, [days]);
    
    const changeMonth = (offset: number) => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };
    
    const handleDayClick = (date: Date) => {
        onDateChange(date);
        setView('agenda');
    };

    const handleDownloadCalendarPDF = async () => {
        setIsDownloading(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            // Pasamos los datos de vacaciones a la función de generación de PDF.
            await generateCalendarPDF(days, currentMonth, bookings, specialEvents, vacations);
        }
        setIsDownloading(false);
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, booking: ConsolidatedBooking) => {
        e.stopPropagation(); // Previene que se dispare el onClick del día
        e.dataTransfer.setData('application/json', JSON.stringify(booking));
        (e.target as HTMLDivElement).classList.add('dragging');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        (e.target as HTMLDivElement).classList.remove('dragging');
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
        e.currentTarget.classList.remove('drag-over');
    };
    
    const handleDrop = async (e: React.DragEvent<HTMLButtonElement>, targetDate: Date) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        try {
            const bookingData: ConsolidatedBooking = JSON.parse(e.dataTransfer.getData('application/json'));
            if (formatDateForBookingKey(targetDate) === bookingData.date) {
                return; // No se puede soltar en el mismo día para duplicar
            }
            
            const { startTime, endTime, details, keys: originalKeys } = bookingData;
            
            const spaceIds = [...new Set(originalKeys.map(key => key.split('-').slice(0, -4).join('-')))];
            const timeSlots = TIME_SLOTS.filter(time => time >= startTime && time < endTime);
            const targetDateStr = formatDateForBookingKey(targetDate);
            
            const newKeys = spaceIds.flatMap(spaceId => 
                timeSlots.map(time => `${spaceId}-${targetDateStr}-${time}`)
            );
            
            // Conflict check
            for (const key of newKeys) {
                if (bookings[key]) {
                    alert(`Conflicto de reserva: El horario de ${startTime} a ${endTime} ya está ocupado el ${targetDate.toLocaleDateString('es-ES')}.`);
                    return;
                }
            }

            await onAddBooking(newKeys, details);

        } catch (error) {
            console.error("Error al duplicar la reserva:", error);
            alert("No se pudo duplicar la reserva.");
        }
    };

    return (
        <>
            <div className="bg-white/5 backdrop-blur-lg p-4 sm:p-6 rounded-lg shadow-lg border border-white/10" style={{ fontFamily: 'Arial, sans-serif' }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
                    <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20">&lt;</button>
                    <h2 className="text-xl font-bold text-white capitalize text-center">
                        {currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadCalendarPDF}
                            disabled={isDownloading}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar calendario del mes en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{isDownloading ? 'Generando...' : 'PDF Calendario'}</span>
                        </button>
                        <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-white/10 rounded-md hover:bg-white/20">&gt;</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,1fr,1fr,1fr] gap-1 text-center font-semibold text-orange-400 mb-2">
                    <div></div>
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,1fr,1fr,1fr] gap-1 sm:gap-2">
                    {weeks.map((weekDays, i) => {
                        const firstDayOfWeek = weekDays[0];
                        const { week, year } = getWeekData(firstDayOfWeek);
                        const weekId = `${year}-${week.toString().padStart(2, '0')}`;
                        
                        let defaultMorning: string;
                        let defaultEvening: string;

                        if (formatDateForBookingKey(firstDayOfWeek) >= '2025-11-17') {
                            defaultMorning = 'Adrián';
                            defaultEvening = 'Olga';
                        } else {
                            const isEvenWeek = week % 2 === 0;
                            defaultMorning = isEvenWeek ? 'Adrián' : 'Olga';
                            defaultEvening = isEvenWeek ? 'Olga' : 'Adrián';
                        }
                        
                        const weeklyShifts = shiftAssignments[weekId];
                        const morningWorker = weeklyShifts?.morning || defaultMorning;
                        const eveningWorker = weeklyShifts?.evening || defaultEvening;
                        
                        return (
                            <React.Fragment key={i}>
                                <div className="flex flex-col items-center justify-center bg-black/20 rounded-md text-xs px-2 py-1 h-full">
                                    <div className="space-y-2 my-1 text-center">
                                        <div className="flex items-center gap-1 text-yellow-300" title={`Mañana: ${morningWorker}`}>
                                            <SunIcon className="w-4 h-4" />
                                            <span className="font-mono font-bold">{morningWorker.substring(0, 2).toUpperCase()}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-blue-300" title={`Tarde: ${eveningWorker}`}>
                                            <MoonIcon className="w-4 h-4" />
                                            <span className="font-mono font-bold">{eveningWorker.substring(0, 2).toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>

                                {weekDays.map((d, j) => {
                                    const dayKey = formatDateForBookingKey(d);
                                    const dayYear = d.getFullYear().toString();
                                    const dayBookings = consolidateBookingsForDay(bookings, d);
                                    const eventsForDay = Object.values(specialEvents).filter(event => dayKey >= (event as SpecialEvent).startDate && dayKey <= (event as SpecialEvent).endDate);
                                    const isCurrentMonth = d.getMonth() === currentMonth.getMonth();
                                    const isSelected = isSameDay(d, selectedDate);
                                    
                                    const dayWeekData = getWeekData(d);
                                    const dayWeekId = `${dayWeekData.year}-${dayWeekData.week.toString().padStart(2, '0')}`;
                                    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                                    const hasOverride = !!shiftAssignments[dayWeekId]?.dailyOverrides?.[dayIndex];

                                    // Comprobamos si hay vacaciones para este día.
                                    const vacationWorker = vacations[dayYear]?.dates[dayKey];

                                    return (
                                        <button
                                            key={j}
                                            onClick={() => handleDayClick(d)}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, d)}
                                            className={`relative p-1 sm:p-2 h-28 sm:h-32 md:h-36 rounded-md transition-colors duration-200 flex flex-col items-start text-left overflow-hidden ${
                                                isSelected ? 'bg-orange-600 ring-2 ring-orange-300' 
                                                : (vacationWorker ? 'bg-purple-900/70 border border-purple-600' : 'bg-black/20')
                                            } ${isCurrentMonth ? 'text-white hover:bg-black/40' : 'text-gray-500 hover:bg-black/40'}`}
                                        >
                                            <div className="flex justify-between w-full items-center mb-1">
                                                <span className="font-bold text-sm">{d.getDate()}</span>
                                                {hasOverride && <span className="h-2 w-2 bg-blue-400 rounded-full" title="Horario especial"></span>}
                                            </div>

                                            <div className="text-xs w-full space-y-1 flex-grow overflow-y-auto pr-1">
                                                {/* Mostramos el indicador de vacaciones */}
                                                {vacationWorker && (
                                                    <div className="text-purple-300 font-bold truncate" title={`${vacationWorker} de vacaciones`}>
                                                        🌴 {vacationWorker}
                                                    </div>
                                                )}
                                                {eventsForDay.map(event => (
                                                    <div 
                                                        key={(event as SpecialEvent).id}
                                                        className="bg-purple-800/80 text-white rounded px-1.5 py-0.5 truncate font-bold flex items-center gap-1 cursor-pointer"
                                                        onClick={(e) => { e.stopPropagation(); onSelectSpecialEvent(event as SpecialEvent); }}
                                                    >
                                                    <StarIcon className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{(event as SpecialEvent).name}</span>
                                                    </div>
                                                ))}
                                                {dayBookings.map((booking, index) => {
                                                    const salaOnly = isSalaOnly(booking);
                                                    return (
                                                        <div 
                                                            key={index} 
                                                            className={`${salaOnly ? 'bg-green-900/70' : 'bg-black/30'} rounded px-1.5 py-0.5 truncate ${!isReadOnly ? 'cursor-grab' : 'cursor-default'}`} 
                                                            title={`${booking.startTime} - ${booking.details.name}`}
                                                            draggable={!isReadOnly}
                                                            onDragStart={(e) => !isReadOnly && handleDragStart(e, booking)}
                                                            onDragEnd={!isReadOnly ? handleDragEnd : undefined}
                                                        >
                                                            <span className="font-semibold text-orange-400 pointer-events-none">{booking.startTime}</span> <span className="pointer-events-none">{booking.details.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </button>
                                    );
                                })}
                            </React.Fragment>
                        )
                    })}
                </div>
            </div>

            {!isReadOnly && (
                <div className="fixed bottom-24 right-6 z-40 flex flex-col items-center gap-3 md:bottom-6">
                    <button onClick={() => setView('eventos')} className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg transform hover:scale-110 transition-transform" title="Añadir Evento Especial">
                        <StarIcon className="w-6 h-6"/>
                    </button>
                    <button onClick={() => setView('plano')} className="bg-orange-600 hover:bg-orange-700 text-white rounded-full p-4 shadow-lg transform hover:scale-110 transition-transform" title="Añadir Reserva">
                        <PlusIcon className="w-6 h-6"/>
                    </button>
                </div>
            )}
        </>
    );
};

export default CalendarView;