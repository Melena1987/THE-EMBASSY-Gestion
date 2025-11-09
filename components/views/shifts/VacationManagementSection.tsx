import React, { useState } from 'react';
// FIX: Import `VacationYear` to correctly type the data from `Object.entries`.
import type { Vacations, UserRole, SpecialEvent, VacationYear } from '../../../types';
import { formatDateForBookingKey } from '../../../utils/dateUtils';
import TrashIcon from '../../icons/TrashIcon';

interface VacationManagementSectionProps {
    selectedDate: Date;
    vacations: Vacations;
    userRole: UserRole;
    currentUserName: string | null;
    handleUpdateVacations: (year: string, dates: Record<string, string>) => Promise<void>;
    specialEvents: Record<string, SpecialEvent>;
}

const VacationManagementSection: React.FC<VacationManagementSectionProps> = ({
    selectedDate, vacations, userRole, currentUserName, handleUpdateVacations, specialEvents
}) => {
    const currentYear = selectedDate.getFullYear().toString();
    const WORKERS_FOR_VACATIONS = ['Olga', 'Dani'];

    const handleAddVacation = (worker: string, dateStr: string) => {
        if (!dateStr) return;
        const date = new Date(`${dateStr}T00:00:00`);
        const yearOfNewDate = date.getFullYear().toString();
        const formattedDate = formatDateForBookingKey(date);

        // Check for conflicts with special events
        for (const event of Object.values(specialEvents)) {
            const typedEvent = event as SpecialEvent;
            if (formattedDate >= typedEvent.startDate && formattedDate <= typedEvent.endDate) {
                alert(`No se pueden coger vacaciones durante el evento especial "${typedEvent.name}".`);
                return;
            }
        }
        
        const vacationsForYear = vacations[yearOfNewDate]?.dates || {};
        const daysTakenInYear = Object.values(vacationsForYear).filter(name => name === worker).length;

        if (daysTakenInYear >= 23) {
            alert(`${worker} ya ha alcanzado el límite de 23 días de vacaciones para el año ${yearOfNewDate}.`);
            return;
        }

        // Check if another worker has already taken this day
        if (vacationsForYear[formattedDate] && vacationsForYear[formattedDate] !== worker) {
            alert(`El día ${formattedDate} ya está cogido por ${vacationsForYear[formattedDate]}.`);
            return;
        }

        const newDates = { ...vacationsForYear, [formattedDate]: worker };
        handleUpdateVacations(yearOfNewDate, newDates);
    };

    const handleRemoveVacation = (date: string) => {
        const yearOfDate = date.split('-')[0];
        if (!vacations[yearOfDate]) return;

        const vacationsForYear = { ...(vacations[yearOfDate].dates || {}) };
        delete vacationsForYear[date];
        handleUpdateVacations(yearOfDate, vacationsForYear);
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Gestión de Vacaciones</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {WORKERS_FOR_VACATIONS.map(worker => {
                    const canManage = userRole === 'ADMIN' || currentUserName === worker;

                    // FIX: Explicitly type `yearData` to resolve 'unknown' type error.
                    const vacationsByYear = Object.entries(vacations).reduce((acc, [year, yearData]: [string, VacationYear]) => {
                        const workerDates = Object.keys(yearData.dates).filter(date => yearData.dates[date] === worker);
                        if (workerDates.length > 0) {
                            acc[year] = workerDates;
                        }
                        return acc;
                    }, {} as Record<string, string[]>);

                    // Ensure the current year is always displayed, even if empty
                    if (!vacationsByYear[currentYear]) {
                        vacationsByYear[currentYear] = [];
                    }
                    
                    const allWorkerVacations = Object.values(vacationsByYear).flat().sort();
                    
                    const [newVacationDate, setNewVacationDate] = useState('');

                    return (
                        <div key={worker}>
                            <h4 className="font-bold text-white">{worker}</h4>
                            <div className="text-sm text-gray-400 mb-2">
                                {Object.keys(vacationsByYear).sort().map(year => (
                                    <p key={year}>Año {year}: {vacationsByYear[year].length} / 23 días</p>
                                ))}
                            </div>

                            {canManage && (
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
                                {allWorkerVacations.length > 0 ? allWorkerVacations.map(date => (
                                    <div key={date} className="flex items-center justify-between text-sm p-1">
                                        <span className="text-gray-300">{new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        {canManage && (
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
