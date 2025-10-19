import React, { useMemo, useState } from 'react';
import type { Bookings, ConsolidatedBooking, View, ShiftAssignments, BookingDetails } from '../types';
import { WORKERS, TIME_SLOTS } from '../constants';
import { getWeekData, formatDateForBookingKey } from '../utils/dateUtils';
import PlusIcon from './icons/PlusIcon';
import { consolidateBookingsForDay } from '../utils/bookingUtils';
import DownloadIcon from './icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF, generateAgendaPDF } from '../utils/pdfUtils';

interface AgendaViewProps {
    bookings: Bookings;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onSelectBooking: (booking: ConsolidatedBooking) => void;
    setView: (view: View) => void;
    shiftAssignments: ShiftAssignments;
    onAddBooking: (bookingKeys: string[], bookingDetails: BookingDetails) => Promise<boolean>;
    isReadOnly: boolean;
}

const AgendaView: React.FC<AgendaViewProps> = ({ bookings, selectedDate, onDateChange, onSelectBooking, setView, shiftAssignments, onAddBooking, isReadOnly }) => {
    const [isDownloadingShifts, setIsDownloadingShifts] = useState(false);
    const [isDownloadingAgenda, setIsDownloadingAgenda] = useState(false);

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(selectedDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1); // Adjust to make Monday the first day
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    }, [selectedDate]);

    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    const currentWeekShifts = shiftAssignments[weekId] || defaultAssignments;
    const hasOverrides = !!(shiftAssignments[weekId]?.dailyOverrides && Object.keys(shiftAssignments[weekId]!.dailyOverrides!).length > 0);

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleDownloadShiftsPDF = async () => {
        setIsDownloadingShifts(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateShiftsPDF(weekNumber, year, weekDays, currentWeekShifts);
        }
        setIsDownloadingShifts(false);
    };

    const handleDownloadAgendaPDF = async () => {
        setIsDownloadingAgenda(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            // FIX: Pass the 'year' to generateAgendaPDF.
            await generateAgendaPDF(weekNumber, year, weekDays, bookings);
        }
        setIsDownloadingAgenda(false);
    }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, booking: ConsolidatedBooking) => {
        e.dataTransfer.setData('application/json', JSON.stringify(booking));
        (e.target as HTMLDivElement).classList.add('dragging');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        (e.target as HTMLDivElement).classList.remove('dragging');
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('drag-over');
    };
    
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        try {
            const bookingData: ConsolidatedBooking = JSON.parse(e.dataTransfer.getData('application/json'));
            if (formatDateForBookingKey(targetDate) === bookingData.date) {
                return; // Can't drop on the same day
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
            console.error("Error al soltar la reserva:", error);
            alert("No se pudo duplicar la reserva.");
        }
    };
    
    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
                    <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                    <h2 className="text-xl font-bold text-white text-center w-full sm:w-auto order-first sm:order-none">
                        Semana {weekNumber} <br />
                        <span className="text-sm font-normal text-gray-400">
                            {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </h2>
                     <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadAgendaPDF}
                            disabled={isDownloadingAgenda}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar agenda de reservas en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{isDownloadingAgenda ? 'Generando...' : 'PDF Agenda'}</span>
                        </button>
                        <button
                            onClick={handleDownloadShiftsPDF}
                            disabled={isDownloadingShifts}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar horario de turnos en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{isDownloadingShifts ? 'Generando...' : 'PDF Turnos'}</span>
                        </button>
                        <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente &gt;</button>
                    </div>
                </div>
                 <div className="text-center bg-black/20 p-3 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                        <p className="font-semibold text-orange-400">Turno Mañana (defecto)</p>
                        <p>{currentWeekShifts.morning}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-yellow-400">Turno Tarde (defecto)</p>
                        <p>{currentWeekShifts.evening}</p>
                    </div>
                </div>
                {hasOverrides && (
                    <div className="text-center text-sm text-blue-300 bg-blue-900/40 p-2 rounded-md mt-2">
                        <p>⚠️ Esta semana contiene días con horarios especiales.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map(day => {
                    const dayBookings = consolidateBookingsForDay(bookings, day);
                    const dayWeekData = getWeekData(day);
                    const dayWeekId = `${dayWeekData.year}-${dayWeekData.week.toString().padStart(2, '0')}`;
                    const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
                    const dailyOverride = shiftAssignments[dayWeekId]?.dailyOverrides?.[dayIndex];

                    const shiftsText: string[] = [];
                    if (dailyOverride?.morning.active) {
                        shiftsText.push(`M: ${dailyOverride.morning.start}-${dailyOverride.morning.end} (${dailyOverride.morning.worker})`);
                    }
                    if (dailyOverride?.evening.active) {
                        shiftsText.push(`T: ${dailyOverride.evening.start}-${dailyOverride.evening.end} (${dailyOverride.evening.worker})`);
                    }
                    
                    return (
                        <div 
                            key={day.toISOString()} 
                            className="bg-white/5 backdrop-blur-lg p-3 rounded-lg shadow-inner min-h-[200px] flex flex-col border border-white/10 transition-all duration-300"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day)}
                        >
                            <div className="text-center border-b border-white/20 pb-2 mb-2">
                                <h3 className="font-bold capitalize text-white">
                                    {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                </h3>
                                {dailyOverride && (
                                    <div className="text-xs text-blue-300 mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                                        {shiftsText.length > 0 ? (
                                            shiftsText.map((text, index) => <p key={index} className="leading-tight">{text}</p>)
                                        ) : (
                                            <p className="text-red-400 font-semibold">Cerrado</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2 text-xs flex-grow">
                                {dayBookings.length > 0 ? (
                                    dayBookings.map((booking, index) => (
                                        <div 
                                            key={index} 
                                            draggable={!isReadOnly}
                                            onDragStart={(e) => !isReadOnly && handleDragStart(e, booking)}
                                            onDragEnd={!isReadOnly ? handleDragEnd : undefined}
                                            className={`w-full text-left bg-black/20 p-2 rounded hover:bg-black/40 transition-colors duration-200 ${!isReadOnly ? 'cursor-grab' : 'cursor-default'}`}
                                        >
                                            <button onClick={() => onSelectBooking(booking)} className="w-full text-left">
                                                <p className="font-semibold text-orange-300 pointer-events-none">
                                                    {booking.startTime} - {booking.endTime}
                                                </p>
                                                <ul className="list-disc list-inside pl-2 text-gray-300 pointer-events-none">
                                                    <li className="capitalize">
                                                        {booking.space}: <span className="font-semibold text-white">{booking.details.name}</span>
                                                    </li>
                                                </ul>
                                            </button>
                                        </div>
                                    ))
                                 ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                                        <p>Sin reservas</p>
                                    </div>
                                )}
                            </div>
                             <div className="flex justify-center pt-2 mt-auto">
                                <button 
                                    onClick={() => { onDateChange(day); setView('plano'); }}
                                    disabled={isReadOnly}
                                    className="bg-black/20 hover:bg-black/40 text-orange-400 p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Añadir reserva para ${day.toLocaleDateString('es-ES')}`}
                                    title={isReadOnly ? "No tiene permisos para añadir reservas" : "Añadir reserva"}
                                >
                                    <PlusIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgendaView;
