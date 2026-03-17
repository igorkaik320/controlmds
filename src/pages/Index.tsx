import { useAuth } from '@/lib/auth';

const Index = () => {
  const { userRole } = useAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Bem-vindo ao Sistema Financeiro</h1>
      <p className="text-muted-foreground">Use o menu lateral para navegar. Seu perfil: <strong>{userRole}</strong></p>
    </div>
  );
};

export default Index;
