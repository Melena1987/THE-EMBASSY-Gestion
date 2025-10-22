import React from 'react';
import type { Space } from '../../../types';

interface EventSpaceSelectorProps {
    startTime: string;
    endTime: string;
    onStartTimeChange: (value: string) => void;
    onEndTimeChange: (value: string) => void;
    groupedSpaces: Record<string, Space[]>;
    spaceStatuses: { [spaceId: string]: { isBooked: boolean; bookingName?: string } };
    selectedSpaces: string[];
    onSpaceClick: (spaceId: string) => void;
    isReadOnly: boolean;
    isUploading: boolean;
}

const EventSpaceSelector: React.FC<EventSpaceSelectorProps> = ({
    startTime,
    endTime,
    onStartTimeChange,
    onEndTimeChange,
    groupedSpaces,
    spaceStatuses,
    selectedSpaces,
    onSpaceClick,
    isReadOnly,
    isUploading,
}) => {
    return (
        <fieldset disabled={isReadOnly || isUploading} className={`space-y-4 ${isReadOnly || isUploading ? 'opacity-70' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="startTime" className="text-xs text-gray-400 block mb-1">Hora de inicio</label>
                    <input id="startTime" type="time" value={startTime} onChange={e => onStartTimeChange(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" step="1800" />
                </div>
                <div>
                    <label htmlFor="endTime" className="text-xs text-gray-400 block mb-1">Hora de fin</label>
                    <input id="endTime" type="time" value={endTime} onChange={e => onEndTimeChange(e.target.value)} className="w-full bg-black/20 text-white border-white/20 rounded-md p-2 focus:ring-orange-500 focus:border-orange-500" step="1800" />
                </div>
            </div>
            {Object.keys(groupedSpaces).map((group) => {
                const spaces = groupedSpaces[group];
                return (
                    <div key={group}>
                        <h4 className="text-lg font-semibold text-orange-400 mt-4 mb-2">{group}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {spaces.map(space => {
                                const { isBooked, bookingName } = spaceStatuses[space.id] || {};
                                const isSelected = selectedSpaces.includes(space.id);
                                return (
                                    <button key={space.id} onClick={() => onSpaceClick(space.id)} disabled={isReadOnly}
                                        title={isBooked ? `Reserva '${bookingName}' será ELIMINADA al guardar.` : space.name}
                                        className={`p-3 rounded-md text-sm font-medium transition-all h-20 flex items-center justify-center text-center ${isSelected ? 'bg-blue-600 ring-2 ring-white' : 'bg-black/20 hover:bg-black/40'} ${isBooked ? 'border-2 border-red-500' : ''} ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        {isBooked ? `SOBRESCRIBIR: ${bookingName}` : space.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </fieldset>
    );
};

export default EventSpaceSelector;
