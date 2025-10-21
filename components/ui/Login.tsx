import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import EmbassyLogo from '../icons/EmbassyLogo';
import DownloadIcon from '../icons/DownloadIcon';
import ShareIcon from '../icons/ShareIcon';
import PlusSquareIcon from '../icons/PlusSquareIcon';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);

    const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!isInStandaloneMode()) {
                setShowInstallButton(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);
        
        if (isIos() && !isInStandaloneMode()) {
            setShowInstallButton(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            setShowInstallButton(false);
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            setDeferredPrompt(null);
        } else if (isIos()) {
            setShowIosInstallPrompt(true);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged in useAuth.ts will handle the state change
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Email o contraseña incorrectos.');
            } else {
                setError('Ocurrió un error al iniciar sesión.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative">
            <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 shadow-lg rounded-lg p-8 space-y-6">
                <div className="text-center">
                    <EmbassyLogo className="h-10 w-auto text-orange-400 mx-auto" />
                    <h2 className="mt-4 text-center text-2xl font-bold text-white">
                        Iniciar Sesión
                    </h2>
                </div>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-gray-300">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full bg-black/20 text-white border-white/20 rounded-md p-3 focus:ring-orange-500 focus:border-orange-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-gray-300">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full bg-black/20 text-white border-white/20 rounded-md p-3 focus:ring-orange-500 focus:border-orange-500"
                        />
                    </div>
                    
                    {error && (
                        <p className="text-sm text-red-400 text-center">{error}</p>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isLoading ? 'Iniciando...' : 'Entrar'}
                        </button>
                    </div>
                </form>
                 <p className="text-center text-xs text-gray-500">
                    Solo personal autorizado. No hay registro público.
                </p>
            </div>

            {showInstallButton && (
                <button
                    onClick={handleInstallClick}
                    className="fixed bottom-5 right-5 bg-orange-600 text-white p-4 rounded-full shadow-lg hover:bg-orange-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-orange-500 z-20"
                    title="Instalar aplicación"
                >
                    <DownloadIcon className="w-6 h-6" />
                </button>
            )}

            {showIosInstallPrompt && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-50"
                    onClick={() => setShowIosInstallPrompt(false)}
                >
                    <div 
                        className="bg-gray-800 border border-white/20 rounded-lg shadow-xl p-6 w-full max-w-sm m-4 text-white text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold text-orange-400 mb-4">Instalar Aplicación</h3>
                        <p className="text-gray-300 mb-6">
                            Para instalar la aplicación en tu dispositivo, sigue estos pasos:
                        </p>
                        <div className="space-y-4 text-left">
                            <p className="flex items-center gap-3">
                                <span className="bg-white/10 p-2 rounded-md"><ShareIcon className="w-6 h-6 text-blue-400"/></span>
                                <span>1. Pulsa el icono de <strong>Compartir</strong> en la barra de herramientas del navegador.</span>
                            </p>
                             <p className="flex items-center gap-3">
                                <span className="bg-white/10 p-2 rounded-md"><PlusSquareIcon className="w-6 h-6 text-gray-300"/></span>
                                <span>2. Desplázate hacia abajo y selecciona <strong>'Añadir a pantalla de inicio'</strong>.</span>
                            </p>
                        </div>
                         <button
                            onClick={() => setShowIosInstallPrompt(false)}
                            className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-md transition-colors mt-8"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
