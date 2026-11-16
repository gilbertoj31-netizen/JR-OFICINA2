import React, { useState, useEffect } from 'react';
import { ServiceOrder, ServiceItem, Customer } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, Save, X, AlertTriangle, User, Search, Package, Box } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

// Bling Item Type
interface BlingProduct {
  id: string;
  nome: string;
  preco: number;
  codigo?: string;
}

const DEFAULT_ITEMS = [
  "Abraçadeira de Selim", "Acessorios/outros", "Alavancas de Câmbio", "Aros", "Box / Embalagem",
  "Cabos de aço", "Caixa de Direção", "Câmaras de Ar", "Câmbio Dianteiro", "Câmbio Traseiro",
  "Canote", "Cassete", "Conduíte", "Coroas", "Corrente", "Cubos", "Discos", "Eixos esfera",
  "Eixos rolamento", "Espaçadores", "Esferas/ Rolamentos selados", "Fita de Aro",
  "Gancheira", "Garfo", "Guidão", "Manetes de Freio", "Manoplas ou Fita de Guidão",
  "Mesa", "Movimento Central", "Pastilhas de Freio", "Pedais", "Pedivela", "Pinças",
  "Pneus", "Quadro", "Raios", "Roda Livre", "Roldanas", "Selim", "Válvulas"
].sort((a, b) => a.localeCompare(b));

interface Props {
  initialData?: ServiceOrder | Partial<ServiceOrder>;
  onClose: () => void;
}

