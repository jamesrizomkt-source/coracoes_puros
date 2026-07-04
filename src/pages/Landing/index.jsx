import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logError, logInfo } from '../../utils/logger';
import { supabase } from '../../lib/supabase';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import AlertModal from '../../components/AlertModal';

initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY || "APP_USR-2020a5c1-8647-4afd-a2e5-22481b030e4a", { locale: 'pt-BR' });

const mpErrorMessages = {
  cc_rejected_bad_filled_card_number: "Número do cartão inválido. Por favor, revise.",
  cc_rejected_bad_filled_date: "Data de validade inválida. Por favor, revise.",
  cc_rejected_bad_filled_other: "Algum dado do cartão está incorreto. Por favor, revise.",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido.",
  cc_rejected_blacklist: "Não pudemos processar seu pagamento. Tente usar o PIX.",
  cc_rejected_call_for_authorize: "O pagamento requer autorização prévia da operadora do cartão.",
  cc_rejected_card_disabled: "O cartão encontra-se inativo. Ligue para a administradora do seu cartão.",
  cc_rejected_card_error: "Não conseguimos processar seu cartão. Tente outro ou use o PIX.",
  cc_rejected_duplicated_payment: "Você já efetuou um pagamento com esse valor recentemente.",
  cc_rejected_high_risk: "Seu pagamento foi bloqueado por segurança pelo sistema antifraude. Se for um teste, use cartões de teste ou tente de outro celular/rede. Se for uma compra real, tente usar o PIX.",
  cc_rejected_insufficient_amount: "O seu cartão não possui saldo ou limite suficiente.",
  cc_rejected_invalid_installments: "O número de parcelas escolhido é inválido.",
  cc_rejected_max_attempts: "Você atingiu o limite máximo de tentativas com esse cartão.",
  cc_rejected_other_reason: "A operadora do seu cartão recusou o pagamento."
};

