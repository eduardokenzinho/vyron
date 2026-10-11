# VYRON

Loja de mochilas com checkout Pix e consulta de CEP.

## Publicar na Vercel

1. Importe `eduardokenzinho/vyron` na Vercel e mantenha a raiz do projeto como diretório de implantação.
2. Em **Settings → Environment Variables**, configure:
   - `MANGOFY_API_KEY`
   - `MANGOFY_STORE_CODE`
   - `MANGOFY_PAYMENT_URL` com `https://checkout.mangofy.com.br/api/v1/payment` (ou `https://app.mangofy.com.br/api/v1/payment`, conforme a sua conta)
   - `MANGOFY_POSTBACK_URL` com `https://vyron-beta.vercel.app/api/mangofy-webhook`
3. Habilite as variáveis no ambiente de produção e faça um novo deploy.
4. Teste o checkout com as credenciais válidas da loja. Não use valores de exemplo para gerar cobranças.

As credenciais devem ser adicionadas diretamente às configurações da Vercel. Não as coloque neste repositório.
