import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { USER_EMAIL_MAP } from '../constants';
import type { UserRole, Task } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole>(null);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setIsLoading(true);
            if (currentUser && currentUser.email) {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const role = userDocSnap.data().role as UserRole;
                    setUserRole(role);
                    setCurrentUserName(USER_EMAIL_MAP[currentUser.email.toLowerCase()] || null);
                    setUser(currentUser);

                    // Initial Sponsor Setup Logic
                    if (role === 'ADMIN' || role === 'EVENTOS') {
                        const cleardentRef = doc(db, 'sponsors', 'cleardent');
                        const cleardentSnap = await getDoc(cleardentRef);
                        if (!cleardentSnap.exists()) {
                            const defaultCleardentTasks: Task[] = [
                                { id: 'cl-1', text: 'Presencia del logo y banner de Clínicas Cleardent en la web oficial de THE EMBASSY TEAM 3X3', assignedTo: [], completed: false },
                                { id: 'cl-2', text: 'Presencia del logo de Clínicas Cleardent en ropa OFICIAL DEL CLUB PROFESIONAL (Masc. y femen.) SUPERBASKET y ACADEMIA 3x3 (Cantera)', assignedTo: [], completed: false },
                                { id: 'cl-3', text: 'Logo de Clínicas Cleardent en photocall, carteles, vídeos, etc de todos los eventos 3X3 organizados por THE EMBASSY', assignedTo: [], completed: false },
                                { id: 'cl-4', text: 'Espacio reservado para la instalación de stand exclusivo de Clínicas Cleardent en la Fan Zone de eventos 3x3 organizados por THE EMBASSY.', assignedTo: [], completed: false },
                                { id: 'cl-5', text: 'Presencia física de un representante de Clínicas Cleardent en todos los eventos organizados por el Universo The Embassy (Pro y Social)', assignedTo: [], completed: false }
                            ];
                            await setDoc(cleardentRef, { name: 'Cleardent', tasks: defaultCleardentTasks });
                        }
                    }

                } else {
                    console.error("No role document found for user:", currentUser.uid);
                    await signOut(auth);
                    setUser(null);
                    setUserRole(null);
                    setCurrentUserName(null);
                }
            } else {
                setUser(null);
                setUserRole(null);
                setCurrentUserName(null);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    return { user, userRole, currentUserName, isLoading, handleLogout };
};