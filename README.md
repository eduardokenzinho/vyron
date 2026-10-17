# VYRON

Loja Vyron de streetwear com catálogo atual de mochilas, checkout Pix e consulta de CEP.

## Publicar na Vercel

1. Importe `eduardokenzinho/vyron` na Vercel e mantenha a raiz do projeto como diretório de implantação.
2. Em **Settings → Environment Variables**, configure:
   - `MANGOFY_API_KEY`
   - `MANGOFY_STORE_CODE`
   - `MANGOFY_PAYMENT_URL` com `https://checkout.mangofy.com.br/api/v1/payment` (ou `https://app.mangofy.com.br/api/v1/payment`, conforme a sua conta)
   - `MANGOFY_POSTBACK_URL` com `https://vyron-beta.vercel.app/api/mangofy-webhook`
   - `META_ACCESS_TOKEN` com o token de acesso da API de Conversões da Meta
3. Habilite as variáveis no ambiente de produção e faça um novo deploy.
4. Teste o checkout com as credenciais válidas da loja. Não use valores de exemplo para gerar cobranças.

O Pixel da Meta está instalado na página e registra visualizações, adições ao carrinho e início do checkout. A compra é enviada pela API de Conversões quando a Mangofy confirma o pagamento. O evento Purchase usa um identificador estável para evitar duplicatas em tentativas repetidas.

Adicione o token da Meta e as credenciais da Mangofy diretamente às configurações da Vercel e faça um novo deploy. Não coloque tokens ou outras credenciais neste repositório.
