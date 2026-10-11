const { getConfig, requestMangofy } = require('../lib/mangofy');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const paymentCode = req.query && req.query.paymentCode;
  if (
    typeof paymentCode !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(paymentCode)
  ) {
    return res.status(400).json({ error: 'Código de pagamento inválido.' });
  }

  let paymentUrl;
  try {
    ({ paymentUrl } = getConfig());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  try {
    const url = new URL(paymentUrl);
    url.pathname = `/api/v1/payment/${encodeURIComponent(paymentCode)}`;
    const payment = await requestMangofy(url, 'GET');

    if (typeof payment.payment_status !== 'string') {
      return res
        .status(502)
        .json({ error: 'A Mangofy não retornou o status do pagamento.' });
    }

    return res.status(200).json({ status: payment.payment_status });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
};
