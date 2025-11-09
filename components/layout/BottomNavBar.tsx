import React from 'react';
import type { View, UserRole } from '../../types';
import CalendarIcon from '../icons/CalendarIcon';
import ListIcon from '../icons/ListIcon';
import UsersIcon from '../icons/UsersIcon';
import ClipboardIcon from '../icons/ClipboardIcon';
import BriefcaseIcon from '../icons/BriefcaseIcon';
import HeartIcon from '../icons/HeartIcon';

interface BottomNavBarProps {
    currentView: View;
    setView: (view: View) => void;
    userRole: UserRole;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center flex-1 pt-2 pb-1 text-xs transition-colors duration-200 ${
            isActive ? 'text-orange-400' : 'text-gray-400 hover:text-white'
        }`}
        aria-current={isActive ? 'page' : undefined}
    >
        {icon}
        <span className="mt-1">{label}</span>
    </button>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, setView, userRole }) => {
    
    const handleAgendaClick = () => {
        // Toggle between month (calendario) and week (agenda) views
        if (currentView === 'calendario') {
            setView('agenda');
        } else {
            setView('calendario');
        }
    };
    
    // The "Agenda" button is active for any view related to scheduling
    const isAgendaActive = ['agenda', 'calendario', 'detalles', 'detalles_evento', 'plano', 'eventos'].includes(currentView);

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-gray-900 border-t border-white/10 flex items-center justify-around z-30 md:hidden">
            <NavItem
                onClick={handleAgendaClick}
                isActive={isAgendaActive}
                label="Agenda"
                // Show the icon for the view you'll switch TO
                icon={currentView === 'calendario' ? <ListIcon className="w-6 h-6" /> : <CalendarIcon className="w-6 h-6" />}
            />
            <NavItem
                onClick={() => setView('turnos')}
                isActive={currentView === 'turnos'}
                label="Turnos"
                icon={<UsersIcon className="w-6 h-6" />}
            />
            <NavItem
                onClick={() => setView('tareas')}
                isActive={currentView === 'tareas'}
                label="Tareas"
                icon={<ClipboardIcon className="w-6 h-6" />}
            />
            <NavItem
                onClick={() => setView('servicios')}
                isActive={currentView === 'servicios'}
                label="Servicios"
                icon={<BriefcaseIcon className="w-6 h-6" />}
            />
            {(userRole === 'ADMIN' || userRole === 'EVENTOS') && (
                <NavItem
                    onClick={() => setView('sponsors')}
                    isActive={currentView === 'sponsors'}
                    label="Sponsors"
                    icon={<HeartIcon className="w-6 h-6" />}
                />
            )}
        </nav>
    );
};

export default BottomNavBar;
