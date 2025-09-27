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
      customerEmail,
      amount,
      currency,
      product,
      description,
      priceId
    } = JSON.parse(event.body);

    // Trova il cliente esistente (deve esistere dalla OTO1)
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    let customer = customers.data[0];
    
    if (!customer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cliente non trovato' })
      };
    }

    // Crea payment intent con il metodo di pagamento salvato
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description,
      metadata: {
        product: product,
        priceId: priceId || '',
        customerEmail: customerEmail
      }
    });

    if (paymentIntent.status === 'succeeded') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          paymentIntentId: paymentIntent.id
        })
      };
    } else if (paymentIntent.status === 'requires_action') {
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
    console.error('Errore one-click payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};