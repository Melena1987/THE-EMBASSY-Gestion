import React from 'react';
import { useAuth } from './hooks/useAuth';
import { useAppStore } from './hooks/useAppStore';
import Login from './components/ui/Login';
import AppLayout from './components/AppLayout';

const App: React.FC = () => {
    const { user, userRole, currentUserName, isLoading, handleLogout } = useAuth();

    // The store hook is called conditionally, which is fine since the condition (user) is stable during the component's lifecycle.
    const store = useAppStore(user, userRole, currentUserName);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-white text-xl">Cargando...</div>;
    }

    if (!user || !userRole) {
        return <Login />;
    }

    return (
        <AppLayout
            store={store}
            auth={{
                user,
                userRole,
                currentUserName,
                handleLogout,
            }}
        />
    );
};

export default App;
