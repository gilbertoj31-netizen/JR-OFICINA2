import React, { useState } from 'react';
import { Auth } from './components/Auth';
import { ServiceOrderList } from './components/ServiceOrderList';
import { ServiceOrderForm } from './components/ServiceOrderForm';
import { AppointmentList } from './components/AppointmentList';
import { Chatbot } from './components/Chatbot';
import { auth } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ServiceOrder } from './types';
import { Plus, LayoutDashboard, Settings, HelpCircle, Bike, Users, Calendar } from 'lucide-react';
import { CustomerList } from './components/CustomerList';
import { Dashboard } from './components/Dashboard';
import { SettingsComponent } from './components/Settings';
import { BlingConnection } from './components/BlingConnection';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOS, setEditingOS] = useState<Partial<ServiceOrder> | undefined>();
  const [activeTab, setActiveTab] = useState<'orders' | 'appointments' | 'customers' | 'finance' | 'settings'>('orders');
  const [isFinanceAuthorized, setIsFinanceAuthorized] = useState(false);
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState(false);

  const FINANCE_PIN = '1234'; // Default PIN

  const handleTabChange = (tab: 'orders' | 'appointments' | 'customers' | 'finance' | 'settings') => {
    if ((tab === 'finance' || tab === 'settings') && !isFinanceAuthorized) {
      setShowPinModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === FINANCE_PIN) {
      setIsFinanceAuthorized(true);
      setActiveTab('finance');
      setShowPinModal(false);
      setPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  };

  const handleEdit = (os: ServiceOrder) => {
    setEditingOS(os);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingOS(undefined);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black">
        <Auth />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col md:flex-row text-white">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-black border-r border-white/10 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 bg-neon rounded-xl flex items-center justify-center shadow-lg shadow-neon/20">
            <Bike size={24} className="text-black" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none text-white">JR BIKE</h1>
            <span className="text-[10px] text-neon uppercase font-bold tracking-widest">Oficina & Revisão</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => handleTabChange('orders')}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-black transition-all border ${
              activeTab === 'orders' ? 'bg-neon text-black border-neon' : 'hover:bg-white/5 text-gray-400 border-transparent'
            }`}
          >
            <LayoutDashboard size={20} />
            Ordens de Serviço
          </button>
          <button 
            onClick={() => handleTabChange('appointments')}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-black transition-all border ${
              activeTab === 'appointments' ? 'bg-neon text-black border-neon' : 'hover:bg-white/5 text-gray-400 border-transparent'
            }`}
          >
            <Calendar size={20} />
            Agendamentos
          </button>
          <button 
            onClick={() => handleTabChange('customers')}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-black transition-all border ${
              activeTab === 'customers' ? 'bg-neon text-black border-neon' : 'hover:bg-white/5 text-gray-400 border-transparent'
            }`}
          >
            <Users size={20} />
            Clientes
          </button>
          <button 
            onClick={() => handleTabChange('finance')}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-black transition-all border ${
              activeTab === 'finance' ? 'bg-neon text-black border-neon' : 'hover:bg-white/5 text-gray-400 border-transparent'
            }`}
          >
            {isFinanceAuthorized ? <Unlock size={20} /> : <Lock size={20} />}
            Painel do Dono
          </button>
          <button 
            onClick={() => handleTabChange('settings')}
            className={`flex items-center gap-3 w-full p-3 rounded-xl font-black transition-all border ${
              activeTab === 'settings' ? 'bg-neon text-black border-neon' : 'hover:bg-white/5 text-gray-400 border-transparent'
            }`}
          >
            <Settings size={20} />
            Configurações
          </button>
        </nav>

        <div className="border-t border-white/5 py-4">
          <BlingConnection />
        </div>

        <div className="p-4 border-t border-white/10">
          <Auth />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-black">
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white">
              {activeTab === 'orders' ? 'Ordens de Serviço' : activeTab === 'appointments' ? 'Agendamento de Revisões' : activeTab === 'customers' ? 'Gestão de Clientes' : activeTab === 'finance' ? 'Financeiro & Métricas' : 'Configurações'}
            </h2>
            <p className="text-sm text-neon font-bold uppercase tracking-wider">
              {activeTab === 'orders' ? 'Gerencie as revisões da sua oficina' : activeTab === 'appointments' ? 'Agende revisões e envie lembretes por WhatsApp' : activeTab === 'customers' ? 'Histórico e Frequência de Clientes' : activeTab === 'finance' ? 'Acompanhamento de Lucros e Desempenho' : 'Configure os dados da sua loja e pagamentos'}
            </p>
          </div>
          {activeTab === 'orders' && (
            <button
              onClick={() => {
                setEditingOS(undefined);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-neon text-black rounded-2xl hover:scale-105 transition-all font-black shadow-xl shadow-neon/20 active:scale-95"
            >
              <Plus size={20} /> Nova OS
            </button>
          )}
        </header>

        <div className="p-6 max-w-7xl mx-auto">
          {activeTab === 'orders' ? (
            <ServiceOrderList onEdit={handleEdit} />
          ) : activeTab === 'appointments' ? (
            <AppointmentList 
              onCreateOS={(initial) => {
                setEditingOS(initial as ServiceOrder);
                setIsFormOpen(true);
              }} 
            />
          ) : activeTab === 'customers' ? (
            <CustomerList />
          ) : activeTab === 'finance' ? (
            <Dashboard />
          ) : (
            <SettingsComponent />
          )}
        </div>
      </main>

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
          <div className="bg-black border-2 border-neon rounded-3xl p-8 w-full max-w-sm shadow-[0_0_50px_rgba(0,255,0,0.2)]">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-neon/10 rounded-2xl flex items-center justify-center text-neon border border-neon/20">
                <Lock size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Área Restrita</h3>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Digite o PIN do proprietário para acessar</p>
              </div>
              
              <form onSubmit={handlePinSubmit} className="w-full space-y-4">
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="PIN DE ACESSO"
                  className={`w-full p-4 bg-white/5 border rounded-2xl text-center text-2xl tracking-[1em] font-black focus:ring-2 outline-none transition-all ${
                    pinError ? 'border-red-500 ring-red-500/20' : 'border-white/10 focus:ring-neon'
                  }`}
                  autoFocus
                />
                {pinError && <p className="text-red-500 text-[10px] font-black uppercase italic tracking-widest">PIN Incorreto. Tente novamente.</p>}
                
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="flex-1 py-3 border border-white/20 rounded-xl text-xs font-black uppercase text-gray-500 hover:bg-white/5"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-neon text-black rounded-xl text-xs font-black uppercase hover:scale-105 transition-all"
                  >
                    Entrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Overlays */}
      {isFormOpen && (
        <ServiceOrderForm
          initialData={editingOS}
          onClose={handleCloseForm}
        />
      )}

      <Chatbot />
    </div>
  );
}
