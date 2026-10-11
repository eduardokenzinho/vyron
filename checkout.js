const checkoutStyle = document.createElement('style');
checkoutStyle.textContent = `
  .customer-form { display:grid; gap:12px; margin:18px 0; }
  .customer-form label { display:grid; gap:5px; font-size:13px; font-weight:700; }
  .customer-form input { width:100%; padding:12px; border:1px solid #d5dbd2; border-radius:6px; font:inherit; }
  .customer-form .privacy-consent { display:flex; align-items:flex-start; gap:9px; font-weight:400; line-height:1.5; }
  .customer-form .privacy-consent input { width:auto; margin:3px 0 0; }
  .customer-form .address-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .checkout-error { color:#a11; font-size:13px; line-height:1.5; }
  .pix-code { width:100%; min-height:82px; padding:10px; border:1px solid #d5dbd2; border-radius:6px; resize:vertical; }
  .pix-image { display:block; width:min(240px,100%); margin:18px auto; }
  .payment-status { font-weight:700; }
  .customer-hint { color:#777; font-size:12px; }
  .address-status { min-height:18px; margin:0; color:#777; font-size:12px; }
  @media(max-width:420px) { .customer-form .address-row { grid-template-columns:1fr; } }
`;
document.head.append(checkoutStyle);

document.getElementById('pix-screen').innerHTML =
  '<h2>Pagamento via Pix</h2><p>Preencha seus dados para gerar uma cobrança real.</p>';

const customerForm = document.createElement('form');
customerForm.className = 'customer-form';
customerForm.id = 'customer-form';
customerForm.innerHTML = `
  <label>Nome completo
    <input name="name" autocomplete="name" maxlength="254" required>
  </label>
  <label>E-mail
    <input name="email" type="email" autocomplete="email" maxlength="254" required>
  </label>
  <label>CPF ou CNPJ
    <input name="document" inputmode="numeric" autocomplete="off" maxlength="18" required>
  </label>
  <label>Telefone com DDD
    <input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(11) 99999-9999" required>
  </label>
  <h3>Endereço de entrega</h3>
  <label>CEP
    <input name="zip_code" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" required>
  </label>
  <p class="address-status" id="address-status" role="status" aria-live="polite"></p>
  <label>Rua / avenida
    <input name="street" autocomplete="address-line1" maxlength="254" required>
  </label>
  <div class="address-row">
    <label>Número
      <input name="street_number" autocomplete="address-line2" maxlength="254" required>
    </label>
    <label>Complemento (opcional)
      <input name="complement" autocomplete="address-line3" maxlength="254">
    </label>
  </div>
  <label>Bairro
    <input name="neighborhood" autocomplete="address-level3" maxlength="254" required>
  </label>
  <div class="address-row">
    <label>Cidade
      <input name="city" autocomplete="address-level2" maxlength="254" required>
    </label>
    <label>Estado (UF)
      <input name="state" autocomplete="address-level1" minlength="2" maxlength="2" required>
    </label>
  </div>
  <label class="privacy-consent">
    <input name="privacy_consent" type="checkbox" required>
    <span>Estou ciente de que meus dados serão enviados à Mangofy para gerar o Pix e informar os dados necessários à entrega, e que o CEP será consultado pelo ViaCEP.</span>
  </label>
  <p class="customer-hint">Frete grátis no checkout para todo o Brasil.</p>
  <p class="checkout-error" id="checkout-error" role="alert" hidden></p>
`;
document.querySelector('#cart-screen .checkout').before(customerForm);
document.querySelector('#cart-screen .notice').textContent =
  'Frete grátis para todo o Brasil.';

let paymentStatusTimer;
let currentPaymentCode;

function setCheckoutError(message) {
  const error = document.getElementById('checkout-error');
  error.textContent = message;
  error.hidden = !message;
}

const cepField = customerForm.elements.zip_code;
let lastCepLookup = '';
let pendingCepLookup = '';
let cepLookupId = 0;

