# Guia de Deploy no Render

## 📋 Pré-requisitos

1. Conta no Render (https://render.com)
2. Repositório no GitHub (já configurado: `IMPACTOCDI/IMPACTO-CDI-GESTAO`)
3. Variáveis de ambiente do Supabase configuradas

## 🚀 Passo a Passo

### 1. Acessar o Render Dashboard

1. Acesse https://dashboard.render.com
2. Faça login com sua conta GitHub

### 2. Criar Novo Serviço Web Estático

1. Clique em **"New +"** no canto superior direito
2. Selecione **"Static Site"**

### 3. Conectar Repositório

1. Em **"Connect a repository"**, selecione:
   - **Repository**: `IMPACTOCDI/IMPACTO-CDI-GESTAO`
   - **Branch**: `main`

### 4. Configurar Build

1. **Name**: `gestor-de-projetos-impacto-frontend` (ou outro nome de sua preferência)
2. **Root Directory**: `project-hive-manage-14`
3. **Build Command**: `npm ci && npm run build` ⚠️ **IMPORTANTE**: Use `npm ci` para garantir que devDependencies sejam instaladas
4. **Publish Directory**: `dist`
5. **Start Command**: ⚠️ **NÃO É NECESSÁRIO** para Static Site (deixe em branco)

**Nota**: Se você escolher "Web Service" em vez de "Static Site", use:
- **Start Command**: `npm start`

### 5. Configurar Variáveis de Ambiente

Clique em **"Advanced"** e adicione as seguintes variáveis:

```
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
NODE_ENV=production
```

**⚠️ IMPORTANTE**: Substitua pelos valores reais do seu Supabase!

### 6. Configurar Domínio (Opcional)

1. Em **"Custom Domain"**, você pode adicionar um domínio personalizado
2. Ou use o domínio padrão do Render: `gestor-de-projetos-impacto-frontend.onrender.com`

### 7. Deploy

1. Clique em **"Create Static Site"**
2. O Render começará a fazer o build automaticamente
3. Aguarde o build completar (geralmente 2-5 minutos)

## ✅ Verificações Pós-Deploy

Após o deploy, verifique:

1. ✅ O site está acessível na URL fornecida
2. ✅ A logo aparece corretamente
3. ✅ O login funciona
4. ✅ As requisições ao Supabase estão funcionando

## 🔧 Troubleshooting

### Build falha

- Verifique se todas as dependências estão no `package.json`
- Verifique os logs de build no Render Dashboard

### Variáveis de ambiente não funcionam

- Certifique-se de que as variáveis começam com `VITE_` para serem expostas no build
- Faça um novo deploy após adicionar variáveis

### Erro 404 em rotas

- O arquivo `public/_redirects` já está configurado para redirecionar todas as rotas para `index.html`
- Verifique se o arquivo está sendo incluído no build

### Problemas de CORS

- Verifique as configurações de CORS no Supabase Dashboard
- Adicione a URL do Render nas URLs permitidas

## 📝 Notas Importantes

- O Render faz deploy automático a cada push no branch `main`
- O primeiro deploy pode demorar mais (instalação de dependências)
- Deploys subsequentes são mais rápidos (cache de dependências)

## 🔗 Links Úteis

- Render Dashboard: https://dashboard.render.com
- Documentação Render: https://render.com/docs
- Supabase Dashboard: https://app.supabase.com
