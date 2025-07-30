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
          amount: '30.00',
          orderId: Date.now().toString(),
          locale: 'es',
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('Error en la respuesta:', data.details);
        alert('Error al procesar el pago: ' + data.details);
        return;
      }

      console.log('Datos recibidos:', data);
      redirigirARedsys(data);
      
    } catch (error) {
      console.error('Error al iniciar el pago:', error);
      alert('Error al conectar con el servidor de pago');
    }
  };

  const redirigirARedsys = (data: {
    url: string;
    params: string;
    signature: string;
    signatureVersion: string;
  }) => {
    if (!data.url || !data.url.startsWith('https://')) {
      console.error('URL de Redsys inválida:', data.url);
      alert('Configuración de pago incorrecta');
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = data.url.trim();
    form.target = '_blank';
    form.style.display = 'none';

    const campos = [
      { name: 'Ds_MerchantParameters', value: data.params },
      { name: 'Ds_Signature', value: data.signature },
      { name: 'Ds_SignatureVersion', value: data.signatureVersion },
    ];

    campos.forEach(({ name, value }) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      document.body.removeChild(form);
    }, 5000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Finalizar Reserva</h1>
      <button
        onClick={handlePagar}
        style={{
          padding: '1rem 2rem',
          fontSize: '1rem',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Pagar con Tarjeta
      </button>
    </div>
  );
};

export default CheckoutPage;