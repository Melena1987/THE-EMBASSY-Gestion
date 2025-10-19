import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import EmbassyLogo from './icons/EmbassyLogo';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged in App.tsx will handle the state change
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
        <div className="min-h-screen flex items-center justify-center px-4">
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
        </div>
    );
};

export default Login;
