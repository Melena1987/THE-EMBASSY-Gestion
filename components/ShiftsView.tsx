import React, { useMemo } from 'react';
import type { ShiftAssignments, ShiftAssignment, DailyShift, ShiftPeriodDetail } from '../types';
import { WORKERS } from '../constants';
import { getWeekData } from '../utils/dateUtils';
import { getDefaultDailyShift } from '../utils/shiftUtils';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import SwitchIcon from './icons/SwitchIcon';
import RefreshCcwIcon from './icons/RefreshCcwIcon';
import DownloadIcon from './icons/DownloadIcon';

interface ShiftsViewProps {
    shiftAssignments: ShiftAssignments;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateShifts: (weekId: string, newShifts: ShiftAssignment) => void;
    onResetWeekShifts: (weekId: string) => void;
}

const ShiftsView: React.FC<ShiftsViewProps> = ({ shiftAssignments, selectedDate, onDateChange, onUpdateShifts, onResetWeekShifts }) => {

    const { week: weekNumber, year } = getWeekData(selectedDate);
    const weekId = `${year}-${weekNumber.toString().padStart(2, '0')}`;

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(selectedDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    }, [selectedDate]);

    const defaultAssignments = useMemo(() => {
        const isEvenWeek = weekNumber % 2 === 0;
        const morning = isEvenWeek ? WORKERS[1] : WORKERS[0];
        const evening = morning === WORKERS[0] ? WORKERS[1] : WORKERS[0];
        return { morning, evening };
    }, [weekNumber]);

    const currentShifts = shiftAssignments[weekId] || defaultAssignments;
    const isCustomized = !!shiftAssignments[weekId];

    const changeWeek = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + offset * 7);
        onDateChange(newDate);
    };

    const handleSwap = () => {
        const newShifts = {
            ...currentShifts,
            morning: currentShifts.evening,
            evening: currentShifts.morning,
        };
        onUpdateShifts(weekId, newShifts);
    };

    const handleReset = () => {
        onResetWeekShifts(weekId);
    };
    
    const handleWeeklyWorkerChange = (shift: 'morning' | 'evening', worker: string) => {
        const newShifts = { ...currentShifts };
        if (shift === 'morning') {
            newShifts.morning = worker;
            if (worker === newShifts.evening) {
                newShifts.evening = WORKERS.find(w => w !== worker) || '';
            }
        } else {
            newShifts.evening = worker;
            if (worker === newShifts.morning) {
                newShifts.morning = WORKERS.find(w => w !== worker) || '';
            }
        }
        onUpdateShifts(weekId, newShifts);
    };
    
    const handleDailyShiftChange = (dayIndex: number, period: 'morning' | 'evening', field: keyof ShiftPeriodDetail, value: string | boolean) => {
        const newShifts: ShiftAssignment = JSON.parse(JSON.stringify(
            shiftAssignments[weekId] || { ...defaultAssignments, dailyOverrides: {} }
        ));
        if (!newShifts.dailyOverrides) {
            newShifts.dailyOverrides = {};
        }

        const weeklyDefaults = { morning: newShifts.morning, evening: newShifts.evening };
        
        const currentDailyState = newShifts.dailyOverrides[dayIndex]
            ? newShifts.dailyOverrides[dayIndex]
            : getDefaultDailyShift(dayIndex, weeklyDefaults.morning, weeklyDefaults.evening);

        const updatedDailyState: DailyShift = JSON.parse(JSON.stringify(currentDailyState));

        (updatedDailyState[period] as any)[field] = value;
        
        if (field === 'worker') {
            const otherPeriod = period === 'morning' ? 'evening' : 'morning';
            if (updatedDailyState[otherPeriod].worker === value) {
                updatedDailyState[otherPeriod].worker = WORKERS.find(w => w !== value) || '';
            }
        }

        const defaultStateForDay = getDefaultDailyShift(dayIndex, weeklyDefaults.morning, weeklyDefaults.evening);
        
        const isSameAsDefault =
            JSON.stringify(updatedDailyState.morning) === JSON.stringify(defaultStateForDay.morning) &&
            JSON.stringify(updatedDailyState.evening) === JSON.stringify(defaultStateForDay.evening);

        if (isSameAsDefault) {
            delete newShifts.dailyOverrides[dayIndex];
        } else {
            newShifts.dailyOverrides[dayIndex] = updatedDailyState;
        }

        if (Object.keys(newShifts.dailyOverrides).length === 0) {
            delete newShifts.dailyOverrides;
        }

        onUpdateShifts(weekId, newShifts);
    };

    const handleResetDay = (dayIndex: number) => {
        if (!currentShifts.dailyOverrides?.[dayIndex]) return;

        const newShifts: ShiftAssignment = JSON.parse(JSON.stringify(currentShifts));
        delete newShifts.dailyOverrides[dayIndex];

        if (Object.keys(newShifts.dailyOverrides).length === 0) {
            delete newShifts.dailyOverrides;
        }
        onUpdateShifts(weekId, newShifts);
    };

    const handleObservationsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newShifts: ShiftAssignment = { ...currentShifts };
        const newObservations = e.target.value;

        if (newObservations) {
            newShifts.observations = newObservations;
        } else {
            delete newShifts.observations;
        }

        onUpdateShifts(weekId, newShifts);
    };

    const handleDownloadPDF = () => {
        if (!(window as any).jspdf || !(window as any).autoTable) {
            alert("No se pudieron cargar las librerías para generar el PDF. Inténtelo de nuevo más tarde.");
            return;
        }

        const { jsPDF } = (window as any).jspdf;
        const autoTable = (window as any).autoTable;
        const doc = new jsPDF();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor('#E67E22');
        doc.text(`Horario Semanal - Semana ${weekNumber}`, 14, 22);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(100);
        const dateRange = `${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        doc.text(dateRange, 14, 30);
        
        const tableBody = weekDays.flatMap((day, dayIndex) => {
            const effectiveShifts = currentShifts.dailyOverrides?.[dayIndex] || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);
            const dayString = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });

            const morningRow = [
                { content: dayString, rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                { content: 'Mañana', styles: { fillColor: [255, 249, 230] } },
                effectiveShifts.morning.active ? effectiveShifts.morning.worker : 'Cerrado',
                effectiveShifts.morning.active ? `${effectiveShifts.morning.start} - ${effectiveShifts.morning.end}` : '-'
            ];
            
            const eveningRow = [
                { content: 'Tarde', styles: { fillColor: [229, 239, 255] } },
                effectiveShifts.evening.active ? effectiveShifts.evening.worker : 'Cerrado',
                effectiveShifts.evening.active ? `${effectiveShifts.evening.start} - ${effectiveShifts.evening.end}` : '-'
            ];

            return [morningRow, eveningRow];
        });

        autoTable(doc, {
            head: [['Día', 'Turno', 'Personal', 'Horario']],
            body: tableBody,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: '#374151', textColor: '#F3F4F6', fontStyle: 'bold' },
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });

        if (currentShifts.observations) {
            const finalY = (doc as any).lastAutoTable.finalY;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#E67E22');
            doc.text('Observaciones:', 14, finalY + 15);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(40);
            doc.text(currentShifts.observations, 14, finalY + 22, { maxWidth: 180 });
        }

        doc.save(`Turnos_Semana_${weekNumber}_${year}.pdf`);
    };

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
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
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors flex items-center gap-2"
                          title="Descargar horario semanal en PDF"
                      >
                          <DownloadIcon className="w-5 h-5" />
                          <span className="hidden sm:inline">PDF</span>
                      </button>
                    </div>
                </div>
                
                <div className="mt-6 bg-black/20 p-4 rounded-lg flex flex-col md:flex-row items-center justify-center gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-orange-400">Turno Mañana (por defecto):</span>
                        <select 
                            value={currentShifts.morning} 
                            onChange={(e) => handleWeeklyWorkerChange('morning', e.target.value)}
                            className="bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                            {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                     <div className="flex items-center gap-3">
                        <span className="font-semibold text-yellow-400">Turno Tarde (por defecto):</span>
                        <select 
                            value={currentShifts.evening}
                            onChange={(e) => handleWeeklyWorkerChange('evening', e.target.value)}
                            className="bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                             {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleSwap}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2"
                        title="Intercambiar turno de mañana y tarde para toda la semana"
                    >
                        <SwitchIcon className="w-5 h-5" />
                        Intercambiar
                    </button>
                    {isCustomized && (
                        <button
                            onClick={handleReset}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        >
                            Resetear Semana
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => {
                    const dailyOverride = currentShifts.dailyOverrides?.[dayIndex];
                    const effectiveShifts = dailyOverride || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);
                    const isDayCustomized = !!dailyOverride;
                    
                    const ShiftEditor = ({ period, details }: { period: 'morning' | 'evening', details: ShiftPeriodDetail }) => (
                        <div className="p-2 bg-black/20 rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {period === 'morning' ? <SunIcon className="w-5 h-5 text-yellow-300"/> : <MoonIcon className="w-5 h-5 text-blue-300"/>}
                                    <p className="text-gray-300 font-semibold capitalize text-sm">{period === 'morning' ? 'Mañana' : 'Tarde'}</p>
                                </div>
                                <label className="flex items-center cursor-pointer">
                                    <input type="checkbox" className="h-4 w-4 rounded bg-black/30 border-white/20 text-orange-500 focus:ring-orange-500" checked={details.active} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'active', e.target.checked)} />
                                    <span className={`ml-2 text-xs font-medium ${details.active ? 'text-green-400' : 'text-red-400'}`}>{details.active ? 'Abierto' : 'Cerrado'}</span>
                                </label>
                            </div>
                            <div className={`space-y-2 transition-opacity ${!details.active ? 'opacity-50 pointer-events-none' : ''}`}>
                                <select value={details.worker} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'worker', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 text-xs focus:ring-orange-500 focus:border-orange-500">
                                    {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                                <div className="flex items-center gap-1 text-xs">
                                    <input type="time" value={details.start} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'start', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 focus:ring-orange-500 focus:border-orange-500" />
                                    <span>-</span>
                                    <input type="time" value={details.end} onChange={(e) => handleDailyShiftChange(dayIndex, period, 'end', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 focus:ring-orange-500 focus:border-orange-500" />
                                </div>
                            </div>
                        </div>
                    );

                    return (
                        <div key={day.toISOString()} className={`bg-white/5 backdrop-blur-lg p-3 rounded-lg shadow-inner transition-all border border-white/10 ${isDayCustomized ? 'ring-2 ring-blue-500' : ''}`}>
                            <div className="flex items-center justify-center text-center border-b border-white/20 pb-2 mb-3 relative h-10">
                                <h3 className="font-bold capitalize text-white">
                                    {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                </h3>
                                {isDayCustomized && (
                                    <button onClick={() => handleResetDay(dayIndex)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10" title="Resetear turno del día">
                                        <RefreshCcwIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <ShiftEditor period="morning" details={effectiveShifts.morning} />
                                <ShiftEditor period="evening" details={effectiveShifts.evening} />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <label htmlFor="weekObservations" className="text-lg font-semibold text-orange-400 mb-2 block">
                    Observaciones de la Semana
                </label>
                <textarea
                    id="weekObservations"
                    value={currentShifts.observations || ''}
                    onChange={handleObservationsChange}
                    rows={4}
                    placeholder="Anotaciones importantes para la semana, eventos especiales, recordatorios, etc."
                    className="w-full bg-black/20 text-white border-white/20 rounded-md p-3 focus:ring-orange-500 focus:border-orange-500 resize-y"
                />
            </div>
        </div>
    );
};

export default ShiftsView;