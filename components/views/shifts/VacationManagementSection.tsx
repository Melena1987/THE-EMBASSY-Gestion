import React, { useState } from 'react';
import type { Vacations, UserRole } from '../../../types';
import { formatDateForBookingKey } from '../../../utils/dateUtils';
import TrashIcon from '../../icons/TrashIcon';

interface VacationManagementSectionProps {
    selectedDate: Date;
    vacations: Vacations;
    userRole: UserRole;
    currentUserName: string | null;
    isReadOnly: boolean;
    handleUpdateVacations: (year: string, dates: Record<string, string>) => Promise<void>;
}

const VacationManagementSection: React.FC<VacationManagementSectionProps> = ({
    selectedDate, vacations, userRole, currentUserName, isReadOnly, handleUpdateVacations
}) => {
    const currentYear = selectedDate.getFullYear().toString();
    const currentYearVacations = vacations[currentYear]?.dates || {};
    const WORKERS_FOR_VACATIONS = ['Olga', 'Dani'];

    const handleAddVacation = (worker: string, dateStr: string) => {
        if (!dateStr) return;
        const date = new Date(`${dateStr}T00:00:00`);
        const formattedDate = formatDateForBookingKey(date);

        if (Object.keys(currentYearVacations).filter(d => currentYearVacations[d] === worker).length >= 30) {
            alert(`${worker} ya ha alcanzado el límite de 30 días de vacaciones.`);
            return;
        }
        if (currentYearVacations[formattedDate] && currentYearVacations[formattedDate] !== worker) {
            alert(`El día ${formattedDate} ya está cogido por ${currentYearVacations[formattedDate]}.`);
            return;
        }

        const newDates = { ...currentYearVacations, [formattedDate]: worker };
        handleUpdateVacations(currentYear, newDates);
    };

    const handleRemoveVacation = (date: string) => {
        const newDates = { ...currentYearVacations };
        delete newDates[date];
        handleUpdateVacations(currentYear, newDates);
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Gestión de Vacaciones ({currentYear})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {WORKERS_FOR_VACATIONS.map(worker => {
                    const canManage = userRole === 'ADMIN' || currentUserName === worker;
                    const workerVacations = Object.entries(currentYearVacations)
                        .filter(([, name]) => name === worker)
                        .map(([date]) => date)
                        .sort();
                    
                    const [newVacationDate, setNewVacationDate] = useState('');

                    return (
                        <div key={worker}>
                            <h4 className="font-bold text-white">{worker}</h4>
                            <p className="text-sm text-gray-400 mb-2">{workerVacations.length} / 30 días</p>

                            {canManage && !isReadOnly && (
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="date"
                                        value={newVacationDate}
                                        onChange={(e) => setNewVacationDate(e.target.value)}
                                        className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    />
                                    <button
                                        onClick={() => {
                                            handleAddVacation(worker, newVacationDate);
                                            setNewVacationDate('');
                                        }}
                                        disabled={!newVacationDate}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md text-sm disabled:opacity-50"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            )}

                            <div className="space-y-1 max-h-40 overflow-y-auto bg-black/20 p-2 rounded-md">
                                {workerVacations.length > 0 ? workerVacations.map(date => (
                                    <div key={date} className="flex items-center justify-between text-sm p-1">
                                        <span className="text-gray-300">{new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                        {canManage && !isReadOnly && (
                                            <button onClick={() => handleRemoveVacation(date)} className="text-red-500 hover:text-red-400">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )) : <p className="text-xs text-gray-500 text-center">No hay vacaciones asignadas.</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VacationManagementSection;
