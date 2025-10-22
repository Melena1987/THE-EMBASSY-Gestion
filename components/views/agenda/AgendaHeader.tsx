import React, { useState } from 'react';
import type { Bookings, ShiftAssignment, SpecialEvents, Task } from '../../../types';
import DownloadIcon from '../../icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF, generateAgendaPDF } from '../../../utils/pdfUtils';

type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

interface AgendaHeaderProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    weekNumber: number;
    year: number;
    weekDays: Date[];
    bookings: Bookings;
    currentWeekShifts: ShiftAssignment | undefined;
    defaultAssignments: { morning: string; evening: string };
    specialEvents: SpecialEvents;
    allTasks: CombinedTask[];
}

const AgendaHeader: React.FC<AgendaHeaderProps> = ({
    selectedDate, onDateChange, weekNumber, year, weekDays, bookings, currentWeekShifts, defaultAssignments, specialEvents, allTasks
}) => {
    const [isDownloadingShifts, setIsDownloadingShifts] = useState(false);
    const [isDownloadingAgenda, setIsDownloadingAgenda] = useState(false);

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleDownloadShiftsPDF = async () => {
        setIsDownloadingShifts(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateShiftsPDF(weekNumber, year, weekDays, currentWeekShifts || defaultAssignments, allTasks);
        }
        setIsDownloadingShifts(false);
    };

    const handleDownloadAgendaPDF = async () => {
        setIsDownloadingAgenda(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateAgendaPDF(weekNumber, year, weekDays, bookings, currentWeekShifts || defaultAssignments, specialEvents, allTasks);
        }
        setIsDownloadingAgenda(false);
    }

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-4 gap-4 sm:gap-2">
                <div className="hidden sm:flex sm:flex-1 sm:justify-start">
                    <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                </div>
                <div className="flex-shrink-0 order-first sm:order-none w-full sm:w-auto text-center">
                    <h2 className="text-xl font-bold text-white">
                        Semana {weekNumber}
                    </h2>
                    <p className="text-sm font-normal text-gray-400">
                        {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="w-full flex justify-between items-center sm:hidden order-1">
                    <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Ant</button>
                    <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Sig &gt;</button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:justify-end items-center gap-2">
                    <button
                        onClick={handleDownloadAgendaPDF}
                        disabled={isDownloadingAgenda}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                        title="Descargar agenda semanal en PDF"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span className="hidden lg:inline">{isDownloadingAgenda ? 'Generando...' : 'PDF Agenda'}</span>
                    </button>
                    <button
                        onClick={handleDownloadShiftsPDF}
                        disabled={isDownloadingShifts}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                        title="Descargar horario de turnos en PDF"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span className="hidden lg:inline">{isDownloadingShifts ? 'Generando...' : 'PDF Turnos'}</span>
                    </button>
                    <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente Semana &gt;</button>
                </div>
            </div>
        </div>
    );
};

export default AgendaHeader;