import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './admin.css';

export default function Admin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookPrice, setBookPrice] = useState(59.90);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    paidOrders: 0,
    pendingOrders: 0,
    totalOrders: 0
  });

  useEffect(() => {
    loadData();
    
    // Inscreve para receber atualizações em tempo real do banco de dados
    const channel = supabase
      .channel('admin_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        if (payload.eventType === 'UPDATE') {
          // Atualiza a tabela na tela instantaneamente sem precisar buscar tudo de novo
          setOrders(prevOrders => prevOrders.map(order => 
            order.id === payload.new.id ? { ...order, ...payload.new } : order
          ));
          // Aproveita para refazer os cálculos de KPIs locais (faturamento, etc) - simplificado
          loadData(); 
        } else {
          loadData(); // Para INSERT e DELETE, recarrega
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      // 1. Busca o preço atual do livro
      const { data: priceData, error: priceError } = await supabase.rpc('get_book_price');
      let currentBookPrice = 59.90;
      if (!priceError && priceData) {
        currentBookPrice = parseFloat(String(priceData).replace(/['"]/g, '').replace(',', '.'));
        setBookPrice(currentBookPrice);
      }

      // 2. Busca todos os pedidos ordenados por data de criação (mais recentes primeiro)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(ordersData || []);

      // 3. Calcula as métricas (KPIs)
      let revenue = 0;
      let paid = 0;
      let pending = 0;

      (ordersData || []).forEach(order => {
        if (order.status === 'paid') {
          paid++;
          // A receita é o preço do livro + o preço do frete que o cliente pagou
          revenue += currentBookPrice + (Number(order.shipping_price) || 0);
        } else {
          pending++;
        }
      });

      setMetrics({
        totalRevenue: revenue,
        paidOrders: paid,
        pendingOrders: pending,
        totalOrders: (ordersData || []).length
      });

    } catch (err) {
      console.error("Erro ao carregar dados do admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString));
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando painel administrativo...</div>;

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Painel de Controle - Corações Puros</h1>
        <p>Acompanhe suas vendas e recebimentos em tempo real.</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <h3>Faturamento (Real)</h3>
          <div className="kpi-value">{formatCurrency(metrics.totalRevenue)}</div>
          <div className="kpi-label">Vendas aprovadas + Frete</div>
        </div>
        <div className="kpi-card">
          <h3>Vendas Concluídas</h3>
          <div className="kpi-value">{metrics.paidOrders}</div>
          <div className="kpi-label">Pagamentos confirmados</div>
        </div>
        <div className="kpi-card">
          <h3>Aguardando Pagamento</h3>
          <div className="kpi-value">{metrics.pendingOrders}</div>
          <div className="kpi-label">PIX gerado, não pago</div>
        </div>
        <div className="kpi-card">
          <h3>Total de Pedidos</h3>
          <div className="kpi-value">{metrics.totalOrders}</div>
          <div className="kpi-label">Taxa de conversão: {metrics.totalOrders > 0 ? Math.round((metrics.paidOrders / metrics.totalOrders) * 100) : 0}%</div>
        </div>
      </div>

      <div className="admin-table-container">
        <h2>Histórico de Pedidos</h2>
        {orders.length === 0 ? (
          <p className="empty-state">Nenhum pedido recebido ainda.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>E-mail</th>
                <th>Frete Pago</th>
                <th>Status</th>
                <th>ID Mercado Pago</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>{formatDate(order.created_at)}</td>
                  <td><strong>{order.name}</strong><br/><span style={{fontSize: '12px', color: '#666'}}>{order.phone}</span></td>
                  <td>{order.email}</td>
                  <td>{order.shipping_price ? formatCurrency(order.shipping_price) : '-'}</td>
                  <td>
                    <span className={`status-badge ${order.status}`}>
                      {order.status === 'paid' ? 'Aprovado' : 
                       order.status === 'pending' ? 'Pendente' : 
                       order.status === 'cancelled' ? 'Cancelado' : order.status}
                    </span>
                    {order.status === 'paid' && order.payment_origin === 'mercadopago' && (
                      <div style={{marginTop: '4px', fontSize: '10px', color: '#2563eb', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <span>🤝</span> Mercado Pago
                      </div>
                    )}
                  </td>
                  <td style={{fontFamily: 'monospace', fontSize: '12px', color: '#666'}}>
                    {order.mp_payment_id || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
