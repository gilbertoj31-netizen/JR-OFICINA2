import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ServiceOrder } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  TrendingUp, 
  DollarSign, 
  Settings, 
  Clock, 
  BarChart3, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Bike
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'serviceOrders'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceOrder[];
      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-gray-500">Calculando métricas...</div>;
  }

  // Metrics Logic
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const currentMonthOrders = orders.filter(o => {
    const d = new Date(o.date);
    return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
  });

  const lastMonthOrders = orders.filter(o => {
    const d = new Date(o.date);
    return isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd });
  });

  const currentRevenue = currentMonthOrders.reduce((acc, o) => acc + o.total, 0);
  const lastRevenue = lastMonthOrders.reduce((acc, o) => acc + o.total, 0);
  
  const revenueGrowth = lastRevenue > 0 
    ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 
    : 100;

  const averageTicket = currentMonthOrders.length > 0 
    ? currentRevenue / currentMonthOrders.length 
    : 0;

  const pendingRevenue = orders
    .filter(o => o.status !== 'Concluído' || o.paymentStatus === 'Pendente')
    .reduce((acc, o) => acc + o.total, 0);

  const pendingCount = orders.filter(o => o.status !== 'Concluído').length;

  // Chart Data (Last 6 months)
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const monthOrders = orders.filter(o => {
      const d = new Date(o.date);
      return isWithinInterval(d, { start: mStart, end: mEnd });
    });
    return {
      name: format(monthDate, 'MMM', { locale: ptBR }).toUpperCase(),
      total: monthOrders.reduce((acc, o) => acc + o.total, 0),
      count: monthOrders.length
    };
  }).reverse();

  // Top Parts/Services
  const itemCounts: Record<string, number> = {};
  orders.forEach(o => {
    o.items.forEach(item => {
      if (item.subtotal > 0) {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      }
    });
  });

  const topItems = Object.entries(itemCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={64} className="text-neon" />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Faturamento {format(now, 'MMMM', { locale: ptBR })}</p>
          <h3 className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(currentRevenue)}</h3>
          <div className={`mt-2 flex items-center gap-1 text-[10px] font-black uppercase ${revenueGrowth >= 0 ? 'text-neon' : 'text-red-500'}`}>
            {revenueGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(revenueGrowth).toFixed(1)}% vs mês ant.
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={64} className="text-neon" />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Ticket Médio (Mês)</p>
          <h3 className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(averageTicket)}</h3>
          <p className="mt-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">{currentMonthOrders.length} Serviços realizados</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={64} className="text-yellow-400" />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Valor a Receber / Pendente</p>
          <h3 className="text-3xl font-black text-white italic tracking-tighter text-yellow-400">{formatCurrency(pendingRevenue)}</h3>
          <p className="mt-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">{pendingCount} OS não concluídas</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bike size={64} className="text-neon" />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Histórico</p>
          <h3 className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(orders.reduce((acc, o) => acc + o.total, 0))}</h3>
          <p className="mt-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">{orders.length} Ordens totais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Faturamento */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-neon" size={24} />
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Faturamento por Mês</h3>
            </div>
          </div>
          
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#525252" 
                  fontSize={10} 
                  fontWeight="900"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#525252" 
                  fontSize={10} 
                  fontWeight="900"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0, 255, 0, 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    border: '1px solid #00FF00', 
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '900'
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'Total']}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === chartData.length - 1 ? '#00FF00' : '#171717'} 
                      stroke={index === chartData.length - 1 ? 'none' : '#00FF00'}
                      strokeWidth={index === chartData.length - 1 ? 0 : 1}
                      fillOpacity={index === chartData.length - 1 ? 1 : 0.2}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Peças/Serviços */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <Package className="text-neon" size={24} />
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Mais Vendidos</h3>
          </div>
          
          <div className="space-y-4">
            {topItems.map(([name, count], index) => (
              <div key={name} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-neon/30 transition-all">
                <div className="flex items-center gap-4">
                  <span className="text-neon font-black italic text-lg opacity-50">#0{index + 1}</span>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic leading-none">{name}</h4>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{count} unidades</span>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-neon opacity-30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
