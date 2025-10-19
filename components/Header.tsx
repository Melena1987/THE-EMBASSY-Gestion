import React, { useState, useRef, useEffect } from 'react';
import type { View, UserRole } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import LayoutIcon from './icons/LayoutIcon';
import ListIcon from './icons/ListIcon';
import EmbassyLogo from './icons/EmbassyLogo';
import ChevronDownIcon from './icons/ChevronDownIcon';
import PlusIcon from './icons/PlusIcon';
import UsersIcon from './icons/UsersIcon';
import BriefcaseIcon from './icons/BriefcaseIcon';
import LogoutIcon from './icons/LogoutIcon';
import StarIcon from './icons/StarIcon';
import HeartIcon from './icons/HeartIcon';

interface HeaderProps {
    currentView: View;
    setView: (view: View) => void;
    userEmail: string | null;
    userRole: UserRole;
    onLogout: () => void;
}

const DropdownItem: React.FC<{
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
    label: string;
}> = ({ isActive, onClick, children, label }) => (
    <button
        onClick={onClick}
        role="menuitem"
        className={`flex items-center gap-3 px-4 py-2 text-sm w-full text-left transition-colors duration-150 ${
            isActive
                ? 'bg-orange-600 text-white'
                : 'text-gray-200 hover:bg-white/10 hover:text-white'
        }`}
    >
        {children}
        <span>{label}</span>
    </button>
);


const Header: React.FC<HeaderProps> = ({ currentView, setView, userEmail, userRole, onLogout }) => {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleViewChange = (view: View) => {
        setView(view);
        setDropdownOpen(false);
    };

    const isAgendaMenuActive = ['plano', 'calendario', 'agenda', 'detalles', 'eventos', 'detalles_evento'].includes(currentView);
    const isTurnosActive = currentView === 'turnos';
    const isServiciosActive = currentView === 'servicios';
    const isSponsorsActive = currentView === 'sponsors';

    return (
        <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 shadow-lg sticky top-0 z-20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-2">
                        <EmbassyLogo className="h-7 w-auto text-orange-400" />
                        <span className="text-orange-400 font-light hidden sm:inline">Gestión</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-medium text-white">{userEmail}</p>
                            <p className="text-xs text-orange-400 font-semibold">{userRole}</p>
                        </div>
                        <nav className="flex items-center space-x-2 sm:space-x-4">
                           <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(prev => !prev)}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                        isAgendaMenuActive
                                            ? 'bg-orange-600 text-white'
                                            : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                    aria-haspopup="true"
                                    aria-expanded={isDropdownOpen}
                                >
                                    <LayoutIcon className="h-5 w-5" />
                                    <span className="hidden sm:inline">Agenda</span>
                                    <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isDropdownOpen && (
                                    <div 
                                        className="absolute right-0 mt-2 w-56 origin-top-right bg-black/50 backdrop-blur-xl border border-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                                        role="menu"
                                        aria-orientation="vertical"
                                    >
                                        <div className="py-1" role="none">
                                            <DropdownItem
                                                isActive={currentView === 'plano'}
                                                onClick={() => handleViewChange('plano')}
                                                label="Reserva"
                                            >
                                                <PlusIcon className="h-5 w-5" />
                                            </DropdownItem>
                                            <DropdownItem
                                                isActive={currentView === 'calendario'}
                                                onClick={() => handleViewChange('calendario')}
                                                label="Calendario"
                                            >
                                                <CalendarIcon className="h-5 w-5" />
                                            </DropdownItem>
                                            <DropdownItem
                                                isActive={currentView === 'agenda'}
                                                onClick={() => handleViewChange('agenda')}
                                                label="Agenda Semanal"
                                            >
                                                <ListIcon className="h-5 w-5" />
                                            </DropdownItem>
                                             <DropdownItem
                                                isActive={currentView === 'eventos'}
                                                onClick={() => handleViewChange('eventos')}
                                                label="Evento Especial"
                                            >
                                                <StarIcon className="h-5 w-5" />
                                            </DropdownItem>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                               onClick={() => setView('turnos')}
                               className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                   isTurnosActive
                                       ? 'bg-orange-600 text-white'
                                       : 'text-gray-300 hover:bg-white/10 hover:text-white'
                               }`}
                           >
                               <UsersIcon className="h-5 w-5" />
                               <span className="hidden sm:inline">Turnos</span>
                           </button>
                           <button
                               onClick={() => setView('servicios')}
                               className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                   isServiciosActive
                                       ? 'bg-orange-600 text-white'
                                       : 'text-gray-300 hover:bg-white/10 hover:text-white'
                               }`}
                           >
                               <BriefcaseIcon className="h-5 w-5" />
                               <span className="hidden sm:inline">Servicios</span>
                           </button>
                           {(userRole === 'ADMIN' || userRole === 'EVENTOS') && (
                               <button
                                   onClick={() => setView('sponsors')}
                                   className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                       isSponsorsActive
                                           ? 'bg-orange-600 text-white'
                                           : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                   }`}
                               >
                                   <HeartIcon className="h-5 w-5" />
                                   <span className="hidden sm:inline">Patrocinadores</span>
                               </button>
                           )}
                        </nav>
                        <button 
                            onClick={onLogout}
                            title="Cerrar Sesión"
                            className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
                        >
                            <LogoutIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
