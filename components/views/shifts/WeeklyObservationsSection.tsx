import React from 'react';

interface WeeklyObservationsSectionProps {
    observations: string | undefined;
    isReadOnly: boolean;
    onObservationsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const WeeklyObservationsSection: React.FC<WeeklyObservationsSectionProps> = ({
    observations, isReadOnly, onObservationsChange
}) => {
    return (
        <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
            <label htmlFor="weekObservations" className="text-lg font-semibold text-orange-400 mb-2 block">
                Observaciones de la Semana
            </label>
            <textarea
                id="weekObservations"
                value={observations || ''}
                onChange={onObservationsChange}
                rows={4}
                placeholder="Anotaciones importantes para la semana, eventos especiales, recordatorios, etc."
                className="w-full bg-black/20 text-white border-white/20 rounded-md p-3 focus:ring-orange-500 focus:border-orange-500 resize-y disabled:cursor-not-allowed"
                disabled={isReadOnly}
            />
        </div>
    );
};

export default WeeklyObservationsSection;
