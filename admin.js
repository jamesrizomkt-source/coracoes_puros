/* ==========================================
   CORAÇÕES PUROS - ADMIN CONTROLLER (JAVASCRIPT)
   ========================================== */

const SUPABASE_URL = "https://lmdawrnbnnrnmxbrmgak.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs";

// Configuração do Quiz correspondente ao script.js
const quizQuestions = [
  {
    question: "Quando falamos em proteção da infância, qual atitude deve vir primeiro?",
    answer: "Informar, prevenir e fortalecer ambientes seguros"
  },
  {
    question: "Se uma criança relata uma situação de violência, qual é a postura mais adequada?",
    answer: "Escutar com calma, acolher e acionar a rede de proteção"
  },
  {
    question: "Segundo a proposta do livro, quem deve participar da rede de proteção?",
    answer: "Famílias, escolas, igrejas, comunidades e gestores públicos"
  },
  {
    question: "Qual campanha reforça a conscientização contra o abuso e a exploração sexual de crianças e adolescentes?",
    answer: "Maio Laranja"
  },
  {
    question: "No contexto do livro, o que significa romper o silêncio?",
    answer: "Falar do tema com responsabilidade, denunciar e buscar ajuda"
  },
  {
    question: "Qual destas iniciativas citadas fortalece a proteção também no ambiente digital?",
    answer: "Proteção Digital"
  }
];

// Estado Geral da Aplicação
const state = {
  token: null,
  user: null,
  profile: null,
  activeTab: "dashboard",
  orders: [],
  messages: [],
  quizResponses: [],
  users: [],
  currentModalCallback: null,
  realtimeTimer: null,
  settings: {}
};

// ==========================================
// INICIALIZAÇÃO E VERIFICAÇÃO DE SESSÃO
// ==========================================
// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", initApp);

// -------------------------------------------------------------
// GERAÇÃO DE ETIQUETA (Melhor Envio)
// -------------------------------------------------------------
window.generateLabel = async function(orderId) {
  let popup = window.open('', '_blank');
  if (popup) popup.document.write("<h2>Gerando etiqueta... Por favor aguarde.</h2>");
  
  try {
    const btn = document.getElementById('btn-label-' + orderId);
    let originalText = "";
    if (btn) {
      originalText = btn.innerHTML;
      btn.innerHTML = '<span class="loader" style="width:14px;height:14px;border-width:2px;display:inline-block;border-color:var(--accent-orange);border-bottom-color:transparent;"></span>';
      btn.disabled = true;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/melhor-envio/generate-label`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${state.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ order_id: orderId })
    });
    
    const data = await res.json();
    if (!res.ok || data.error) {
      if (popup) popup.close();
      showToast("Erro ao gerar etiqueta: " + (data.error || "Desconhecido.") + " Detalhes: " + (data.details || ""), "error");
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
      return;
    }
    
    showToast("Etiqueta gerada com sucesso!", "success");
    
    // Atualiza estado local
    const orderIndex = state.orders.findIndex(o => o.id === orderId);
    if (orderIndex > -1) {
      state.orders[orderIndex].melhor_envio_label_url = data.url;
      state.orders[orderIndex].melhor_envio_tracking = data.tracking;
      renderOrdersTable();
    }
    
    if(data.url) {
      if (popup) popup.location.href = data.url;
      else window.open(data.url, '_blank');
    } else {
      if (popup) popup.close();
    }
    
  } catch(err) {
    if (popup) popup.close();
    showToast("Erro na requisição: " + err.message, "error");
    const btn = document.getElementById('btn-label-' + orderId);
    if (btn) {
      btn.innerHTML = '📦';
      btn.disabled = false;
    }
  }
}

async function initApp() {
  setupEventListeners();
  
  // Verificar se é um retorno de recuperação de senha (hash na URL)
  const hash = window.location.hash;
  if (hash && hash.includes("type=recovery")) {
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get("access_token");
    if (accessToken) {
      // Esconder login e mostrar form de nova senha
      document.getElementById("js-login-wrapper").style.display = "none";
      document.getElementById("js-set-password-wrapper").style.display = "flex";
      
      // Salvar token temporário para atualizar a senha
      state.recoveryToken = accessToken;
      
      // Limpar hash da URL para não poluir
      window.history.replaceState(null, "", window.location.pathname);
      return; // Interrompe o fluxo normal de login
    }
  }

  // Tentar restaurar sessão
  const savedToken = sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token");
  const savedUser = sessionStorage.getItem("admin_user") || localStorage.getItem("admin_user");
  const savedProfile = sessionStorage.getItem("admin_profile") || localStorage.getItem("admin_profile");
  
  if (savedToken && savedUser) {
    state.token = savedToken;
    state.user = JSON.parse(savedUser);
    state.profile = savedProfile ? JSON.parse(savedProfile) : null;
    
    // Verificar se o token ainda é válido chamando a API do Supabase
    const isValid = await verifySession();
    if (isValid) {
      showAdminPanel();
    } else {
      clearSession();
      showToast("Sessão expirada. Faça login novamente.", "error");
    }
  }
}

// Verifica a autenticidade do token do usuário
async function verifySession() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${state.token}`
      }
    });
    return res.ok;
  } catch (err) {
    console.error("Erro ao verificar sessão:", err);
    return false;
  }
}

// ==========================================
// CONTROLE DE EVENTOS & LOGIN
// ==========================================
function setupEventListeners() {
  const loginForm = document.getElementById("js-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Formulário de Esqueci a Senha
  const forgotLink = document.getElementById("js-forgot-password-link");
  const forgotForm = document.getElementById("js-forgot-password-form");
  const backToLoginBtn = document.getElementById("js-btn-back-to-login");
  const setPasswordForm = document.getElementById("js-set-password-form");

  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("js-login-wrapper").style.display = "none";
      document.getElementById("js-forgot-password-wrapper").style.display = "flex";
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      document.getElementById("js-forgot-password-wrapper").style.display = "none";
      document.getElementById("js-login-wrapper").style.display = "flex";
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", handleForgotPassword);
  }

  if (setPasswordForm) {
    setPasswordForm.addEventListener("submit", handleSetNewPassword);
  }

  // Abas da Sidebar
  const tabTriggers = document.querySelectorAll("[data-tab-trigger]");
  tabTriggers.forEach(trigger => {
    trigger.addEventListener("click", () => {
      const tabId = trigger.getAttribute("data-tab-trigger");
      switchTab(tabId);
    });
  });

  // Botão Sair (Logout)
  const logoutBtn = document.getElementById("js-btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      showToast("Desconectado com sucesso.", "success");
      // Esconder painel e exibir login
      document.getElementById("js-admin-container").style.display = "none";
      document.getElementById("js-login-wrapper").style.display = "flex";
    });
  }

  // Botão Atualizar Dados (Refresh)
  const refreshBtn = document.getElementById("js-btn-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchAllData(true);
    });
  }

  // Botão Exportar CSV
  const exportBtn = document.getElementById("js-btn-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", handleExportCSV);
  }

  // Binds de Busca e Filtros
  const ordersSearch = document.getElementById("orders-search");
  if (ordersSearch) ordersSearch.addEventListener("input", renderOrdersTable);

  const ordersFilter = document.getElementById("orders-status-filter");
  if (ordersFilter) ordersFilter.addEventListener("change", renderOrdersTable);

  const messagesSearch = document.getElementById("messages-search");
  if (messagesSearch) messagesSearch.addEventListener("input", renderMessagesList);

  // Binds para a aba Configurações
  const signupForm = document.getElementById("js-signup-form");
  if (signupForm) signupForm.addEventListener("submit", handleSignUp);

  const globalSettingsForm = document.getElementById("js-global-settings-form");
  if (globalSettingsForm) globalSettingsForm.addEventListener("submit", handleSaveGlobalSettings);

  const notificationsSettingsForm = document.getElementById("js-notifications-settings-form");
  if (notificationsSettingsForm) notificationsSettingsForm.addEventListener("submit", handleSaveNotificationSettings);

  const triggerReportBtn = document.getElementById("js-btn-trigger-report");
  if (triggerReportBtn) triggerReportBtn.addEventListener("click", handleTriggerDailyReportManual);

  const testTelegramBtn = document.getElementById("js-btn-test-telegram");
  if (testTelegramBtn) testTelegramBtn.addEventListener("click", handleTestTelegramConnection);

  const telegramEnabledInput = document.getElementById("setting-telegram-enabled");
  const telegramConfigPanel = document.getElementById("telegram-config-panel");
  if (telegramEnabledInput && telegramConfigPanel) {
    telegramEnabledInput.addEventListener("change", (e) => {
      telegramConfigPanel.style.display = e.target.checked ? "block" : "none";
    });
  }

  const usersSearch = document.getElementById("users-search");
  if (usersSearch) usersSearch.addEventListener("input", renderUsersTable);

  // Binds para controle de Senha Provisória (Ver e Gerar/Trocar)
  const toggleBtn = document.getElementById("js-toggle-signup-password");
  const passwordInput = document.getElementById("signup-password");
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isPassword ? "text" : "password");
      toggleBtn.style.color = isPassword ? "var(--accent-blue-hover)" : "var(--text-muted)";
      toggleBtn.innerHTML = isPassword 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  const generateBtn = document.getElementById("js-generate-signup-password");
  if (generateBtn && passwordInput) {
    generateBtn.addEventListener("click", () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
      let newPassword = "";
      for (let i = 0; i < 10; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      passwordInput.value = newPassword;
      passwordInput.setAttribute("type", "text");
      
      // Sincronizar o botão de Ver/Ocultar
      if (toggleBtn) {
        toggleBtn.style.color = "var(--accent-blue-hover)";
        toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
      }
      
      showToast("Nova senha provisória gerada com sucesso!", "success");
    });
  }

  // Modal de Confirmação - Binds
  document.getElementById("confirm-btn-cancel").addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-btn-proceed").addEventListener("click", () => {
    if (state.currentModalCallback) {
      state.currentModalCallback();
      closeConfirmModal();
    }
  });
}

