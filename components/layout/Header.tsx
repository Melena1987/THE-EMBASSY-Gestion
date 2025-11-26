
import React, { useState, useRef, useEffect } from 'react';
import type { View, UserRole, AggregatedTask, TaskSourceCollection, AppNotification } from '../../types';
import CalendarIcon from '../icons/CalendarIcon';
import LayoutIcon from '../icons/LayoutIcon';
import ListIcon from '../icons/ListIcon';
import EmbassyLogo from '../icons/EmbassyLogo';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import PlusIcon from '../icons/PlusIcon';
import UsersIcon from '../icons/UsersIcon';
import BriefcaseIcon from '../icons/BriefcaseIcon';
import LogoutIcon from '../icons/LogoutIcon';
import StarIcon from '../icons/StarIcon';
import HeartIcon from '../icons/HeartIcon';
import BellIcon from '../icons/BellIcon';
import TasksDropdown from '../ui/TasksDropdown';
import ClipboardIcon from '../icons/ClipboardIcon';
import UserIcon from '../icons/UserIcon';

interface HeaderProps {
    currentView: View;
    setView: (view: View) => void;
    userEmail: string | null;
    userRole: UserRole;
    onLogout: () => void;
    pendingTasks: AggregatedTask[];
    unreadNotifications: AppNotification[];
    onToggleTask: (sourceId: string, taskId: string, collection: TaskSourceCollection) => void;
    onNotificationClick: (notification: AppNotification) => void;
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

const Header: React.FC<HeaderProps> = ({ currentView, setView, userEmail, userRole, onLogout, pendingTasks, unreadNotifications, onToggleTask, onNotificationClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isTasksOpen, setIsTasksOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const tasksRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (tasksRef.current && !tasksRef.current.contains(event.target as Node)) {
                setIsTasksOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleViewChange = (view: View) => {
        setView(view);
        setIsMenuOpen(false);
    };

    const isAgendaMenuActive = ['plano', 'calendario', 'agenda', 'detalles', 'eventos', 'detalles_evento'].includes(currentView);
    const isTurnosActive = currentView === 'turnos';
    const isTareasActive = currentView === 'tareas';
    const isServiciosActive = currentView === 'servicios';
    const isSponsorsActive = currentView === 'sponsors';
    
    const canCreateBooking = userRole === 'ADMIN' || userRole === 'EVENTOS' || userRole === 'SALUD';
    const canCreateEvent = userRole === 'ADMIN' || userRole === 'EVENTOS';
    const notificationCount = pendingTasks.length + unreadNotifications.length;

    return (
        <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 shadow-lg sticky top-0 z-20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 flex-nowrap">
                    {/* --- Left Part: Logo --- */}
                    <div className="flex-1 flex items-center justify-start">
                        <div className="flex items-center gap-2">
                            <EmbassyLogo className="h-7 w-auto text-orange-400" />
                            <span className="text-orange-400 font-light hidden sm:inline">Gestión</span>
                        </div>
                    </div>
                    
                    {/* --- Center Part: Desktop Navigation --- */}
                    <nav className="hidden md:flex items-center justify-center space-x-1 sm:space-x-2 flex-nowrap">
                       <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsMenuOpen(prev => !prev)}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                    isAgendaMenuActive
                                        ? 'bg-orange-600 text-white'
                                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                }`}
                                aria-haspopup="true"
                                aria-expanded={isMenuOpen}
                            >
                                <LayoutIcon className="h-5 w-5" />
                                <span>Agenda</span>
                                <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isMenuOpen && (
                                <div 
                                    className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 origin-top bg-gray-900 border border-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                                    role="menu"
                                    aria-orientation="vertical"
                                >
                                    <div className="py-1" role="none">
                                        {canCreateBooking && (
                                            <DropdownItem
                                                isActive={currentView === 'plano'}
                                                onClick={() => handleViewChange('plano')}
                                                label="Reserva"
                                            >
                                                <PlusIcon className="h-5 w-5" />
                                            </DropdownItem>
                                        )}
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
                                        {canCreateEvent && (
                                            <DropdownItem
                                                isActive={currentView === 'eventos'}
                                                onClick={() => handleViewChange('eventos')}
                                                label="Evento Especial"
                                            >
                                                <StarIcon className="h-5 w-5" />
                                            </DropdownItem>
                                        )}
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
                           <span>Turnos</span>
                       </button>
                        <button
                           onClick={() => setView('tareas')}
                           className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                               isTareasActive
                                   ? 'bg-orange-600 text-white'
                                   : 'text-gray-300 hover:bg-white/10 hover:text-white'
                           }`}
                       >
                           <ClipboardIcon className="h-5 w-5" />
                           <span>Tareas</span>
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
                           <span>Servicios</span>
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
                               <span>Patrocinadores</span>
                           </button>
                       )}
                    </nav>

                    {/* --- Right Part: User, Notifications, Logout --- */}
                    <div className="flex-1 flex items-center justify-end">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="relative" ref={tasksRef}>
                                <button
                                    onClick={() => setIsTasksOpen(prev => !prev)}
                                    className="relative p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
                                    title="Notificaciones y Tareas"
                                >
                                    <BellIcon className="h-5 w-5" />
                                    {notificationCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                                            {notificationCount}
                                        </span>
                                    )}
                                </button>
                                {isTasksOpen && (
                                    <TasksDropdown
                                        tasks={pendingTasks}
                                        notifications={unreadNotifications}
                                        onToggleTask={onToggleTask}
                                        onNotificationClick={onNotificationClick}
                                        onClose={() => setIsTasksOpen(false)}
                                    />
                                )}
                            </div>
                            
                            {/* --- Desktop User Info --- */}
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium text-white truncate max-w-[120px] sm:max-w-none">{userEmail}</p>
                                <p className="text-xs text-orange-400 font-semibold">{userRole}</p>
                            </div>
                            
                            <button 
                                onClick={onLogout}
                                title="Cerrar Sesión"
                                className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors hidden md:block"
                            >
                                <LogoutIcon className="h-5 w-5" />
                            </button>

                            {/* --- Mobile User Menu --- */}
                            <div className="relative md:hidden" ref={userMenuRef}>
                                <button
                                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                                    className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
                                    title="Cuenta de usuario"
                                >
                                    <UserIcon className="h-6 w-6" />
                                </button>
                                {isUserMenuOpen && (
                                    <div 
                                        className="absolute right-0 mt-2 w-64 origin-top-right bg-gray-900 border border-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30"
                                        role="menu"
                                    >
                                        <div className="p-2">
                                            <div className="text-left px-3 pt-2 pb-3">
                                                <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                                                <p className="text-xs text-orange-400 font-semibold">{userRole}</p>
                                            </div>
                                            <div className="pt-2 border-t border-white/10">
                                                <button 
                                                    onClick={() => { onLogout(); setIsUserMenuOpen(false); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-base text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-150 rounded-md"
                                                >
                                                    <LogoutIcon className="w-5 h-5" />
                                                    <span>Cerrar Sesión</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
