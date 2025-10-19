import React, { useState, useMemo, useEffect } from 'react';
import type { Bookings, Space, BookingDetails, ConsolidatedBooking } from '../types';
import { SPACES, TIME_SLOTS } from '../constants';
import CheckIcon from './icons/CheckIcon';
import { formatDateForBookingKey, generateRepeatingDates } from '../utils/dateUtils';

interface FloorPlanViewProps {
    bookings: Bookings;
    onAddBooking: (bookingKeys: string[], bookingDetails: BookingDetails) => Promise<boolean>;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    bookingToPreFill: ConsolidatedBooking | null;
    onPreFillComplete: () => void;
}

const FloorPlanView: React.FC<FloorPlanViewProps> = ({ bookings, onAddBooking, selectedDate, onDateChange, bookingToPreFill, onPreFillComplete }) => {
    const [selectedStartTime, setSelectedStartTime] = useState('09:00');
    const [selectedEndTime, setSelectedEndTime] = useState('10:00');
    const [reservationName, setReservationName] = useState('');
    const [observations, setObservations] = useState('');
    const [repeatOption, setRepeatOption] = useState('none');
    const [pendingSelections, setPendingSelections] = useState<string[]>([]);

    useEffect(() => {
        if (bookingToPreFill) {
            // Consistent date parsing: ensure the pre-filled date string is handled as local time.
            onDateChange(new Date(`${bookingToPreFill.date}T00:00:00`));
            setSelectedStartTime(bookingToPreFill.startTime);
            setSelectedEndTime(bookingToPreFill.endTime);
            setReservationName(bookingToPreFill.details.name);
            setObservations(bookingToPreFill.details.observations || '');

            // For editing, we don't want to repeat the creation logic.
            setRepeatOption('none');

            // Extract unique space IDs from the keys. A key is like "spaceId-YYYY-MM-DD-HH:mm"
            const spaceIds = [...new Set(bookingToPreFill.keys.map(key => key.split('-').slice(0, -4).join('-')))];
            setPendingSelections(spaceIds);

            onPreFillComplete();
        }
    }, [bookingToPreFill, onPreFillComplete, onDateChange]);

    const groupedSpaces = useMemo(() => {
        // Definitive FIX: Replaced the `reduce` method with a standard `for...of` loop.
        // This approach provides more stable and reliable type inference in TypeScript,
        // permanently resolving the "'map' does not exist on type 'unknown'" error.
        const groups: Record<string, Space[]> = {};
        for (const space of SPACES) {
            const group = space.group;
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(space);
        }
        return groups;
    }, []);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // To prevent timezone issues where new Date("YYYY-MM-DD") is interpreted as UTC midnight,
        // we explicitly parse it in the local timezone by appending a time component.
        // This ensures that selecting '21/10/2025' results in a Date object for that day
        // at midnight *in the user's local timezone*, avoiding off-by-one day errors.
        const dateStr = e.target.value; // "YYYY-MM-DD"
        if (dateStr) {
            onDateChange(new Date(`${dateStr}T00:00:00`));
        }
    };
    
    const spaceStatuses = useMemo(() => {
        const statuses: { [spaceId: string]: { isBooked: boolean; bookingDetails?: BookingDetails } } = {};
        
        if (selectedStartTime >= selectedEndTime) {
            SPACES.forEach(space => {
                statuses[space.id] = { isBooked: false };
            });
            return statuses;
        }

        const relevantTimeSlots = TIME_SLOTS.filter(time => time >= selectedStartTime && time < selectedEndTime);

        SPACES.forEach(space => {
            statuses[space.id] = { isBooked: false }; // Default
            for (const time of relevantTimeSlots) {
                const key = `${space.id}-${formatDateForBookingKey(selectedDate)}-${time}`;
                if (bookings[key]) {
                    statuses[space.id] = { isBooked: true, bookingDetails: bookings[key] };
                    break;
                }
            }
        });

        return statuses;
    }, [bookings, selectedDate, selectedStartTime, selectedEndTime]);

    const handleSpaceClick = (spaceId: string) => {
        // This function is now only called for available spaces,
        // as the button is disabled for booked ones.
        setPendingSelections(prev =>
            prev.includes(spaceId)
                ? prev.filter(id => id !== spaceId)
                : [...prev, spaceId]
        );
    };
    
    const handleConfirmBooking = async () => {
        if (pendingSelections.length === 0) {
            alert("No ha seleccionado ningún espacio para reservar.");
            return;
        }

        if (!reservationName.trim()) {
            alert("El nombre de la reserva no puede estar vacío.");
            return;
        }

        if (selectedEndTime <= selectedStartTime) {
            alert("La hora de finalización debe ser posterior a la hora de inicio.");
            return;
        }
        
        const initialDate = new Date(selectedDate.getTime());
        const datesToBook = Array.from(generateRepeatingDates(initialDate, repeatOption));

        if (datesToBook.length === 0) {
            alert("La regla de repetición no generó ninguna fecha válida para la selección actual.");
            return;
        }
        
        const relevantTimeSlots = TIME_SLOTS.filter(time => time >= selectedStartTime && time < selectedEndTime);
        
        const allKeysToToggle = pendingSelections.flatMap(spaceId => 
             datesToBook.flatMap(date => {
                const dateStr = formatDateForBookingKey(date);
                return relevantTimeSlots.map(time => `${spaceId}-${dateStr}-${time}`);
            })
        );
        
        const bookingDetails: BookingDetails = { name: reservationName };
        if (observations.trim()) {
            bookingDetails.observations = observations.trim();
        }

        const success = await onAddBooking(allKeysToToggle, bookingDetails);
        
        if (success) {
            setReservationName('');
            setObservations('');
            setPendingSelections([]);
        }
    };
    
    const handleClearSelection = () => {
        setPendingSelections([]);
    };

    const courtGroupNames = Object.keys(groupedSpaces).filter(name => name.startsWith('Pista')).sort();
    const otherGroupNames = Object.keys(groupedSpaces).filter(name => !name.startsWith('Pista')).sort();

    const SpaceButton: React.FC<{space: Space}> = ({ space }) => {
        const { isBooked, bookingDetails } = spaceStatuses[space.id];
        const isPending = pendingSelections.includes(space.id);
        return (
            <button
                key={space.id}
                onClick={() => handleSpaceClick(space.id)}
                disabled={isBooked}
                className={`p-4 rounded-md text-center text-sm font-medium transition-all duration-200 ease-in-out flex items-center justify-center h-24 ${
                    isBooked ? 'bg-red-600 text-white cursor-not-allowed opacity-75' : 
                    isPending ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-white transform hover:scale-105' :
                    'bg-black/20 hover:bg-black/40 text-gray-300 transform hover:scale-105'
                }`}
            >
                <div className="flex flex-col items-center gap-1 text-center break-words">
                    {isBooked && <CheckIcon className="w-5 h-5 mb-1" />}
                    {isBooked ? bookingDetails?.name : space.name}
                </div>
            </button>
        );
    };

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg space-y-4 border border-white/10">
                <h2 className="text-lg font-bold text-white border-b border-white/20 pb-2">Selector de Reserva</h2>
                
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="w-full md:flex-1">
                            <label htmlFor="reservationName" className="text-xs text-gray-400 block mb-1">Nombre de la reserva</label>
                            <input id="reservationName" type="text" placeholder="Ej: Entrenamiento John Doe" value={reservationName} onChange={(e) => setReservationName(e.target.value)}
                                className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                        <div className="w-full md:w-auto">
                            <label htmlFor="reservationDate" className="text-xs text-gray-400 block mb-1">Fecha</label>
                            <input id="reservationDate" type="date" value={formatDateForBookingKey(selectedDate)} onChange={handleDateChange}
                                className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                        <div className="w-full md:w-auto">
                            <label htmlFor="startTime" className="text-xs text-gray-400 block mb-1">Hora de inicio</label>
                            <input id="startTime" type="time" value={selectedStartTime} onChange={(e) => setSelectedStartTime(e.target.value)}
                                className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" step="1800" />
                        </div>
                        <div className="w-full md:w-auto">
                            <label htmlFor="endTime" className="text-xs text-gray-400 block mb-1">Hora de fin</label>
                            <input id="endTime" type="time" value={selectedEndTime} onChange={(e) => setSelectedEndTime(e.target.value)}
                                className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" step="1800" />
                        </div>
                        <div className="w-full md:w-auto">
                            <label htmlFor="repeatOption" className="text-xs text-gray-400 block mb-1">Repetir</label>
                            <select id="repeatOption" value={repeatOption} onChange={(e) => setRepeatOption(e.target.value)}
                                className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500">
                                <option value="none">No repetir</option>
                                <option value="daily">Todos los días (1 mes)</option>
                                <option value="weekdays">Días laborables (L-V, 1 mes)</option>
                                <option value="weekly">Semanalmente (3 meses)</option>
                                <option value="monthly">Mensualmente (6 meses)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="observations" className="text-xs text-gray-400 block mb-1">Observaciones (opcional)</label>
                        <textarea id="observations" placeholder="Añadir material, personal necesario, etc." value={observations} onChange={(e) => setObservations(e.target.value)}
                            rows={2}
                            className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500 resize-y" />
                    </div>
                </div>

                {pendingSelections.length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t border-white/20">
                        <span className="text-sm text-gray-400">
                            {pendingSelections.length} {pendingSelections.length > 1 ? 'espacios seleccionados' : 'espacio seleccionado'}.
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleClearSelection}
                                className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors"
                            >
                                Limpiar
                            </button>
                            <button
                                onClick={handleConfirmBooking}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap"
                            >
                                Confirmar Reserva
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courtGroupNames.length > 0 && (
                    <div key="pistas" className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                        <h3 className="text-lg font-semibold text-orange-400 mb-4 border-b border-white/20 pb-2">Pistas de Baloncesto</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {courtGroupNames.flatMap(name => groupedSpaces[name]).map(space => (
                                <SpaceButton key={space.id} space={space} />
                            ))}
                        </div>
                    </div>
                )}
                {otherGroupNames.map(groupName => {
                    const spaces = groupedSpaces[groupName];
                    return (
                        <div key={groupName} className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                            <h3 className="text-lg font-semibold text-orange-400 mb-4 border-b border-white/20 pb-2">{groupName}</h3>
                            <div className={`grid ${spaces.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                                {spaces.map(space => (
                                    <SpaceButton key={space.id} space={space} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FloorPlanView;
