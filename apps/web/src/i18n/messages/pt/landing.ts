/* The public home page, Brazilian Portuguese: mirrors es/landing.ts key for key. */
import type es from '@/i18n/messages/es/landing';

const landing: typeof es = {
  metaTitle: '{brand}: pagamentos internacionais entre pessoas',
  metaDescription:
    'Envie dinheiro para pessoas de outros países e pague na moeda de cada lugar, por transferência bancária ou com QR. Cada pagamento é concluído por um comerciante local, e o dinheiro fica em um contrato até ser confirmado.',
  hero: {
    title: 'Pagamentos internacionais entre pessoas',
    body: 'Envie dinheiro para alguém em outro país, pague com QR onde você estiver ou troque para a sua moeda com uma transferência bancária. Cada pagamento é concluído por um comerciante local, e o dinheiro fica em um contrato até ser confirmado.',
    open: 'Criar conta',
    merchant: 'Sou comerciante',
    rails:
      'Transferência bancária na Bolívia, no Peru, na Argentina, no Chile e na Colômbia, PIX no Brasil e SPEI no México.',
  },
  slip: {
    caption: 'É assim que uma ordem aparece: o valor exato, a conta e o tempo que você ainda tem.',
    order: 'Ordem de compra',
    transfer: 'Transfira exatamente',
    to: 'Para esta conta',
    holder: 'Titular',
    account: 'Conta',
    receive: 'Você recebe',
    left: 'Tempo para pagar',
    locked: 'Bloqueado no contrato até o comerciante confirmar',
    button: 'Já transferi',
  },
  how: {
    title: 'Como funciona uma compra',
    lede: 'Sem lista de anúncios nem pechincha: você digita um valor e o mercado escolhe o comerciante.',
    steps: [
      {
        title: 'Digite o valor',
        body: 'Na sua moeda. O mercado escolhe um comerciante com preço e histórico, e mostra quanto você recebe, com a taxa incluída.',
      },
      {
        title: 'Transfira o valor exato',
        body: 'De uma conta no seu nome, para a conta do comerciante que mostramos, antes de o tempo acabar. Depois, toque em “Já transferi”.',
      },
      {
        title: 'Receba os USDC',
        body: 'O comerciante vê a sua transferência e libera a ordem. O contrato envia os USDC para a sua carteira Stellar, sem taxa de rede para você.',
      },
    ],
    sell: 'Vender é a mesma coisa ao contrário: você bloqueia seus USDC na ordem, o comerciante transfere para a sua conta e você libera os USDC quando vê o dinheiro.',
  },
  app: {
    title: 'O app',
    body: 'Ele é instalado no celular pelo navegador. Seu saldo fica em dólares digitais (USDC) e as taxas de rede são pagas por {brand}.',
    points: [
      {
        title: 'Envie e receba',
        body: 'Para um @usuário, um endereço Stellar ou com um link. Chega em segundos.',
      },
      {
        title: 'Pague com QR',
        body: 'Escaneie o QR de uma loja no Peru, no Brasil ou na Argentina: um comerciante do mercado paga por você na moeda desse país.',
      },
      {
        title: 'Adicione dinheiro e saque',
        body: 'Compre USDC com uma transferência do seu banco e venda quando precisar de moeda local.',
      },
      {
        title: 'Pague cobranças',
        body: 'Pague o link de cobrança de uma empresa com o seu saldo, sem transferência.',
      },
    ],
    cta: 'Abrir o app',
  },
  trust: {
    title: 'Como cada pagamento é protegido',
    items: [
      {
        title: 'Bloqueados em um contrato',
        body: 'Cada ordem bloqueia os USDC em um contrato inteligente público. {brand} não tem nenhuma chave que possa movê-los para outro lugar.',
      },
      {
        title: 'Os prazos devolvem',
        body: 'Se o pagamento não chegar a tempo, a ordem expira e os USDC voltam para quem os vendeu. Nada fica travado.',
      },
      {
        title: 'Disputas com limite',
        body: 'Se algo der errado, um revisor decide. Ele só pode dividir a ordem entre o comprador e o vendedor dela, nunca enviá-la a um terceiro.',
      },
      {
        title: 'Comerciantes com histórico',
        body: 'Cada preço mostra quantas ordens o comerciante concluiu e com que rapidez ele libera.',
      },
    ],
  },
  merchants: {
    title: 'Para comerciantes',
    body: 'Coloque sua liquidez para trabalhar sem entregá-la. Seus USDC ficam no contrato do mercado, no seu nome, e você pode sacá-los quando quiser.',
    points: [
      'Você autoriza o mercado a abrir ordens sobre o seu saldo, com um limite por ordem que você escolhe.',
      'Você publica preços por moeda e método de pagamento, manualmente ou com um bot via API.',
      'Seu bot encaminha os avisos de transferência do seu banco e recebe a liberação pronta para assinar.',
      'Webhooks assinados para cada mudança de status das suas ordens.',
    ],
    cta: 'Abrir o painel',
  },
  business: {
    title: 'Para empresas e desenvolvedores',
    body: 'Cobre em moeda local e receba USDC, pague centenas de pessoas a partir de um arquivo ou integre compra e venda no seu próprio app.',
    points: [
      {
        title: 'Cobranças',
        body: 'Um link e um código QR por cobrança. Quem paga transfere do próprio banco; você recebe USDC.',
      },
      {
        title: 'Pagamentos a terceiros',
        body: 'Faça upload de um CSV: cada linha é validada antes do envio e cada pagamento é acompanhado separadamente.',
      },
      {
        title: 'API pública',
        body: 'Chaves de teste e de produção com permissões, e webhooks assinados com HMAC.',
      },
    ],
    codeLabel: 'Criar uma cobrança com a API',
    cta: 'Ler a documentação',
  },
  faq: {
    title: 'Perguntas frequentes',
    items: [
      {
        q: '{brand} guarda os meus fundos?',
        a: 'Não. Os USDC ficam na sua carteira ou bloqueados no contrato de cada ordem. {brand} não tem nenhuma chave que possa movê-los para outro destino.',
      },
      {
        q: 'Preciso criar uma conta?',
        a: 'Sim. Você se cadastra com seu e-mail ou sua conta Google, sem senha. Se você já tem uma carteira Stellar, pode usá-la no painel.',
      },
      {
        q: 'Em qual rede funciona?',
        a: 'Na Stellar. As taxas de rede são pagas por {brand}: você não precisa ter XLM.',
      },
      {
        q: 'E se eu transferir e o comerciante não liberar?',
        a: 'Você reporta um problema na própria ordem. Os USDC continuam bloqueados e um revisor decide com base nos comprovantes, entre você e o comerciante.',
      },
      {
        q: 'E se eu não conseguir transferir a tempo?',
        a: 'A ordem expira e nada é cobrado. Se você já transferiu, não cancele: reporte um problema.',
      },
      {
        q: 'Quanto custa?',
        a: 'O preço de cada comerciante e a taxa do mercado aparecem antes de você abrir a ordem. Você recebe exatamente o que diz a cotação.',
      },
      {
        q: 'Por que a conta tem que estar no meu nome?',
        a: 'O comerciante confere se a transferência vem da pessoa que abriu a ordem. Assim se evitam pagamentos com contas de terceiros.',
      },
    ],
  },
  closing: {
    title: 'Crie sua conta',
    body: 'Com seu e-mail ou sua conta Google. Você vê o preço de cada pagamento antes de confirmá-lo.',
  },
};

export default landing;
