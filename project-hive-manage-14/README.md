# Project Hive - Gestor de Projetos

Um sistema moderno de gerenciamento de projetos com interface intuitiva e recursos avançados.

## 🚀 Funcionalidades

- 📊 Dashboard personalizado para cada usuário
- 📝 Gerenciamento de projetos e tarefas
- 👥 Gestão de equipes e membros
- 📅 Calendário integrado
- 📈 Analytics e relatórios
- 🔄 Atualizações em tempo real
- 🔒 Sistema de permissões
- 💾 Backup automático

## 🛠️ Tecnologias

- React 18
- TypeScript
- Vite
- Supabase
- Tailwind CSS
- Shadcn/ui
- React Router
- React Query
- React Hook Form
- Zod

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no Supabase

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/project-hive.git
cd project-hive
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```
Edite o arquivo `.env` com suas credenciais do Supabase.

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## 🚀 Deploy

1. Construa o projeto:
```bash
npm run build
```

2. O diretório `dist` conterá os arquivos otimizados para produção.

3. Faça deploy em seu servidor preferido (Vercel, Netlify, etc).

## 📦 Estrutura do Projeto

```
src/
  ├── components/     # Componentes React
  ├── contexts/      # Contextos React
  ├── hooks/         # Hooks personalizados
  ├── integrations/  # Integrações (Supabase, etc)
  ├── lib/          # Utilitários e configurações
  ├── pages/        # Páginas da aplicação
  └── types/        # Definições de tipos TypeScript
```

## 🔒 Segurança

- Autenticação via Supabase
- Políticas de segurança em nível de linha (RLS)
- CSP configurada
- Proteção contra XSS e CSRF

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📧 Suporte

Para suporte, envie um email para seu-email@exemplo.com ou abra uma issue no GitHub.

# Gestor de Projetos IMI

Sistema de gestão de projetos desenvolvido para o IMI.

## Configuração do Ambiente

1. Clone o repositório
2. Instale as dependências com `npm install`
3. Execute o projeto com `npm run dev`

## Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento
- `npm run build`: Compila o projeto para produção
- `npm run lint`: Executa o linter
- `npm run preview`: Visualiza a build de produção localmente
- `npm run format`: Formata os arquivos com Prettier
- `npm run type-check`: Verifica os tipos TypeScript
