import React, { useState } from 'react';
import type { ShiftAssignment, Task } from '../../../types';
import { WORKERS } from '../../../constants';
import SwitchIcon from '../../icons/SwitchIcon';
import RefreshCcwIcon from '../../icons/RefreshCcwIcon';
import DownloadIcon from '../../icons/DownloadIcon';
import { ensurePdfLibsLoaded, generateShiftsPDF } from '../../../utils/pdfUtils';

// Define the CombinedTask type locally as it's not exported from the parent
type CombinedTask = (Task & {
    type: 'shift';
    sourceId: string;
}) | (Task & {
    type: 'event';
    sourceId: string;
    eventName: string;
});

interface ShiftHeaderProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    weekNumber: number;
    year: number;
    weekDays: Date[];
    currentShifts: ShiftAssignment;
    isCustomized: boolean;
    isReadOnly: boolean;
    onWeeklyWorkerChange: (shift: 'morning' | 'evening', worker: string) => void;
    onSwap: () => void;
    onReset: () => void;
    allTasks: CombinedTask[];
}

const ShiftHeader: React.FC<ShiftHeaderProps> = ({
    selectedDate,
    onDateChange,
    weekNumber,
    year,
    weekDays,
    currentShifts,
    isCustomized,
    isReadOnly,
    onWeeklyWorkerChange,
    onSwap,
    onReset,
    allTasks,
}) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        const loaded = await ensurePdfLibsLoaded();
        if (loaded) {
            await generateShiftsPDF(weekNumber, year, weekDays, currentShifts, allTasks);
        }
        setIsDownloading(false);
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
                <button onClick={() => changeWeek(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">&lt; Semana Anterior</button>
                <h2 className="text-xl font-bold text-white text-center w-full sm:w-auto">
                    Gestión de Turnos - Semana {weekNumber}
                    <span className="block text-sm font-normal text-gray-400">
                        {weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => changeWeek(1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md">Siguiente Semana &gt;</button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                        title="Descargar horario semanal en PDF"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">{isDownloading ? 'Generando...' : 'PDF'}</span>
                    </button>
                </div>
            </div>

            <fieldset disabled={isReadOnly} className={`mt-6 bg-black/20 p-4 rounded-lg flex flex-col md:flex-row items-center justify-center gap-4 flex-wrap ${isReadOnly ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-orange-400">Turno Mañana (por defecto):</span>
                    <select
                        value={currentShifts.morning}
                        onChange={(e) => onWeeklyWorkerChange('morning', e.target.value)}
                        className="bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed"
                    >
                        {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-yellow-400">Turno Tarde (por defecto):</span>
                    <select
                        value={currentShifts.evening}
                        onChange={(e) => onWeeklyWorkerChange('evening', e.target.value)}
                        className="bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed"
                    >
                        {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>

                <button
                    onClick={onSwap}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Intercambiar turno de mañana y tarde para toda la semana"
                >
                    <SwitchIcon className="w-5 h-5" />
                    Intercambiar
                </button>
                {isCustomized && (
                    <button
                        onClick={onReset}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Resetear Semana
                    </button>
                )}
            </fieldset>
        </div>
    );
};

export default ShiftHeader;