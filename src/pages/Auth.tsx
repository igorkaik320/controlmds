import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
    } else {
      if (!displayName.trim()) { toast.error('Informe seu nome'); setLoading(false); return; }
      const { error } = await signUp(email, password, displayName.trim());
      if (error) toast.error(error.message);
      else toast.success('Conta criada com sucesso!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Controle de Caixa</CardTitle>
          <p className="text-muted-foreground text-sm">{isLogin ? 'Entre na sua conta' : 'Crie sua conta'}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div><Label>Nome</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" required={!isLogin} /></div>
            )}
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" required /></div>
            <div><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}</Button>
          </form>
          <Button variant="link" className="w-full mt-2" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
