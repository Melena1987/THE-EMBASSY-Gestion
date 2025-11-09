import React, { useState } from 'react';
// FIX: Import `VacationYear` to provide explicit type hints and fix type inference errors.
import type { Vacations, UserRole, SpecialEvent, VacationYear } from '../../../types';
import { formatDateForBookingKey } from '../../../utils/dateUtils';
import TrashIcon from '../../icons/TrashIcon';
import ChevronDownIcon from '../../icons/ChevronDownIcon';

interface VacationManagementSectionProps {
    selectedDate: Date;
    vacations: Vacations;
    userRole: UserRole;
    currentUserName: string | null;
    handleUpdateVacations: (year: string, dates: Record<string, string>) => Promise<void>;
    specialEvents: Record<string, SpecialEvent>;
    isReadOnly: boolean;
}

const VacationManagementSection: React.FC<VacationManagementSectionProps> = ({
    selectedDate, vacations, userRole, currentUserName, handleUpdateVacations, specialEvents, isReadOnly
}) => {
    const currentYearForDisplay = selectedDate.getFullYear().toString();
    const WORKERS_FOR_VACATIONS = ['Olga', 'Dani'];

    const [expandedWorkerYears, setExpandedWorkerYears] = useState<Record<string, Set<string>>>({
        'Olga': new Set([selectedDate.getFullYear().toString()]),
        'Dani': new Set([selectedDate.getFullYear().toString()]),
    });

    const toggleYear = (worker: string, year: string) => {
        setExpandedWorkerYears(prev => {
            const newSets = { ...prev };
            const workerSet = new Set(newSets[worker]);
            if (workerSet.has(year)) {
                workerSet.delete(year);
            } else {
                workerSet.add(year);
            }
            newSets[worker] = workerSet;
            return newSets;
        });
    };

    const handleAddVacation = (worker: string, dateStr: string) => {
        if (!dateStr) return;
        const date = new Date(`${dateStr}T00:00:00`);
        const yearOfNewDate = date.getFullYear().toString();
        const formattedDate = formatDateForBookingKey(date);

        for (const event of Object.values(specialEvents)) {
            const typedEvent = event as SpecialEvent;
            if (formattedDate >= typedEvent.startDate && formattedDate <= typedEvent.endDate) {
                alert(`No se pueden coger vacaciones durante el evento especial "${typedEvent.name}".`);
                return;
            }
        }

        // Robustly count all days for the worker in the target year, regardless of which document they are in.
        const daysTakenInYear = Object.values(vacations)
            // FIX: Explicitly type `yearData` to fix "property 'dates' does not exist on type 'unknown'" error.
            .flatMap((yearData: VacationYear) => Object.entries(yearData.dates))
            .filter(([d, name]) => name === worker && d.startsWith(yearOfNewDate))
            .length;
        
        if (daysTakenInYear >= 23) {
            alert(`${worker} ya ha alcanzado el límite de 23 días de vacaciones para el año ${yearOfNewDate}.`);
            return;
        }

        // Check for conflicts
        // FIX: Explicitly type `yearData` to fix "property 'dates' does not exist on type 'unknown'" error.
        const allDates = Object.values(vacations).flatMap((yearData: VacationYear) => Object.entries(yearData.dates));
        const existingBooking = allDates.find(([d]) => d === formattedDate);
        if (existingBooking && existingBooking[1] !== worker) {
             alert(`El día ${formattedDate} ya está cogido por ${existingBooking[1]}.`);
            return;
        }

        // Write to the CORRECT document for the new date's year.
        // FIX: Explicitly cast to `VacationYear` to fix "property 'dates' does not exist on type 'unknown'" error.
        const vacationsForCorrectYear = (vacations[yearOfNewDate] as VacationYear)?.dates || {};
        const newDates = { ...vacationsForCorrectYear, [formattedDate]: worker };
        handleUpdateVacations(yearOfNewDate, newDates);
    };

    const handleRemoveVacation = (date: string) => {
        let yearDocKey: string | null = null;
    
        // Find which year document the date is actually stored in
        for (const yearKey in vacations) {
            // FIX: Explicitly cast to `VacationYear` to fix "property 'dates' does not exist on type 'unknown'" error.
            if ((vacations[yearKey] as VacationYear).dates && (vacations[yearKey] as VacationYear).dates[date]) {
                yearDocKey = yearKey;
                break;
            }
        }

        if (!yearDocKey) {
            console.error(`Could not find vacation date ${date} in any year document.`);
            alert("No se pudo encontrar el día de vacaciones para eliminarlo.");
            return;
        }

        // FIX: Explicitly cast to `VacationYear` to fix potential "property 'dates' does not exist on type 'unknown'" error.
        const vacationsForYear = { ...((vacations[yearDocKey] as VacationYear).dates || {}) };
        delete vacationsForYear[date];
        handleUpdateVacations(yearDocKey, vacationsForYear);
    };

    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">Gestión de Vacaciones</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {WORKERS_FOR_VACATIONS.map(worker => {
                    const canManage = (userRole === 'ADMIN' || currentUserName === worker) && !isReadOnly;

                    // New robust grouping logic: derives the year from each date key.
                    const vacationsByYear = Object.values(vacations)
                        // FIX: Explicitly type `yearData` to fix "property 'dates' does not exist on type 'unknown'" error.
                        .flatMap((yearData: VacationYear) => Object.entries(yearData.dates))
                        .reduce((acc, [date, name]) => {
                            if (name === worker) {
                                const yearOfDate = date.split('-')[0];
                                if (!acc[yearOfDate]) {
                                    acc[yearOfDate] = [];
                                }
                                acc[yearOfDate].push(date);
                            }
                            return acc;
                        }, {} as Record<string, string[]>);

                    // Ensure the current year is always displayed for context, even if empty
                    if (!vacationsByYear[currentYearForDisplay]) {
                        vacationsByYear[currentYearForDisplay] = [];
                    }
                    
                    const [newVacationDate, setNewVacationDate] = useState('');
                    const sortedYears = Object.keys(vacationsByYear).sort((a, b) => parseInt(b) - parseInt(a));

                    return (
                        <div key={worker}>
                            <h4 className="font-bold text-white mb-2">{worker}</h4>
                            
                            {canManage && (
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="date"
                                        value={newVacationDate}
                                        onChange={(e) => setNewVacationDate(e.target.value)}
                                        className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        placeholder="dd/mm/aaaa"
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

                            <div className="space-y-2 max-h-64 overflow-y-auto bg-black/20 p-2 rounded-md">
                                {sortedYears.length > 0 && sortedYears.some(year => vacationsByYear[year].length > 0 || year === currentYearForDisplay) ? sortedYears.map(year => {
                                    const datesForYear = vacationsByYear[year].sort((a,b) => a.localeCompare(b));
                                    const isExpanded = expandedWorkerYears[worker]?.has(year);

                                    if (datesForYear.length === 0 && year !== currentYearForDisplay) return null;

                                    return (
                                        <div key={year}>
                                            <button 
                                                onClick={() => toggleYear(worker, year)}
                                                className="w-full flex justify-between items-center p-2 bg-black/30 rounded-t-md hover:bg-black/40 transition-colors"
                                            >
                                                <span className="font-semibold text-white">Año {year} ({datesForYear.length} / 23)</span>
                                                <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="bg-black/10 p-2 rounded-b-md">
                                                    {datesForYear.length > 0 ? datesForYear.map(date => (
                                                        <div key={date} className="flex items-center justify-between text-sm p-1 hover:bg-white/5 rounded">
                                                            <span className="text-gray-300">{new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                            {canManage && (
                                                                <button onClick={() => handleRemoveVacation(date)} className="text-red-500 hover:text-red-400 p-1 rounded-full">
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )) : <p className="text-xs text-gray-500 text-center italic py-1">No hay vacaciones este año.</p>}
                                                </div>
                                            )}
                                        </div>
                                    );

                                }) : <p className="text-xs text-gray-500 text-center">No hay vacaciones asignadas.</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VacationManagementSection;