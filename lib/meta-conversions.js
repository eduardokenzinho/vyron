const META_PIXEL_ID = '1468752251841323';
const META_GRAPH_API_VERSION = 'v23.0';

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== 'string') return undefined;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? cookie.slice(name.length + 1) : undefined;
}

function getEventSourceUrl(req) {
  const referer = req.headers.referer;
  try {
    const url = new URL(
      typeof referer === 'string' ? referer : 'https://vyron-beta.vercel.app/'
    );
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : 'https://vyron-beta.vercel.app/';
  } catch {
    return 'https://vyron-beta.vercel.app/';
  }
}

async function sendMetaPurchase(req, payment, paymentCode) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('Configure META_ACCESS_TOKEN para habilitar a API de Conversões.');
  }

  const amount = Number(payment.payment_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('A Mangofy retornou um valor inválido para a compra aprovada.');
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp =
    (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : '') ||
    req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const fbp = getCookie(req, '_fbp');
  const fbc = getCookie(req, '_fbc');
  const userData = {
    ...(clientIp ? { client_ip_address: clientIp } : {}),
    ...(typeof userAgent === 'string' ? { client_user_agent: userAgent } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [
            {
              event_name: 'Purchase',
              event_time: Math.floor(Date.now() / 1000),
              event_id: `vyron_${paymentCode}`,
              action_source: 'website',
              event_source_url: getEventSourceUrl(req),
              user_data: userData,
              custom_data: {
                currency: 'BRL',
                value: amount / 100,
                order_id: paymentCode,
              },
            },
          ],
        }),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('A API de Conversões da Meta excedeu o tempo limite.');
    }
    throw new Error('Não foi possível conectar à API de Conversões da Meta.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `A API de Conversões da Meta recusou o evento (HTTP ${response.status}).`
    );
  }
}

module.exports = { sendMetaPurchase };