// Ação de Login no Supabase Auth
async function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById("js-login-error");
  const loginBtn = document.getElementById("js-btn-login");
  
  errorEl.style.display = "none";
  loginBtn.disabled = true;
  loginBtn.querySelector("span").textContent = "Entrando...";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.msg || data.error_description || data.error || "Credenciais inválidas ou erro no login.");
    }

    state.token = data.access_token;
    state.user = data.user;
    
    // Salvar token temporário na sessão
    sessionStorage.setItem("admin_token", state.token);
    sessionStorage.setItem("admin_user", JSON.stringify(state.user));

    // Buscar Perfil do Usuário na tabela public.profiles
    await fetchUserProfile(data.user.id);
    
    showToast(`Bem-vindo, ${state.profile ? state.profile.name : state.user.email}!`, "success");
    showAdminPanel();

  } catch (err) {
    console.error("Erro no login:", err);
    errorEl.textContent = err.message || "Erro de conexão. Verifique os dados.";
    errorEl.style.display = "block";
  } finally {
    loginBtn.disabled = false;
    loginBtn.querySelector("span").textContent = "Entrar no Painel";
  }
}

// Ação de Recuperar Senha (Enviar Email)
async function handleForgotPassword(e) {
  e.preventDefault();
  const errorEl = document.getElementById("js-forgot-error");
  const successEl = document.getElementById("js-forgot-success");
  const sendBtn = document.getElementById("js-btn-send-recovery");
  
  errorEl.style.display = "none";
  successEl.style.display = "none";
  sendBtn.disabled = true;
  sendBtn.querySelector("span").textContent = "Enviando...";

  const email = document.getElementById("forgot-email").value.trim();

  try {
    // 1. Checar se o e-mail existe chamando a RPC segura
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_email_exists`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ check_email: email })
    });

    if (rpcRes.ok) {
      const exists = await rpcRes.json();
      if (!exists) {
        throw new Error("Este e-mail não está cadastrado no sistema.");
      }
    } else {
      // Se houver algum erro com a RPC, logar mas não bloquear necessariamente, ou lançar erro genérico
      console.warn("Erro ao checar e-mail, procedendo com o envio padrão...");
    }

    // 2. Disparar e-mail de recuperação
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: email })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error_description || data.msg || "Erro ao enviar e-mail de recuperação");
    }

    successEl.textContent = "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha em instantes.";
    successEl.style.display = "block";
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  } finally {
    sendBtn.disabled = false;
    sendBtn.querySelector("span").textContent = "Enviar Link";
  }
}

// Ação de Definir Nova Senha
async function handleSetNewPassword(e) {
  e.preventDefault();
  const errorEl = document.getElementById("js-set-password-error");
  const setBtn = document.getElementById("js-btn-set-password");
  
  errorEl.style.display = "none";
  setBtn.disabled = true;
  setBtn.querySelector("span").textContent = "Salvando...";

  const newPassword = document.getElementById("new-password").value;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${state.recoveryToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password: newPassword })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error_description || data.msg || "Erro ao redefinir a senha");
    }

    showToast("Senha redefinida com sucesso! Faça login com a nova senha.", "success");
    
    // Esconder modal e mostrar login normal
    document.getElementById("js-set-password-wrapper").style.display = "none";
    document.getElementById("js-login-wrapper").style.display = "flex";
    state.recoveryToken = null; // limpar
    
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  } finally {
    setBtn.disabled = false;
    setBtn.querySelector("span").textContent = "Salvar Nova Senha";
  }
}

// Buscar o perfil do usuário na tabela public.profiles
async function fetchUserProfile(userId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${state.token}`
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        state.profile = data[0];
        sessionStorage.setItem("admin_profile", JSON.stringify(state.profile));
      }
    }
  } catch (err) {
    console.error("Erro ao obter perfil de usuário:", err);
  }
}

// Exibe o painel administrativo e oculta o login
function showAdminPanel() {
  document.getElementById("js-login-wrapper").style.display = "none";
  document.getElementById("js-admin-container").style.display = "flex";
  
  // Atualizar Info do Usuário no Rodapé da Sidebar
  const avatarEl = document.getElementById("js-user-avatar");
  const emailEl = document.getElementById("js-user-email");
  const roleEl = document.getElementById("js-user-role");

  if (state.profile) {
    emailEl.textContent = state.profile.email;
    roleEl.textContent = state.profile.role;
    avatarEl.textContent = state.profile.name ? state.profile.name.substring(0, 2).toUpperCase() : "AD";
  } else if (state.user) {
    emailEl.textContent = state.user.email;
    roleEl.textContent = "Administrador";
    avatarEl.textContent = state.user.email.substring(0, 2).toUpperCase();
  }

  // Carregar dados iniciais das tabelas
  switchTab("dashboard");
  
  // Iniciar sincronização automática em tempo real
  startRealtimePolling();
}

function clearSession() {
  stopRealtimePolling();
  state.token = null;
  state.user = null;
  state.profile = null;
  sessionStorage.clear();
  localStorage.clear();
}

// ==========================================
// CONTROLE DE NAVEGAÇÃO DE ABAS
// ==========================================
function switchTab(tabId) {
  state.activeTab = tabId;

  // Atualizar botões da sidebar
  document.querySelectorAll("[data-tab-trigger]").forEach(btn => {
    if (btn.getAttribute("data-tab-trigger") === tabId) {
      btn.classList.add("is-active");
    } else {
      btn.classList.remove("is-active");
    }
  });

  // Atualizar visualização do container
  document.querySelectorAll(".tab-content").forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add("is-active");
    } else {
      content.classList.remove("is-active");
    }
  });

  // Atualizar cabeçalho da página
  const titles = {
    dashboard: "Dashboard geral",
    orders: "Gerenciamento de Pedidos",
    messages: "Mensagens Recebidas",
    quiz: "Análise de Respostas do Quiz",
    settings: "Configurações e Controle de Acesso"
  };
  document.getElementById("js-page-title").textContent = titles[tabId] || "Painel";

  // Exibir/ocultar botão de exportar
  const exportBtn = document.getElementById("js-btn-export");
  if (tabId === "orders" || tabId === "quiz") {
    exportBtn.style.display = "inline-flex";
    if (tabId === "orders") exportBtn.querySelector("span").textContent = "Exportar Pedidos";
    else exportBtn.querySelector("span").textContent = "Exportar Resultados";
  } else {
    exportBtn.style.display = "none";
  }

  if (tabId === "settings") {
    switchSubTab("global");
  }

  // Buscar dados específicos se a lista estiver vazia ou forçar atualização
  fetchAllData();
}

function switchSubTab(subTabId) {
  // Alterar botões ativos
  document.querySelectorAll(".sub-tab-btn").forEach(btn => {
    btn.classList.remove("is-active");
    btn.style.color = "var(--text-muted)";
    btn.style.fontWeight = "700";
  });
  
  const activeBtn = document.getElementById(`sub-tab-btn-${subTabId}`);
  if (activeBtn) {
    activeBtn.classList.add("is-active");
    activeBtn.style.color = "var(--text-main)";
    activeBtn.style.fontWeight = "800";
  }

  // Alterar conteúdos ativos
  document.querySelectorAll(".sub-tab-content").forEach(content => {
    content.style.display = "none";
  });
  
  const activeContent = document.getElementById(`sub-tab-${subTabId}-content`);
  if (activeContent) {
    activeContent.style.display = subTabId === "global" ? "block" : "grid";
  }
}

