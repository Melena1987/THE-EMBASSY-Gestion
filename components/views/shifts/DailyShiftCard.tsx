import React from 'react';
import type { ShiftAssignment, ShiftPeriodDetail, Vacations } from '../../../types';
import { WORKERS } from '../../../constants';
import { getDefaultDailyShift } from '../../../utils/shiftUtils';
import { formatDateForBookingKey } from '../../../utils/dateUtils';
import SunIcon from '../../icons/SunIcon';
import MoonIcon from '../../icons/MoonIcon';
import RefreshCcwIcon from '../../icons/RefreshCcwIcon';

interface DailyShiftCardProps {
    day: Date;
    dayIndex: number;
    currentShifts: ShiftAssignment;
    isReadOnly: boolean;
    vacations: Vacations;
    onDailyShiftChange: (dayIndex: number, period: 'morning' | 'evening', field: keyof ShiftPeriodDetail, value: string | boolean) => void;
    onResetDay: (dayIndex: number) => void;
}

const DailyShiftCard: React.FC<DailyShiftCardProps> = ({
    day,
    dayIndex,
    currentShifts,
    isReadOnly,
    vacations,
    onDailyShiftChange,
    onResetDay,
}) => {
    const dailyOverride = currentShifts.dailyOverrides?.[dayIndex];
    const effectiveShifts = dailyOverride || getDefaultDailyShift(dayIndex, currentShifts.morning, currentShifts.evening);
    const isDayCustomized = !!dailyOverride;
    const year = day.getFullYear().toString();
    const dayKey = formatDateForBookingKey(day);
    const vacationWorkerForDay = vacations[year]?.dates[dayKey];

    const ShiftEditor = ({ period, details }: { period: 'morning' | 'evening', details: ShiftPeriodDetail }) => {
        const isVacation = details.worker === vacationWorkerForDay;

        if (isVacation) {
            return (
                <div className="p-2 bg-purple-900/50 rounded-md text-center h-[116px] flex flex-col justify-center">
                    <p className="font-bold text-purple-300">VACACIONES</p>
                    <p className="text-sm text-purple-400">{details.worker}</p>
                </div>
            );
        }

        return (
            <fieldset disabled={isReadOnly} className={`p-2 bg-black/20 rounded-md space-y-2 ${isReadOnly ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {period === 'morning' ? <SunIcon className="w-5 h-5 text-yellow-300" /> : <MoonIcon className="w-5 h-5 text-blue-300" />}
                        <p className="text-gray-300 font-semibold capitalize text-sm">{period === 'morning' ? 'Mañana' : 'Tarde'}</p>
                    </div>
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" className="h-4 w-4 rounded bg-black/30 border-white/20 text-orange-500 focus:ring-orange-500 disabled:cursor-not-allowed" checked={details.active} onChange={(e) => onDailyShiftChange(dayIndex, period, 'active', e.target.checked)} />
                        <span className={`ml-2 text-xs font-medium ${details.active ? 'text-green-400' : 'text-red-400'}`}>{details.active ? 'Abierto' : 'Cerrado'}</span>
                    </label>
                </div>
                <div className={`space-y-2 transition-opacity ${!details.active ? 'opacity-50 pointer-events-none' : ''}`}>
                    <select value={details.worker} onChange={(e) => onDailyShiftChange(dayIndex, period, 'worker', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 text-xs focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed">
                        {WORKERS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <div className="flex items-center gap-1 text-xs">
                        <input type="time" value={details.start} onChange={(e) => onDailyShiftChange(dayIndex, period, 'start', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed" />
                        <span>-</span>
                        <input type="time" value={details.end} onChange={(e) => onDailyShiftChange(dayIndex, period, 'end', e.target.value)} className="w-full bg-black/30 text-white border-white/20 rounded-md p-1 focus:ring-orange-500 focus:border-orange-500 disabled:cursor-not-allowed" />
                    </div>
                </div>
            </fieldset>
        );
    };

    return (
        <div className={`bg-white/5 backdrop-blur-lg p-3 rounded-lg shadow-inner transition-all border border-white/10 ${isDayCustomized && !isReadOnly ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="flex items-center justify-center text-center border-b border-white/20 pb-2 mb-3 relative h-10">
                <h3 className="font-bold capitalize text-white">
                    {day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                </h3>
                {isDayCustomized && (
                    <button onClick={() => onResetDay(dayIndex)} disabled={isReadOnly} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed" title="Resetear turno del día">
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
};

export default DailyShiftCard;
