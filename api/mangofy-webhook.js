module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, status: 'webhook-ready' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = req.body || {};
    console.log('Mangofy webhook recebido:', JSON.stringify(body).slice(0, 2000));
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro no webhook da Mangofy:', error);
    return res.status(500).json({ error: 'Falha ao processar webhook.' });
  }
};
