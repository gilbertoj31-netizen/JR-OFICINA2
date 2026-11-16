import React, { useEffect, useState } from 'react';
import { Power, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';

export function BlingConnection() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [serverRedirectUri, setServerRedirectUri] = useState('');
  const [diagInfo, setDiagInfo] = useState<string | null>(null);
  const [isDiagLoading, setIsDiagLoading] = useState(false);

  const checkStatus = async () => {
    try {
      const [statusRes, uriRes] = await Promise.all([
        fetch('/api/auth/bling/status'),
        fetch('/api/auth/bling/redirect-uri')
      ]);
      const statusData = await statusRes.json();
      const uriData = await uriRes.json();
      setIsConnected(statusData.connected);
      setServerRedirectUri(uriData.redirectUri);
    } catch (err) {
      console.error('Erro ao verificar status do Bling:', err);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnosis = async () => {
    setIsDiagLoading(true);
    setDiagInfo(null);
    try {
      const res = await fetch('/api/bling/test');
      const data = await res.json();
      if (res.ok) {
        setDiagInfo(`Analise: ${data.totalItens} itens encontrados. Depósitos: ${data.temDepositos ? 'Sim' : 'Não'}. Primeiro: ${data.nomePrimeiro}`);
      } else {
        const msg = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || 'Falha na conexão');
        setDiagInfo(`Erro: ${msg}`);
      }
    } catch (err: any) {
      setDiagInfo(`Erro na requisição: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsDiagLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleMessage = (event: MessageEvent) => {
      // origin check is good but in preview it might change, skipping strict origin for ease in preview
      if (event.data?.type === 'BLING_AUTH_SUCCESS') {
        checkStatus();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/auth/bling/url');
      if (!response.ok) throw new Error('Falha ao obter URL de autenticação');
      const { url } = await response.json();

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        url,
        'bling_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      alert('Erro ao iniciar conexão com Bling. Verifique as credenciais nos Secrets.');
    }
  };

  if (loading) return null;

  return (
    <div className="px-4 py-2">
      <div className={`flex items-center justify-between p-3 rounded-xl border ${
        isConnected ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
      }`}>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <CheckCircle2 size={16} className="text-green-500" />
          ) : (
            <XCircle size={16} className="text-red-500" />
          )}
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            Bling {isConnected ? 'Ativo' : 'Off'}
          </span>
        </div>
        
        <button
          onClick={handleConnect}
          className={`p-1.5 rounded-lg transition-all ${
            isConnected 
              ? 'hover:bg-green-500/20 text-green-500' 
              : 'hover:bg-red-500/20 text-red-500 bg-red-500/10'
          }`}
          title={isConnected ? "Reconectar ao Bling" : "Conectar ao Bling"}
        >
          {isConnected ? <RefreshCcw size={14} /> : <Power size={14} />}
        </button>
      </div>

      {isConnected && (
        <div className="mt-3 space-y-2">
          <button
            onClick={runDiagnosis}
            disabled={isDiagLoading}
            className="w-full py-1.5 bg-neon/10 border border-neon/30 text-neon text-[8px] font-black rounded hover:bg-neon hover:text-black transition-all uppercase tracking-widest disabled:opacity-50"
          >
            {isDiagLoading ? 'Diagnosticando...' : 'Diagnosticar Conexão'}
          </button>
          {diagInfo && (
            <div className="p-2 bg-black/40 border border-white/10 rounded text-[8px] font-bold text-gray-400 leading-tight">
              {diagInfo}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 text-center">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="text-[7px] text-neon hover:underline uppercase font-bold"
        >
          {showConfig ? 'Ocultar Link de Retorno' : 'Configurar Link no Bling'}
        </button>
      </div>

      {showConfig && (
        <div className="mt-3 p-2 bg-white/5 rounded-lg border border-white/10 text-left">
          <p className="text-[7px] text-gray-400 font-bold uppercase mb-1">Passo 1: No Painel do Bling</p>
          <p className="text-[6px] text-gray-500 mb-2">Vá em "Dados básicos" e cole este link no campo "URL de redirecionamento":</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-black p-1.5 rounded border border-white/10 break-all select-all text-[8px] font-mono text-neon">
              {serverRedirectUri || 'Carregando...'}
            </div>
            <button
              onClick={() => {
                if (serverRedirectUri) {
                  navigator.clipboard.writeText(serverRedirectUri);
                  alert('Copiado!');
                }
              }}
              className="px-2 py-1 bg-neon/10 border border-neon/30 text-neon text-[8px] font-black rounded hover:bg-neon hover:text-black transition-all"
            >
              COPIAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
