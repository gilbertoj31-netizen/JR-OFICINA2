import React from 'react';
import { signInWithGoogle, logOut, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { LogIn, LogOut, User, Bike } from 'lucide-react';

export const Auth: React.FC = () => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div className="p-4 text-center">Carregando...</div>;

  if (user) {
    return (
      <div className="flex items-center gap-4 bg-white/5 p-2 rounded-lg backdrop-blur-sm border border-white/10">
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-neon" referrerPolicy="no-referrer" />
          ) : (
            <User className="w-8 h-8 p-1 bg-white/10 rounded-full text-white" />
          )}
          <span className="text-sm font-medium hidden sm:inline text-white">{user.displayName}</span>
        </div>
        <button
          onClick={logOut}
          className="p-2 hover:bg-red-500/20 rounded-full transition-colors text-red-400"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-black">
      <div className="mb-8 p-8 bg-black border-2 border-neon rounded-3xl shadow-[0_0_30px_rgba(0,255,0,0.1)] max-w-md w-full">
        <div className="w-20 h-20 bg-neon rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-neon/40">
          <Bike size={40} className="text-black" />
        </div>
        <h1 className="text-4xl font-black mb-2 text-white italic">JR BIKE SHOP</h1>
        <p className="text-neon mb-10 font-bold uppercase tracking-widest text-sm">Sistema de Oficina e Revisão</p>
        
        <button
          onClick={signInWithGoogle}
          className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white text-black rounded-2xl hover:scale-105 transition-all shadow-lg font-black text-lg"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          ENTRAR COM GOOGLE
        </button>
      </div>
    </div>
  );
};
