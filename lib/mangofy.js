const PAYMENT_URL =
  process.env.MANGOFY_PAYMENT_URL ||
  'https://checkout.mangofy.com.br/api/v1/payment';

function getConfig() {
  const apiKey = process.env.MANGOFY_API_KEY;
  const storeCode = process.env.MANGOFY_STORE_CODE;

  if (!apiKey || !storeCode) {
    throw new Error('Configure MANGOFY_API_KEY e MANGOFY_STORE_CODE na Vercel.');
  }

  let paymentUrl;
  try {
    paymentUrl = new URL(PAYMENT_URL);
  } catch {
    throw new Error('MANGOFY_PAYMENT_URL não é uma URL válida.');
  }

  const allowedHosts = new Set(['app.mangofy.com.br', 'checkout.mangofy.com.br']);
  const allowedPaths = new Set([
    '/api/v1/payment',
    '/api/v1/payment/pix',
  ]);

  if (
    paymentUrl.protocol !== 'https:' ||
    !allowedHosts.has(paymentUrl.hostname) ||
    !allowedPaths.has(paymentUrl.pathname) ||
    paymentUrl.search ||
    paymentUrl.hash
  ) {
    throw new Error(
      'MANGOFY_PAYMENT_URL deve apontar para https://checkout.mangofy.com.br/api/v1/payment ou https://app.mangofy.com.br/api/v1/payment.'
    );
  }

  return { apiKey, storeCode, paymentUrl };
}

async function requestMangofy(url, method, body) {
  const { apiKey, storeCode } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: apiKey,
        'Store-Code': storeCode,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('A Mangofy demorou para responder. Tente novamente.');
    }
    throw new Error('Não foi possível conectar à API da Mangofy.');
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('A API da Mangofy retornou uma resposta inválida.');
  }

  if (!response.ok) {
    const message =
      typeof data.message === 'string'
        ? data.message
        : `A Mangofy recusou a solicitação (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return data;
}

module.exports = { getConfig, requestMangofy };
