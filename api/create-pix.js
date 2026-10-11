const { getConfig, requestMangofy } = require('../lib/mangofy');

const products = [
  { code: 'vyron-forest', name: 'VYRON Forest', price: 6500 },
  { code: 'vyron-desert', name: 'VYRON Desert', price: 6990 },
  { code: 'vyron-midnight', name: 'VYRON Midnight', price: 7490 },
];

function isValidCpf(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;

  const digits = value.split('').map(Number);
  for (let length = 9; length <= 10; length += 1) {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const checkDigit = ((sum * 10) % 11) % 10;
    if (digits[length] !== checkDigit) return false;
  }

  return true;
}

function isValidCnpj(value) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;

  const digitFor = (digits, weights) => {
    const remainder =
      digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) %
      11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const digits = value.split('').map(Number);
  const first = digitFor(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitFor(
    digits.slice(0, 12).concat(first),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return digits[12] === first && digits[13] === second;
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function normalizePixImage(image) {
  if (typeof image !== 'string') return null;

  const compact = image.trim().replace(/\s/g, '');
  const dataUri = compact.match(
    /^(?:data:image\/(png|jpeg|webp);base64,)?([a-z0-9+/]+={0,2})$/i
  );
  if (!dataUri || dataUri[2].length % 4 !== 0) return null;

  const mimeType = (dataUri[1] || 'png').toLowerCase();
  return `data:image/${mimeType};base64,${dataUri[2]}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Método não permitido.');
  }

  const body = req.body;
  const customer = body && body.customer;
  const cartItems = body && body.items;

  if (!customer || !Array.isArray(cartItems) || cartItems.length === 0) {
    return sendError(res, 400, 'Informe os produtos e os dados do comprador.');
  }

  const name = typeof customer.name === 'string' ? customer.name.trim() : '';
  const email = typeof customer.email === 'string' ? customer.email.trim() : '';
  const document = String(customer.document || '').replace(/\D/g, '');
  const phoneDigits = String(customer.phone || '').replace(/\D/g, '');
  const zipCode = String(customer.zip_code || '').replace(/\D/g, '');
  const street = typeof customer.street === 'string' ? customer.street.trim() : '';
  const streetNumber =
    typeof customer.street_number === 'string'
      ? customer.street_number.trim()
      : '';
  const complement =
    typeof customer.complement === 'string' ? customer.complement.trim() : '';
  const neighborhood =
    typeof customer.neighborhood === 'string'
      ? customer.neighborhood.trim()
      : '';
  const city = typeof customer.city === 'string' ? customer.city.trim() : '';
  const state =
    typeof customer.state === 'string' ? customer.state.trim().toUpperCase() : '';

  if (name.length < 2 || name.length > 254) {
    return sendError(res, 400, 'Informe o nome completo do comprador.');
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return sendError(res, 400, 'Informe um e-mail válido.');
  }
  if (!isValidCpf(document) && !isValidCnpj(document)) {
    return sendError(res, 400, 'Informe um CPF ou CNPJ válido.');
  }
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return sendError(res, 400, 'Informe um telefone válido com DDD.');
  }

  const phone = phoneDigits.startsWith('55')
    ? phoneDigits
    : `55${phoneDigits}`;
  if (phone.length > 20) {
    return sendError(res, 400, 'O telefone informado é muito longo.');
  }
  if (!/^\d{8}$/.test(zipCode)) {
    return sendError(res, 400, 'Informe um CEP válido com 8 dígitos.');
  }
  if (!street || street.length > 254) {
    return sendError(res, 400, 'Informe o endereço de entrega.');
  }
  if (!streetNumber || streetNumber.length > 254) {
    return sendError(res, 400, 'Informe o número do endereço.');
  }
  if (!neighborhood || neighborhood.length > 254) {
    return sendError(res, 400, 'Informe o bairro.');
  }
  if (!city || city.length > 254) {
    return sendError(res, 400, 'Informe a cidade.');
  }
  if (!/^[A-Z]{2}$/.test(state)) {
    return sendError(res, 400, 'Informe um estado brasileiro válido.');
  }
  if (complement.length > 254) {
    return sendError(res, 400, 'O complemento do endereço é muito longo.');
  }

  const quantities = new Map();
  for (const item of cartItems) {
    if (
      !item ||
      !Number.isInteger(item.productId) ||
      item.productId < 0 ||
      item.productId >= products.length ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 100 ||
      quantities.has(item.productId)
    ) {
      return sendError(res, 400, 'Os produtos do carrinho são inválidos.');
    }
    quantities.set(item.productId, item.quantity);
  }

  const items = [...quantities.entries()].map(([productId, quantity]) => {
    const product = products[productId];
    return {
      code: product.code,
      name: product.name,
      quantity,
      price: product.price,
    };
  });
  const paymentAmount = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  if (paymentAmount < 500 || paymentAmount > 200000) {
    return sendError(
      res,
      400,
      'O valor do pedido deve ficar entre R$ 5,00 e R$ 2.000,00.'
    );
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : '') ||
    req.socket.remoteAddress;
  if (!ip || ip.length > 100) {
    return sendError(res, 400, 'Não foi possível identificar a conexão.');
  }

  let paymentUrl;
  try {
    ({ paymentUrl } = getConfig());
  } catch (error) {
    return sendError(res, 500, error.message);
  }

  try {
    const payment = await requestMangofy(
      paymentUrl,
      'POST',
      {
        external_code: `vyron-${require('crypto').randomUUID()}`,
        payment_method: 'pix',
        payment_format: 'regular',
        installments: 1,
        payment_amount: paymentAmount,
        shipping_amount: 0,
        items,
        customer: {
          email,
          name,
          document,
          phone,
          ip,
          street,
          street_number: streetNumber,
          complement: complement || null,
          neighborhood,
          city,
          state,
          zip_code: zipCode,
          country: 'Brasil',
        },
        shipping: {
          street,
          street_number: streetNumber,
          complement: complement || null,
          neighborhood,
          city,
          state,
          zip_code: zipCode,
          country: 'Brasil',
        },
        pix: { expires_in_days: 1 },
      }
    );

    if (
      typeof payment.payment_code !== 'string' ||
      !payment.pix ||
      typeof payment.pix.pix_qrcode_text !== 'string'
    ) {
      return sendError(
        res,
        502,
        'A Mangofy não retornou os dados do Pix. Tente novamente.'
      );
    }

    const pixImage = normalizePixImage(payment.pix.pix_qrcode_image);

    return res.status(200).json({
      paymentCode: payment.payment_code,
      paymentStatus: payment.payment_status,
      amount: payment.payment_amount,
      pix: {
        text: payment.pix.pix_qrcode_text,
        image: pixImage,
        expiresAt: payment.pix.pix_expires_at || payment.expires_at || null,
      },
    });
  } catch (error) {
    return sendError(res, 502, error.message);
  }
};
