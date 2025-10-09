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

        console.log('Processing payment for:', customerEmail);

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

        console.log('Customer ID:', customer.id);

        // Collega il metodo di pagamento al cliente
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customer.id
            });
        } catch (attachError) {
            console.log('Payment method già collegato o errore:', attachError.message);
        }

        // Aggiorna il cliente con il metodo di pagamento predefinito
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
                enabled: true,
                allow_redirects: 'always'
            },
            description: 'Consulenza ONE TO ONE con Thomas - 1 ora',
            metadata: {
                product: product,
                customerEmail: customerEmail,
                customerName: customerName,
                priceId: 'price_1SGGpSE9CzAMobs3EMQEvQVo'
            },
            return_url: 'https://infobiz.com/thankyou-consulenza'
        });

        console.log('Payment Intent Status:', paymentIntent.status);

        if (paymentIntent.status === 'succeeded') {
            console.log('✅ Payment succeeded, sending to Make webhook...');

            // INVIA I DATI AL WEBHOOK DI MAKE
            if (process.env.MAKE_WEBHOOK_CONSULENZA) {
                try {
                    const fetch = require('node-fetch');
                    
                    const webhookData = {
                        // Dati cliente
                        email: customerEmail,
                        nome: customerName || customer.name || '',
                        
                        // Dati pagamento
                        importo: amount / 100, // Converti in euro
                        valuta: currency.toUpperCase(),
                        prodotto: 'consulenza_thomas_1h',
                        descrizione: 'Consulenza ONE TO ONE con Thomas - 1 ora',
                        
                        // Dati Stripe
                        stripeCustomerId: customer.id,
                        stripePaymentIntentId: paymentIntent.id,
                        stripePriceId: 'price_1SGGpSE9CzAMobs3EMQEvQVo',
                        
                        // Timestamp
                        dataAcquisto: new Date().toISOString(),
                        dataAcquistoFormattata: new Date().toLocaleString('it-IT', {
                            timeZone: 'Europe/Rome',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        
                        // Tag per GoHighLevel
                        tag: 'Consulenza_Thomas_500',
                        
                        // Info aggiuntive
                        tipoAcquisto: 'sales-page',
                        nomeOfferta: 'Consulenza ONE TO ONE con Thomas - 1 ora',
                        
                        // Status
                        paymentStatus: paymentIntent.status,
                        status: 'completed'
                    };

                    console.log('📤 Sending data to Make webhook:', webhookData);

                    const webhookResponse = await fetch(process.env.MAKE_WEBHOOK_CONSULENZA, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(webhookData)
                    });

                    if (webhookResponse.ok) {
                        const makeResult = await webhookResponse.text();
                        console.log('✅ Data sent to Make successfully:', makeResult);
                    } else {
                        console.error('⚠️ Make webhook error:', await webhookResponse.text());
                    }

                } catch (webhookError) {
                    console.error('❌ Error sending to Make:', webhookError);
                    // NON bloccare il pagamento se il webhook fallisce
                }
            } else {
                console.warn('⚠️ MAKE_WEBHOOK_CONSULENZA not configured');
            }

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
        console.error('❌ Error process-payment-consulenza:', error);
        
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