// ==========================================
// CONSULTAS DE DADOS (SUPABASE REST API)
// ==========================================
async function fetchAllData(forceRefresh = false, isBackground = false) {
  if (!state.token) return;

  const refreshBtn = document.getElementById("js-btn-refresh");
  if (refreshBtn && !isBackground) refreshBtn.classList.add("spinning");

  try {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${state.token}`,
      "Content-Type": "application/json"
    };

    const fetchOpts = { headers, cache: "no-store" };
    const ts = new Date().getTime();

    // Fazer requisições em paralelo para desempenho premium
    const [ordersRes, messagesRes, quizRes, profilesRes, settingsRes, pageViewsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?order=created_at.desc`, fetchOpts),
      fetch(`${SUPABASE_URL}/rest/v1/messages?order=created_at.desc`, fetchOpts),
      fetch(`${SUPABASE_URL}/rest/v1/quiz_responses?order=created_at.desc`, fetchOpts),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?order=name.asc`, fetchOpts),
      fetch(`${SUPABASE_URL}/rest/v1/settings`, fetchOpts),
      fetch(`${SUPABASE_URL}/rest/v1/page_views`, fetchOpts)
    ]);

    if (ordersRes.ok) state.orders = await ordersRes.json();
    if (messagesRes.ok) state.messages = await messagesRes.json();
    if (quizRes.ok) state.quizResponses = await quizRes.json();
    if (profilesRes.ok) state.users = await profilesRes.json();
    if (pageViewsRes && pageViewsRes.ok) state.pageViews = await pageViewsRes.json();
    
    if (settingsRes.ok) {
      const settingsArray = await settingsRes.json();
      state.settings = {};
      settingsArray.forEach(s => {
        state.settings[s.key] = s.value;
      });
      // Popular os campos de input do form de Ajustes Globais
      populateSettingsForm();
    }

    // Atualizar as views correspondentes
    renderAll();
    
    if (forceRefresh) {
      showToast("Dados atualizados com sucesso.", "success");
    }

  } catch (err) {
    console.error("Erro ao buscar dados do Supabase:", err);
    if (!isBackground) {
      showToast("Erro ao sincronizar dados com o servidor.", "error");
    }
  } finally {
    if (refreshBtn && !isBackground) {
      setTimeout(() => refreshBtn.classList.remove("spinning"), 300);
    }
  }
}

// ==========================================
// MONITORAMENTO EM TEMPO REAL (POLLING)
// ==========================================
function startRealtimePolling() {
  if (state.realtimeTimer) clearInterval(state.realtimeTimer);
  
  // Atualizar o status badge para ativo
  const badge = document.getElementById("js-realtime-status");
  if (badge) {
    badge.style.display = "inline-flex";
  }

  // Sincronização em background a cada 10 segundos
  state.realtimeTimer = setInterval(() => {
    // Só faz requisição se o painel estiver aberto e em foco
    if (state.token && document.visibilityState === "visible") {
      fetchAllData(false, true);
    }
  }, 10000);
}

function stopRealtimePolling() {
  if (state.realtimeTimer) {
    clearInterval(state.realtimeTimer);
    state.realtimeTimer = null;
  }
  
  const badge = document.getElementById("js-realtime-status");
  if (badge) {
    badge.style.display = "none";
  }
}

// Renderiza todas as abas e atualiza métricas
function renderAll() {
  // 1. Atualizar KPIs do Dashboard
  updateDashboardKPIs();
  
  // 2. Renderizar abas dependendo do estado
  renderRecentOrders();
  renderOrdersTable();
  renderMessagesList();
  renderQuizAnalytics();
  renderUsersTable();
}

// ==========================================
// RENDER: DASHBOARD VIEW
// ==========================================
function updateDashboardKPIs() {
  // Pedidos de Livros KPIs
  const totalOrders = state.orders.length;
  const pendingOrders = state.orders.filter(o => o.status === "pending").length;
  const paidOrders = state.orders.filter(o => o.status === "paid").length;
  const shippedOrders = state.orders.filter(o => o.status === "shipped").length;

  document.getElementById("kpi-orders-total").textContent = totalOrders;
  document.getElementById("sub-orders-pending").textContent = `${pendingOrders} Pendente`;
  document.getElementById("sub-orders-paid").textContent = `${paidOrders} Pago`;
  document.getElementById("sub-orders-shipped").textContent = `${shippedOrders} Enviado`;

  // Faturamento (Real)
  let revenuePaid = 0;
  let revenuePending = 0;
  const currentBookPrice = parseFloat(state.settings?.book_price || 59.90);

  state.orders.forEach(order => {
    const shipping = Number(order.shipping_price) || 0;
    const totalOrderValue = currentBookPrice + shipping;
    if (order.status === "paid" || order.status === "shipped") {
      revenuePaid += totalOrderValue;
    } else if (order.status === "pending") {
      revenuePending += totalOrderValue;
    }
  });

  const formatCurrency = val => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const elTotalRev = document.getElementById("kpi-revenue-total");
  const elPaidRev = document.getElementById("sub-revenue-paid");
  const elPendingRev = document.getElementById("sub-revenue-pending");

  if (elTotalRev) elTotalRev.textContent = formatCurrency(revenuePaid);
  if (elPaidRev) elPaidRev.textContent = `${formatCurrency(revenuePaid)} Confirmado`;
  if (elPendingRev) elPendingRev.textContent = `${formatCurrency(revenuePending)} Aguardando PIX`;

  document.getElementById("kpi-messages-total").textContent = state.messages.length;

  document.getElementById("kpi-quiz-total").textContent = state.quizResponses.length;
  if (state.quizResponses.length > 0) {
    const avgScore = state.quizResponses.reduce((acc, q) => acc + (q.score / Math.max(1, q.total_questions)), 0) / state.quizResponses.length;
    document.getElementById("sub-quiz-avg-score").textContent = `Média de ${Math.round(avgScore * 100)}% acertos`;
  }

  // Processar Painel Completo de Analytics
  if (state.pageViews && document.getElementById("analytics-views-total")) {
    const totalViews = state.pageViews.length;
    const uniqueSessions = new Set(state.pageViews.map(pv => pv.session_id)).size;
    
    // Calcular visualizações de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewsToday = state.pageViews.filter(pv => {
      const d = new Date(pv.created_at);
      return d >= today;
    }).length;

    document.getElementById("analytics-views-today").textContent = viewsToday;
    document.getElementById("analytics-views-total").textContent = totalViews;
    document.getElementById("analytics-unique-total").textContent = `${uniqueSessions} Únicos`;

    // Dispositivos (Mobile vs Desktop)
    let mobileCount = 0;
    let desktopCount = 0;
    
    // Top Origens
    const referrersMap = {};

    state.pageViews.forEach(pv => {
      // User Agent Parsing Básico
      const ua = (pv.user_agent || "").toLowerCase();
      if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
        mobileCount++;
      } else {
        desktopCount++;
      }

      // Referrer Parsing
      let ref = pv.referrer || "Direto / Sem origem";
      if (ref !== "Direto / Sem origem") {
        try {
          const url = new URL(ref);
          ref = url.hostname.replace("www.", "");
        } catch (e) {
          // Mantém como está se não for URL válida
        }
      }
      if (ref === "instagram.com" || ref === "l.instagram.com") ref = "Instagram";
      if (ref.includes("google")) ref = "Google";
      if (ref.includes("facebook") || ref === "l.facebook.com" || ref === "m.facebook.com") ref = "Facebook";

      if (ref !== "localhost" && ref !== "127.0.0.1") {
        referrersMap[ref] = (referrersMap[ref] || 0) + 1;
      }
    });

    // Atualizar UI Dispositivos
    const mobilePct = totalViews > 0 ? Math.round((mobileCount / totalViews) * 100) : 0;
    const desktopPct = totalViews > 0 ? Math.round((desktopCount / totalViews) * 100) : 0;
    
    const mPctEl = document.getElementById("analytics-device-mobile-pct");
    const dPctEl = document.getElementById("analytics-device-desktop-pct");
    const mBarEl = document.getElementById("analytics-device-mobile-bar");
    const dBarEl = document.getElementById("analytics-device-desktop-bar");
    
    if (mPctEl) {
      mPctEl.textContent = `${mobilePct}%`;
      mBarEl.style.width = `${mobilePct}%`;
      dPctEl.textContent = `${desktopPct}%`;
      dBarEl.style.width = `${desktopPct}%`;
    }

    // Atualizar UI Origens
    const referrersListEl = document.getElementById("analytics-referrers-list");
    if (referrersListEl) {
      referrersListEl.innerHTML = "";
      const sortedReferrers = Object.entries(referrersMap).sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5
      
      if (sortedReferrers.length === 0) {
        referrersListEl.innerHTML = `<div style="font-size: 13px; color: var(--text-muted);">Nenhum dado registrado ainda.</div>`;
      } else {
        sortedReferrers.forEach(([ref, count]) => {
          const pct = Math.round((count / totalViews) * 100);
          referrersListEl.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; color: var(--text-main);">${ref}</span>
              </div>
              <span style="font-size: 13px; color: var(--text-muted); font-weight: 600;">${pct}%</span>
            </div>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: -6px;">
              <div style="height: 100%; width: ${pct}%; background: rgba(255,255,255,0.3); border-radius: 2px;"></div>
            </div>
          `;
        });
      }
    }
  }

  // ==========================================
  // INTELIGÊNCIA ESTRATÉGICA & CONVERSÃO
  // ==========================================
  if (state.pageViews && state.orders) {
    // 1. Dias da Semana
    const daysMap = [0, 0, 0, 0, 0, 0, 0]; // Dom a Sab
    const hoursMap = new Array(24).fill(0);
    
    state.pageViews.forEach(pv => {
      const ref = pv.referrer || "";
      if (ref === "localhost" || ref === "127.0.0.1") return;

      if (pv.created_at) {
        const d = new Date(pv.created_at);
        daysMap[d.getDay()]++;
        hoursMap[d.getHours()]++;
      }
    });

    // Encontrar dia de pico
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const fullDayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    let maxDayVal = Math.max(...daysMap);
    let topDayIndex = daysMap.indexOf(maxDayVal);
    
    const daysBarsEl = document.getElementById("analytics-days-bars");
    const topDayEl = document.getElementById("analytics-top-day");
    if (daysBarsEl && topDayEl) {
      if (maxDayVal === 0) {
        topDayEl.textContent = "Sem dados";
        daysBarsEl.innerHTML = "";
      } else {
        topDayEl.textContent = fullDayNames[topDayIndex];
        let barsHtml = "";
        daysMap.forEach((val, i) => {
          const hPct = maxDayVal > 0 ? (val / maxDayVal) * 100 : 0;
          const isTop = i === topDayIndex;
          barsHtml += `
            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 4px;">
              <div style="width: 100%; height: 40px; display: flex; align-items: flex-end; justify-content: center;">
                <div style="width: 8px; border-radius: 2px; height: ${Math.max(hPct, 5)}%; background: ${isTop ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)'}; transition: height 1s ease;"></div>
              </div>
              <span style="font-size: 9px; color: ${isTop ? 'var(--text-main)' : 'var(--text-muted)'};">${dayNames[i]}</span>
            </div>
          `;
        });
        daysBarsEl.innerHTML = barsHtml;
      }
    }

    // 2. Horário de Pico
    let maxHourVal = Math.max(...hoursMap);
    let topHourIndex = hoursMap.indexOf(maxHourVal);
    const topHourEl = document.getElementById("analytics-top-hour");
    const topHourDescEl = document.getElementById("analytics-top-hour-desc");
    
    if (topHourEl && topHourDescEl) {
      if (maxHourVal === 0) {
        topHourEl.textContent = "--:--";
        topHourDescEl.textContent = "Sem dados";
      } else {
        const hStr = topHourIndex.toString().padStart(2, '0');
        topHourEl.textContent = `${hStr}h`;
        topHourDescEl.textContent = `${maxHourVal} acessos neste horário`;
      }
    }

    // 3. Taxa de Conversão & Abandono
    const totalOrders = state.orders.length;
    const uniqueIPs = new Set();
    let oldestPageViewTime = Date.now();
    
    state.pageViews.forEach(pv => {
      const ref = pv.referrer || "";
      if (ref !== "localhost" && ref !== "127.0.0.1") {
        if (pv.session_id) uniqueIPs.add(pv.session_id);
        if (pv.created_at) {
          const t = new Date(pv.created_at).getTime();
          if (t < oldestPageViewTime) oldestPageViewTime = t;
        }
      }
    });
    
    const uniqueVisitors = uniqueIPs.size;

    // Para a taxa de conversão não ficar distorcida (acima de 100%), 
    // só contamos os pedidos que ocorreram DEPOIS do início do rastreio de visualizações
    let validOrdersCount = 0;
    if (uniqueVisitors > 0 && oldestPageViewTime < Date.now()) {
      validOrdersCount = state.orders.filter(o => new Date(o.created_at).getTime() >= oldestPageViewTime).length;
    }

    const conversionRate = uniqueVisitors > 0 ? ((validOrdersCount / uniqueVisitors) * 100).toFixed(1) : "0.0";
    const pendingOrders = state.orders.filter(o => o.status === "pending").length;
    const abandonmentRate = totalOrders > 0 ? ((pendingOrders / totalOrders) * 100).toFixed(1) : "0.0";

    const convEl = document.getElementById("analytics-conversion-rate");
    if (convEl) convEl.textContent = `${conversionRate}%`;

    const abanEl = document.getElementById("analytics-abandonment-rate");
    if (abanEl) abanEl.textContent = `${abandonmentRate}%`;
  }

  // Atualizar visualização do gráfico circular do Dashboard
  const circleProgress = document.getElementById("js-dash-circle-progress");
  const circleText = document.getElementById("js-dash-circle-text");
  
  if (circleProgress && circleText) {
    let avgPercent = 0;
    if (state.quizResponses && state.quizResponses.length > 0) {
      const totalScore = state.quizResponses.reduce((acc, q) => acc + q.score, 0);
      const totalQuestions = state.quizResponses.reduce((acc, q) => acc + q.total_questions, 0);
      avgPercent = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    }

    circleText.textContent = `${avgPercent}%`;
    // Raio do círculo = 58, Circunferência = 2 * PI * r = 364.42
    const circumference = 364.4;
    const strokeOffset = circumference - (circumference * avgPercent) / 100;
    circleProgress.style.strokeDashoffset = strokeOffset;
  }
}

