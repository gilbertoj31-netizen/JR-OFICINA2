import React, { useState, useEffect } from 'react';
import { ServiceOrder } from '../types';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Edit2, Trash2, Search, Calendar, Bike, MessageCircle, FileText, Share2, X, AlertTriangle, DollarSign, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { generateOSPDF, sendWhatsAppNotification } from '../lib/pdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PaymentModal } from './PaymentModal';
import { AppSettings } from '../types';
import { getDoc } from 'firebase/firestore';

interface Props {
  onEdit: (os: ServiceOrder) => void;
}

export const ServiceOrderList: React.FC<Props> = ({ onEdit }) => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<ServiceOrder | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceOrder[];
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'serviceOrders', deletingId));
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("Erro ao excluir ordem de serviço.");
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.bikeModel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'Todos' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando ordens de serviço...</div>;

  return (
    <div className="space-y-6">
      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente ou bicicleta..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Concluído">Concluído</option>
          </select>
        </div>
      </div>

      {/* Lista de Ordens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/20 text-gray-500">
            Nenhuma ordem de serviço encontrada.
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden hover:border-neon/50 transition-all group">
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-black text-lg text-white leading-tight italic uppercase">{order.customerName}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-neon font-bold">
                      <Bike size={14} />
                      <span>{order.bikeModel}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      order.status === 'Concluído' ? 'bg-neon text-black' :
                      order.status === 'Em Andamento' ? 'bg-blue-500 text-white' :
                      'bg-yellow-400 text-black'
                    }`}>
                      {order.status}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      order.paymentStatus === 'Pago' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {order.paymentStatus === 'Pago' ? 'Pago' : 'Pgto Pendente'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Data</span>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <Calendar size={14} className="text-neon" />
                      {format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Total</span>
                    <div className="text-sm font-black text-neon flex flex-col items-end">
                      {order.discount > 0 && (
                        <span className="text-[9px] text-red-400 line-through opacity-50">
                          {formatCurrency(order.total + order.discount)}
                        </span>
                      )}
                      {formatCurrency(order.total)}
                    </div>
                  </div>
                </div>

                {order.whatsapp && (
                  <button 
                    onClick={() => sendWhatsAppNotification(order)}
                    className="flex items-center gap-2 w-full text-xs font-black text-black bg-green-500 p-2 rounded-lg hover:scale-105 transition-transform uppercase"
                  >
                    <MessageCircle size={14} />
                    Notificar WhatsApp
                  </button>
                )}
              </div>

              <div className="px-5 py-3 bg-white/5 border-t border-white/10 flex justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentOrder(order)}
                    className="p-2 text-neon hover:bg-neon/10 rounded-lg transition-colors"
                    title="Pagamento e Recibo"
                  >
                    <Wallet size={18} />
                  </button>
                  <button
                    onClick={async () => await generateOSPDF(order)}
                    className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Baixar PDF"
                  >
                    <FileText size={18} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(order)}
                    className="p-2 text-neon hover:bg-neon/10 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => order.id && setDeletingId(order.id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-black border-2 border-red-500 rounded-3xl shadow-[0_0_50px_rgba(255,0,0,0.2)] w-full max-w-sm overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-500/20">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Confirma a exclusão?</h3>
              <p className="text-gray-400 text-sm font-medium">Esta ação não pode ser desfeita. A ordem de serviço será removida permanentemente.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDelete}
                className="w-full py-4 bg-red-500 text-white font-black rounded-xl hover:scale-105 transition-all uppercase shadow-lg shadow-red-500/20"
              >
                Sim, Excluir Agora
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="w-full py-4 border border-white/10 text-white font-black rounded-xl hover:bg-white/5 transition-all uppercase"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentOrder && settings && (
        <PaymentModal 
          order={paymentOrder}
          settings={settings}
          onClose={() => setPaymentOrder(null)}
        />
      )}
    </div>
  );
};
