import { useState } from 'react';
import { Activity, ArrowRight, AtSign, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      if (!displayName.trim()) {
        toast.error('Informe seu nome');
        setLoading(false);
        return;
      }

      const { error } = await signUp(email, password, displayName.trim());
      if (error) toast.error(error.message);
      else toast.success('Conta criada com sucesso!');
    }

    setLoading(false);
  };

  return (
    <div className="auth-login-shell flex min-h-screen items-center justify-center p-4 sm:p-6">
      <style>{`
        .auth-login-shell {
          background: #dfe6ef;
        }

        .auth-login-card {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
        }

        .auth-login-side {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #172437;
          color: #cbd5e1;
        }

        .auth-login-icon,
        .auth-login-submit {
          background: #2563eb;
          color: #fff;
        }

        .auth-login-submit:hover {
          background: #1d4ed8;
        }

        .auth-login-hero {
          margin-top: 42px;
        }

        .auth-login-kicker {
          display: block;
          margin-bottom: 12px;
          color: #8fa1ba;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          line-height: 1;
          text-transform: uppercase;
        }

        @media (max-width: 900px) {
          .auth-login-card {
            grid-template-columns: 1fr;
          }

          .auth-login-side {
            display: none;
          }
        }
      `}</style>

      <Card className="auth-login-card w-full max-w-5xl overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div className="auth-login-side p-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="auth-login-icon flex h-11 w-11 items-center justify-center rounded-lg">
                <Activity className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <h1 className="text-xl font-bold text-white">MDS Gestão</h1>
                <p className="text-xs text-slate-400">Controle operacional e financeiro</p>
              </div>
            </div>

            <div className="auth-login-hero max-w-sm">
              <span className="auth-login-kicker">Área restrita</span>
              <h1 className="text-3xl font-bold leading-tight text-white">
                Gestão integrada para compras, financeiro e operações.
              </h1>
            </div>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-7 flex items-center gap-3">
              <div className="auth-login-icon flex h-11 w-11 items-center justify-center rounded-lg lg:hidden">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {isLogin ? 'Entrar no MDS Gestão' : 'Criar acesso'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isLogin ? 'Acesse sua conta para continuar.' : 'Solicite seu acesso ao sistema.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label>Nome completo</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="relative">
                <Label>Email</Label>
                <AtSign className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  autoComplete="email"
                  className="pl-10"
                />
              </div>

              <div className="relative">
                <Label>Senha</Label>
                <Lock className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="pl-10"
                />
                <p className="mt-1 text-left text-[11px] text-slate-500">
                  Use letras maiúsculas e números para mais segurança
                </p>
              </div>

              <Button
                type="submit"
                className="auth-login-submit h-11 w-full text-sm font-semibold shadow-sm"
                disabled={loading}
              >
                {loading ? (
                  'Aguarde...'
                ) : isLogin ? (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  'Cadastrar'
                )}
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-slate-500"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