function renderRecentOrders() {
  const tbody = document.getElementById("dashboard-recent-orders-tbody");
  if (!tbody) return;

  const recents = state.orders.slice(0, 5);
  
  if (recents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Sem pedidos registrados.</td></tr>`;
    return;
  }

  const statusBadges = {
    pending: '<span class="badge orange">Pendente</span>',
    paid: '<span class="badge green">Pago</span>',
    shipped: '<span class="badge blue">Enviado</span>',
    cancelled: '<span class="badge red">Cancelado</span>'
  };

  tbody.innerHTML = recents.map(order => `
    <tr>
      <td style="font-weight: 700;">${escapeHTML(order.name || "Sem Nome")}</td>
      <td>${escapeHTML(order.email)}</td>
      <td>${statusBadges[order.status] || order.status}</td>
    </tr>
  `).join("");
}

// ==========================================
// RENDER: ORDERS TABLE
// ==========================================
function renderOrdersTable() {
  const tbody = document.getElementById("orders-tbody");
  if (!tbody) return;

  const currentBookPrice = parseFloat(state.settings?.book_price || 49.90);
  const mpFeeRate = parseFloat(state.settings?.mp_fee || 4.99) / 100;

  // Calculando KPIs Financeiros para os Pedidos (Apenas Pagos ou Enviados geram lucro real)
  let totalGross = 0;
  let totalShippingCost = 0;
  let totalMpFees = 0;
  let totalNet = 0;
  let totalBooksSold = 0;

  state.orders.forEach(order => {
    if (order.status === "paid" || order.status === "shipped") {
      const qty = Number(order.quantity) || 1;
      const shipping = Number(order.shipping_price) || 0;
      const gross = order.total_price != null ? Number(order.total_price) : ((currentBookPrice * qty) + shipping);
      const mpFee = order.mp_fee_amount != null ? Number(order.mp_fee_amount) : gross * mpFeeRate;
      const net = gross - shipping - mpFee;
      
      totalGross += gross;
      totalShippingCost += shipping;
      totalMpFees += mpFee;
      totalNet += net;
      totalBooksSold += qty;
    }
  });

  const formatCurrency = val => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const elGrossVal = document.getElementById("order-kpi-value-gross");
  const elShippingVal = document.getElementById("order-kpi-value-shipping");
  const elFeesVal = document.getElementById("order-kpi-value-fees");
  const elNetVal = document.getElementById("order-kpi-value-net");
  const elBooksVal = document.getElementById("order-kpi-value-books");

  if (elGrossVal) elGrossVal.textContent = formatCurrency(totalGross);
  if (elShippingVal) elShippingVal.textContent = `- ${formatCurrency(totalShippingCost)}`;
  if (elFeesVal) elFeesVal.textContent = `- ${formatCurrency(totalMpFees)}`;
  if (elNetVal) elNetVal.textContent = formatCurrency(totalNet);
  if (elBooksVal) elBooksVal.textContent = totalBooksSold;

  const searchQuery = document.getElementById("orders-search").value.toLowerCase().trim();
  const statusFilter = document.getElementById("orders-status-filter").value;

  // Filtrar
  const filtered = state.orders.filter(order => {
    const matchesSearch = 
      (order.name && order.name.toLowerCase().includes(searchQuery)) ||
      (order.email && order.email.toLowerCase().includes(searchQuery)) ||
      (order.phone && order.phone.includes(searchQuery));
      
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <p class="empty-state-title">Nenhum Pedido Encontrado</p>
          <p class="empty-state-desc">Refine sua pesquisa ou filtro de status.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const formattedDate = new Date(order.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const cleanPhone = order.phone ? order.phone.replace(/\D/g, '') : '';
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : '#';
    
    // Cálculos por linha
    const qty = Number(order.quantity) || 1;
    const shipping = Number(order.shipping_price) || 0;
    const gross = order.total_price != null ? Number(order.total_price) : ((currentBookPrice * qty) + shipping);
    const mpFee = order.mp_fee_amount != null ? Number(order.mp_fee_amount) : gross * mpFeeRate;
    const totalCosts = shipping + mpFee;
    const net = gross - totalCosts;

    let paymentIcon = "";
    if (order.payment_method === "pix") {
      paymentIcon = `<span title="Pago via PIX">💠 PIX</span>`;
    } else if (order.payment_method === "credit_card") {
      paymentIcon = `<span title="Pago via Cartão de Crédito">💳 Cartão</span>`;
    } else if (order.payment_method === "ticket" || order.payment_method === "bolbradesco") {
      paymentIcon = `<span title="Pago via Boleto">📄 Boleto</span>`;
    }

    // Se o pedido está pendente ou cancelado, mostramos o net um pouco desativado
    const opacityStyle = (order.status === "pending" || order.status === "cancelled") ? "opacity: 0.5;" : "";

    // Check se já estava selecionado (manter estado ao re-renderizar)
    const isChecked = window.selectedOrders && window.selectedOrders.has(order.id) ? "checked" : "";

    let labelBtn = "";
    if (order.status === "paid" || order.status === "shipped") {
      if (order.melhor_envio_label_url) {
        labelBtn = `
          <a href="${order.melhor_envio_label_url}" target="_blank" class="btn-icon" title="Imprimir Etiqueta" style="color: var(--text-main); border-color: var(--line);">
            🖨️
          </a>
        `;
      } else {
        labelBtn = `
          <button id="btn-label-${order.id}" class="btn-icon" title="Gerar Etiqueta (Melhor Envio)" onclick="generateLabel('${order.id}')" style="color: var(--accent-orange); border-color: rgba(255, 136, 0, 0.2);">
            📦
          </button>
        `;
      }
    }

    return `
      <tr data-order-id="${order.id}" style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'" onclick="openOrderModal('${order.id}')">
        <td style="text-align: center; vertical-align: middle;" onclick="event.stopPropagation()">
          <input type="checkbox" class="order-checkbox" value="${order.id}" onchange="toggleOrderSelection(this)" ${isChecked} style="cursor: pointer; width: 16px; height: 16px;">
        </td>
        
        <td>
          <div style="font-weight: 800; color: var(--text-main);">${escapeHTML(order.name || "Sem Nome")} <span style="font-size: 11px; background: var(--accent-orange); color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${qty}x</span></div>
          <div style="font-size: 12px; color: var(--text-muted);">${escapeHTML(order.email)}</div>
          <div style="font-size: 11px; color: var(--accent-blue);">${escapeHTML(order.phone || "Não Informado")}</div>
        </td>
        
        <td style="font-size: 13px; color: var(--text-muted);">${formattedDate}</td>
        
        <td style="font-weight: 700; color: var(--text-main); ${opacityStyle}">
          ${formatCurrency(gross)}<br>
          <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">${paymentIcon}</span>
        </td>
        
        <td style="font-size: 13px; color: var(--accent-red); cursor: help; ${opacityStyle}" title="Frete: ${formatCurrency(shipping)} | MP: ${formatCurrency(mpFee)}">
          - ${formatCurrency(totalCosts)}
        </td>
        
        <td style="font-weight: 800; color: var(--accent-green); ${opacityStyle}">
          ${formatCurrency(net)}
        </td>

        <td onclick="event.stopPropagation()">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <select class="table-select" onchange="updateOrderStatus('${order.id}', this.value)" style="font-weight: 700; font-size: 12px; padding: 4px 8px; height: 32px; width: 130px;">
              <option value="pending" ${order.status === "pending" ? "selected" : ""}>🟡 Pendente</option>
              <option value="paid" ${order.status === "paid" ? "selected" : ""}>🟢 Pago</option>
              <option value="shipped" ${order.status === "shipped" ? "selected" : ""}>🔵 Enviado</option>
              <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>🔴 Cancelado</option>
            </select>
            
            <div class="action-buttons" style="justify-content: flex-start;">
              ${labelBtn}
              ${cleanPhone ? `
              <a href="${waLink}" target="_blank" class="btn-icon blue" title="Enviar WhatsApp" style="color: #10b981; border-color: rgba(16, 185, 129, 0.2);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </a>` : ''}
              <button class="btn-icon red" title="Excluir Pedido" onclick="confirmDeleteOrder('${order.id}', '${escapeHTML(order.name)}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join("");
  
  updateBulkActionsVisibility();
}

window.selectedOrders = new Set();

window.toggleOrderSelection = function(checkbox) {
  if (checkbox.checked) {
    window.selectedOrders.add(checkbox.value);
  } else {
    window.selectedOrders.delete(checkbox.value);
    document.getElementById("selectAllOrders").checked = false;
  }
  updateBulkActionsVisibility();
};

window.toggleSelectAllOrders = function(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.order-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = masterCheckbox.checked;
    if (masterCheckbox.checked) {
      window.selectedOrders.add(cb.value);
    } else {
      window.selectedOrders.delete(cb.value);
    }
  });
  updateBulkActionsVisibility();
};

