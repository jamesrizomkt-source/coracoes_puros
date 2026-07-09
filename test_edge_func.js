async function run() {
  const payload = {
    order_id: "b43522d4-febe-4bda-aa0d-f5ab58f096e2",
    formData: { payment_method_id: "pix", payer: { email: "test@example.com", first_name: "Test", last_name: "User", identification: {type: "CPF", number: "11122233344"} } },
    customer_name: "Test User",
    customer_email: "test@example.com",
    qty: 1,
    shippingPrice: 15.00,
    shippingServiceId: "1",
    device_id: "test"
  };

  const res = await globalThis.fetch("https://lmdawrnbnnrnmxbrmgak.supabase.co/functions/v1/create-mercado-pago-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run().catch(console.error);
