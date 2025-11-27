
import React, { useState, useMemo } from 'react';
import type { CashFlows, CashFlowCategory, CashFlowMovement } from '../../types';
import EuroIcon from '../icons/EuroIcon';
import PlusIcon from '../icons/PlusIcon';

interface CashFlowViewProps {
    cashFlow: CashFlows;
    onAddMovement: (movementData: Omit<CashFlowMovement, 'id' | 'createdAt'>) => Promise<boolean>;
    isReadOnly: boolean;
}

const CATEGORIES: { id: CashFlowCategory; label: string; colorClass: string; borderColorClass: string; }[] = [
    { id: 'GENERAL', label: 'GENERAL', colorClass: 'bg-orange-600 hover:bg-orange-700', borderColorClass: 'border-orange-500' },
    { id: 'ALFONSO', label: 'ALFONSO', colorClass: 'bg-blue-600 hover:bg-blue-700', borderColorClass: 'border-blue-500' },
    { id: 'ADRIANA', label: 'ADRIANA', colorClass: 'bg-purple-600 hover:bg-purple-700', borderColorClass: 'border-purple-500' },
];

const CashFlowView: React.FC<CashFlowViewProps> = ({ cashFlow, onAddMovement, isReadOnly }) => {
    const [activeCategory, setActiveCategory] = useState<CashFlowCategory | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const movements = useMemo(() => {
        if (!activeCategory) return [];
        return (Object.values(cashFlow) as CashFlowMovement[])
            .filter(m => m.category === activeCategory)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    }, [cashFlow, activeCategory]);

    const balance = useMemo(() => {
        return movements.reduce((acc, m) => acc + m.amount, 0);
    }, [movements]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCategory || !amount || !description || !date) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            alert('Por favor, introduce una cantidad válida.');
            return;
        }

        setIsSubmitting(true);
        const success = await onAddMovement({
            category: activeCategory,
            amount: numAmount,
            date,
            description
        });

        if (success) {
            setAmount('');
            setDescription('');
            setDate(new Date().toISOString().split('T')[0]);
        }
        setIsSubmitting(false);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
    };

    if (!activeCategory) {
        return (
            <div className="space-y-6" style={{ fontFamily: 'Arial, sans-serif' }}>
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-white/20 pb-4">Gestión de Caja</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`h-48 rounded-xl shadow-lg flex flex-col items-center justify-center gap-4 transition-all transform hover:scale-105 ${cat.colorClass} text-white`}
                        >
                            <EuroIcon className="w-12 h-12" />
                            <span className="text-2xl font-bold tracking-wider">{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const activeCategoryConfig = CATEGORIES.find(c => c.id === activeCategory);

    return (
        <div className="space-y-6 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header with Back Button */}
            <div className="flex items-center justify-between border-b border-white/20 pb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className="text-gray-400 hover:text-white transition-colors text-lg font-medium flex items-center gap-1"
                    >
                        &larr; Volver
                    </button>
                    <h2 className={`text-2xl font-bold text-white px-3 py-1 rounded-md ${activeCategoryConfig?.colorClass}`}>
                        Caja {activeCategoryConfig?.label}
                    </h2>
                </div>
            </div>

            {/* Balance Card */}
            <div className={`bg-gray-900 border-l-4 ${activeCategoryConfig?.borderColorClass} p-6 rounded-lg shadow-lg flex flex-col items-center justify-center`}>
                <span className="text-gray-400 text-sm uppercase tracking-wider mb-1">Saldo Actual</span>
                <span className={`text-4xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(balance)}
                </span>
            </div>

            {/* Input Form */}
            {!isReadOnly && (
                <form onSubmit={handleAdd} className="bg-white/5 p-6 rounded-lg border border-white/10 space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                        <PlusIcon className="w-5 h-5 text-gray-400"/> Nuevo Movimiento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Fecha</label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-gray-400 mb-1">Concepto</label>
                            <input
                                type="text"
                                required
                                placeholder="Descripción del movimiento..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Importe (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                placeholder="-50.00 o 50.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className={`w-full bg-black/30 text-white border-white/20 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 ${parseFloat(amount) < 0 ? 'text-red-400' : 'text-green-400'}`}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-6 py-2 rounded-md text-white font-bold transition-colors ${activeCategoryConfig?.colorClass} disabled:opacity-50`}
                        >
                            {isSubmitting ? 'Guardando...' : 'Añadir Movimiento'}
                        </button>
                    </div>
                </form>
            )}

            {/* History List */}
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 bg-black/20">
                    <h3 className="text-lg font-semibold text-white">Historial de Movimientos</h3>
                </div>
                <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
                    {movements.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay movimientos registrados.</p>
                    ) : (
                        movements.map((movement) => (
                            <div key={movement.id} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/5 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-2 sm:mb-0">
                                    <span className="text-sm text-gray-400 font-mono w-24">{new Date(movement.date).toLocaleDateString('es-ES')}</span>
                                    <span className="text-white font-medium">{movement.description}</span>
                                </div>
                                <span className={`text-lg font-bold font-mono ${movement.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {movement.amount > 0 ? '+' : ''}{formatCurrency(movement.amount)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CashFlowView;