export default function CheckoutWidget() {
  const [modalActive, setModalActive] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [shippingResult, setShippingResult] = useState("");
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [orderId, setOrderId] = useState("");
  const [paymentData, setPaymentData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [showBrick, setShowBrick] = useState(false);
  const [finalPrice, setFinalPrice] = useState(0);
  const [bookPrice, setBookPrice] = useState(59.90);
  const [qty, setQty] = useState(1);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1 = Resumo, 2 = Pagamento MP
  const [addressData, setAddressData] = useState({ street: '', district: '', city: '', state: '' });
  const [buyerData, setBuyerData] = useState({ name: '', email: '', cpf: '' });
  const [isPickup, setIsPickup] = useState(false);
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });
  const [formStep, setFormStep] = useState(1); // 1 = Dados, 2 = Endereço

  const mpInitialization = useMemo(() => {
    return {
      amount: finalPrice,
      payer: {
        email: buyerData.email,
        identification: {
          type: "CPF",
          number: buyerData.cpf ? buyerData.cpf.replace(/\D/g, '') : ""
        }
      },
    };
  }, [finalPrice, buyerData]);

  const mpCustomization = useMemo(() => {
    return {
      paymentMethods: {
        creditCard: "all",
        maxInstallments: qty >= 2 ? 3 : 1,
        bankTransfer: "all",
      },
      visual: {
        hideValueProp: qty < 2,
        texts: {
          valueProp: qty >= 2 ? "Em até 3x" : " ",
          creditCardValueProp: qty >= 2 ? "Em até 3x" : " ",
        }
      }
    };
  }, [qty]);
  const loadPrice = async () => {
    try {
      const { data, error } = await supabase.rpc('get_book_price');
      if (!error && data) {
        const cleanString = String(data).replace(/['"]/g, '').replace(',', '.');
        const parsed = parseFloat(cleanString);
        if (!isNaN(parsed)) setBookPrice(parsed);
      }
    } catch (e) {
      // ignora
    }
  };

  useEffect(() => {
    loadPrice();
  }, []);

  const openModal = async (e) => {
    if (e) e.preventDefault();
    await loadPrice(); // Atualiza o preço em tempo real sempre que o modal abrir
    setModalActive(true);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setModalActive(false);
    document.body.style.overflow = "";
    setTimeout(() => {
      setSuccessState(false);
      setFeedback("");
      setShippingResult("");
      setShippingOptions([]);
      setSelectedShipping(null);
      setOrderId("");
      setPaymentData(null);
      setTimeLeft(300);
      setPaymentSuccess(false);
      setLoadingPayment(false);
      setShowBrick(false);
      setFinalPrice(0);
      setFormStep(1);
    }, 300);
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get("name");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const rawCep = isPickup ? "00000000" : (formData.get("cep") || "");
    const cep = rawCep.replace(/\D/g, "");
    const address_street = isPickup ? "Retirada Presencial" : (formData.get("street") || addressData.street);
    const address_number = isPickup ? "SN" : (formData.get("number") || "");
    const address_complement = formData.get("complement") || "";
    const address_district = isPickup ? "Localização do Vendedor" : (formData.get("district") || addressData.district);
    const address_city = isPickup ? "Sua Cidade" : (formData.get("city") || addressData.city);
    const address_state = isPickup ? "UF" : (formData.get("state") || addressData.state);
    const buyer_cpf = formData.get("cpf") || "";

    setFeedback("Processando seu pedido e calculando frete...");
    setIsError(false);
    setLoadingPayment(true);

    const newOrderId = crypto.randomUUID();
    setOrderId(newOrderId);

    // Salvar o email no addressData para que o Brick inicialize corretamente
    setAddressData(prev => ({ ...prev, email }));
    setBuyerData({ name, email, cpf: buyer_cpf });

    try {
      const { error: dbError } = await supabase.from('orders').insert([{
        id: newOrderId,
        name,
        email,
        phone,
        status: 'pending',
        address_cep: cep,
        address_street,
        address_number,
        address_complement,
        address_district,
        address_city,
        address_state,
        buyer_cpf,
        quantity: qty
      }]);

      if (dbError) throw dbError;

      logInfo("Pedido registrado com sucesso", { email });
      
      let shippingPrice = 0;
      let shippingDetails = "";

      if (isPickup) {
        shippingPrice = 0;
        setShippingOptions([{ id: "pickup", name: "Retirada Presencial (Combinar)", price: 0 }]);
        setSelectedShipping({ id: "pickup", name: "Retirada Presencial (Combinar)", price: 0 });
        setShippingResult("");
      } else if (cep && cep.length === 8) {
        setShippingResult("Calculando frete...");
        try {
          const { data, error: rpcError } = await supabase.functions.invoke('melhor-envio/calculate', {
            body: { to_postal_code: cep }
          });
          
          if (!rpcError && data && data.success && data.servicos && data.servicos.length > 0) {
            let validServices = data.servicos;
            validServices.sort((a, b) => {
              const nameA = (a.name || "").toLowerCase();
              const nameB = (b.name || "").toLowerCase();
              const aIsImpresso = nameA.includes("impresso") || nameA.includes("modico") || nameA.includes("módico") || a.id === 17;
              const bIsImpresso = nameB.includes("impresso") || nameB.includes("modico") || nameB.includes("módico") || b.id === 17;
              if (aIsImpresso && !bIsImpresso) return -1;
              if (!aIsImpresso && bIsImpresso) return 1;
              return parseFloat(a.price) - parseFloat(b.price);
            });
            const topServices = validServices.slice(0, 3);
            setShippingOptions(topServices);
            setSelectedShipping(topServices[0]);
            shippingPrice = parseFloat(topServices[0].price || 0);
            setShippingResult("");
          } else {
            const { data: rpcData, error: fallbackError } = await supabase.rpc('calculate_melhor_envio', { p_to_postal_code: cep });
            if (!fallbackError && rpcData && rpcData.success && rpcData.servicos && rpcData.servicos.length > 0) {
              let validServices = rpcData.servicos;
              validServices.sort((a, b) => {
                const nameA = (a.name || "").toLowerCase();
                const nameB = (b.name || "").toLowerCase();
                const aIsImpresso = nameA.includes("impresso") || nameA.includes("modico") || nameA.includes("módico") || a.id === 17;
                const bIsImpresso = nameB.includes("impresso") || nameB.includes("modico") || nameB.includes("módico") || b.id === 17;
                if (aIsImpresso && !bIsImpresso) return -1;
                if (!aIsImpresso && bIsImpresso) return 1;
                return parseFloat(a.price) - parseFloat(b.price);
              });
              const topServices = validServices.slice(0, 3);
              setShippingOptions(topServices);
              setSelectedShipping(topServices[0]);
              shippingPrice = parseFloat(topServices[0].price || 0);
              setShippingResult("");
            } else {
              let errorMessage = "Nenhuma opção de frete disponível para este CEP.";
              if (data?.error) errorMessage = data.error;
              else if (rpcData?.error) {
                errorMessage = rpcData.error;
                if (rpcData.details) errorMessage += `<br><span style="font-size:12px; color:gray">${rpcData.details}</span>`;
              }
              
              setShippingResult(`<span style='color: #e74c3c;'>${errorMessage}</span>`);
            }
          }
        } catch(err) {
          logError(err, { context: "Shipping Calculation" });
          setShippingResult("<span style='color: #e74c3c;'>Erro ao conectar com o serviço de frete.</span>");
        }
      }

      const calculatedPrice = (bookPrice * qty) + shippingPrice;
      setFinalPrice(calculatedPrice);
      
      setSuccessState(true);
      setShowBrick(true);

    } catch (error) {
      logError(error, { context: "Lead Submission" });
      setFeedback("Ocorreu um erro ao processar seu pedido. Tente novamente.");
      setIsError(true);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handlePaymentSubmit = useCallback(async (brickParam) => {
    return new Promise(async (resolve, reject) => {
      try {
        // O MP Payment Brick envia { selectedPaymentMethod, formData }
        const formData = brickParam?.formData || brickParam;
        const isPix = !formData?.token || formData?.payment_method_id?.toLowerCase() === "pix";
        
        let cleanFormData;
        if (isPix) {
          cleanFormData = {
            payment_method_id: "pix",
            payer: {
              email: buyerData.email || formData?.payer?.email,
              first_name: buyerData.name.split(' ')[0],
              last_name: buyerData.name.split(' ').slice(1).join(' ') || "Sobrenome",
              identification: {
                type: "CPF",
                number: buyerData.cpf.replace(/\D/g, '')
              }
            }
          };
        } else {
          cleanFormData = {
            ...formData,
            payer: {
              ...formData?.payer,
              email: buyerData.email || formData?.payer?.email,
              first_name: buyerData.name.split(' ')[0],
              last_name: buyerData.name.split(' ').slice(1).join(' ') || "Sobrenome",
              identification: {
                type: "CPF",
                number: buyerData.cpf.replace(/\D/g, '')
              }
            }
          };
        }

        const payload = {
          order_id: orderId,
          formData: cleanFormData,
          customer_name: buyerData.name,
          customer_email: buyerData.email,
          qty: qty,
          shippingPrice: selectedShipping ? parseFloat(selectedShipping.price) : 0,
          shippingServiceId: selectedShipping ? String(selectedShipping.id) : "",
          device_id: window.MP_DEVICE_SESSION_ID || ""
        };

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://lmdawrnbnnrnmxbrmgak.supabase.co"}/functions/v1/create-mercado-pago-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs"}`
          },
          body: JSON.stringify(payload)
        });

        const payData = await res.json();

        if (!res.ok || !payData?.success) {
          let errorMsg = payData?.error || "Erro ao processar pagamento.";
          if (payData?.details?.cause && payData.details.cause.length > 0) {
            errorMsg = payData.details.cause[0].description;
          } else if (payData?.details?.message) {
            errorMsg = payData.details.message;
          }
          throw new Error(errorMsg);
        }

        if (payData.status === "approved" || payData.simulated) {
          setPaymentSuccess(true);
          resolve();
        } else if (payData.status === "rejected") {
          const friendlyMessage = mpErrorMessages[payData.status_detail] || "Verifique os dados do cartão, limite disponível ou tente usar o PIX.";
          setAlertData({ isOpen: true, message: `Pagamento não concluído: ${friendlyMessage}` });
          reject(); // Keep the Brick open for retry
        } else {
          // Status pending (PIX)
          setPaymentData(payData);
          setShowBrick(false);
          resolve();
        }
      } catch (error) {
        logError(error, { context: "Payment Submit" });
        setAlertData({ isOpen: true, message: "Erro detalhado do Mercado Pago: " + error.message });
        reject();
      }
    });
  }, [orderId, qty, selectedShipping, buyerData]);

  useEffect(() => {
    if (!successState || !orderId || paymentSuccess || showBrick) return;

    let isFinished = false;
    let mpPollingTimeout = null;
    let mpPollingDelay = 2500;

    const onSuccess = () => {
      if (isFinished) return;
      isFinished = true;
      setPaymentSuccess(true);
    };

    const channel = supabase
      .channel(`order_status_${orderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders', 
        filter: `id=eq.${orderId}` 
      }, (payload) => {
        if (payload.new?.status === 'paid') onSuccess();
      })
      .subscribe();

    const checkDbStatus = async () => {
      if (isFinished) return;
      const { data } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
      if (data?.status === 'paid') onSuccess();
    };

    const pollMpStatus = async () => {
      if (isFinished || !paymentData?.payment_id) return;
      try {
        const { data } = await supabase.functions.invoke('check-mercado-pago-payment', {
          body: { payment_id: paymentData.payment_id, order_id: orderId }
        });
        if (data?.status === 'approved') {
          onSuccess();
          return;
        }
      } catch (err) {}
      
      // Exponential backoff
      if (!isFinished) {
        mpPollingDelay = Math.min(mpPollingDelay * 1.5, 15000); // max 15s
        mpPollingTimeout = setTimeout(pollMpStatus, mpPollingDelay);
      }
    };

    const intervalDb = setInterval(checkDbStatus, 3000);
    if (paymentData?.payment_id) {
      mpPollingTimeout = setTimeout(pollMpStatus, mpPollingDelay);
    }

    return () => {
      isFinished = true;
      supabase.removeChannel(channel);
      clearInterval(intervalDb);
      if (mpPollingTimeout) clearTimeout(mpPollingTimeout);
    };
  }, [successState, orderId, paymentData, paymentSuccess, showBrick]);

  useEffect(() => {
    if (!successState || !orderId || paymentSuccess) return;

    if (timeLeft <= 0) {
      supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId).then(() => {
        setAlertData({ isOpen: true, message: 'Tempo limite de 5 minutos excedido. Por favor, tente criar um novo pedido.' });
        closeModal();
      });
      return;
    }

    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [successState, orderId, timeLeft, paymentSuccess]);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setAlertData({ isOpen: true, message: "Mensagem enviada!" });
  };

  useEffect(() => {
    const handleOpen = (e) => {
      if (e) e.preventDefault();
      openModal();
    };
    
    window.openCheckoutModal = handleOpen;

    const triggers = document.querySelectorAll('[data-buy-trigger]');
    triggers.forEach(t => t.addEventListener('click', handleOpen));

    return () => {
      triggers.forEach(t => t.removeEventListener('click', handleOpen));
      delete window.openCheckoutModal;
    };
  }, []);

  const handleNextStep = () => {
    const nameEl = document.getElementById("lead-name");
    const emailEl = document.getElementById("lead-email");
    const phoneEl = document.getElementById("lead-phone");
    const cpfEl = document.getElementById("lead-cpf");

    if (nameEl && !nameEl.checkValidity()) { nameEl.reportValidity(); return; }
    if (emailEl && !emailEl.checkValidity()) { emailEl.reportValidity(); return; }
    if (phoneEl && !phoneEl.checkValidity()) { phoneEl.reportValidity(); return; }
    if (cpfEl && !cpfEl.checkValidity()) { cpfEl.reportValidity(); return; }

    if (isPickup) {
      const form = document.getElementById("leadForm");
      if (form) form.requestSubmit();
    } else {
      setFormStep(2);
    }
  };

  return (
    <div className={`modal-backdrop ${modalActive ? 'is-active' : ''}`} aria-hidden={!modalActive} role="dialog" onClick={(e) => { if (e.target.className.includes('modal-backdrop')) closeModal() }}>
      <div className="modal-content">
        <button className="modal-close" onClick={closeModal} aria-label="Fechar modal">&times;</button>
        
        {!successState ? (
          <div className="modal-body">
            <p className="eyebrow">Adquira o Livro</p>
            <h2 style={{ fontSize: "28px", color: "var(--blue)", marginBottom: "12px" }}>Garanta seu Exemplar</h2>
            <p style={{ color: "var(--muted)", marginBottom: "24px", fontSize: "15px" }}>
              {formStep === 1 ? "Etapa 1 de 2: Dados Pessoais" : "Etapa 2 de 2: Endereço de Entrega"}
            </p>
            <form id="leadForm" onSubmit={handleLeadSubmit}>
              <div style={{ display: formStep === 1 ? 'block' : 'none' }}>
                <div className="form-group">
                  <label htmlFor="lead-name">Nome Completo</label>
                  <input type="text" id="lead-name" name="name" required placeholder="Digite seu nome completo" />
                </div>
                <div className="form-group">
                  <label htmlFor="lead-email">Seu E-mail</label>
                  <input type="email" id="lead-email" name="email" required placeholder="Digite seu melhor e-mail" />
                </div>
                <div className="form-group">
                  <label htmlFor="lead-phone">WhatsApp / Telefone</label>
                  <input type="tel" id="lead-phone" name="phone" required placeholder="(31) 99999-9999" />
                </div>
                <div className="form-group">
                  <label htmlFor="lead-cpf">Seu CPF (obrigatório para envio)</label>
                  <input type="text" id="lead-cpf" name="cpf" required placeholder="Ex: 000.000.000-00" maxLength="14" pattern="\d{3}\.?\d{3}\.?\d{3}-?\d{2}" title="Digite um CPF válido" />
                </div>

                <div className="form-group" style={{ marginTop: "16px", marginBottom: "16px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "bold" }}>
                    <input type="checkbox" checked={isPickup} onChange={(e) => setIsPickup(e.target.checked)} style={{ width: "18px", height: "18px" }} />
                    Quero retirar presencialmente (Frete Grátis)
                  </label>
                </div>

                <button type="button" onClick={handleNextStep} className="button button-primary" style={{ width: "100%", marginTop: "10px", cursor: "pointer" }}>
                  {isPickup ? "Confirmar e Prosseguir" : "Avançar para Entrega"}
                </button>
              </div>

              <div style={{ display: formStep === 2 ? 'block' : 'none' }}>
                {!isPickup && (
                  <>
                    <div className="form-group">
                      <label htmlFor="lead-cep">CEP de Entrega</label>
                      <input 
                        type="text" 
                        id="lead-cep" 
                        name="cep" 
                        required={!isPickup && formStep === 2}
                        placeholder="Ex: 30130-010" 
                        maxLength="9" 
                        pattern="\d{5}-?\d{3}" 
                        title="Digite um CEP válido" 
                        onChange={async (e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          if (val.length === 8) {
                            try {
                              const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
                              const data = await res.json();
                              if (!data.erro) {
                                setAddressData({ street: data.logradouro, district: data.bairro, city: data.localidade, state: data.uf });
                              }
                            } catch(err) {}
                          }
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label htmlFor="lead-street">Rua</label>
                        <input type="text" id="lead-street" name="street" required={!isPickup && formStep === 2} value={addressData.street} onChange={(e) => setAddressData({...addressData, street: e.target.value})} placeholder="Ex: Av. Paulista" />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label htmlFor="lead-number">Número</label>
                        <input type="text" id="lead-number" name="number" required={!isPickup && formStep === 2} placeholder="Ex: 1000" />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label htmlFor="lead-complement">Complemento</label>
                        <input type="text" id="lead-complement" name="complement" placeholder="Apto, Bloco..." />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label htmlFor="lead-district">Bairro</label>
                        <input type="text" id="lead-district" name="district" required={!isPickup && formStep === 2} value={addressData.district} onChange={(e) => setAddressData({...addressData, district: e.target.value})} placeholder="Bairro" />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label htmlFor="lead-city">Cidade</label>
                        <input type="text" id="lead-city" name="city" required={!isPickup && formStep === 2} value={addressData.city} onChange={(e) => setAddressData({...addressData, city: e.target.value})} placeholder="Cidade" />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label htmlFor="lead-state">Estado (UF)</label>
                        <input type="text" id="lead-state" name="state" required={!isPickup && formStep === 2} value={addressData.state} onChange={(e) => setAddressData({...addressData, state: e.target.value})} maxLength="2" placeholder="MG" />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                  <button type="button" onClick={() => setFormStep(1)} className="button button-secondary" style={{ flex: 1, cursor: "pointer", background: "#f8f9fa", color: "var(--blue)" }}>
                    Voltar
                  </button>
                  <button type="submit" className="button button-primary" style={{ flex: 2, cursor: "pointer" }} disabled={loadingPayment}>
                    {loadingPayment ? "Calculando frete..." : "Confirmar e Prosseguir"}
                  </button>
                </div>
              </div>

              {feedback && (
                <p className={`form-feedback ${isError ? 'is-error' : ''}`} style={{ marginTop: "14px", textAlign: "center", fontWeight: "700" }}>
                  {feedback}
                </p>
              )}
            </form>
          </div>
        ) : (
          <div className="modal-body modal-success-state" style={{ textAlign: "center", padding: "20px 10px" }}>
            {!paymentSuccess ? (
              showBrick ? (
                <>
                  <div style={{ display: checkoutStep === 1 ? 'block' : 'none' }}>
                    <h2 style={{ fontSize: "24px", color: "var(--blue)", marginBottom: "12px" }}>Resumo do Pedido</h2>
                  
                    <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", marginBottom: "20px", textAlign: "left", color: "var(--blue)", border: "1px solid #e9ecef" }}>
                      <h3 style={{ fontSize: "16px", marginBottom: "12px", borderBottom: "1px dashed #ccc", paddingBottom: "8px" }}>Resumo da Compra</h3>
                    
                    {/* Controle de Quantidade */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}>
                      <span style={{ fontSize: "15px", fontWeight: "bold" }}>Quantidade:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button 
                          type="button"
                          onClick={() => {
                            if (qty > 1) {
                              setQty(qty - 1);
                              setFinalPrice((bookPrice * (qty - 1)) + (selectedShipping ? parseFloat(selectedShipping.price) : 0));
                            }
                          }}
                          style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "18px", display: "grid", placeItems: "center" }}
                        >-</button>
                        <span style={{ fontSize: "16px", fontWeight: "bold", width: "20px", textAlign: "center" }}>{qty}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            setQty(qty + 1);
                            setFinalPrice((bookPrice * (qty + 1)) + (selectedShipping ? parseFloat(selectedShipping.price) : 0));
                          }}
                          style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "18px", display: "grid", placeItems: "center" }}
                        >+</button>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Livro Corações Puros ({qty}x)</span>
                      <strong>R$ {(bookPrice * qty).toFixed(2).replace('.', ',')}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Frete</span>
                      <strong>R$ {(selectedShipping ? parseFloat(selectedShipping.price) : 0).toFixed(2).replace('.', ',')}</strong>
                    </div>
                    {shippingResult && (
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "-4px", marginBottom: "12px" }} dangerouslySetInnerHTML={{ __html: shippingResult }} />
                    )}
                    {shippingOptions.length > 0 && (
                      <div style={{ marginTop: "12px", marginBottom: "16px" }}>
                        <h4 style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Escolha o Prazo:</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {shippingOptions.map((opt, idx) => (
                            <label key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: selectedShipping?.id === opt.id ? "2px solid var(--blue)" : "1px solid #ccc", borderRadius: "6px", cursor: "pointer", background: selectedShipping?.id === opt.id ? "#f0f7ff" : "#fff", transition: "all 0.2s" }} onClick={() => { setSelectedShipping(opt); setFinalPrice((bookPrice * qty) + parseFloat(opt.price)); }}>
                              <input type="radio" name="shippingOpt" checked={selectedShipping?.id === opt.id} readOnly style={{ margin: 0, cursor: "pointer" }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                                  {opt.company?.name ? `${opt.company.name} - ${opt.name}` : opt.name}
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--muted)" }}>até {opt.delivery_time} dias úteis</div>
                              </div>
                              <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--blue)" }}>R$ {parseFloat(opt.price).toFixed(2).replace('.', ',')}</div>
                            </label>
                          ))}
                        </div>
                        <div style={{ marginTop: "10px", fontSize: "11.5px", color: "var(--muted)", fontStyle: "italic", textAlign: "left", lineHeight: "1.3" }}>
                          * Os despachos aos Correios/Transportadoras são realizados semanalmente.
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                      <strong>Total a Pagar</strong>
                      <strong style={{ color: "#1f9d61" }}>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                    
                    <button 
                      className="button button-primary"
                      style={{ width: "100%", marginTop: "16px", cursor: "pointer", fontSize: "16px" }}
                      onClick={() => setCheckoutStep(2)}
                    >
                      Ir para Pagamento
                    </button>
                    </div>
                  </div>

                  <div style={{ display: checkoutStep === 2 ? 'block' : 'none' }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #eee" }}>
                      <button 
                        onClick={() => setCheckoutStep(1)}
                        style={{ background: "transparent", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: "15px", fontWeight: "bold", padding: "8px", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>←</span> Voltar ao Resumo
                      </button>
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--muted)", fontStyle: "italic", textAlign: "center", marginBottom: "12px" }}>
                      * Parcelamento no cartão: Em casos elegíveis (a partir de 2 livros).
                    </div>
                    
                    <Payment
                      key={`mp-brick-${qty}`}
                      initialization={mpInitialization}
                      customization={mpCustomization}
                      onSubmit={handlePaymentSubmit}
                    />
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', color: '#1f9d61', fontSize: '13px', fontWeight: '500', background: '#f0fcf5', padding: '10px', borderRadius: '6px', border: '1px solid #c6f6d5' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <span>Ambiente 100% Seguro. Pagamento processado pelo Mercado Pago.</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: "24px", color: "var(--blue)", marginBottom: "12px" }}>Efetue o Pagamento PIX</h2>
                  <p style={{ color: "var(--muted)", fontSize: "15px", marginBottom: "12px" }}>
                    Tempo restante: <strong style={{ color: "red" }}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</strong>
                  </p>

                  <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", marginBottom: "20px", textAlign: "left", color: "var(--blue)", border: "1px solid #e9ecef" }}>
                    <h3 style={{ fontSize: "16px", marginBottom: "12px", borderBottom: "1px dashed #ccc", paddingBottom: "8px" }}>Resumo da Compra</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Livro Corações Puros ({qty}x)</span>
                      <strong>R$ {(bookPrice * qty).toFixed(2).replace('.', ',')}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Frete</span>
                      <strong>R$ {(selectedShipping ? parseFloat(selectedShipping.price) : 0).toFixed(2).replace('.', ',')}</strong>
                    </div>
                    {shippingResult && (
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "-4px", marginBottom: "12px" }} dangerouslySetInnerHTML={{ __html: shippingResult }} />
                    )}
                    {shippingOptions.length > 0 && (
                      <div style={{ marginTop: "12px", marginBottom: "16px" }}>
                        <h4 style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Escolha o Prazo:</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {shippingOptions.map((opt, idx) => (
                            <label key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: selectedShipping?.id === opt.id ? "2px solid var(--blue)" : "1px solid #ccc", borderRadius: "6px", cursor: "pointer", background: selectedShipping?.id === opt.id ? "#f0f7ff" : "#fff", transition: "all 0.2s" }} onClick={() => { setSelectedShipping(opt); setFinalPrice((bookPrice * qty) + parseFloat(opt.price)); }}>
                              <input type="radio" name="shippingOpt" checked={selectedShipping?.id === opt.id} readOnly style={{ margin: 0, cursor: "pointer" }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                                  {opt.company?.name ? `${opt.company.name} - ${opt.name}` : opt.name}
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--muted)" }}>até {opt.delivery_time} dias úteis</div>
                              </div>
                              <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--blue)" }}>R$ {parseFloat(opt.price).toFixed(2).replace('.', ',')}</div>
                            </label>
                          ))}
                        </div>
                        <div style={{ marginTop: "10px", fontSize: "11.5px", color: "var(--muted)", fontStyle: "italic", textAlign: "left", lineHeight: "1.3" }}>
                          * Os despachos aos Correios/Transportadoras são realizados semanalmente.
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                      <strong>Total a Pagar</strong>
                      <strong style={{ color: "#1f9d61" }}>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                  </div>

                  {paymentData?.qr_code_base64 && (
                    <div style={{ margin: "20px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <img 
                        src={`data:image/jpeg;base64,${paymentData.qr_code_base64}`} 
                        alt="QR Code Pix" 
                        style={{ width: "180px", height: "180px", border: "1px solid #ddd", padding: "5px", borderRadius: "8px", marginBottom: "16px" }} 
                      />
                      
                      {paymentData?.qr_code && (
                        <div style={{ width: "100%", maxWidth: "300px", textAlign: "left" }}>
                          <label style={{ fontSize: "13px", fontWeight: "bold", color: "var(--blue)", marginBottom: "4px", display: "block" }}>Pix Copia e Cola:</label>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <input 
                              type="text" 
                              readOnly 
                              value={paymentData.qr_code} 
                              style={{ flex: 1, padding: "8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", background: "#f8f9fa", color: "var(--muted)" }}
                            />
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(paymentData.qr_code);
                                setAlertData({ isOpen: true, message: "Código Pix copiado!" });
                              }}
                              style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: "4px", padding: "0 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}
                            >
                              Copiar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}



                  <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "15px" }}>
                    Aguardando confirmação do pagamento em tempo real...
                  </p>
                </>
              )
            ) : (
              <>
                <div className="success-icon" style={{ width: "72px", height: "72px", background: "#e9f8f0", color: "#1f9d61", borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 20px", fontSize: "32px", fontWeight: "bold" }}>✓</div>
                <h2 style={{ fontSize: "28px", color: "var(--blue)", marginBottom: "12px" }}>Pagamento Confirmado! 🎉</h2>
                <p style={{ color: "var(--muted)", fontSize: "16px", marginBottom: "12px" }}>
                  Obrigado pelo seu apoio! Seu exemplar do livro <strong>Corações Puros</strong> está confirmado e o comprovante foi enviado para o seu e-mail.
                </p>
                <button className="button button-primary" onClick={closeModal} style={{ marginTop: "15px" }}>
                  Fechar
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <AlertModal 
        isOpen={alertData.isOpen} 
        message={alertData.message} 
        onClose={() => setAlertData({ ...alertData, isOpen: false })} 
      />
    </div>
  );
}