async function lookupAddressByCep() {
  const cep = cepField.value.replace(/\D/g, '');
  if (
    !/^\d{8}$/.test(cep) ||
    cep === lastCepLookup ||
    cep === pendingCepLookup
  ) {
    return;
  }

  const lookupId = ++cepLookupId;
  const status = document.getElementById('address-status');
  pendingCepLookup = cep;
  status.textContent = 'Consultando CEP...';

  try {
    const response = await fetch(`/api/address?cep=${encodeURIComponent(cep)}`);
    const result = await response.json();
    if (lookupId !== cepLookupId) return;
    if (!response.ok) throw new Error(result.error || 'Não foi possível localizar o CEP.');

    for (const field of ['street', 'neighborhood', 'city', 'state']) {
      if (result[field]) customerForm.elements[field].value = result[field];
    }
    cepField.value = `${cep.slice(0, 5)}-${cep.slice(5)}`;
    lastCepLookup = cep;
    status.textContent = 'Endereço localizado. Confira e informe o número.';
  } catch (error) {
    if (lookupId !== cepLookupId) return;
    status.textContent = error.message || 'Não foi possível consultar o CEP.';
  } finally {
    if (pendingCepLookup === cep) pendingCepLookup = '';
  }
}

cepField.addEventListener('input', () => {
  const cep = cepField.value.replace(/\D/g, '');
  if (cep !== lastCepLookup) {
    if (lastCepLookup) {
      for (const field of ['street', 'neighborhood', 'city', 'state']) {
        customerForm.elements[field].value = '';
      }
    }
    lastCepLookup = '';
    pendingCepLookup = '';
    cepLookupId += 1;
    document.getElementById('address-status').textContent = '';
  }
  if (cep.length === 8) lookupAddressByCep();
});
cepField.addEventListener('blur', lookupAddressByCep);

function renderPix(payment) {
  const screen = document.getElementById('pix-screen');
  const address = [
    customerForm.elements.street.value.trim(),
    customerForm.elements.street_number.value.trim(),
    customerForm.elements.complement.value.trim(),
    customerForm.elements.neighborhood.value.trim(),
    `${customerForm.elements.city.value.trim()} - ${customerForm.elements.state.value.trim()}`,
    customerForm.elements.zip_code.value.trim(),
  ]
    .filter(Boolean)
    .join(', ');
  screen.innerHTML = `
    <h2>Pagamento via Pix</h2>
    <p>Escaneie o QR Code ou copie o código Pix.</p>
    <div class="pix-amount" id="pix-amount"></div>
    <p><strong>Frete grátis</strong> · <span id="delivery-address"></span></p>
    <div id="pix-image-container"></div>
    <p class="notice" id="pix-image-error" role="status" hidden></p>
    <label for="pix-code">Pix copia e cola</label>
    <textarea class="pix-code" id="pix-code" readonly></textarea>
    <button class="checkout" id="copy-pix" type="button">COPIAR CÓDIGO PIX</button>
    <p class="notice payment-status" id="payment-status" role="status">Aguardando pagamento...</p>
    <p class="notice" id="pix-expiry"></p>
    <button class="back" type="button" id="back-to-cart">← VOLTAR AO CARRINHO</button>
  `;
  document.getElementById('pix-amount').textContent = money(payment.amount / 100);
  document.getElementById('delivery-address').textContent = address;
  document.getElementById('pix-code').value = payment.pix.text;
  if (payment.pix.image && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(payment.pix.image)) {
    const image = document.createElement('img');
    image.className = 'pix-image';
    image.alt = 'QR Code do Pix';
    image.src = payment.pix.image;
    image.addEventListener('error', () => {
      image.remove();
      const error = document.getElementById('pix-image-error');
      error.textContent = 'Não foi possível carregar a imagem do QR Code. Use o Pix copia e cola abaixo.';
      error.hidden = false;
    }, { once: true });
    document.getElementById('pix-image-container').append(image);
  } else {
    const error = document.getElementById('pix-image-error');
    error.textContent = 'A Mangofy não retornou a imagem do QR Code. Use o Pix copia e cola abaixo.';
    error.hidden = false;
  }
  document.getElementById('pix-expiry').textContent = payment.pix.expiresAt
    ? `Válido até ${payment.pix.expiresAt}.`
    : '';
  document.getElementById('copy-pix').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(payment.pix.text);
      document.getElementById('copy-pix').textContent = 'CÓDIGO COPIADO';
    } catch {
      const field = document.getElementById('pix-code');
      field.focus();
      field.select();
      document.getElementById('payment-status').textContent =
        'Selecione e copie o código Pix manualmente.';
    }
  });
  document.getElementById('back-to-cart').addEventListener('click', () => {
    currentPaymentCode = null;
    if (paymentStatusTimer) clearInterval(paymentStatusTimer);
    paymentStatusTimer = null;
    showCart();
  });
  document.getElementById('cart-screen').style.display = 'none';
  screen.classList.add('active');
}

