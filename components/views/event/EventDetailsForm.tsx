import React from 'react';
import { formatDateForBookingKey } from '../../../utils/dateUtils';

interface EventDetailsFormProps {
    eventName: string;
    eventStartDate: Date;
    eventEndDate: Date;
    observations: string;
    onEventNameChange: (value: string) => void;
    onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onObservationsChange: (value: string) => void;
    isReadOnly: boolean;
    isUploading: boolean;
}

const EventDetailsForm: React.FC<EventDetailsFormProps> = ({
    eventName,
    eventStartDate,
    eventEndDate,
    observations,
    onEventNameChange,
    onStartDateChange,
    onEndDateChange,
    onObservationsChange,
    isReadOnly,
    isUploading,
}) => {
    return (
        <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="eventName" className="text-xs text-gray-400 block mb-1">Nombre del Evento</label>
                    <input id="eventName" type="text" value={eventName} onChange={e => onEventNameChange(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                </div>
                <div>
                    <label htmlFor="eventStartDate" className="text-xs text-gray-400 block mb-1">Fecha de Inicio</label>
                    <input id="eventStartDate" type="date" value={formatDateForBookingKey(eventStartDate)} onChange={onStartDateChange} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                </div>
                <div>
                    <label htmlFor="eventEndDate" className="text-xs text-gray-400 block mb-1">Fecha de Fin</label>
                    <input id="eventEndDate" type="date" value={formatDateForBookingKey(eventEndDate)} min={formatDateForBookingKey(eventStartDate)} onChange={onEndDateChange} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" />
                </div>
            </div>
            <div>
                <label htmlFor="eventObservations" className="text-xs text-gray-400 block mb-1">Observaciones</label>
                <textarea id="eventObservations" value={observations} onChange={e => onObservationsChange(e.target.value)} rows={3} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 resize-y focus:ring-orange-500 focus:border-orange-500" />
            </div>
        </fieldset>
    );
};

export default EventDetailsForm;
