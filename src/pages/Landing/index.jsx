import React, { useState, useEffect } from 'react';
import { logError, logInfo } from '../../utils/logger';
import { supabase } from '../../lib/supabase';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

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
    }, 300);
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get("name");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const rawCep = formData.get("cep") || "";
    const cep = rawCep.replace(/\D/g, "");

    setFeedback("Processando seu pedido e calculando frete...");
    setIsError(false);
    setLoadingPayment(true);

    const newOrderId = crypto.randomUUID();
    setOrderId(newOrderId);

    try {
      const { error: dbError } = await supabase.from('orders').insert([{
        id: newOrderId,
        name,
        email,
        phone,
        cep,
        status: 'pending'
      }]);

      if (dbError) throw dbError;

      logInfo("Pedido registrado com sucesso", { email });
      
      let shippingPrice = 0;
      let shippingDetails = "";

      if (cep.length === 8) {
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

      const calculatedPrice = bookPrice + shippingPrice;
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

  const handlePaymentSubmit = async (formData) => {
    return new Promise(async (resolve, reject) => {
      try {
        const { data: payData, error: payError } = await supabase.functions.invoke('create-mercado-pago-payment', {
          body: {
            order_id: orderId,
            formData: formData
          }
        });

        if (payError || !payData?.success) {
          throw new Error(payError?.message || "Erro ao processar pagamento.");
        }

        if (payData.status === "approved" || payData.simulated) {
          setPaymentSuccess(true);
          resolve();
        } else {
          setPaymentData(payData);
          setShowBrick(false);
          resolve();
        }
      } catch (error) {
        logError(error, { context: "Payment Submit" });
        alert("Erro ao processar pagamento: " + error.message);
        reject();
      }
    });
  };

  useEffect(() => {
    if (!successState || !orderId || paymentSuccess || showBrick) return;

    let isFinished = false;

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

    const checkMpStatus = async () => {
      if (isFinished || !paymentData?.payment_id) return;
      const { data } = await supabase.functions.invoke('check-mercado-pago-payment', {
        body: { payment_id: paymentData.payment_id, order_id: orderId }
      });
      if (data?.status === 'approved') onSuccess();
    };

    const intervalDb = setInterval(checkDbStatus, 2000);
    const intervalMp = setInterval(checkMpStatus, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalDb);
      clearInterval(intervalMp);
    };
  }, [successState, orderId, paymentData, paymentSuccess, showBrick]);

  useEffect(() => {
    if (!successState || !orderId || paymentSuccess) return;

    if (timeLeft <= 0) {
      supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId).then(() => {
        alert('Tempo limite de 5 minutos excedido. Por favor, tente criar um novo pedido.');
        closeModal();
      });
      return;
    }

    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [successState, orderId, timeLeft, paymentSuccess]);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    alert("Mensagem enviada!");
  };

  useEffect(() => {
    const handleOpen = (e) => {
      e.preventDefault();
      openModal();
    };
    
    const triggers = document.querySelectorAll('[data-buy-trigger]');
    triggers.forEach(t => t.addEventListener('click', handleOpen));

    return () => triggers.forEach(t => t.removeEventListener('click', handleOpen));
  }, []);

  return (
    <div className={`modal-backdrop ${modalActive ? 'is-active' : ''}`} aria-hidden={!modalActive} role="dialog" onClick={(e) => { if (e.target.className.includes('modal-backdrop')) closeModal() }}>
      <div className="modal-content">
        <button className="modal-close" onClick={closeModal} aria-label="Fechar modal">&times;</button>
        
        {!successState ? (
          <div className="modal-body">
            <p className="eyebrow">Adquira o Livro</p>
            <h2 style={{ fontSize: "28px", color: "var(--blue)", marginBottom: "12px" }}>Garanta seu Exemplar</h2>
            <p style={{ color: "var(--muted)", marginBottom: "24px", fontSize: "15px" }}>
              Preencha seus dados para prosseguir para o pagamento seguro.
            </p>
            <form onSubmit={handleLeadSubmit}>
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
                <label htmlFor="lead-cep">CEP de Entrega</label>
                <input type="text" id="lead-cep" name="cep" required placeholder="Ex: 30130-010" maxLength="9" pattern="\d{5}-?\d{3}" title="Digite um CEP válido (com ou sem traço)" />
              </div>
              <button type="submit" className="button button-primary" style={{ width: "100%", marginTop: "10px", cursor: "pointer" }} disabled={loadingPayment}>
                {loadingPayment ? "Calculando frete..." : "Confirmar e Prosseguir"}
              </button>
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
                  <h2 style={{ fontSize: "24px", color: "var(--blue)", marginBottom: "12px" }}>Escolha como Pagar</h2>
                  
                  <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", marginBottom: "20px", textAlign: "left", color: "var(--blue)", border: "1px solid #e9ecef" }}>
                    <h3 style={{ fontSize: "16px", marginBottom: "12px", borderBottom: "1px dashed #ccc", paddingBottom: "8px" }}>Resumo da Compra</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Livro Corações Puros</span>
                      <strong>R$ {bookPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Frete</span>
                      <strong>R$ {(finalPrice - bookPrice).toFixed(2).replace('.', ',')}</strong>
                    </div>
                    {shippingResult && (
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "-4px", marginBottom: "12px" }} dangerouslySetInnerHTML={{ __html: shippingResult }} />
                    )}
                    {shippingOptions.length > 0 && (
                      <div style={{ marginTop: "12px", marginBottom: "16px" }}>
                        <h4 style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Escolha o Prazo:</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {shippingOptions.map((opt, idx) => (
                            <label key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: selectedShipping?.id === opt.id ? "2px solid var(--blue)" : "1px solid #ccc", borderRadius: "6px", cursor: "pointer", background: selectedShipping?.id === opt.id ? "#f0f7ff" : "#fff", transition: "all 0.2s" }} onClick={() => { setSelectedShipping(opt); setFinalPrice(bookPrice + parseFloat(opt.price)); }}>
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
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                      <strong>Total a Pagar</strong>
                      <strong style={{ color: "#1f9d61" }}>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', minHeight: '400px' }}>
                    <Payment
                      initialization={{ amount: finalPrice }}
                      customization={{
                        paymentMethods: {
                          pix: "all",
                          creditCard: "all"
                        }
                      }}
                      onSubmit={handlePaymentSubmit}
                    />
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
                      <span>Livro Corações Puros</span>
                      <strong>R$ {bookPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "15px" }}>
                      <span>Frete</span>
                      <strong>R$ {(finalPrice - bookPrice).toFixed(2).replace('.', ',')}</strong>
                    </div>
                    {shippingResult && (
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "-4px", marginBottom: "12px" }} dangerouslySetInnerHTML={{ __html: shippingResult }} />
                    )}
                    {shippingOptions.length > 0 && (
                      <div style={{ marginTop: "12px", marginBottom: "16px" }}>
                        <h4 style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Escolha o Prazo:</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {shippingOptions.map((opt, idx) => (
                            <label key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", border: selectedShipping?.id === opt.id ? "2px solid var(--blue)" : "1px solid #ccc", borderRadius: "6px", cursor: "pointer", background: selectedShipping?.id === opt.id ? "#f0f7ff" : "#fff", transition: "all 0.2s" }} onClick={() => { setSelectedShipping(opt); setFinalPrice(bookPrice + parseFloat(opt.price)); }}>
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
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                      <strong>Total a Pagar</strong>
                      <strong style={{ color: "#1f9d61" }}>R$ {finalPrice.toFixed(2).replace('.', ',')}</strong>
                    </div>
                  </div>

                  {paymentData?.qr_code_base64 && (
                    <div style={{ margin: "20px 0" }}>
                      <img 
                        src={`data:image/jpeg;base64,${paymentData.qr_code_base64}`} 
                        alt="QR Code Pix" 
                        style={{ width: "180px", height: "180px", border: "1px solid #ddd", padding: "5px", borderRadius: "8px" }} 
                      />
                    </div>
                  )}

                  {paymentData?.qr_code && (
                    <div style={{ marginTop: "15px", display: "flex", gap: "8px", justifyContent: "center" }}>
                      <input readOnly value={paymentData.qr_code} style={{ width: "70%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px" }} onClick={(e) => e.target.select()} />
                      <button className="button button-primary" style={{ padding: "8px 16px", fontSize: "13px" }} onClick={() => {
                        navigator.clipboard.writeText(paymentData.qr_code);
                        alert("Código PIX copiado!");
                      }}>Copiar</button>
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
    </div>
  );
}
