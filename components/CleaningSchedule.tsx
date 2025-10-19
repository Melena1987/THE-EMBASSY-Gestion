import React, { useMemo, useState } from 'react';
import type { CleaningAssignments, CleaningObservations } from '../types';
import { getWeekData, formatDateForBookingKey } from '../utils/dateUtils';
import DownloadIcon from './icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateCleaningPDF } from '../utils/pdfUtils';
import TrashIcon from './icons/TrashIcon';

interface CleaningScheduleProps {
    cleaningAssignments: CleaningAssignments;
    cleaningObservations: CleaningObservations;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateCleaningTime: (date: Date, startTime: string) => void;
    onUpdateCleaningObservations: (weekId: string, observations: string) => void;
    isReadOnly: boolean;
}

const CleaningSchedule: React.FC<CleaningScheduleProps> = ({ cleaningAssignments, cleaningObservations, selectedDate, onDateChange, onUpdateCleaningTime, onUpdateCleaningObservations, isReadOnly }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;
    const currentObservations = cleaningObservations[weekId]?.observations || '';

    const weekDays = useMemo(() => {
        const referenceDate = new Date(selectedDate);
        const dayOfWeek = referenceDate.getDay();
        const diffToMonday = referenceDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const monday = new Date(referenceDate.setDate(diffToMonday));

        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            return day;
        });
    }, [selectedDate]);

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleTimeChange = (date: Date, time: string) => {
        onUpdateCleaningTime(date, time);
    };

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateCleaningPDF(weekNumber, year, weekDays, cleaningAssignments, cleaningObservations[weekId]);
        }
        setIsDownloading(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
                    <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                    <h2 className="text-xl font-bold text-white text-center">
                        Agenda de Limpieza - Semana {weekNumber}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente &gt;</button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isDownloading}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                            title="Descargar horario de limpieza en PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{isDownloading ? 'Generando...' : 'PDF'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 ${isReadOnly ? 'opacity-70' : ''}`}>
                {weekDays.map(day => {
                    const dayKey = formatDateForBookingKey(day);
                    const assignment = cleaningAssignments[dayKey];

                    return (
                        <div key={day.toISOString()} className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-inner border border-white/10 flex flex-col items-center">
                            <h3 className="font-bold text-white capitalize text-center border-b border-white/20 pb-2 mb-4 w-full">
                                {day.toLocaleDateString('es-ES', { weekday: 'long' })}
                                <span className="block text-sm text-gray-400 font-normal">{day.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}</span>
                            </h3>
                            <div className="flex flex-col items-center justify-center gap-2 w-full">
                                <label htmlFor={`time-${dayKey}`} className="text-sm text-gray-300">Hora de inicio</label>
                                <input 
                                    id={`time-${dayKey}`}
                                    type="time" 
                                    value={assignment?.startTime || ''}
                                    onChange={(e) => handleTimeChange(day, e.target.value)}
                                    disabled={isReadOnly}
                                    className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed"
                                />
                                {assignment && !isReadOnly && (
                                    <button 
                                        onClick={() => handleTimeChange(day, '')}
                                        className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-white/10 transition-colors"
                                        title="Limpiar hora"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <label htmlFor="cleaningObservations" className="text-lg font-semibold text-orange-400 mb-2 block">
                    Observaciones de Limpieza de la Semana
                </label>
                <textarea
                    id="cleaningObservations"
                    value={currentObservations}
                    onChange={(e) => onUpdateCleaningObservations(weekId, e.target.value)}
                    rows={4}
                    placeholder="Anotaciones sobre la limpieza de la semana, productos necesarios, etc."
                    disabled={isReadOnly}
                    className="w-full bg-black/20 text-white border-white/20 rounded-md p-3 focus:ring-orange-500 focus:border-orange-500 resize-y disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );
};

export default CleaningSchedule;