export const ServiceOrderForm: React.FC<Props> = ({ initialData, onClose }) => {
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [bikeModel, setBikeModel] = useState(initialData?.bikeModel || '');
  const [mechanicName, setMechanicName] = useState(initialData?.mechanicName || '');
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || '');
  const [status, setStatus] = useState<ServiceOrder['status']>(initialData?.status || 'Pendente');
  const [paymentStatus, setPaymentStatus] = useState<ServiceOrder['paymentStatus']>(initialData?.paymentStatus || 'Pendente');
  const [items, setItems] = useState<ServiceItem[]>(() => {
    const initialItems = initialData?.items || [];
    const initialNames = new Set(initialItems.map(i => i.name.toLowerCase().trim()));
    
    const defaultOptions = DEFAULT_ITEMS
      .filter(name => !initialNames.has(name.toLowerCase().trim()))
      .map(name => ({
        id: Math.random().toString(36).substr(2, 9),
        name,
        defect: false,
        replace: false,
        description: '',
        quantity: 1,
        unitPrice: 0,
        subtotal: 0
      }));
      
    // Combine existing items with missing defaults
    const combined = [...initialItems, ...defaultOptions];
    return combined.sort((a, b) => a.name.localeCompare(b.name));
  });

  const [laborCost, setLaborCost] = useState(initialData?.laborCost || 0);
  const [washCost, setWashCost] = useState(initialData?.washCost || 0);
  const [discount, setDiscount] = useState(initialData?.discount || 0);
  const [observations, setObservations] = useState(initialData?.observations || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Bling States
  const [blingSuggestions, setBlingSuggestions] = useState<BlingProduct[]>([]);
  const [activeBlingSearch, setActiveBlingSearch] = useState<string | null>(null);
  const [loadingBling, setLoadingBling] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setAllCustomers(customersData);
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (customerName.length > 0 && showSuggestions) {
      const filtered = allCustomers.filter(c => 
        c.name.toLowerCase().includes(customerName.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [customerName, allCustomers, showSuggestions]);

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setWhatsapp(customer.whatsapp);
    if (customer.bikeModel) setBikeModel(customer.bikeModel);
    setShowSuggestions(false);
  };

  const calculateTotal = () => {
    const itemsTotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    return itemsTotal + laborCost + washCost - discount;
  };

  const handleItemChange = (id: string, field: keyof ServiceItem, value: any) => {
    if (field === 'name' && value.trim() !== '') {
      const isDuplicate = items.some(item => 
        item.id !== id && 
        item.name.toLowerCase().trim() === value.toLowerCase().trim()
      );
      if (isDuplicate) {
        setError(`O item "${value}" já está na lista de peças/serviços.`);
        // We don't block the change let the user see what they typed, but error will block save
      } else if (error?.includes('já está na lista')) {
        setError(null);
      }
    }
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
        return updatedItem;
      }
      return item;
    }));
  };

  const searchBling = async (query: string, itemId: string) => {
    if (query.length < 3) {
      setBlingSuggestions([]);
      return;
    }

    try {
      setLoadingBling(true);
      const response = await fetch(`/api/bling/products?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        const products = data.data?.map((p: any) => ({
          id: p.id,
          nome: p.nome,
          preco: p.preco,
          codigo: p.codigo
        })) || [];
        
        // Filter out products already in items (except the one we are currently editing)
        const filtered = products.filter((p: any) => 
          !items.some(item => item.id !== itemId && item.name.toLowerCase().trim() === p.nome.toLowerCase().trim())
        );
        
        setBlingSuggestions(filtered);
        setActiveBlingSearch(itemId);
      } else if (response.status === 401) {
        setError("Bling desconectado. Por favor, conecte novamente na barra lateral.");
      }
    } catch (err) {
      console.error("Erro ao buscar no Bling:", err);
    } finally {
      setLoadingBling(false);
    }
  };

  const selectBlingProduct = (product: BlingProduct, itemId: string) => {
    // Double check just in case
    const isDuplicate = items.some(item => item.id !== itemId && item.name.toLowerCase().trim() === product.nome.toLowerCase().trim());
    if (isDuplicate) {
      setError(`O item "${product.nome}" já está na lista.`);
      setBlingSuggestions([]);
      setActiveBlingSearch(null);
      return;
    }

    handleItemChange(itemId, 'name', product.nome);
    handleItemChange(itemId, 'unitPrice', product.preco);
    if (product.codigo) handleItemChange(itemId, 'description', `Código Bling: ${product.codigo}`);
    setBlingSuggestions([]);
    setActiveBlingSearch(null);
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      defect: false,
      replace: false,
      description: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0
    }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Check for duplicate names
    const names = items.map(i => i.name.toLowerCase().trim()).filter(n => n !== '');
    const hasDuplicates = names.some((name, index) => names.indexOf(name) !== index);
    if (hasDuplicates) {
      setError("Não é possível salvar com itens duplicados. Por favor, remova ou renomeie as duplicatas.");
      return;
    }

    setLoading(true);
    setError(null);

    const osData: Omit<ServiceOrder, 'id'> = {
      customerName,
      bikeModel,
      mechanicName,
      whatsapp,
      date: new Date().toISOString(),
      status,
      paymentStatus,
      items,
      laborCost,
      washCost,
      discount,
      total: calculateTotal(),
      observations,
      createdBy: initialData?.createdBy || auth.currentUser.uid,
      createdAt: initialData?.createdAt || serverTimestamp()
    };

    try {
      if (initialData?.id) {
        await updateDoc(doc(db, 'serviceOrders', initialData.id), osData);
      } else {
        await addDoc(collection(db, 'serviceOrders'), osData);
      }

      // Automatically handle Customer record
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('whatsapp', '==', whatsapp));
      const querySnapshot = await getDocs(q);

      const customerData = {
        name: customerName,
        whatsapp: whatsapp,
        bikeModel: bikeModel,
        lastServiceDate: new Date().toISOString(),
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };

      if (querySnapshot.empty) {
        // Create new customer if doesn't exist by WhatsApp
        await addDoc(customersRef, customerData);
      } else {
        // Update existing customer's last service and bike
        const customerDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'customers', customerDoc.id), {
          name: customerName,
          bikeModel: bikeModel,
          lastServiceDate: new Date().toISOString()
        });
      }

      onClose();
    } catch (err) {
      console.error("Error saving OS:", err);
      try {
        handleFirestoreError(err, initialData ? OperationType.UPDATE : OperationType.CREATE, 'serviceOrders');
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-black border-2 border-neon rounded-3xl shadow-[0_0_50px_rgba(0,255,0,0.15)] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black">
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
            {initialData ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 bg-black">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">Erro ao Salvar</h3>
                  <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                    Verifique se todos os campos obrigatórios (Cliente, Bicicleta, WhatsApp) estão preenchidos corretamente.
                  </p>
                  <details className="mt-2">
                    <summary className="text-[10px] text-red-400/50 cursor-pointer hover:text-red-400">Ver detalhes técnicos</summary>
                    <pre className="mt-2 p-2 bg-black/40 rounded text-[10px] text-red-300/70 overflow-x-auto whitespace-pre-wrap font-mono">
                      {typeof error === 'object' ? JSON.stringify(error, null, 2) : error}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          )}
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest">Cliente</label>
              <input
                required
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="Nome do cliente"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-black border border-neon rounded-xl shadow-2xl overflow-hidden">
                  {suggestions.map(customer => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="w-full p-3 text-left hover:bg-neon/10 flex items-center gap-3 border-b border-white/5 last:border-0"
                    >
                      <div className="w-8 h-8 bg-neon/10 rounded-lg flex items-center justify-center text-neon font-black text-xs uppercase">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm">{customer.name}</span>
                        <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{customer.whatsapp}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest">Bicicleta</label>
              <input
                required
                value={bikeModel}
                onChange={e => setBikeModel(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="Modelo da bike"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest">WhatsApp</label>
              <input
                required
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest">Mecânico</label>
              <input
                value={mechanicName}
                onChange={e => setMechanicName(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="Nome do mecânico"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest">Status da OS</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none bg-black text-white font-bold"
              >
                <option value="Pendente">Pendente</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest">Pagamento</label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as any)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none bg-black text-white font-bold"
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white italic uppercase flex items-center gap-2">
                <Package className="text-neon" /> Peças / Serviços
              </h3>
              {loadingBling && (
                <span className="text-[10px] text-neon animate-pulse font-black uppercase tracking-widest">
                  Buscando no Bling...
                </span>
              )}
            </div>

            <div className="border border-white/10 rounded-2xl bg-black/50">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-white/5 text-neon uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-4 py-4 min-w-[200px]">Peça / Serviço</th>
                    <th className="px-4 py-4 text-center">Defeito</th>
                    <th className="px-4 py-4 text-center">Troca</th>
                    <th className="px-4 py-4 min-w-[150px]">Descrição</th>
                    <th className="px-4 py-4 text-center">Qtd</th>
                    <th className="px-4 py-4">Preço Un.</th>
                    <th className="px-4 py-4">Subtotal</th>
                    <th className="px-4 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3 relative">
                        <input
                          value={item.name}
                          onChange={e => {
                            handleItemChange(item.id, 'name', e.target.value);
                            searchBling(e.target.value, item.id);
                          }}
                          onFocus={() => {
                            if (item.name.length >= 3) searchBling(item.name, item.id);
                          }}
                          className="w-full p-1 border-none focus:ring-0 bg-transparent text-white font-bold"
                          placeholder="Nome do item..."
                        />
                        {activeBlingSearch === item.id && blingSuggestions.length > 0 && (
                          <div className="absolute z-[60] left-0 top-full w-full bg-black border border-neon rounded-xl shadow-2xl overflow-hidden mt-1 max-h-48 overflow-y-auto">
                            <div className="bg-neon/10 p-2 border-b border-neon/20 flex items-center justify-between">
                              <span className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-1">
                                <Box size={12} /> Sugestões do Bling
                              </span>
                              <button onClick={() => setActiveBlingSearch(null)} className="text-neon hover:text-white">
                                <X size={12} />
                              </button>
                            </div>
                            {blingSuggestions.length > 0 ? (
                              blingSuggestions.map(product => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => selectBlingProduct(product, item.id)}
                                  className="w-full p-2 text-left hover:bg-neon/10 border-b border-white/5 last:border-0 flex justify-between items-center group"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-white font-bold text-xs truncate max-w-[150px]">{product.nome}</span>
                                    {product.codigo && <span className="text-[9px] text-gray-500 font-bold">SKU: {product.codigo}</span>}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-black text-neon">{formatCurrency(product.preco)}</span>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Nenhum produto encontrado</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.defect}
                          onChange={e => handleItemChange(item.id, 'defect', e.target.checked)}
                          className="w-5 h-5 accent-neon rounded border-white/20"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.replace}
                          onChange={e => handleItemChange(item.id, 'replace', e.target.checked)}
                          className="w-5 h-5 accent-neon rounded border-white/20"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.description}
                          onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                          className="w-full p-1 border-none focus:ring-0 bg-transparent text-gray-400 text-xs"
                          placeholder="Obs..."
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-16 p-1 bg-white/5 border border-white/10 rounded text-center text-white font-bold"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 p-1 bg-white/5 border border-white/10 rounded text-white font-bold"
                        />
                      </td>
                      <td className="px-4 py-3 font-black text-neon">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 text-neon border border-neon/30 rounded-xl hover:bg-neon hover:text-black transition-all text-xs font-black uppercase"
              >
                <Plus size={18} /> Adicionar Item Manualmente
              </button>
            </div>
          </div>

          {/* Totais e Observações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neon uppercase tracking-widest">Observações</label>
                <textarea
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-neon outline-none resize-none text-white font-medium"
                  placeholder="Observações gerais da revisão..."
                />
              </div>
            </div>

            <div className="bg-white/5 p-8 rounded-3xl space-y-4 border border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black uppercase text-xs tracking-widest">Mão de Obra</span>
                <input
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={e => setLaborCost(parseFloat(e.target.value) || 0)}
                  className="w-32 p-2 bg-black border border-white/10 rounded-lg text-right font-black text-white"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black uppercase text-xs tracking-widest">Lavagem</span>
                <input
                  type="number"
                  step="0.01"
                  value={washCost}
                  onChange={e => setWashCost(parseFloat(e.target.value) || 0)}
                  className="w-32 p-2 bg-black border border-white/10 rounded-lg text-right font-black text-white"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black uppercase text-xs tracking-widest">Desconto</span>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-32 p-2 bg-black border border-red-500/30 rounded-lg text-right font-black text-red-500"
                />
              </div>
              <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                <span className="text-2xl font-black text-white italic uppercase tracking-tighter">TOTAL</span>
                <span className="text-4xl font-black text-neon shadow-neon drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-white/10 bg-black flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 border border-white/20 rounded-2xl hover:bg-white/5 transition-colors font-black text-white uppercase text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-10 py-3 bg-neon text-black rounded-2xl hover:scale-105 transition-all font-black shadow-xl shadow-neon/20 disabled:opacity-50 uppercase text-sm"
          >
            {loading ? 'Salvando...' : (
              <>
                <Save size={20} /> Salvar OS
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
