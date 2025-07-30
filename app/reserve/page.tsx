'use client';

import React from 'react';

const CheckoutPage = () => {
  const handlePagar = async () => {
    try {
      const response = await fetch('/api/redsys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: '30.00',             // 💰 Monto en euros
          orderId: Date.now().toString(), // 🧾 Timestamp como ID
          locale: 'es',                // 🌍 Idioma
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('❌ Error en la respuesta:', data.details);
        return;
      }

      // Aquí recibes el objeto que luego será enviado a Redsys
      console.log('✅ Datos recibidos de /api/redsys:', data);

      redirigirARedsys(data);
    } catch (error) {
      console.error('❌ Error al iniciar el pago:', error);
    }
  };

  const redirigirARedsys = (data: {
    url: string;
    params: string;
    signature: string;
    signatureVersion: string;
  }) => {
    // Log de TODO lo que vamos a enviar
    console.log('➡️ Preparando formulario para Redsys con estos valores:');
    console.log('   action URL:        ', data.url);
    console.log('   Ds_MerchantParameters:', data.params);
    console.log('   Ds_Signature:        ', data.signature);
    console.log('   Ds_SignatureVersion: ', data.signatureVersion);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.url;

    const addField = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addField('Ds_MerchantParameters', data.params);
    addField('Ds_Signature', data.signature);
    addField('Ds_SignatureVersion', data.signatureVersion);

    document.body.appendChild(form);

    console.log('⌛ El formulario se enviará automáticamente en 20 segundos...');
    setTimeout(() => {
      console.log('🚀 Enviando formulario a Redsys ahora.');
      form.submit();
    }, 20_000);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Checkout Redsys</h1>
      <button
        onClick={handlePagar}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          backgroundColor: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Pagar con Redsys
      </button>
    </div>
  );
};

export default CheckoutPage;
