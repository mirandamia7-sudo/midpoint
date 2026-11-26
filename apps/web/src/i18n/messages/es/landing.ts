/* The public home page. */
const landing = {
  metaTitle: '{brand}: pagos internacionales entre personas',
  metaDescription:
    'Envía dinero a personas de otros países y paga en la moneda de cada lugar, por transferencia bancaria o con QR. Cada pago lo completa un comerciante local y el dinero queda en un contrato hasta que se confirma.',
  hero: {
    title: 'Pagos internacionales entre personas',
    body: 'Envía dinero a alguien en otro país, paga con QR donde estés o cambia a tu moneda con una transferencia bancaria. Cada pago lo completa un comerciante local, y el dinero queda en un contrato hasta que se confirma.',
    open: 'Crear cuenta',
    merchant: 'Soy comerciante',
    rails:
      'Transferencia bancaria en Bolivia, Perú, Argentina, Chile y Colombia, PIX en Brasil y SPEI en México.',
  },
  slip: {
    caption: 'Así se ve una orden: el monto exacto, la cuenta y el tiempo que te queda.',
    order: 'Orden de compra',
    transfer: 'Transfiere exactamente',
    to: 'A esta cuenta',
    holder: 'Titular',
    account: 'Cuenta',
    receive: 'Recibes',
    left: 'Tiempo para pagar',
    locked: 'Bloqueado en el contrato hasta que el comerciante confirma',
    button: 'Ya transferí',
  },
  how: {
    title: 'Cómo funciona una compra',
    lede: 'Sin libro de anuncios ni regateo: escribes un monto y el mercado elige al comerciante.',
    steps: [
      {
        title: 'Escribe el monto',
        body: 'En tu moneda. El mercado elige un comerciante con precio y historial, y te muestra cuánto recibes, con la comisión incluida.',
      },
      {
        title: 'Transfiere el monto exacto',
        body: 'Desde una cuenta a tu nombre, a la cuenta del comerciante que te mostramos, antes de que termine el tiempo. Después tocas «Ya transferí».',
      },
      {
        title: 'Recibe los USDC',
        body: 'El comerciante ve tu transferencia y libera la orden. El contrato envía los USDC a tu wallet de Stellar, sin comisión de red para ti.',
      },
    ],
    sell: 'Vender es lo mismo al revés: bloqueas tus USDC en la orden, el comerciante te transfiere a tu cuenta y tú liberas los USDC cuando ves el dinero.',
  },
  app: {
    title: 'La app',
    body: 'Se instala en el teléfono desde el navegador. Tu saldo está en dólares digitales (USDC) y las comisiones de red las paga {brand}.',
    points: [
      {
        title: 'Envía y recibe',
        body: 'A un @usuario, a una dirección de Stellar o con un enlace. Llega en segundos.',
      },
      {
        title: 'Paga con QR',
        body: 'Escanea el QR de un comercio en Perú, Brasil o Argentina: un comerciante del mercado lo paga por ti en la moneda de ese país.',
      },
      {
        title: 'Carga y retira',
        body: 'Compra USDC con una transferencia desde tu banco y véndelos cuando necesites moneda local.',
      },
      {
        title: 'Paga cobros',
        body: 'Paga el enlace de cobro de un negocio con tu saldo, sin transferencia.',
      },
    ],
    cta: 'Abrir la app',
  },
  trust: {
    title: 'Cómo se protege cada pago',
    items: [
      {
        title: 'Bloqueados en un contrato',
        body: 'Cada orden bloquea los USDC en un contrato inteligente público. {brand} no tiene ninguna clave que pueda moverlos a otro lado.',
      },
      {
        title: 'Los plazos devuelven',
        body: 'Si el pago no llega a tiempo, la orden vence y los USDC vuelven a quien los vendió. Nada queda trabado.',
      },
      {
        title: 'Disputas con límite',
        body: 'Si algo sale mal, un revisor decide. Solo puede repartir la orden entre su comprador y su vendedor, nunca enviarla a un tercero.',
      },
      {
        title: 'Comerciantes con historial',
        body: 'Cada precio muestra cuántas órdenes completó el comerciante y qué tan rápido libera.',
      },
    ],
  },
  merchants: {
    title: 'Para comerciantes',
    body: 'Pon tu liquidez a trabajar sin entregarla. Tus USDC quedan en el contrato del mercado a tu nombre y puedes retirarlos cuando quieras.',
    points: [
      'Autorizas al mercado a abrir órdenes sobre tu saldo, con un límite por orden que eliges tú.',
      'Publicas precios por moneda y medio de pago, a mano o con un bot por API.',
      'Tu bot reenvía los avisos de transferencia de tu banco y recibe la liberación lista para firmar.',
      'Webhooks firmados para cada cambio de estado de tus órdenes.',
    ],
    cta: 'Abrir el panel',
  },
  business: {
    title: 'Para empresas y desarrolladores',
    body: 'Cobra en moneda local y recibe USDC, paga a cientos de personas desde un archivo, o integra compra y venta en tu propia app.',
    points: [
      {
        title: 'Cobros',
        body: 'Un enlace y un código QR por cobro. Quien paga transfiere desde su banco; tú recibes USDC.',
      },
      {
        title: 'Pagos a terceros',
        body: 'Sube un CSV: cada fila se valida antes de enviarse y cada pago se sigue por separado.',
      },
      {
        title: 'API pública',
        body: 'Claves de prueba y de producción con permisos, y webhooks firmados con HMAC.',
      },
    ],
    codeLabel: 'Crear un cobro con la API',
    cta: 'Leer la documentación',
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: [
      {
        q: '¿{brand} guarda mis fondos?',
        a: 'No. Los USDC están en tu wallet o bloqueados en el contrato de cada orden. {brand} no tiene ninguna clave que pueda moverlos a otro destino.',
      },
      {
        q: '¿Necesito crear una cuenta?',
        a: 'Sí. Te registras con tu email o tu cuenta de Google, sin contraseña. Si ya tienes una wallet de Stellar, puedes usarla en el panel.',
      },
      {
        q: '¿En qué red funciona?',
        a: 'En Stellar. Las comisiones de red las paga {brand}: no necesitas tener XLM.',
      },
      {
        q: '¿Qué pasa si transfiero y el comerciante no libera?',
        a: 'Reportas un problema desde la orden. Los USDC siguen bloqueados y un revisor decide con los comprobantes, entre tú y el comerciante.',
      },
      {
        q: '¿Qué pasa si no llego a transferir a tiempo?',
        a: 'La orden vence y no se cobra nada. Si ya transferiste, no canceles: reporta un problema.',
      },
      {
        q: '¿Cuánto cuesta?',
        a: 'El precio de cada comerciante y la comisión del mercado se muestran antes de abrir la orden. Recibes exactamente lo que dice la cotización.',
      },
      {
        q: '¿Por qué tiene que ser una cuenta a mi nombre?',
        a: 'El comerciante comprueba que la transferencia venga de la persona que abrió la orden. Así se evitan pagos con cuentas de terceros.',
      },
    ],
  },
  closing: {
    title: 'Crea tu cuenta',
    body: 'Con tu email o tu cuenta de Google. Ves el precio de cada pago antes de confirmarlo.',
  },
};

export default landing;
