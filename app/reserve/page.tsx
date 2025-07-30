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
          amount: '30.00', // 💰 Monto en euros
          orderId: Date.now().toString(), // 🧾 Usamos timestamp como ID
          locale: 'es', // 🌍 Idioma (español por defecto)
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('❌ Error en la respuesta:', data.details);
        return;
      }

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
    form.submit();
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
