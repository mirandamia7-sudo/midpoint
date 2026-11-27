/* The hosted charge page (/c/{id}), Brazilian Portuguese: mirrors es/charge.ts key for key. */
import type es from '@/i18n/messages/es/charge';

const charge: typeof es = {
  metaTitle: 'Solicitação de pagamento | {brand}',
  metaDescription: 'Pague esta solicitação com uma transferência bancária.',
  eyebrow: 'Solicitação de pagamento',
  toPay: 'A pagar',
  payee: 'Pagamento para {payee}',
  settles: 'A transferência vai para {merchant}, o comerciante que liquida este pagamento.',
  loadError: 'Não conseguimos carregar esta solicitação de pagamento.',
  notFound: 'Esta solicitação de pagamento não existe. Confira o link que enviaram para você.',
  expiresAt: 'Expira em {date}',
  payer: {
    title: 'Quem paga',
    body: 'O comerciante verifica se a transferência vem desta pessoa. Use uma conta no seu nome.',
    name: 'Nome completo',
    document: 'Número do documento',
    email: 'E-mail',
    emailHint: 'Seu comprovante chega aqui.',
    method: 'Método de pagamento',
    submit: 'Continuar',
    submitting: 'Preparando seu pagamento…',
    failed: 'Não conseguimos preparar o pagamento. Tente de novo.',
    busy: 'Alguém está pagando esta solicitação agora. Tente de novo em alguns minutos.',
    noRails:
      'Nenhum comerciante pode aceitar este pagamento agora. Tente de novo em alguns minutos.',
  },
  transfer: {
    title: 'Transfira exatamente',
    body: 'De uma conta no seu nome, para esta conta:',
    timeLeft: 'Você tem {time} para pagar',
    timeBar: 'Tempo restante para pagar',
    amount: 'Valor a transferir',
    reference: 'Referência da transferência',
    referenceHint: 'Opcional. Ajuda o comerciante a encontrar sua transferência.',
    done: 'Já transferi',
    sending: 'Enviando…',
    failed: 'Não conseguimos avisar o comerciante. Tente de novo.',
    cancel: 'Cancelar este pagamento',
    cancelTitle: 'Cancelar este pagamento?',
    cancelBody: 'Faça isso só se você não transferiu dinheiro.',
    cancelFailed: 'Não conseguimos cancelar o pagamento. Tente de novo.',
  },
  status: {
    preparing: 'Preparando seu pagamento…',
    paid: 'Transferência informada',
    paidBody:
      'O comerciante confere sua transferência. Esta página é atualizada quando ele confirmar.',
    completed: 'Pago',
    completedBody: 'O comerciante confirmou sua transferência. Você já pode fechar esta página.',
    expired: 'Expirado',
    expiredBody: 'O tempo para pagar acabou. Se você não transferiu, comece de novo.',
    cancelled: 'Cancelado',
    cancelledBody: 'Este pagamento foi cancelado. Se você não transferiu, comece de novo.',
    disputed: 'Em análise',
    disputedBody: 'Um revisor analisa este pagamento e avisa o comerciante.',
    failed: 'Não foi possível abrir',
    failedBody: 'Nada foi movimentado. Comece de novo.',
    requestPaid: 'Esta solicitação já está paga.',
    requestExpired: 'Esta solicitação de pagamento expirou.',
    requestCancelled: 'Esta solicitação de pagamento foi cancelada.',
  },
  startAgain: 'Começar de novo',
  poweredBy:
    'Pagamento protegido por {brand}: o dinheiro chega ao comerciante e o comerciante libera o pagamento em um contrato inteligente da rede Stellar.',
  app: {
    title: 'Tem dólares no {brand}?',
    body: 'Pague com seu saldo pelo app, sem transferência bancária.',
    cta: 'Pagar com meu saldo',
  },
};

export default charge;