window.updateBulkActionsVisibility = function() {
  const container = document.getElementById("bulk-actions-container");
  const selectAllCb = document.getElementById("selectAllOrders");
  const checkboxes = document.querySelectorAll('.order-checkbox');
  
  if (container) {
    if (window.selectedOrders.size > 0) {
      container.style.display = "block";
      const bulkSelect = document.getElementById("bulk-actions-select");
      if (bulkSelect) {
        bulkSelect.options[0].text = `Ações em Massa (${window.selectedOrders.size})...`;
      }
    } else {
      container.style.display = "none";
    }
  }
  
  // Atualiza master checkbox se todos visíveis estiverem checkados
  if (selectAllCb && checkboxes.length > 0) {
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCb.checked = allChecked;
  }
};

window.handleBulkAction = async function(action) {
  if (!action || window.selectedOrders.size === 0) return;
  
  const ids = Array.from(window.selectedOrders);
  
  if (action === "delete") {
    if (!confirm(`Tem certeza que deseja excluir ${ids.length} pedidos selecionados?`)) {
      document.getElementById("bulk-actions-select").value = "";
      return;
    }
    
    try {
      showToast("Excluindo pedidos...", "info");
      const query = `id=in.(${ids.join(",")})`;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?${query}`, {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${state.token}`
        }
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error("Erro do Supabase:", errText);
        throw new Error(errText || "Falha ao excluir");
      }
      
      showToast(`${ids.length} pedidos excluídos com sucesso.`, "success");
      
      // Limpar seleção
      window.selectedOrders.clear();
      document.getElementById("bulk-actions-select").value = "";
      updateBulkActionsVisibility();
      
      // Recarregar a tabela
      fetchAllData(true);
      
    } catch (err) {
      console.error(err);
      showToast(err.message || "Erro ao excluir pedidos.", "error");
    }
    document.getElementById("bulk-actions-select").value = "";
  } else if (action === "mark_paid" || action === "mark_shipped") {
    const newStatus = action === "mark_paid" ? "paid" : "shipped";
    const statusName = action === "mark_paid" ? "PAGO" : "ENVIADO";
    
    if (!confirm(`Mudar o status de ${ids.length} pedidos para ${statusName}?`)) {
      document.getElementById("bulk-actions-select").value = "";
      return;
    }
    
    try {
      showToast("Atualizando status...", "info");
      const query = `id=in.(${ids.join(",")})`;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?${query}`, {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${state.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) throw new Error("Falha ao atualizar");
      
      showToast(`Status atualizado com sucesso.`, "success");
      
      // Limpar seleção
      window.selectedOrders.clear();
      document.getElementById("bulk-actions-select").value = "";
      updateBulkActionsVisibility();
      
      // Recarregar a tabela
      fetchAllData(true);
      
    } catch (e) {
      console.error(e);
      showToast("Erro ao atualizar pedidos.", "error");
      document.getElementById("bulk-actions-select").value = "";
    }
  } else if (action === "generate_labels") {
    if (!confirm(`Gerar etiquetas em lote para os ${ids.length} pedidos selecionados? Isso irá gerar um arquivo PDF contendo todas elas.`)) {
      document.getElementById("bulk-actions-select").value = "";
      return;
    }
    
    // Abrir janela antes do await para driblar bloqueadores de popup
    let popup = window.open('', '_blank');
    if (popup) {
      popup.document.write("<h2>Gerando etiquetas... Por favor aguarde.</h2>");
    }
    
    try {
      showToast("Gerando etiquetas em lote. Isso pode demorar alguns segundos...", "info");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/melhor-envio/generate-labels-bulk`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${state.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ order_ids: ids })
      });
      
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erro desconhecido ao gerar em lote.");
      }
      
      showToast(`${data.generated_count || ids.length} etiquetas geradas/recuperadas com sucesso!`, "success");
      
      window.selectedOrders.clear();
      document.getElementById("bulk-actions-select").value = "";
      updateBulkActionsVisibility();
      
      fetchAllData(true);
      
      if(data.url) {
        if (popup) {
          popup.location.href = data.url;
        } else {
          window.open(data.url, '_blank');
        }
      } else if (popup) {
        popup.close();
      }
      
    } catch (e) {
      console.error(e);
      if (popup) popup.close();
      showToast("⚠️ Erro na geração em lote:\n\n" + e.message + "\n\nDica: Pedidos antigos que não têm endereço ou CPF salvos no banco não podem gerar etiquetas!", "error");
      document.getElementById("bulk-actions-select").value = "";
    }
  }
};

// Ação de Atualização de Status de Pedido Inline
window.updateOrderStatus = async function(orderId, newStatus) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${state.token}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      const updatedData = await res.json();
      if (!updatedData || updatedData.length === 0) {
        throw new Error("O servidor não atualizou o pedido (verifique permissões).");
      }
      
      showToast("Status do pedido atualizado.", "success");
      // Atualizar no estado local
      const idx = state.orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        state.orders[idx].status = newStatus;
        updateDashboardKPIs();
        renderOrdersTable(); // Re-renderizar a tabela para exibir ou esconder o botão de etiqueta
      }
    } else {
      const errText = await res.text();
      throw new Error(`Erro HTTP ${res.status}: ${errText}`);
    }
  } catch (err) {
    console.error("Erro ao atualizar status do pedido:", err);
    alert("ERRO CAPTURADO: " + err.message + "\n\nPor favor, copie ou tire um print desta mensagem e envie para o suporte!");
    showToast("Não foi possível atualizar o status do pedido.", "error");
    renderOrdersTable();
  }
}

// Excluir Pedido
window.confirmDeleteOrder = function(orderId, name) {
  showConfirmModal(
    "Excluir Pedido",
    `Deseja realmente remover o pedido de "${name}" permanentemente?`,
    async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
          method: "DELETE",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${state.token}`
          }
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Erro do Supabase:", errText);
          throw new Error(errText || "Falha ao excluir pedido");
        }
        
        showToast("Pedido excluído com sucesso.", "success");
        state.orders = state.orders.filter(o => o.id !== orderId);
        renderAll();
      } catch (err) {
        console.error("Erro ao excluir pedido:", err);
        showToast("Não foi possível excluir o pedido.", "error");
      }
    }
  );
}

// ==========================================
// RENDER: MESSAGES VIEW
// ==========================================
function renderMessagesList() {
  const container = document.getElementById("messages-list-container");
  if (!container) return;

  const searchQuery = document.getElementById("messages-search").value.toLowerCase().trim();

  // Filtrar
  const filtered = state.messages.filter(msg => {
    return (
      msg.name.toLowerCase().includes(searchQuery) ||
      msg.email.toLowerCase().includes(searchQuery) ||
      msg.message.toLowerCase().includes(searchQuery)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p class="empty-state-title">Nenhuma Mensagem Encontrada</p>
        <p class="empty-state-desc">Refine o termo de pesquisa.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(msg => {
    const formattedDate = new Date(msg.created_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const initial = msg.name.substring(0, 1).toUpperCase();

    return `
      <div class="message-card" id="message-card-${msg.id}">
        <div class="message-card-header">
          <div class="message-sender">
            <div class="message-avatar">${initial}</div>
            <div>
              <p class="message-sender-name">${escapeHTML(msg.name)}</p>
              <p class="message-sender-email">${escapeHTML(msg.email)}</p>
            </div>
          </div>
          <div class="message-date">${formattedDate}</div>
        </div>
        <div class="message-body">${escapeHTML(msg.message)}</div>
        <div class="message-actions">
          <a href="mailto:${msg.email}?subject=Contato Corações Puros&body=Olá ${escapeHTML(msg.name)},%0D%0A%0D%0A" class="btn" style="width: auto; height: 36px; padding: 0 14px; font-size: 13px; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            <span>Responder por E-mail</span>
          </a>
          <button class="btn-icon red" title="Excluir Mensagem" style="height: 36px; width: 36px;" onclick="confirmDeleteMessage('${msg.id}', '${escapeHTML(msg.name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Excluir Mensagem
window.confirmDeleteMessage = function(msgId, senderName) {
  showConfirmModal(
    "Excluir Mensagem",
    `Deseja realmente remover permanentemente a mensagem de "${senderName}"?`,
    async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${msgId}`, {
          method: "DELETE",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${state.token}`
          }
        });

        if (res.ok) {
          showToast("Mensagem removida com sucesso.", "success");
          state.messages = state.messages.filter(m => m.id !== msgId);
          renderAll();
        } else {
          throw new Error("Erro ao excluir.");
        }
      } catch (err) {
        console.error("Erro ao excluir mensagem:", err);
        showToast("Não foi possível excluir a mensagem.", "error");
      }
    }
  );
}

