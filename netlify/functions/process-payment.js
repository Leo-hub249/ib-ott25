const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const {
      paymentMethodId,
      amount,
      currency,
      customerEmail,
      customerName,
      product
    } = JSON.parse(event.body);

    // Crea o recupera il cliente
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    let customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName
      });
    }

    // IMPORTANTE: Prima collega il metodo di pagamento al cliente
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });
    } catch (attachError) {
      // Se il metodo è già collegato, continua
      console.log('Payment method già collegato o errore:', attachError.message);
    }

    // POI aggiorna il cliente con il metodo di pagamento predefinito
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Crea il payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: false // Disabilita automatic payment methods per evitare conflitti
      },
      description: 'Biz Starter Pack',
      metadata: {
        product: product,
        customerEmail: customerEmail,
        customerName: customerName
      },
      return_url: 'https://infobiz.com/oto2'
    });

    if (paymentIntent.status === 'succeeded') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          customerId: customer.id,
          paymentIntentId: paymentIntent.id
        })
      };
    } else if (paymentIntent.status === 'requires_action' || 
               paymentIntent.status === 'requires_confirmation') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          requiresAction: true,
          clientSecret: paymentIntent.client_secret
        })
      };
    } else {
      throw new Error('Stato pagamento non gestito: ' + paymentIntent.status);
    }

  } catch (error) {
    console.error('Errore process-payment:', error);
    
    // Log dettagliato per debug
    if (error.type === 'StripeInvalidRequestError') {
      console.error('Dettagli errore Stripe:', {
        type: error.type,
        code: error.code,
        param: error.param,
        message: error.message
      });
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        type: error.type || 'unknown'
      })
    };
  }
};