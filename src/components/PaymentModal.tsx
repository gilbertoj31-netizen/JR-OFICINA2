import React from 'react';
import { ServiceOrder, AppSettings } from '../types';
import { X, Copy, Check, QrCode, FileText } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { generateOSPDF } from '../lib/pdf';
import { generatePixPayload } from '../lib/pixUtils';

interface Props {
  order: ServiceOrder;
  settings: AppSettings;
  onClose: () => void;
}

export const PaymentModal: React.FC<Props> = ({ order, settings, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const pixPayload = React.useMemo(() => {
    if (!settings.pixKey) return '';
    return generatePixPayload(
      settings.pixKey, 
      settings.storeName, 
      settings.pixCity || 'SAO PAULO', 
      order.total
    );
  }, [settings, order.total]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload || settings.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[80] flex items-center justify-center p-4">
      <div className="bg-black border-2 border-neon rounded-3xl shadow-[0_0_50px_rgba(0,255,0,0.2)] w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black">
          <div>
            <h2 className="text-lg font-black text-white italic uppercase leading-none">Pagamento & Recibo</h2>
            <p className="text-neon text-[10px] font-bold tracking-widest mt-1 truncate max-w-[200px]">CLIENTE: {order.customerName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Valor Total */}
          <div className="text-center space-y-0">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total a Pagar</span>
            <div className="text-4xl font-black text-neon shadow-neon drop-shadow-[0_0_10px_rgba(0,255,0,0.4)]">
              {formatCurrency(order.total)}
            </div>
          </div>

          {/* Área PIX */}
          {settings.pixKey ? (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center space-y-3">
                <div className="flex items-center gap-2 text-neon font-black text-[10px] uppercase tracking-widest">
                  <QrCode size={14} /> QR CODE PIX
                </div>
                <div className="bg-white p-2 rounded-xl">
                  <img 
                    src={qrUrl} 
                    alt="QR Code PIX" 
                    className="w-32 h-32" 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="w-full space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center block">Chave PIX</label>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value={settings.pixKey} 
                      className="flex-1 bg-black border border-white/10 p-2 rounded-xl text-[10px] font-bold text-white outline-none"
                    />
                    <button 
                      onClick={handleCopy}
                      className="p-2 bg-neon text-black rounded-xl hover:scale-105 transition-all"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  {copied && <p className="text-neon text-[10px] font-black text-center uppercase animate-pulse">Copiado!</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <p className="text-yellow-500 text-[10px] font-bold uppercase italic">
                Chave PIX não configurada. Vá em "Configurações" para ativar.
              </p>
            </div>
          )}

          {/* Botão Recibo */}
          <button
            onClick={async () => await generateOSPDF(order)}
            className="w-full py-3 bg-white/10 border border-white/20 rounded-xl text-white font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
          >
            <FileText size={18} className="text-neon" />
            Gerar Recibo PDF
          </button>
        </div>

        <div className="p-4 border-t border-white/10 bg-black">
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-white"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
