import React from 'react';
import type { ConsolidatedBooking } from '../types';
import TrashIcon from './icons/TrashIcon';
import PencilIcon from './icons/PencilIcon';

interface BookingDetailsViewProps {
    booking: ConsolidatedBooking;
    onBack: () => void;
    onEdit: () => void;
    onDelete: (booking: ConsolidatedBooking) => void;
    isReadOnly: boolean;
}

const BookingDetailsView: React.FC<BookingDetailsViewProps> = ({ booking, onBack, onEdit, onDelete, isReadOnly }) => {
    
    const handleDelete = () => {
        onDelete(booking);
    };
    
    // The date string is "YYYY-MM-DD", create date as UTC to avoid timezone shifts.
    const [year, month, day] = booking.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));

    const formattedDate = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });

    return (
        <div className="bg-white/5 backdrop-blur-lg p-6 rounded-lg shadow-lg max-w-2xl mx-auto border border-white/10" style={{ fontFamily: 'Arial, sans-serif' }}>
            <h2 className="text-2xl font-bold text-orange-400 mb-4 border-b border-white/20 pb-2">Detalles de la Reserva</h2>
            <div className="space-y-4 text-base sm:text-lg">
                <p><strong className="text-gray-400 w-28 inline-block">Nombre:</strong> <span className="text-white">{booking.details.name}</span></p>
                <p><strong className="text-gray-400 w-28 inline-block">Espacio:</strong> <span className="text-white capitalize">{booking.space}</span></p>
                <p><strong className="text-gray-400 w-28 inline-block">Fecha:</strong> <span className="text-white">{formattedDate}</span></p>
                <p><strong className="text-gray-400 w-28 inline-block">Horario:</strong> <span className="text-white">{booking.startTime} - {booking.endTime}</span></p>
                {booking.details.observations && (
                    <div>
                        <strong className="text-gray-400 block mb-1">Observaciones:</strong>
                        <p className="text-white bg-black/20 p-3 rounded-md mt-1 whitespace-pre-wrap text-sm sm:text-base">{booking.details.observations}</p>
                    </div>
                )}
            </div>
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                    onClick={onBack}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    &larr; Volver a la Agenda
                </button>
                {!isReadOnly && (
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={onEdit}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                        >
                            <PencilIcon className="w-5 h-5" />
                            Editar Reserva
                        </button>
                        <button
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                        >
                            <TrashIcon className="w-5 h-5" />
                            Eliminar Reserva
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingDetailsView;
