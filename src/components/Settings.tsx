import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AppSettings } from '../types';
import { Save, AlertTriangle, Key, Store, MapPin, Phone, FileText } from 'lucide-react';

export const SettingsComponent: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    pixKey: '',
    pixCity: 'SAO PAULO',
    storeName: 'JR BIKE SHOP',
    phone: '',
    address: '',
    receiptFooter: 'JR BIKE SHOP - OBRIGADO PELA PREFERÊNCIA!',
    updatedBy: '',
    updatedAt: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSettings);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedSettings = {
        ...settings,
        updatedBy: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'settings', 'general'), updatedSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, 'settings/general');
      } catch (e: any) {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-[10px]">Carregando configurações...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-neon/10 rounded-2xl flex items-center justify-center text-neon border border-neon/20">
            <Store size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Dados da Loja</h3>
            <p className="text-neon text-[10px] font-bold tracking-widest uppercase">Personalize seu sistema e recibos</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-2">
                <Key size={12} /> Chave PIX
              </label>
              <input
                value={settings.pixKey}
                onChange={e => setSettings({...settings, pixKey: e.target.value})}
                className="w-full p-3 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="CPF, Email, Celular ou Chave Aleatória"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-2">
                <MapPin size={12} /> Cidade (para PIX)
              </label>
              <input
                value={settings.pixCity}
                onChange={e => setSettings({...settings, pixCity: e.target.value})}
                className="w-full p-3 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="Ex: SAO PAULO"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-2">
                <Store size={12} /> Nome da Loja
              </label>
              <input
                required
                value={settings.storeName}
                onChange={e => setSettings({...settings, storeName: e.target.value})}
                className="w-full p-3 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-2">
                <Phone size={12} /> Telefone Contato
              </label>
              <input
                value={settings.phone}
                onChange={e => setSettings({...settings, phone: e.target.value})}
                className="w-full p-3 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-2">
                <MapPin size={12} /> Endereço
              </label>
              <input
                value={settings.address}
                onChange={e => setSettings({...settings, address: e.target.value})}
                className="w-full p-3 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-neon uppercase tracking-widest flex items-center gap-2">
                <FileText size={12} /> Rodapé do Recibo (PDF)
              </label>
              <textarea
                value={settings.receiptFooter}
                onChange={e => setSettings({...settings, receiptFooter: e.target.value})}
                rows={2}
                className="w-full p-3 bg-black border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white font-bold resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold uppercase italic">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-neon/10 border border-neon/20 rounded-xl text-neon text-xs font-bold uppercase italic">
              Configurações salvas com sucesso!
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-neon text-black font-black rounded-xl hover:scale-105 transition-all uppercase shadow-lg shadow-neon/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={20} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
};
