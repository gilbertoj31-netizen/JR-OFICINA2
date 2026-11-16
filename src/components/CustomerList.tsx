import React, { useState, useEffect } from 'react';
import { Customer, ServiceOrder } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { Search, UserPlus, Edit2, Trash2, Phone, Mail, MapPin, Bike, X, Save, AlertTriangle, History, Calendar, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '../lib/utils';
import { generateOSPDF } from '../lib/pdf';

export const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<ServiceOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [bikeModel, setBikeModel] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customersData);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching customers:", err);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'customers');
      } catch (e: any) {
        setError(e.message);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!historyCustomer) {
      setCustomerHistory([]);
      return;
    }

    const q = query(
      collection(db, 'serviceOrders'),
      where('whatsapp', '==', historyCustomer.whatsapp),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceOrder[];
      setCustomerHistory(orders);
    });

    return () => unsubscribe();
  }, [historyCustomer]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setWhatsapp(customer.whatsapp);
      setEmail(customer.email || '');
      setAddress(customer.address || '');
      setBikeModel(customer.bikeModel || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setWhatsapp('');
      setEmail('');
      setAddress('');
      setBikeModel('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setError(null);
    const customerData = {
      name,
      whatsapp,
      email,
      address,
      bikeModel,
      createdBy: auth.currentUser.uid,
      createdAt: editingCustomer?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingCustomer?.id) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), customerData);
      } else {
        await addDoc(collection(db, 'customers'), customerData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving customer:", err);
      try {
        handleFirestoreError(err, editingCustomer ? OperationType.UPDATE : OperationType.CREATE, 'customers');
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Excluir este cliente permanentemente?")) {
      setError(null);
      try {
        await deleteDoc(doc(db, 'customers', id));
      } catch (err) {
        console.error("Error deleting customer:", err);
        try {
          handleFirestoreError(err, OperationType.DELETE, 'customers');
        } catch (e: any) {
          setError(e.message);
        }
      }
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.whatsapp.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Buscar clientes por nome ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
          />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-neon text-black rounded-2xl hover:scale-105 transition-all font-black shadow-xl shadow-neon/20 w-full md:w-auto uppercase text-sm"
        >
          <UserPlus size={20} /> Novo Cliente
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">Erro de Permissão ou Dados</h3>
              <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                Ocorreu um erro ao processar sua solicitação. Verifique os dados e tente novamente.
              </p>
              <details className="mt-2">
                <summary className="text-[10px] text-red-400/50 cursor-pointer hover:text-red-400">Ver detalhes técnicos</summary>
                <pre className="mt-2 p-2 bg-black/40 rounded text-[10px] text-red-300/70 overflow-x-auto whitespace-pre-wrap font-mono">
                  {error}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Carregando clientes...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/20 text-gray-500">
            Nenhum cliente cadastrado.
          </div>
        ) : (
          filteredCustomers.map(customer => (
            <div key={customer.id} className="bg-white/5 rounded-3xl border border-white/10 p-6 hover:border-neon/50 transition-all group relative flex flex-col justify-between h-full">
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neon/10 rounded-2xl flex items-center justify-center text-neon border border-neon/20 shrink-0">
                      <span className="text-xl font-black">{customer.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h3 className="font-black text-white uppercase italic text-lg leading-tight break-words pr-2">{customer.name}</h3>
                      <p className="text-neon text-[10px] font-bold tracking-widest mt-1">CLIENTE JR BIKE</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleOpenModal(customer)} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-neon hover:bg-neon/10 transition-colors" title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => customer.id && handleDelete(customer.id)} className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <Phone size={14} className="text-neon" />
                    <span className="font-bold">{customer.whatsapp}</span>
                  </div>
                  {customer.bikeModel && (
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <Bike size={14} className="text-neon" />
                      <span className="font-bold text-white truncate">{customer.bikeModel}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <MapPin size={14} className="text-neon shrink-0" />
                      <span className="text-xs truncate">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={() => setHistoryCustomer(customer)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-neon/5 border border-neon/20 rounded-xl text-neon text-[10px] font-black uppercase tracking-widest hover:bg-neon hover:text-black transition-all group/btn"
                >
                  <History size={14} className="transition-transform group-hover/btn:rotate-[-45deg]" />
                  Ver Histórico de Serviços
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Histórico */}
      {historyCustomer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-black border-2 border-neon rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-white italic uppercase leading-none">Histórico de Serviços</h2>
                <p className="text-neon text-[10px] font-bold tracking-widest mt-1">CLIENTE: {historyCustomer.name}</p>
              </div>
              <button 
                onClick={() => setHistoryCustomer(null)} 
                className="text-white hover:text-neon p-2 bg-white/5 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {customerHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Nenhuma ordem de serviço encontrada para este cliente.
                </div>
              ) : (
                customerHistory.map(order => (
                  <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-neon/30 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={14} className="text-neon" />
                          <span className="text-sm font-bold text-white">
                            {format(new Date(order.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                            order.status === 'Concluído' ? 'bg-neon text-black' :
                            order.status === 'Em Andamento' ? 'bg-blue-500 text-white' :
                            'bg-yellow-400 text-black'
                          }`}>
                            {order.status}
                          </span>
                          <button 
                            onClick={async () => await generateOSPDF(order)}
                            className="flex items-center gap-1 text-[10px] font-black uppercase text-neon hover:underline"
                          >
                             <FileText size={12} /> Recibo PDF
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 uppercase font-black tracking-widest block mb-1">Total OS</span>
                        <span className="text-lg font-black text-neon">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Itens do Serviço</h4>
                       <div className="flex flex-wrap gap-2">
                          {order.items.filter(i => i.subtotal > 0).map(item => (
                            <span key={item.id} className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-gray-400 border border-white/10 italic">
                              {item.name}
                            </span>
                          ))}
                          {order.laborCost > 0 && <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-gray-400 border border-white/10 italic">Mão de Obra</span>}
                          {order.washCost > 0 && <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-gray-400 border border-white/10 italic">Lavagem</span>}
                       </div>
                    </div>

                    {order.observations && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <p className="text-xs text-gray-500 leading-relaxed italic line-clamp-2 uppercase font-medium">
                          <span className="text-neon not-italic font-black text-[10px] mr-2 tracking-widest">OBS:</span>
                          {order.observations}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 border-t border-white/10 bg-white/5 text-center">
               <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Frequência de Uso: {customerHistory.length} {customerHistory.length === 1 ? 'Serviço' : 'Serviços'} realizados</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-black border-2 border-neon rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-black text-white italic uppercase">{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:text-neon"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">Nome Completo</label>
                  <input required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">WhatsApp</label>
                  <input required value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">Bicicleta Principal</label>
                  <input value={bikeModel} onChange={e => setBikeModel(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-neon uppercase tracking-widest">Endereço</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-1 focus:ring-neon" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-neon text-black font-black rounded-xl hover:scale-105 transition-all uppercase mt-4 shadow-lg shadow-neon/20 flex items-center justify-center gap-2">
                <Save size={20} /> {editingCustomer ? 'Atualizar' : 'Cadastrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