// ==========================================
// RENDER: QUIZ ANALYTICS VIEW
// ==========================================
function renderQuizAnalytics() {
  const container = document.getElementById("js-quiz-questions-stats");
  if (!container) return;

  const totalResponses = state.quizResponses.length;
  
  // Atualizar displays principais de pontuação
  let avgPercent = 0;
  if (totalResponses > 0) {
    const totalScore = state.quizResponses.reduce((acc, q) => acc + q.score, 0);
    const totalQuestions = state.quizResponses.reduce((acc, q) => acc + q.total_questions, 0);
    avgPercent = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
  }

  document.getElementById("quiz-panel-avg-text").textContent = `${avgPercent}%`;
  document.getElementById("quiz-panel-total-text").textContent = totalResponses;

  if (totalResponses === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p class="empty-state-title">Sem Estatísticas</p>
        <p class="empty-state-desc">Aguardando a primeira conclusão do quiz educativo para processar acertos.</p>
      </div>
    `;
    return;
  }

  // Agregar acertos por pergunta
  const questionStats = quizQuestions.map((q, idx) => {
    return {
      index: idx + 1,
      question: q.question,
      correctText: q.answer,
      totalCount: 0,
      correctCount: 0
    };
  });

  // Iterar pelas respostas salvas
  state.quizResponses.forEach(res => {
    // res.answers é uma array de objetos formatados no quiz
    if (res.answers && Array.isArray(res.answers)) {
      res.answers.forEach(ans => {
        // Encontrar correspondência de pergunta
        const match = questionStats.find(stat => stat.question === ans.question);
        if (match) {
          match.totalCount++;
          if (ans.isCorrect) {
            match.correctCount++;
          }
        }
      });
    }
  });

  // Renderizar a lista de métricas por pergunta com barra de progressão
  container.innerHTML = questionStats.map(stat => {
    const accuracy = stat.totalCount > 0 ? Math.round((stat.correctCount / stat.totalCount) * 100) : 0;
    
    return `
      <div class="quiz-stat-row">
        <div class="quiz-stat-header">
          <p class="quiz-stat-title">
            <span style="color: var(--accent-orange); font-weight: 900; margin-right: 6px;">P${stat.index}.</span>
            ${escapeHTML(stat.question)}
          </p>
          <span class="quiz-stat-meta">${accuracy}% de Acerto</span>
        </div>
        <div class="quiz-stat-bar-container">
          <div class="quiz-stat-bar" style="width: ${accuracy}%;"></div>
        </div>
        <div class="quiz-stat-legend">
          <span>Acertos: <strong>${stat.correctCount}</strong> de <strong>${stat.totalCount}</strong> respostas</span>
          <span style="color: var(--accent-green);">Correto: "${escapeHTML(stat.correctText)}"</span>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// EXPORTAÇÃO DE CSV
// ==========================================
function handleExportCSV() {
  if (state.activeTab === "orders") {
    if (state.orders.length === 0) {
      showToast("Não há pedidos para exportar.", "error");
      return;
    }

    const headers = ["Pedido ID", "Nome", "E-mail", "Telefone", "Status", "Data do Pedido"];
    const rows = state.orders.map(o => [
      o.id,
      o.name || "Sem Nome",
      o.email,
      o.phone || "",
      o.status,
      o.created_at
    ]);

    downloadCSV(headers, rows, "pedidos_livros_coracoes_puros.csv");
  } else if (state.activeTab === "quiz") {
    if (state.quizResponses.length === 0) {
      showToast("Não há respostas de quiz para exportar.", "error");
      return;
    }

    const headers = ["Resposta ID", "Pontuação", "Total Perguntas", "Porcentagem", "Data de Envio"];
    const rows = state.quizResponses.map(r => {
      const pct = Math.round((r.score / r.total_questions) * 100);
      return [
        r.id,
        r.score,
        r.total_questions,
        `${pct}%`,
        r.created_at
      ];
    });

    downloadCSV(headers, rows, "respostas_quiz_coracoes_puros.csv");
  }
}

function downloadCSV(headers, rows, filename) {
  // Converter para CSV string respeitando separador de colunas padrão (ponto e vírgula para PT-BR Excel)
  const csvContent = "\uFEFF" + [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(";"),
    ...rows.map(row => row.map(val => {
      const cellText = String(val === null || val === undefined ? "" : val);
      return `"${cellText.replace(/"/g, '""')}"`;
    }).join(";"))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("CSV exportado e baixado.", "success");
}

// ==========================================
// TOAST NOTIFICATIONS & CONFIRM DIALOGS
// ==========================================
function showToast(message, type = "info") {
  const container = document.getElementById("js-toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };

  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger animado para deslizar para dentro
  setTimeout(() => {
    toast.classList.add("is-active");
  }, 50);

  // Remover depois de 3.5 segundos
  setTimeout(() => {
    toast.classList.remove("is-active");
    setTimeout(() => {
      container.removeChild(toast);
    }, 300); // tempo de transição css
  }, 3500);
}

// Controle de Modal Confirmar Exclusão
function showConfirmModal(title, desc, onConfirm) {
  const modal = document.getElementById("js-confirm-modal");
  document.getElementById("confirm-modal-title").textContent = title;
  document.getElementById("confirm-modal-desc").textContent = desc;
  
  state.currentModalCallback = onConfirm;
  modal.classList.add("is-active");
}

function closeConfirmModal() {
  const modal = document.getElementById("js-confirm-modal");
  modal.classList.remove("is-active");
  state.currentModalCallback = null;
}

// Auxiliares de Segurança
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ==========================================
// RENDER & CONTROLES: ABA CONFIGURAÇÕES
// ==========================================
function renderUsersTable() {
  const tbody = document.getElementById("users-tbody");
  if (!tbody) return;

  const searchQuery = document.getElementById("users-search").value.toLowerCase().trim();
  const isAdmin = state.profile && state.profile.role === "Admin_Lider";

  // Filtrar
  const filtered = state.users.filter(user => {
    return (
      (user.name && user.name.toLowerCase().includes(searchQuery)) ||
      (user.email && user.email.toLowerCase().includes(searchQuery)) ||
      (user.role && user.role.toLowerCase().includes(searchQuery))
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">Nenhum usuário encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(user => {
    const isSelf = state.user && state.user.email === user.email;
    const disabledAttr = (!isAdmin || isSelf) ? "disabled" : "";
    
    // Se o usuário não for Admin_Lider, os selects de cargo ficam inativos
    const actionsHtml = (isAdmin && !isSelf) ? `
      <button class="btn-icon red" title="Excluir Usuário" onclick="confirmDeleteUser('${user.id}', '${escapeHTML(user.name || "Sem Nome")}', '${escapeHTML(user.email)}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    ` : `<span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">${isSelf ? "Sua Conta" : "Restrito"}</span>`;

    return `
      <tr data-user-id="${user.id}">
        <td style="font-weight: 700;">${escapeHTML(user.name || "Sem Nome")} ${isSelf ? '<span style="color: var(--accent-blue-hover); font-size: 11px;">(Você)</span>' : ""}</td>
        <td>${escapeHTML(user.email)}</td>
        <td>
          <select class="table-select" ${disabledAttr} onchange="updateUserRole('${user.id}', this.value)" style="min-width: 140px;">
            <option value="Assessoria" ${user.role === "Assessoria" ? "selected" : ""}>Assessoria</option>
            <option value="Admin_Lider" ${user.role === "Admin_Lider" ? "selected" : ""}>Admin Líder</option>
            <option value="Regional" ${user.role === "Regional" ? "selected" : ""}>Regional</option>
            <option value="Aguardando Aprovação" ${user.role === "Aguardando Aprovação" ? "selected" : ""}>Aprovação Pendente</option>
          </select>
        </td>
        <td>
          <div class="action-buttons">
            ${actionsHtml}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Desativar inputs de criação de usuário se não for Admin_Lider
  const signupInputs = document.querySelectorAll("#js-signup-form input, #js-signup-form select, #js-signup-form button");
  if (!isAdmin) {
    signupInputs.forEach(el => el.disabled = true);
    // Adicionar um aviso sutil de permissão
    const form = document.getElementById("js-signup-form");
    let notice = document.getElementById("js-admin-notice");
    if (!notice) {
      notice = document.createElement("p");
      notice.id = "js-admin-notice";
      notice.style.color = "var(--accent-orange)";
      notice.style.fontSize = "13px";
      notice.style.marginTop = "16px";
      notice.style.fontWeight = "600";
      notice.textContent = "⚠️ Apenas administradores com cargo 'Admin Líder' podem criar ou gerenciar usuários.";
      form.appendChild(notice);
    }
  } else {
    signupInputs.forEach(el => el.disabled = false);
    const notice = document.getElementById("js-admin-notice");
    if (notice) notice.remove();
  }
}

// Alteração de Permissões de Usuários
window.updateUserRole = async function(userId, newRole) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${state.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role: newRole })
    });

    if (res.ok) {
      showToast("Nível de acesso do usuário atualizado com sucesso.", "success");
      // Atualizar localmente
      const idx = state.users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        state.users[idx].role = newRole;
      }
    } else {
      throw new Error("Erro na resposta da API.");
    }
  } catch (err) {
    console.error("Erro ao atualizar cargo de usuário:", err);
    showToast("Não foi possível atualizar o acesso.", "error");
    renderUsersTable();
  }
}

// Confirmação para Remover Perfil
window.confirmDeleteUser = function(userId, name, email) {
  showConfirmModal(
    "Remover Acesso do Usuário",
    `Deseja realmente remover o perfil administrativo de "${name}" (${email})? Ele perderá todos os acessos imediatamente.`,
    async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "DELETE",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${state.token}`
          }
        });

        if (res.ok) {
          showToast("Acesso do usuário revogado com sucesso.", "success");
          state.users = state.users.filter(u => u.id !== userId);
          renderUsersTable();
        } else {
          throw new Error("Erro ao excluir.");
        }
      } catch (err) {
        console.error("Erro ao remover usuário:", err);
        showToast("Não foi possível remover o acesso.", "error");
      }
    }
  );
}

// Ação de Cadastro de Novo Usuário (Supabase Auth SignUp sem deslogar admin)
async function handleSignUp(e) {
  e.preventDefault();
  
  const name = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const role = document.getElementById("signup-role").value;
  
  const submitBtn = document.getElementById("js-btn-signup");
  submitBtn.disabled = true;
  submitBtn.querySelector("span").textContent = "Cadastrando...";
  
  try {
    // 1. Cadastrar usuário no auth.users do Supabase
    // Fazemos um fetch direto de cadastro que gera a conta, mas sem atualizar nosso sessionToken de admin
    const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    
    const signUpData = await signUpRes.json();
    
    if (!signUpRes.ok) {
      // Caso o usuário já exista na autenticação auth.users
      if (signUpData.message && signUpData.message.includes("already registered")) {
        showToast("Usuário já registrado no Auth. Tentando associar perfil...", "info");
        
        // Chamar o RPC de restauração/criação de perfil para usuários existentes
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_restore_user_profile`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${state.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            user_email: email,
            user_name: name
          })
        });
        
        const rpcData = await rpcRes.json();
        
        if (rpcRes.ok && rpcData === true) {
          // Atualizar o cargo do perfil existente para o cargo selecionado pelo administrador
          // O RPC cria por padrão como 'Regional', então aplicamos a atualização necessária
          const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${email}`, {
            headers: {
              "apikey": SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${state.token}`
            }
          });
          const profilesFound = await usersRes.json();
          if (profilesFound && profilesFound.length > 0) {
            await updateUserRole(profilesFound[0].id, role);
          }
          
          showToast("Perfil de usuário existente ativado com sucesso!", "success");
          document.getElementById("js-signup-form").reset();
          fetchAllData();
          return;
        } else {
          throw new Error("Usuário já existe e não foi possível restaurar seu perfil.");
        }
      }
      throw new Error(signUpData.message || "Falha na criação do usuário.");
    }
    
    // 2. Criar perfil na tabela public.profiles
    const resProfile = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${state.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: signUpData.id,
        email: signUpData.email,
        name: name,
        role: role
      })
    });
    
    if (resProfile.ok) {
      showToast(`Usuário ${name} cadastrado com sucesso!`, "success");
      document.getElementById("js-signup-form").reset();
      
      // Recarregar os perfis
      fetchAllData();
    } else {
      const profileData = await resProfile.json();
      throw new Error(profileData.message || "Erro ao gerar perfil de usuário.");
    }
    
  } catch (err) {
    console.error("Erro no cadastro:", err);
    showToast(err.message || "Erro ao cadastrar usuário.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = "Cadastrar Usuário";
  }
}

// ==========================================
// CONFIGURAÇÕES GLOBAIS (AJUSTES E ALERTAS)
// ==========================================

function populateSettingsForm() {
  const priceInput = document.getElementById("setting-book-price");
  const tokenInput = document.getElementById("setting-melhor-envio-token");
  const emailInput = document.getElementById("setting-admin-email");
  const notifInput = document.getElementById("setting-notifications-enabled");
  
  const weightInput = document.getElementById("setting-book-weight");
  const lengthInput = document.getElementById("setting-book-length");
  const widthInput = document.getElementById("setting-book-width");
  const heightInput = document.getElementById("setting-book-height");
  const cepInput = document.getElementById("setting-origin-cep");
  const sandboxInput = document.getElementById("setting-melhor-envio-sandbox");

  if (priceInput && state.settings.book_price !== undefined) {
    priceInput.value = state.settings.book_price;
  }
  if (tokenInput && state.settings.melhor_envio_token !== undefined) {
    tokenInput.value = state.settings.melhor_envio_token;
  }
  if (emailInput && state.settings.admin_email !== undefined) {
    emailInput.value = state.settings.admin_email;
  }
  if (notifInput && state.settings.notifications_enabled !== undefined) {
    notifInput.checked = state.settings.notifications_enabled === "true";
  }
  
  if (weightInput && state.settings.book_weight !== undefined) weightInput.value = state.settings.book_weight;
  if (lengthInput && state.settings.book_length !== undefined) lengthInput.value = state.settings.book_length;
  if (widthInput && state.settings.book_width !== undefined) widthInput.value = state.settings.book_width;
  if (heightInput && state.settings.book_height !== undefined) heightInput.value = state.settings.book_height;
  if (cepInput && state.settings.melhor_envio_origin_cep !== undefined) cepInput.value = state.settings.melhor_envio_origin_cep;
  if (sandboxInput && state.settings.melhor_envio_sandbox !== undefined) {
    sandboxInput.checked = state.settings.melhor_envio_sandbox === "true";
  }

  const telegramEnabledInput = document.getElementById("setting-telegram-enabled");
  const telegramTokenInput = document.getElementById("setting-telegram-token");
  const telegramChatInput = document.getElementById("setting-telegram-chat");
  const telegramConfigPanel = document.getElementById("telegram-config-panel");

  let tgEnabled = false;
  let tgToken = "";
  let tgChat = "";

  if (telegramEnabledInput && state.settings.telegram_enabled !== undefined) {
    tgEnabled = state.settings.telegram_enabled === "true";
    telegramEnabledInput.checked = tgEnabled;
    if (telegramConfigPanel) telegramConfigPanel.style.display = tgEnabled ? "block" : "none";
  }
  
  if (telegramTokenInput && state.settings.telegram_token !== undefined) {
    tgToken = state.settings.telegram_token;
    telegramTokenInput.value = tgToken;
  }
  
  if (telegramChatInput && state.settings.telegram_chat !== undefined) {
    tgChat = state.settings.telegram_chat;
    telegramChatInput.value = tgChat;
  }

  updateTelegramStatusIndicator(tgEnabled, tgToken, tgChat);
}

// Salva uma única configuração global no Supabase REST
async function saveGlobalSetting(key, value) {
  try {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${state.token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    // Tenta atualizar primeiro (PATCH)
    let res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.${key}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ value, updated_at: new Date().toISOString() })
    });

    if (!res.ok) {
      const errorText = await res.text();
      showToast(`Erro Supabase (PATCH) para ${key}: ${errorText}`, "error");
      throw new Error(`Erro na resposta REST: ${errorText}`);
    }
    
    const data = await res.json();
    
    // Se não atualizou nenhuma linha (array vazio), significa que a chave não existe. Então faz o POST.
    if (!data || data.length === 0) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: "POST",
        headers,
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
      });
      if (!res.ok) {
        const errorText = await res.text();
        showToast(`Erro Supabase (POST) para ${key}: ${errorText}`, "error");
        throw new Error(`Erro na resposta REST: ${errorText}`);
      }
    }
    
    // Atualizar no estado local
    state.settings[key] = value;
    return true;
  } catch (err) {
    console.error(`Erro ao salvar configuração ${key}:`, err);
    return false;
  }
}

// Handler de envio dos Parâmetros de Venda
async function handleSaveGlobalSettings(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("js-btn-save-settings");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Salvando...";
  }

  const bookPrice = document.getElementById("setting-book-price").value.trim();
  const meToken = document.getElementById("setting-melhor-envio-token").value.trim();
  const bookWeight = document.getElementById("setting-book-weight").value.trim();
  const bookLength = document.getElementById("setting-book-length").value.trim();
  const bookWidth = document.getElementById("setting-book-width").value.trim();
  const bookHeight = document.getElementById("setting-book-height").value.trim();
  const originCep = document.getElementById("setting-origin-cep").value.trim();
  const sandboxEnabled = document.getElementById("setting-melhor-envio-sandbox").checked ? "true" : "false";

  try {
    // Salvar todas as configurações em paralelo
    const results = await Promise.all([
      saveGlobalSetting("book_price", bookPrice),
      saveGlobalSetting("melhor_envio_token", meToken),
      saveGlobalSetting("book_weight", bookWeight),
      saveGlobalSetting("book_length", bookLength),
      saveGlobalSetting("book_width", bookWidth),
      saveGlobalSetting("book_height", bookHeight),
      saveGlobalSetting("melhor_envio_origin_cep", originCep),
      saveGlobalSetting("melhor_envio_sandbox", sandboxEnabled)
    ]);

    if (results.every(res => res === true)) {
      showToast("Parâmetros de venda salvos com sucesso!", "success");
    } else {
      showToast("Alguns parâmetros não puderam ser salvos.", "error");
    }
  } catch (err) {
    console.error("Erro ao salvar parâmetros globais:", err);
    showToast("Erro ao tentar salvar configurações.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = "Salvar Parâmetros";
    }
  }
}

// Handler de envio dos Parâmetros de Notificação e Alerta com suporte a múltiplos e-mails
async function handleSaveNotificationSettings(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById("js-btn-save-notif-settings");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Salvando...";
  }

  const adminEmailRaw = document.getElementById("setting-admin-email").value.trim();
  const notificationsEnabled = document.getElementById("setting-notifications-enabled").checked ? "true" : "false";

  // Validar se todos os e-mails inseridos são válidos
  const emailList = adminEmailRaw.split(",").map(email => email.trim()).filter(email => email.length > 0);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const allValid = emailList.every(email => emailRegex.test(email));

  if (emailList.length === 0 || !allValid) {
    showToast("Por favor, insira apenas e-mails válidos separados por vírgula.", "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = "Salvar Parâmetros de Alerta";
    }
    return;
  }

  try {
    const cleanAdminEmailList = emailList.join(", ");
    
    const telegramEnabled = document.getElementById("setting-telegram-enabled").checked ? "true" : "false";
    const telegramToken = document.getElementById("setting-telegram-token").value.trim();
    const telegramChat = document.getElementById("setting-telegram-chat").value.trim();

    const [emailOk, notifOk, tgEnabledOk, tgTokenOk, tgChatOk] = await Promise.all([
      saveGlobalSetting("admin_email", cleanAdminEmailList),
      saveGlobalSetting("notifications_enabled", notificationsEnabled),
      saveGlobalSetting("telegram_enabled", telegramEnabled),
      saveGlobalSetting("telegram_token", telegramToken),
      saveGlobalSetting("telegram_chat", telegramChat)
    ]);

    if (emailOk && notifOk && tgEnabledOk) {
      showToast("Configurações de alerta salvas com sucesso!", "success");
      // Atualizar o input com a lista limpa e formatada
      document.getElementById("setting-admin-email").value = cleanAdminEmailList;
      updateTelegramStatusIndicator(telegramEnabled === "true", telegramToken, telegramChat);
    } else {
      showToast("Alguns parâmetros de alerta não foram salvos.", "error");
    }
  } catch (err) {
    console.error("Erro ao salvar alertas:", err);
    showToast("Erro ao tentar salvar configurações.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = "Salvar Parâmetros de Alerta";
    }
  }
}

// Atualiza a bolinha de status do Telegram
function updateTelegramStatusIndicator(isEnabled, token, chat) {
  const indicator = document.getElementById("telegram-status-indicator");
  if (!indicator) return;

  if (!isEnabled) {
    indicator.style.backgroundColor = "var(--text-muted)";
    indicator.title = "Desativado";
  } else if (!token || !chat) {
    indicator.style.backgroundColor = "var(--accent-red)";
    indicator.title = "Ativado, mas faltando configurações";
  } else {
    indicator.style.backgroundColor = "var(--accent-green)";
    indicator.title = "Ativado e Configurado";
  }
}

// Testa a conexão do Telegram disparando uma requisição direto pra API deles
async function handleTestTelegramConnection() {
  const token = document.getElementById("setting-telegram-token").value.trim();
  const chat = document.getElementById("setting-telegram-chat").value.trim();
  const resultSpan = document.getElementById("telegram-test-result");

  if (!token || !chat) {
    resultSpan.textContent = "Preencha Token e Chat ID!";
    resultSpan.style.color = "var(--accent-red)";
    return;
  }

  resultSpan.textContent = "Enviando...";
  resultSpan.style.color = "var(--text-muted)";

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: "✅ *Sucesso!* A integração com o Telegram na Dashboard do Corações Puros está funcionando perfeitamente.",
        parse_mode: "Markdown"
      })
    });

    const data = await res.json();
    if (data.ok) {
      resultSpan.textContent = "Sucesso! Cheque seu celular.";
      resultSpan.style.color = "var(--accent-green)";
    } else {
      console.error(data);
      resultSpan.textContent = "Erro: Verifique os dados.";
      resultSpan.style.color = "var(--accent-red)";
    }
  } catch (err) {
    console.error(err);
    resultSpan.textContent = "Erro de conexão!";
    resultSpan.style.color = "var(--accent-red)";
  }
}

// Disparo Manual do Relatório Diário Consolidado
async function handleTriggerDailyReportManual() {
  const triggerBtn = document.getElementById("js-btn-trigger-report");
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.querySelector("span").textContent = "Enviando Relatório...";
  }

  try {
    const requesterEmail = state.user?.email || "";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-webhook-secret": "CoracoesPurosSecretWebhook2026Token!!"
      },
      body: JSON.stringify({
        action: "send_daily_report",
        requester_email: requesterEmail
      })
    });

    if (res.ok) {
      showToast("Relatório diário enviado com sucesso para todos os gestores cadastrados!", "success");
    } else {
      const data = await res.json();
      throw new Error(data.error || "Erro ao disparar relatório na nuvem.");
    }
  } catch (err) {
    console.error("Erro ao disparar relatório consolidado:", err);
    showToast(err.message || "Erro ao tentar disparar relatório consolidado.", "error");
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.querySelector("span").textContent = "✉️ Testar/Enviar Relatório Diário Agora";
    }
  }
}

// ==========================================
// ORDER DETAILS MODAL
// ==========================================
window.openOrderModal = function(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById("js-order-modal");
  const content = document.getElementById("js-order-modal-content");

  const dateStr = new Date(order.created_at).toLocaleString('pt-BR');
  const statusLabels = { pending: 'Pendente', paid: 'Pago', shipped: 'Enviado', cancelled: 'Cancelado' };

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <strong style="color: var(--text-main);">Nome do Cliente:</strong><br>
        ${escapeHTML(order.name || "N/A")}
      </div>
      <div>
        <strong style="color: var(--text-main);">E-mail:</strong><br>
        ${escapeHTML(order.email || "N/A")}
      </div>
      <div>
        <strong style="color: var(--text-main);">Telefone (WhatsApp):</strong><br>
        ${escapeHTML(order.phone || "N/A")}
      </div>
      <div>
        <strong style="color: var(--text-main);">Data do Pedido:</strong><br>
        ${dateStr}
      </div>
      <div>
        <strong style="color: var(--text-main);">CPF do Comprador:</strong><br>
        ${escapeHTML(order.buyer_cpf || "Não Informado")}
      </div>
      <div>
        <strong style="color: var(--text-main);">Status:</strong><br>
        ${statusLabels[order.status] || order.status}
      </div>
    </div>
    
    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 20px 0;">
    
    <h4 style="color: var(--text-main); margin-bottom: 12px;">Endereço de Entrega</h4>
    <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
      <div><strong>CEP:</strong> ${escapeHTML(order.address_cep || "N/A")}</div>
      <div><strong>Rua:</strong> ${escapeHTML(order.address_street || "N/A")}, ${escapeHTML(order.address_number || "S/N")}</div>
      <div><strong>Complemento:</strong> ${escapeHTML(order.address_complement || "Nenhum")}</div>
      <div><strong>Bairro:</strong> ${escapeHTML(order.address_district || "N/A")}</div>
      <div><strong>Cidade/UF:</strong> ${escapeHTML(order.address_city || "N/A")} / ${escapeHTML(order.address_state || "N/A")}</div>
    </div>
    
    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 20px 0;">
    
    <h4 style="color: var(--text-main); margin-bottom: 12px;">Informações de Pagamento e Logística</h4>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <strong style="color: var(--text-main);">ID Pagamento MP:</strong><br>
        ${escapeHTML(order.mercado_pago_payment_id || "N/A")}
      </div>
      <div>
        <strong style="color: var(--text-main);">Código de Rastreio:</strong><br>
        ${escapeHTML(order.melhor_envio_tracking || "N/A")}
      </div>
    </div>
    
    <div style="margin-top: 20px; display: flex; justify-content: flex-start;">
      <button class="btn btn-blue" style="width: auto; height: 38px; padding: 0 16px; font-size: 13px; display: flex; align-items: center; gap: 8px;" type="button" onclick="openAgenciesModal('${order.shipping_company || 'Correios'}')">
        📍 Localizar Ponto de Postagem
      </button>
    </div>
  `;

  modal.style.display = "flex";
};

window.closeOrderModal = function() {
  document.getElementById("js-order-modal").style.display = "none";
};

// ==========================================
// AGENCIES MAP MODAL (PONTOS DE POSTAGEM)
// ==========================================
window.openAgenciesModal = function(shippingCompany) {
  const modal = document.getElementById("js-agencies-modal");
  const cepInput = document.getElementById("agency-cep");
  const companySelect = document.getElementById("agency-company");
  const resultsDiv = document.getElementById("js-agencies-results");
  
  // Limpar resultados anteriores
  resultsDiv.innerHTML = "";
  
  // Preencher CEP de origem caso exista
  if (state.settings && state.settings.melhor_envio_origin_cep) {
    cepInput.value = state.settings.melhor_envio_origin_cep;
  }
  
  // Preencher a transportadora se possível
  if (shippingCompany) {
    const compLower = shippingCompany.toLowerCase();
    if (compLower.includes('jadlog')) {
      companySelect.value = "2";
    } else {
      companySelect.value = "1"; // Default Correios
    }
  }

  modal.style.display = "flex";
};

window.closeAgenciesModal = function() {
  document.getElementById("js-agencies-modal").style.display = "none";
};

document.addEventListener("DOMContentLoaded", () => {
  const agenciesForm = document.getElementById("js-agencies-form");
  if (agenciesForm) {
    agenciesForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const cep = document.getElementById("agency-cep").value.trim();
      const company = document.getElementById("agency-company").value;
      const resultsDiv = document.getElementById("js-agencies-results");
      const btn = document.getElementById("js-btn-search-agencies");
      const btnSpan = btn.querySelector("span");
      
      if (!cep) {
        showToast("Por favor, preencha o CEP.", "error");
        return;
      }
      
      btn.disabled = true;
      btnSpan.textContent = "Buscando...";
      resultsDiv.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Buscando agências na região...</p>";
      
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/melhor-envio/agencies?company=${company}&postal_code=${cep}`, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Erro ao buscar agências.");
        }
        
        const data = await res.json();
        const agencies = data.agencies || [];
        
        if (agencies.length === 0) {
          resultsDiv.innerHTML = "<p style='color: var(--accent-orange); font-size: 14px;'>Nenhuma agência encontrada para este CEP e transportadora.</p>";
          return;
        }
        
        // Renderizar lista
        resultsDiv.innerHTML = agencies.slice(0, 5).map(agency => {
          const name = escapeHTML(agency.name || "Agência");
          const address = agency.address || {};
          const label = escapeHTML(address.label || "Endereço não disponível");
          const number = escapeHTML(address.number || "S/N");
          const district = escapeHTML(address.district || "");
          const city = escapeHTML(address.city || "");
          
          return `
            <div style="background: var(--bg-sidebar); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 16px;">
              <strong style="color: var(--text-main); font-size: 15px; display: block; margin-bottom: 4px;">${name}</strong>
              <span style="color: var(--text-muted); font-size: 13px;">${label}, ${number} ${district ? ' - ' + district : ''}</span><br>
              <span style="color: var(--text-muted); font-size: 13px;">${city}</span>
            </div>
          `;
        }).join("");
        
      } catch (error) {
        console.error("Erro na busca de agências:", error);
        resultsDiv.innerHTML = `<p style='color: var(--accent-red); font-size: 14px;'>Erro: ${escapeHTML(error.message)}</p>`;
        showToast("Erro ao buscar agências.", "error");
      } finally {
        btn.disabled = false;
        btnSpan.textContent = "Buscar Agências";
      }
    });
  }
});