async function checkPaymentStatus() {
  if (!currentPaymentCode) return;

  try {
    const response = await fetch(
      `/api/payment-status?paymentCode=${encodeURIComponent(currentPaymentCode)}`
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível consultar o pagamento.');

    const status = document.getElementById('payment-status');
    if (!status) return;

    if (result.status === 'approved') {
      status.textContent = 'Pagamento confirmado. Obrigado pela compra!';
      clearInterval(paymentStatusTimer);
      paymentStatusTimer = null;
    } else if (['expired', 'canceled', 'refused'].includes(result.status)) {
      status.textContent = 'Este pagamento não está mais pendente. Volte ao carrinho para tentar novamente.';
      clearInterval(paymentStatusTimer);
      paymentStatusTimer = null;
    } else if (result.status !== 'pending' && result.status !== 'in_process') {
      status.textContent = `Status do pagamento: ${result.status}.`;
    }
  } catch {
    const status = document.getElementById('payment-status');
    if (status) status.textContent = 'Não foi possível atualizar o status agora. O código Pix continua disponível.';
  }
}

window.checkout = async function checkout() {
  if (!cart.some(Boolean)) {
    alert('Adicione uma mochila ao carrinho.');
    return;
  }

  if (!customerForm.reportValidity()) return;

  const button = document.querySelector('#cart-screen .checkout');
  const formData = new FormData(customerForm);
  const customer = Object.fromEntries(formData.entries());
  const items = cart
    .map((quantity, productId) => ({ productId, quantity }))
    .filter((item) => item.quantity > 0);

  setCheckoutError('');
  button.disabled = true;
  button.textContent = 'GERANDO PIX...';

  try {
    const response = await fetch('/api/create-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o Pix.');

    currentPaymentCode = result.paymentCode;
    renderPix(result);
    if (paymentStatusTimer) clearInterval(paymentStatusTimer);
    paymentStatusTimer = setInterval(checkPaymentStatus, 5000);
    checkPaymentStatus();
  } catch (error) {
    setCheckoutError(error.message || 'Não foi possível gerar o Pix. Tente novamente.');
  } finally {
    button.disabled = false;
    button.textContent = 'PAGAR COM PIX →';
  }
};

const originalCloseCart = window.closeCart;
window.closeCart = function closeCartWithStatusCleanup() {
  if (paymentStatusTimer) clearInterval(paymentStatusTimer);
  paymentStatusTimer = null;
  originalCloseCart();
};

const originalOpenCart = window.openCart;
window.openCart = function reopenCurrentPayment() {
  if (!currentPaymentCode) {
    originalOpenCart();
    return;
  }

  update();
  document.getElementById('modal').classList.add('open');
  document.getElementById('cart-screen').style.display = 'none';
  document.getElementById('pix-screen').classList.add('active');
  if (!paymentStatusTimer) {
    checkPaymentStatus();
    paymentStatusTimer = setInterval(checkPaymentStatus, 5000);
  }
};
