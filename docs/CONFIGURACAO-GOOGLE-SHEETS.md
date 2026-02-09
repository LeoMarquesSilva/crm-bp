# Configuração – Google Sheets (validação dentro do sistema)

Para usar **Validar planilha (Sheets)** dentro do CRM, é preciso configurar o **Client ID** e o **Client Secret** do Google OAuth. O Client Secret é usado apenas no backend para trocar o código de autorização por tokens e obter o refresh_token, que mantém a autenticação renovada indefinidamente.

---

## 0. Corrigir “Error 400: redirect_uri_mismatch”

Se ao clicar em **Conectar com Google** aparecer *“Access blocked”* ou *“Error 400: redirect_uri_mismatch”*, é porque a URL de retorno do login não está cadastrada no seu cliente OAuth.

**Na própria página “Validar planilha (Sheets)”** o sistema mostra, em destaque, as URLs exatas do seu navegador. Use **exatamente** essas mesmas URLs no Google Cloud Console:

1. Abra a página **Validar planilha (Sheets)** no app.
2. Na caixa amarela “Cadastre estes endereços no Google Cloud Console”, veja as 3 URLs em **URIs de redirecionamento autorizados** e a URL em **Origens JavaScript autorizadas**.
3. Abra [Google Cloud Console](https://console.cloud.google.com/) → **APIs e serviços** → **Credenciais** → clique no **ID do cliente OAuth** (tipo “Aplicativo da Web”).
4. Em **URIs de redirecionamento autorizados**, clique em **+ ADICIONAR URI** e adicione **uma a uma** as 3 URLs que o app mostrou (copie e cole do próprio navegador).
5. Em **Origens JavaScript autorizadas**, adicione a URL que o app mostrou nessa seção (normalmente é a origem, ex.: `http://localhost:5173`).
6. Clique em **SALVAR** e espere **1–2 minutos**.
7. Tente de novo **Conectar com Google**.

As URLs dependem de onde você abre o app: por exemplo `http://localhost:5173`, `http://127.0.0.1:5173` ou `https://seu-dominio.vercel.app`. O app exibe na tela os valores reais do seu ambiente.

**Se ainda der erro:** na tela do Google às vezes há um link “See error details” ou “Detalhes do erro”, que mostra o valor de `redirect_uri` que foi enviado. Cadastre **exatamente** essa mesma URL em “URIs de redirecionamento autorizados”.

---

## 1. Onde colocar as credenciais

- **Client ID**  
  - Usado no **frontend** para o botão “Conectar com Google”.  
  - Coloque no arquivo **`.env`** na raiz do projeto:
    ```env
    VITE_GOOGLE_CLIENT_ID=25519157162-ma6cnh0imkp7qde0s3nl3btdjh80g2jt.apps.googleusercontent.com
    ```
  - No **Vercel** (ou outro host), configure a mesma variável em **Settings → Environment Variables** para o build e o ambiente de produção.

- **Client Secret**  
  - Obrigatório para o fluxo de autenticação permanente. O backend usa para trocar o código por access_token e refresh_token.  
  - Adicione no **`.env`** ou **`.env.local`** (nunca no frontend nem em repositório):
    ```env
    GOOGLE_CLIENT_SECRET=seu-client-secret
    ```
  - No Vercel, configure `GOOGLE_CLIENT_SECRET` em **Environment Variables** (sem prefixo VITE_).

- **Planilha fixa (opcional)**  
  - A tela de Validação usa uma planilha fixa por ambiente. Defina no **`.env`** ou **`.env.local`**:
    ```env
    VITE_PLANILHA_ID=14tr0jLk8JztNxPOWv6Pr-9bdoCPBJCF5A_QP_bR1agI
    VITE_PLANILHA_ABA=Planilha1
    ```
  - **VITE_PLANILHA_ID** – ID da planilha (o trecho da URL `docs.google.com/spreadsheets/d/[este é o ID]/edit`). Se não definir, é usado um valor padrão no código.
  - **VITE_PLANILHA_ABA** – Nome da aba (ex.: `Planilha1`, `Dados`). Vazio = primeira aba.

---

## 2. Onde pegar o Client ID (e o Secret, se precisar)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie ou escolha um **projeto**.
3. Ative as APIs:
   - **Google Sheets API** (para ler os dados da planilha)
   - **Google Drive API** (para listar as planilhas disponíveis na conta)  
   Em **APIs e serviços → Biblioteca**, procure cada uma e clique em **Ativar**.
4. Crie credenciais OAuth 2.0:  
   **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
5. Tipo de aplicativo: **Aplicativo da Web**.
6. Em **Origens JavaScript autorizadas**, adicione:
   - `http://localhost:5173` (desenvolvimento com Vite)
   - A URL de produção, ex.: `https://seu-dominio.vercel.app`
7. Em **URIs de redirecionamento autorizados** (se o assistente pedir), use, por exemplo:
   - `http://localhost:5173`
   - `https://seu-dominio.vercel.app`
8. Ao terminar, anote o **ID do cliente** (Client ID) e o **Segredo do cliente** (Client Secret).

O **Client ID** é o que você coloca em `VITE_GOOGLE_CLIENT_ID` no `.env` e nas variáveis de ambiente do Vercel.

---

## 3. O que precisa na planilha

- A planilha precisa estar **acessível à conta Google** que o usuário usar ao clicar em “Conectar com Google” (a mesma que aparece depois de “Conectado”).
- O **ID da planilha** fica na URL:  
  `https://docs.google.com/spreadsheets/d/ESTE_E_O_ID/edit`
- A **primeira linha** deve ser o cabeçalho (nomes das colunas). A API mapeia colunas como “E-mail do Solicitante”, “Solicitante”, “Cadastro realizado por (e-mail)”, “Haverá Due Diligence?”, “Local da Reunião”, “Tipo de Lead”, “Razão Social”, “CNPJ/CPF”, “Áreas Envolvidas”, etc., para as regras do [manual de etapas](ETAPAS-DE-VENDAS-REFERENCIA.md).

---

## 4. Resumo rápido

| Onde | O que fazer |
|------|-------------|
| Arquivo `.env` na raiz do projeto | Criar/editar e colocar `VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com` |
| Vercel (produção) | Em **Settings → Environment Variables**, adicionar `VITE_GOOGLE_CLIENT_ID` com o mesmo valor |
| Google Cloud Console | Projeto com Google Sheets API ativada, OAuth “Aplicativo da Web”, origens e redirect URIs com localhost e a URL de produção |

Depois disso, ao acessar **Validar planilha (Sheets)** no sistema e clicar em “Conectar com Google”, o fluxo deve usar o Client ID configurado e permitir ler a planilha para validação.

---

## 5. Testar em desenvolvimento

A validação chama a API em `/api/validar-sheets`. Em desenvolvimento local:

- **`npm run dev`:** sobe o frontend (Vite) e um servidor local em `http://localhost:3001` que atende `/api/validar-sheets`. O Vite faz proxy de `/api` para esse servidor, então “Conectar com Google” e “Validar planilha” funcionam sem `vercel dev`. Depois de `npm install`, use `npm run dev`.
- **`vercel dev`:** alternativa; sobe o frontend e as rotas em `/api` como no deploy.
- **Deploy na Vercel:** frontend e `/api/validar-sheets` ficam no mesmo domínio; o fluxo completo funciona.
