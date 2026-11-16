import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from '../types';
import { Send, Bot, User, X, MessageSquare, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

const SYSTEM_INSTRUCTION = `Você é o assistente virtual da JR BIKE SHOP, uma oficina especializada em bicicletas. 
Seu objetivo é ajudar os mecânicos e atendentes com informações técnicas sobre manutenção de bikes, 
sugestões de serviços baseados em defeitos relatados e dicas de atendimento ao cliente.
Seja profissional, prestativo e use termos técnicos de ciclismo quando apropriado.
Você pode ajudar a diagnosticar problemas comuns como barulhos no movimento central, regulagem de câmbio, 
sangria de freios hidráulicos, etc.`;

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat(userMsg).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        }
      });

      const response = await model;
      const aiMsg: ChatMessage = {
        role: 'model',
        text: response.text || 'Desculpe, não consegui processar sua solicitação.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: 'Erro ao conectar com o assistente. Verifique sua conexão.',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-neon text-black rounded-full shadow-[0_0_20px_rgba(0,255,0,0.3)] flex items-center justify-center hover:scale-110 transition-transform z-40"
      >
        <MessageSquare size={28} />
      </button>

      {/* Janela do Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-24 right-6 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-black rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 border-2 border-neon"
          >
            {/* Header */}
            <div className="p-4 bg-neon text-black flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-black italic uppercase text-sm">Assistente JR Bike</h3>
                  <span className="text-[10px] font-bold uppercase opacity-70">Online agora</span>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
              {messages.length === 0 && (
                <div className="text-center py-8 px-4">
                  <Bot size={48} className="mx-auto text-neon mb-4 opacity-30" />
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Olá! Como posso ajudar na oficina hoje? Pergunte sobre diagnósticos ou procedimentos técnicos.</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm font-medium ${
                    msg.role === 'user' 
                      ? 'bg-neon text-black rounded-tr-none shadow-lg' 
                      : 'bg-white/10 text-white rounded-tl-none border border-white/10'
                  }`}>
                    <div className="markdown-body">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none border border-white/10">
                    <Loader2 size={18} className="animate-spin text-neon" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-black border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Digite sua dúvida técnica..."
                  className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-neon outline-none text-white text-sm font-bold"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="p-3 bg-neon text-black rounded-xl hover:bg-neon/90 transition-colors disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
