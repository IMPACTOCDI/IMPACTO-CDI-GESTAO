import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Shield, CheckCircle } from 'lucide-react';
import { UserRole } from '../../contexts/SupabaseAuthContext';
import { logger } from '@/lib/logger';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register } = useAuth();

  const validateForm = () => {
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return false;
    }
    
    if (!email.trim()) {
      setError('E-mail é obrigatório');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('E-mail inválido');
      return false;
    }
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return false;
    }
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      logger.debug('Tentando registrar usuário', { name, email, role, context: 'Register' });
      const result = await register(name.trim(), email.trim(), password, role);
      
      if (result.success) {
        logger.info('Registro bem-sucedido', { email, context: 'Register' });
        setSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmar.');
        // Limpar formulário
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else {
        logger.error('Erro no registro', { error: result.error, context: 'Register' });
        if (result.error?.includes('não autorizado') || result.error?.includes('autorizado')) {
          setError('Este email não está autorizado. Entre em contato com o administrador do sistema.');
        } else {
          setError(result.error || 'Erro no registro. Tente novamente.');
        }
      }
    } catch (error: any) {
      logger.error('Exceção durante o registro', { error, context: 'Register' });
      if (error.message?.includes('não autorizado') || error.message?.includes('autorizado')) {
        setError('Este email não está autorizado. Entre em contato com o administrador do sistema.');
      } else {
        setError(`Erro no registro: ${error.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-muted-foreground mt-2">Sistema de Gestão Profissional</p>
        </div>

        <Card className="glass-effect shadow-2xl border-0 hover-lift">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">Criar Conta</CardTitle>
            <CardDescription>
              Acesso restrito para usuários autorizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="animate-fade-in border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Digite seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Tipo de Conta</Label>
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger className="h-12 bg-background/50 border-border/50 focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Pessoal</SelectItem>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 bg-background/50 border-border/50 focus:border-primary transition-all"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 gradient-primary hover:opacity-90 text-white font-medium transition-all hover-lift"
                disabled={isLoading}
              >
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  Entre aqui
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Acesso restrito • Apenas e-mails autorizados
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
