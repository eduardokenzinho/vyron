module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cep =
    typeof req.query.cep === 'string' ? req.query.cep.replace(/\D/g, '') : '';
  if (!/^\d{8}$/.test(cep)) {
    return res.status(400).json({ error: 'Informe um CEP válido com 8 dígitos.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error.name === 'AbortError'
        ? 'A consulta de CEP demorou para responder.'
        : 'Não foi possível consultar o CEP. Tente novamente.';
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return res.status(502).json({ error: 'O serviço de CEP está indisponível.' });
  }

  let address;
  try {
    address = await response.json();
  } catch {
    return res.status(502).json({ error: 'O serviço de CEP retornou uma resposta inválida.' });
  }

  if (address.erro) {
    return res.status(404).json({ error: 'CEP não encontrado. Confira os números.' });
  }

  return res.status(200).json({
    street: address.logradouro || '',
    neighborhood: address.bairro || '',
    city: address.localidade || '',
    state: address.uf || '',
    zip_code: cep,
    country: 'Brasil',
  });
};
