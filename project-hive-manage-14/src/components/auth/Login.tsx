import * as React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || 'Erro no login. Tente novamente.');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/20">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/logo-impacto/logo.png" 
              alt="IMPACTO Consultoria e Desenvolvimento Institucional" 
              className="h-16 w-auto object-contain mr-3" 
            />
            <h1 className="text-4xl font-bold gradient-primary bg-clip-text text-transparent">
              IMPACTO
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">Sistema de Gestão de Projetos e Tarefas</p>
        </div>

        <Card className="glass-effect shadow-2xl border-0 hover-lift">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">Acesso ao Sistema</CardTitle>
            <CardDescription>
              Digite suas credenciais para continuar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="E-mail corporativo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-background/50 border-border/50 focus:border-primary transition-all pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 gradient-primary hover:opacity-90 text-white font-medium transition-all hover-lift"
                disabled={isLoading}
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Não tem acesso?{' '}
                <Link to="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  Solicitar cadastro
                </Link>
              </p>
            </div>

            {/* Informação sobre acesso autorizado */}
            <div className="mt-4 p-3 rounded-lg bg-accent/30 border border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                <strong>Acesso Restrito:</strong> Apenas e-mails autorizados podem acessar o sistema. 
                Contate o administrador para solicitar acesso.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Acesso seguro • Dados protegidos
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
