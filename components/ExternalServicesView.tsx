
import React, { useState } from 'react';
import CleaningSchedule from './CleaningSchedule';
import type { CleaningAssignments } from '../types';

interface ExternalServicesViewProps {
    cleaningAssignments: CleaningAssignments;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onUpdateCleaningTime: (date: Date, startTime: string) => void;
}

const ExternalServicesView: React.FC<ExternalServicesViewProps> = (props) => {
    const [activeTab, setActiveTab] = useState('limpieza');

    return (
        <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="bg-white/5 backdrop-blur-lg p-4 rounded-lg shadow-lg border border-white/10">
                <h2 className="text-xl font-bold text-white mb-4">Servicios Externos</h2>
                <div className="border-b border-white/20">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('limpieza')}
                            className={`${
                                activeTab === 'limpieza'
                                    ? 'border-orange-500 text-orange-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-300'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            Limpieza
                        </button>
                        {/* Other tabs can be added here */}
                    </nav>
                </div>
            </div>

            <div className="mt-4">
                {activeTab === 'limpieza' && <CleaningSchedule {...props} />}
            </div>
        </div>
    );
};

export default ExternalServicesView;
