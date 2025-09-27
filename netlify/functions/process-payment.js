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
      // Aggiorna il metodo di pagamento predefinito
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }

    // Collega il metodo di pagamento al cliente (importante per one-click successivi)
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id
    });

    // Crea il payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true,
      description: 'Biz Starter Pack',
      metadata: {
        product: product,
        customerEmail: customerEmail,
        customerName: customerName
      }
    });

    if (paymentIntent.status === 'succeeded') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          customerId: customer.id 
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
    console.error('Errore process-payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};