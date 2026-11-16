import React, { useState, useEffect } from 'react';
import { Appointment, Customer, ServiceOrder } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Search, Plus, Calendar as CalendarIcon, Clock, Edit2, Trash2, Phone, Bike, X, Save, AlertTriangle, CheckCircle2, MessageSquare, ArrowRight, UserCheck, Check, Filter } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  onCreateOS?: (initialData: Partial<ServiceOrder>) => void;
}

export const AppointmentList: React.FC<Props> = ({ onCreateOS }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'tomorrow' | 'week'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bikeModel, setBikeModel] = useState('');
  const [serviceType, setServiceType] = useState('Revisão Geral');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('10:00');
  const [status, setStatus] = useState<Appointment['status']>('Agendado');
  const [notes, setNotes] = useState('');

  // Customer selection autocomplete
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch appointments
    const q = query(collection(db, 'appointments'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      setAppointments(data);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching appointments:", err);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'appointments');
      } catch (e: any) {
        setError(e.message);
      }
    });

    // Fetch customers for quick picker
    const fetchCustomers = async () => {
      try {
        const snap = await getDocs(collection(db, 'customers'));
        const custs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[];
        setCustomers(custs);
      } catch (e) {
        console.error("Error loading customers for picker:", e);
      }
    };
    fetchCustomers();

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleOpenModal = (app?: Appointment) => {
    setError(null);
    if (app) {
      setEditingAppointment(app);
      setCustomerName(app.customerName);
      setWhatsapp(app.whatsapp);
      setBikeModel(app.bikeModel || '');
      setServiceType(app.serviceType);
      setDate(app.date);
      setTime(app.time);
      setStatus(app.status);
      setNotes(app.notes || '');
      setCustomerSearch(app.customerName);
    } else {
      setEditingAppointment(null);
      setCustomerName('');
      setWhatsapp('');
      setBikeModel('');
      setServiceType('Revisão Geral');
      setDate(format(addDays(new Date(), 1), 'yyyy-MM-dd')); // Default to tomorrow!
      setTime('10:00');
      setStatus('Agendado');
      setNotes('');
      setCustomerSearch('');
    }
    setIsModalOpen(true);
  };

  const handleSelectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerSearch(c.name);
    setWhatsapp(c.whatsapp);
    if (c.bikeModel) setBikeModel(c.bikeModel);
    setShowCustomerDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!customerName.trim() || !whatsapp.trim()) {
      setError("Por favor, preencha o nome do cliente e o WhatsApp.");
      return;
    }

    setError(null);
    const appointmentData = {
      customerName: customerName.trim(),
      whatsapp: whatsapp.trim(),
      bikeModel: bikeModel.trim(),
      serviceType,
      date,
      time,
      status,
      notes: notes.trim(),
      createdBy: auth.currentUser.uid,
      createdAt: editingAppointment?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingAppointment?.id) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), appointmentData);
      } else {
        await addDoc(collection(db, 'appointments'), appointmentData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving appointment:", err);
      try {
        handleFirestoreError(err, editingAppointment ? OperationType.UPDATE : OperationType.CREATE, 'appointments');
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const handleQuickStatusChange = async (app: Appointment, newStatus: Appointment['status']) => {
    if (!app.id) return;
    try {
      await updateDoc(doc(db, 'appointments', app.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error updating appointment status:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Excluir este agendamento permanentemente?")) {
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (err) {
        console.error("Error deleting appointment:", err);
      }
    }
  };

  const handleSendWhatsAppReminder = (app: Appointment) => {
    const cleanPhone = app.whatsapp.replace(/\D/g, '');
    const formattedDate = format(parseISO(app.date), "dd/MM/yyyy");
    const message = `Olá, *${app.customerName}*! tudo bem?\nConfirmando seu agendamento na *JR BIKE SHOP*:\n\n🚲 *Serviço:* ${app.serviceType}\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${app.time}\n${app.bikeModel ? `🚲 *Bike:* ${app.bikeModel}\n` : ''}\nCaso precise alterar o horário, basta nos avisar por aqui. Estamos te aguardando!`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/55${cleanPhone}?text=${encoded}`, '_blank');
  };

  const handleConvertToOS = (app: Appointment) => {
    if (!onCreateOS) return;
    
    // Mark appointment as 'Em Atendimento'
    if (app.id) {
      handleQuickStatusChange(app, 'Em Atendimento');
    }

    const formattedDate = format(parseISO(app.date), "yyyy-MM-dd");

    onCreateOS({
      customerName: app.customerName,
      whatsapp: app.whatsapp,
      bikeModel: app.bikeModel || '',
      date: formattedDate,
      observations: `Agendamento prévio: ${app.serviceType}. ${app.notes ? `Obs: ${app.notes}` : ''}`,
      status: 'Pendente',
      paymentStatus: 'Pendente',
    });
  };

  // Filtered appointments logic
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

  const filteredAppointments = appointments.filter(app => {
    // Search filter
    const matchesSearch = 
      app.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.whatsapp.includes(searchTerm) ||
      (app.bikeModel && app.bikeModel.toLowerCase().includes(searchTerm.toLowerCase())) ||
      app.serviceType.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Date filter
    if (filterDate === 'today' && app.date !== todayStr) return false;
    if (filterDate === 'tomorrow' && app.date !== tomorrowStr) return false;
    if (filterDate === 'week') {
      const appDate = parseISO(app.date);
      const weekEnd = addDays(now, 7);
      if (appDate < new Date(todayStr) || appDate > weekEnd) return false;
    }

    // Status filter
    if (filterStatus !== 'all' && app.status !== filterStatus) return false;

    return true;
  });

  // Counters
  const todayCount = appointments.filter(a => a.date === todayStr && a.status !== 'Cancelado').length;
  const tomorrowCount = appointments.filter(a => a.date === tomorrowStr && a.status !== 'Cancelado').length;
  const pendingConfirmationCount = appointments.filter(a => a.status === 'Agendado').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-neon tracking-widest block">Agendados Hoje</span>
            <span className="text-3xl font-black text-white">{todayCount}</span>
          </div>
          <div className="w-12 h-12 bg-neon/10 rounded-xl flex items-center justify-center text-neon border border-neon/20">
            <CalendarIcon size={24} />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest block">Agendados Amanhã</span>
            <span className="text-3xl font-black text-white">{tomorrowCount}</span>
          </div>
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest block">Aguardando Confirmação</span>
            <span className="text-3xl font-black text-white">{pendingConfirmationCount}</span>
          </div>
          <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-400 border border-yellow-500/20">
            <UserCheck size={24} />
          </div>
        </div>
      </div>

      {/* Header Controls & Filters */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente, WhatsApp, bicicleta ou serviço..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
          />
        </div>

        {/* Date Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterDate('all')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              filterDate === 'all' ? 'bg-neon text-black border-neon' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterDate('today')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              filterDate === 'today' ? 'bg-neon text-black border-neon' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setFilterDate('tomorrow')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              filterDate === 'tomorrow' ? 'bg-neon text-black border-neon' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            Amanhã
          </button>
          <button
            onClick={() => setFilterDate('week')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
              filterDate === 'week' ? 'bg-neon text-black border-neon' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            Próximos 7 dias
          </button>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-black border border-white/10 rounded-xl text-xs font-black uppercase text-neon outline-none focus:ring-1 focus:ring-neon"
          >
            <option value="all">Status: Todos</option>
            <option value="Agendado">Agendado</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Em Atendimento">Em Atendimento</option>
            <option value="Concluído">Concluído</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-3 bg-neon text-black rounded-2xl hover:scale-105 transition-all font-black shadow-xl shadow-neon/20 uppercase text-xs shrink-0"
          >
            <Plus size={18} /> Novo Agendamento
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">Erro ao processar</h3>
              <p className="text-xs text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500 font-bold">Carregando agendamentos...</div>
        ) : filteredAppointments.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/20 text-gray-500">
            Nenhum agendamento encontrado para este filtro.
          </div>
        ) : (
          filteredAppointments.map(app => {
            const isAppToday = app.date === todayStr;
            const isAppTomorrow = app.date === tomorrowStr;

            return (
              <div 
                key={app.id} 
                className={`bg-white/5 rounded-3xl border p-6 transition-all flex flex-col justify-between h-full relative group ${
                  isAppToday ? 'border-neon/60 shadow-[0_0_20px_rgba(0,255,0,0.1)]' :
                  isAppTomorrow ? 'border-blue-500/50' : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div>
                  {/* Top Header info */}
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          app.status === 'Confirmado' ? 'bg-emerald-500 text-black' :
                          app.status === 'Em Atendimento' ? 'bg-blue-500 text-white' :
                          app.status === 'Concluído' ? 'bg-neon text-black' :
                          app.status === 'Cancelado' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          'bg-yellow-400 text-black'
                        }`}>
                          {app.status}
                        </span>

                        {isAppToday && (
                          <span className="px-2 py-0.5 bg-neon/20 text-neon border border-neon/40 rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
                            HOJE
                          </span>
                        )}

                        {isAppTomorrow && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded text-[9px] font-black uppercase tracking-widest">
                            AMANHÃ
                          </span>
                        )}
                      </div>

                      <h3 className="font-black text-white uppercase italic text-lg mt-2 leading-tight">
                        {app.customerName}
                      </h3>
                      <p className="text-neon text-[11px] font-black tracking-wider uppercase mt-0.5">
                        {app.serviceType}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenModal(app)} 
                        className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-neon hover:bg-neon/10 transition-colors"
                        title="Editar Agendamento"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => app.id && handleDelete(app.id)} 
                        className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Excluir Agendamento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 py-3 border-y border-white/5">
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <CalendarIcon size={14} className="text-neon shrink-0" />
                      <span className="font-bold">
                        {format(parseISO(app.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <Clock size={14} className="text-neon shrink-0" />
                      <span className="font-bold text-neon">{app.time} horas</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <Phone size={14} className="text-neon shrink-0" />
                      <span className="font-bold">{app.whatsapp}</span>
                    </div>

                    {app.bikeModel && (
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Bike size={14} className="text-neon shrink-0" />
                        <span className="font-bold text-white truncate">{app.bikeModel}</span>
                      </div>
                    )}

                    {app.notes && (
                      <div className="mt-2 p-2.5 bg-black/40 rounded-xl border border-white/5 text-xs text-gray-400 italic">
                        <span className="text-neon font-black not-italic text-[10px] uppercase mr-1">Obs:</span>
                        {app.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSendWhatsAppReminder(app)}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500 hover:text-black transition-all"
                      title="Enviar Lembrete por WhatsApp"
                    >
                      <MessageSquare size={13} /> WhatsApp
                    </button>

                    {onCreateOS && (
                      <button
                        onClick={() => handleConvertToOS(app)}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-neon/10 border border-neon/30 text-neon rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-neon hover:text-black transition-all"
                        title="Criar Ordem de Serviço"
                      >
                        Abrir OS <ArrowRight size={13} />
                      </button>
                    )}
                  </div>

                  {/* Status quick switch dropdown */}
                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                    <span className="font-bold uppercase tracking-widest">Mudar Status:</span>
                    <div className="flex gap-1">
                      {app.status !== 'Confirmado' && (
                        <button
                          onClick={() => handleQuickStatusChange(app, 'Confirmado')}
                          className="px-2 py-0.5 bg-white/5 hover:bg-emerald-500 hover:text-black rounded text-[9px] font-black uppercase transition-colors"
                        >
                          Confirmar
                        </button>
                      )}
                      {app.status !== 'Concluído' && (
                        <button
                          onClick={() => handleQuickStatusChange(app, 'Concluído')}
                          className="px-2 py-0.5 bg-white/5 hover:bg-neon hover:text-black rounded text-[9px] font-black uppercase transition-colors"
                        >
                          Concluir
                        </button>
                      )}
                      {app.status !== 'Cancelado' && (
                        <button
                          onClick={() => handleQuickStatusChange(app, 'Cancelado')}
                          className="px-2 py-0.5 bg-white/5 hover:bg-red-500 hover:text-white rounded text-[9px] font-black uppercase transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Appointment */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-black border-2 border-neon rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-white italic uppercase">
                  {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento de Revisão'}
                </h2>
                <p className="text-neon text-[10px] font-bold tracking-widest mt-1">JR BIKE SHOP</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:text-neon p-2 rounded-full bg-white/5">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Customer Selector / Autocomplete */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-neon uppercase tracking-widest">Cliente / Nome Completo</label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    value={customerName}
                    onChange={e => {
                      setCustomerName(e.target.value);
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Digite o nome ou selecione da lista..."
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold"
                  />
                </div>

                {/* Quick Customer Dropdown */}
                {showCustomerDropdown && customers.length > 0 && customerSearch.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-black border border-neon/50 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto p-1">
                    {customers
                      .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                      .map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left p-2.5 hover:bg-neon/10 hover:text-neon rounded-lg flex justify-between items-center text-xs font-bold transition-colors"
                        >
                          <span className="uppercase">{c.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{c.whatsapp}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Phone / Whatsapp & Bike */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">WhatsApp / Telefone</label>
                  <input
                    required
                    type="text"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    placeholder="(88) 99999-9999"
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">Modelo da Bicicleta</label>
                  <input
                    type="text"
                    value={bikeModel}
                    onChange={e => setBikeModel(e.target.value)}
                    placeholder="Ex: Oglo / Caloi / Scott"
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold"
                  />
                </div>
              </div>

              {/* Service Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neon uppercase tracking-widest">Tipo de Serviço / Revisão</label>
                <select
                  value={serviceType}
                  onChange={e => setServiceType(e.target.value)}
                  className="w-full p-3 bg-black border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold"
                >
                  <option value="Revisão Geral">Revisão Geral (Desmontagem completa)</option>
                  <option value="Revisão Simples">Revisão Simples (Regulagem e Ajustes)</option>
                  <option value="Troca de Peças">Troca de Peças / Componentes</option>
                  <option value="Regulagem de Freios e Câmbio">Regulagem de Freios & Câmbio</option>
                  <option value="Lavagem Completa & Lubrificação">Lavagem Completa & Lubrificação</option>
                  <option value="Conserto de Pneu / Câmara">Conserto de Pneu / Câmara</option>
                  <option value="Outro Serviço">Outro Serviço</option>
                </select>
              </div>

              {/* Date & Time with presets */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">Data do Agendamento</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))}
                      className="px-2 py-0.5 bg-white/5 hover:bg-neon hover:text-black border border-white/10 rounded text-[9px] font-black uppercase"
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                      className="px-2 py-0.5 bg-neon/20 text-neon border border-neon/40 hover:bg-neon hover:text-black rounded text-[9px] font-black uppercase"
                    >
                      Amanhã
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(format(addDays(new Date(), 2), 'yyyy-MM-dd'))}
                      className="px-2 py-0.5 bg-white/5 hover:bg-neon hover:text-black border border-white/10 rounded text-[9px] font-black uppercase"
                    >
                      +2 Dias
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold"
                  />

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neon uppercase tracking-widest">Horário</label>
                    <input
                      type="time"
                      required
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neon uppercase tracking-widest">Status Inicial</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(['Agendado', 'Confirmado', 'Em Atendimento', 'Concluído', 'Cancelado'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`p-2 rounded-xl text-[10px] font-black uppercase transition-all border ${
                        status === s ? 'bg-neon text-black border-neon' : 'bg-white/5 text-gray-400 border-white/10'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neon uppercase tracking-widest">Observações / Detalhes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Barulho na catraca, cliente trará amanhã cedo..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon font-bold text-xs"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-4 bg-neon text-black font-black rounded-xl hover:scale-[1.02] transition-all uppercase mt-4 shadow-lg shadow-neon/20 flex items-center justify-center gap-2"
              >
                <Save size={20} /> {editingAppointment ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
