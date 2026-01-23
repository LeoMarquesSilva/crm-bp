# Manual Interativo CRM - Bismarchi | Pires

Aplicação web moderna e intuitiva para orientar o preenchimento correto do CRM do escritório, com foco em usabilidade e clareza para os usuários.

## 🚀 Tecnologias

- **React 18+** com **Vite** - Framework e build tool
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **Lucide React** - Ícones modernos
- **Framer Motion** - Animações suaves
- **Zustand** - Gerenciamento de estado
- **React Router DOM** - Roteamento (preparado para futuras expansões)

## 📋 Funcionalidades

### Funis Disponíveis

1. **Funil de Vendas** (11 etapas)
   - Levantamento de Dados (DUE)
   - Compilação (MKT/COM.)
   - Revisão (QUALITY)
   - Due Diligence Finalizada (ESPERA)
   - Reunião (DECISÃO)
   - Confecção de Proposta (ESCOPO)
   - Proposta Enviada (AGUARDA)
   - Confecção de Contrato (JURÍDICO)
   - Contrato Elaborado (PRONTO)
   - Contrato Enviado (PEND. ASSIN.)
   - Contrato Assinado (FECHADO)

2. **Funil de Pós-Venda / Onboarding** (5 etapas)
   - Aguardando Cadastro (INÍCIO)
   - Cadastro de Novo Cliente (FORM)
   - Inclusão no Fluxo de Faturamento (FIN)
   - Boas-vindas (RECEP.)
   - Reunião Kick-off (ALINH.)

### Recursos Principais

- ✅ **Navegação entre etapas** - Cards clicáveis com visualização de detalhes
- 🔍 **Busca inteligente** - Busca em tempo real com highlight de resultados
- 🌓 **Tema claro/escuro** - Alternância com persistência no localStorage
- 📊 **Barra de progresso** - Visualização do progresso no funil
- 📱 **Design responsivo** - Adaptação para mobile, tablet e desktop
- ♿ **Acessibilidade** - ARIA labels e navegação por teclado
- 🎨 **Interface moderna** - Design system consistente e profissional

## 🛠️ Instalação

### Pré-requisitos

- Node.js 18+ e npm/yarn/pnpm

### Passos

1. Clone o repositório ou navegue até a pasta do projeto:
```bash
cd crm-bp
```

2. Instale as dependências:
```bash
npm install
# ou
yarn install
# ou
pnpm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

4. Acesse a aplicação em `http://localhost:5173`

## 📦 Build para Produção

```bash
npm run build
# ou
yarn build
# ou
pnpm build
```

Os arquivos otimizados estarão na pasta `dist/`.

Para visualizar o build:
```bash
npm run preview
```

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx          # Barra lateral com navegação
│   ├── funnel/
│   │   ├── StepCard.tsx          # Card de etapa do funil
│   │   ├── StepDetail.tsx        # Painel de detalhes da etapa
│   │   └── ProgressBar.tsx       # Barra de progresso
│   ├── search/
│   │   └── SearchBar.tsx         # Barra de busca
│   ├── ui/
│   │   ├── Badge.tsx             # Componente de badge
│   │   ├── Alert.tsx              # Componente de alerta
│   │   ├── Tooltip.tsx           # Tooltip informativo
│   │   └── ThemeToggle.tsx       # Toggle de tema
│   ├── SalesFunnel.tsx           # Componente do funil de vendas
│   └── PostFunnel.tsx            # Componente do funil de pós-venda
├── contexts/
│   └── ThemeContext.tsx          # Contexto de tema
├── data/
│   ├── salesFunnel.ts            # Dados do funil de vendas
│   └── postFunnel.ts             # Dados do funil de pós-venda
├── stores/
│   └── appStore.ts               # Store Zustand (estado global)
├── types/
│   └── index.ts                  # Tipos TypeScript
├── lib/
│   └── utils.ts                  # Utilitários (cn, etc.)
├── App.tsx                       # Componente principal
├── main.tsx                      # Ponto de entrada
└── index.css                     # Estilos globais
```

## 🎨 Design System

### Cores

- **Primária**: `#14324f` (Azul escuro)
- **Vendas**: `#d5b170` (Dourado)
- **Pós-Venda**: `#2d936c` (Verde)
- **Fundo claro**: `#f9fafb`
- **Fundo escuro**: `#0a0a0a`

### Tipografia

- **Fonte**: Inter (Google Fonts)
- **Tamanhos**: Sistema baseado em 4px

### Espaçamentos

- Sistema de 4px (4, 8, 12, 16, 20, 24, 32, etc.)

## 📝 Regras Globais

### Formatação

- **Razão Social**: SEMPRE EM CAIXA ALTA
- **Datas**: DD/MM/AAAA
- **Horários**: Formato 24h (ex: 14:30)
- **Listas**: Separar com ponto e vírgula (;)
- **Campos vazios**: Preencher com "N/A"
- **Links**: Apenas diretórios oficiais (Sharepoint / VIOS)
- **Telefone**: (DD) 9XXXX-XXXX
- **RATEIO**: Usar 0 se não aplicável

### Alertas Críticos

⚠️ **Não pular etapas** — cada avanço abre campos obrigatórios e automações  
⚠️ **STATUS automáticos** (Cadastro / Financeiro) não devem ser alterados manualmente  
⚠️ **Financeiro só após** STATUS [CADASTRO] = CONCLUÍDO

## 🔧 Configuração

### Variáveis de Ambiente

Atualmente não há variáveis de ambiente necessárias. Para futuras expansões, crie um arquivo `.env`:

```env
VITE_API_URL=https://api.example.com
```

### Personalização

Para personalizar cores, edite `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: { /* suas cores */ },
      sales: { /* suas cores */ },
      post: { /* suas cores */ },
    },
  },
}
```

## 🧪 Desenvolvimento

### Linting

```bash
npm run lint
```

### Formatação

Recomenda-se usar Prettier (não incluído por padrão):

```bash
npm install -D prettier
```

## 📄 Licença

Este projeto é de uso interno do escritório Bismarchi | Pires.

## 👥 Contribuindo

Para contribuir com melhorias:

1. Crie uma branch para sua feature
2. Faça suas alterações
3. Teste localmente
4. Submeta um pull request

## 🐛 Problemas Conhecidos

- Nenhum no momento

## 📞 Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ para Bismarchi | Pires**
