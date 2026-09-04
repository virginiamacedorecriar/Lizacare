import { Outlet, Link, useLocation } from 'react-router-dom';
import { FileText, Users, FilePlus, Settings, LayoutTemplate } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';

export default function AppLayout() {
  const location = useLocation();
  const signOut = useAuthStore(state => state.signOut);

  const navigation = [
    { name: 'Nova solicitação', href: '/nova-solicitacao', icon: FilePlus },
    { name: 'Solicitações recentes', href: '/', icon: FileText },
    { name: 'Pacientes', href: '/pacientes', icon: Users },
    { name: 'Templates', href: '/templates', icon: LayoutTemplate },
    { name: 'Configurações', href: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <Toaster position="top-right" />
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-6 flex items-center justify-center border-b border-gray-100 mb-4">
          <img src="/lizacare_logo_transparent.png" alt="Lizacare" className="h-32 object-contain" />
        </div>
        <nav className="px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive ? 'text-blue-700' : 'text-gray-400')} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 mt-auto">
          <button 
            onClick={() => signOut()}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2 w-full text-left"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
