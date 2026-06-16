const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");

const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  header.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    nav.classList.remove("is-open");
    header.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// ==========================================
// CONFIGURAÇÕES SUPABASE
// ==========================================
const SUPABASE_URL = "https://lmdawrnbnnrnmxbrmgak.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZGF3cm5ibm5ybm14YnJtZ2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwODc4NDIsImV4cCI6MjA5NDY2Mzg0Mn0.tPPjz7YGWL3u8UHtMG65_p3KtoH6ZiiNdzUxfOXkjbs";

// ==========================================
// CONTROLE DO QUIZ & PERSISTÊNCIA
// ==========================================
const quizQuestions = [
  {
    question: "Quando falamos em proteção da infância, qual atitude deve vir primeiro?",
    options: [
      "Informar, prevenir e fortalecer ambientes seguros",
      "Esperar que a criança peça ajuda sozinha",
      "Tratar o assunto apenas quando houver uma denúncia formal",
      "Evitar conversar sobre o tema para não assustar as famílias"
    ],
    answer: 0,
    feedback: "A prevenção começa com informação, diálogo responsável e ambientes atentos aos sinais de risco."
  },
  {
    question: "Se uma criança relata uma situação de violência, qual é a postura mais adequada?",
    options: [
      "Questionar repetidamente para verificar se ela muda a história",
      "Escutar com calma, acolher e acionar a rede de proteção",
      "Pedir segredo para proteger a família",
      "Resolver tudo sem envolver órgãos competentes"
    ],
    answer: 1,
    feedback: "Escuta, acolhimento e encaminhamento responsável ajudam a proteger a criança e evitam revitimização."
  },
  {
    question: "Segundo a proposta do livro, quem deve participar da rede de proteção?",
    options: [
      "Somente o poder público",
      "Apenas pais e responsáveis",
      "Famílias, escolas, igrejas, comunidades e gestores públicos",
      "Somente profissionais da saúde"
    ],
    answer: 2,
    feedback: "A proteção é coletiva. Quanto mais preparada estiver a rede, maior a capacidade de prevenir e agir."
  },
  {
    question: "Qual campanha reforça a conscientização contra o abuso e a exploração sexual de crianças e adolescentes?",
    options: [
      "Maio Laranja",
      "Setembro Amarelo",
      "Novembro Azul",
      "Outubro Rosa"
    ],
    answer: 0,
    feedback: "O Maio Laranja mobiliza a sociedade para prevenção, orientação e enfrentamento dessa violência."
  },
  {
    question: "No contexto do livro, o que significa romper o silêncio?",
    options: [
      "Expor vítimas publicamente",
      "Falar do tema com responsabilidade, denunciar e buscar ajuda",
      "Transformar o assunto em debate partidário",
      "Substituir acolhimento por punição imediata sem apuração"
    ],
    answer: 1,
    feedback: "Romper o silêncio é agir com responsabilidade: informar, acolher, denunciar e proteger."
  },
  {
    question: "Qual destas iniciativas citadas fortalece a proteção também no ambiente digital?",
    options: [
      "Creche Saudável",
      "Entrega Legal",
      "Proteção Digital",
      "Prefácio"
    ],
    answer: 2,
    feedback: "Proteção Digital busca reduzir a exposição de crianças e adolescentes a conteúdos impróprios nas plataformas."
  }
];

const quiz = document.querySelector("[data-quiz]");

if (quiz) {
  const stepElement = quiz.querySelector("[data-quiz-step]");
  const scoreElement = quiz.querySelector("[data-quiz-score]");
  const barElement = quiz.querySelector("[data-quiz-bar]");
  const questionElement = quiz.querySelector("[data-quiz-question]");
  const optionsElement = quiz.querySelector("[data-quiz-options]");
  const feedbackElement = quiz.querySelector("[data-quiz-feedback]");
  const nextButton = quiz.querySelector("[data-quiz-next]");
  const restartButton = quiz.querySelector("[data-quiz-restart]");

  let currentQuestion = 0;
  let score = 0;
  let answered = false;
  let userAnswers = []; // Rastreia as escolhas para persistência

  const renderQuestion = () => {
    const item = quizQuestions[currentQuestion];
    answered = false;
    stepElement.textContent = `Pergunta ${currentQuestion + 1} de ${quizQuestions.length}`;
    scoreElement.textContent = `${score} ${score === 1 ? "acerto" : "acertos"}`;
    barElement.style.width = `${(currentQuestion / quizQuestions.length) * 100}%`;
    questionElement.textContent = item.question;
    feedbackElement.textContent = "";
    nextButton.textContent = currentQuestion === quizQuestions.length - 1 ? "Ver resultado" : "Próxima";
    nextButton.disabled = true;
    optionsElement.innerHTML = "";

    item.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "quiz-option";
      button.type = "button";
      button.textContent = option;
      button.addEventListener("click", () => selectAnswer(index));
      optionsElement.append(button);
    });
  };

  const selectAnswer = (selectedIndex) => {
    if (answered) return;

    const item = quizQuestions[currentQuestion];
    const optionButtons = [...optionsElement.querySelectorAll(".quiz-option")];
    const isCorrect = selectedIndex === item.answer;
    answered = true;

    if (isCorrect) score += 1;

    // Rastreia a escolha
    userAnswers.push({
      question: item.question,
      selected: item.options[selectedIndex],
      correct: item.options[item.answer],
      isCorrect: isCorrect
    });

    optionButtons.forEach((button, index) => {
      button.disabled = true;
      if (index === item.answer) button.classList.add("is-correct");
      if (index === selectedIndex && !isCorrect) button.classList.add("is-wrong");
    });

    feedbackElement.innerHTML = `<strong>${isCorrect ? "Correto." : "Atenção."}</strong> ${item.feedback}`;
    scoreElement.textContent = `${score} ${score === 1 ? "acerto" : "acertos"}`;
    nextButton.disabled = false;
  };

  const renderResult = () => {
    barElement.style.width = "100%";
    stepElement.textContent = "Resultado";
    scoreElement.textContent = `${score} de ${quizQuestions.length} acertos`;
    questionElement.textContent =
      score >= 5
        ? "Você está no caminho da prevenção."
        : "Informação é o primeiro passo para proteger.";
    optionsElement.innerHTML = "";
    feedbackElement.textContent =
      "Continue aprendendo, compartilhe informação com responsabilidade e conheça a obra Corações Puros para aprofundar esse compromisso.";
    nextButton.textContent = "Conhecer o livro";
    nextButton.disabled = false;

    // Salva as respostas no Supabase
    saveQuizResponse(score, userAnswers);
  };

  const saveQuizResponse = async (finalScore, answers) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/quiz_responses`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          score: finalScore,
          total_questions: quizQuestions.length,
          answers: answers
        })
      });
    } catch (err) {
      console.error("Erro ao salvar respostas do quiz:", err);
    }
  };

  nextButton.addEventListener("click", () => {
    if (currentQuestion >= quizQuestions.length) {
      document.querySelector("#comprar").scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (currentQuestion === quizQuestions.length - 1) {
      currentQuestion += 1;
      renderResult();
      return;
    }

    currentQuestion += 1;
    renderQuestion();
  });

  restartButton.addEventListener("click", () => {
    currentQuestion = 0;
    score = 0;
    userAnswers = [];
    renderQuestion();
  });

  renderQuestion();
}

// ==========================================
// CONTROLE DO MODAL DE COMPRA (LEAD CAPTURE)
// ==========================================
const buyModal = document.getElementById("js-buy-modal");
const buyTriggers = document.querySelectorAll("[data-buy-trigger]");
const modalClose = document.getElementById("js-modal-close");
const leadForm = document.getElementById("js-lead-form");
const leadFeedback = document.getElementById("js-lead-feedback");
const modalBodyForm = document.getElementById("js-modal-body-form");
const modalBodySuccess = document.getElementById("js-modal-body-success");

const openModal = (e) => {
  if (e) e.preventDefault();
  buyModal.classList.add("is-active");
  buyModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden"; // Desativa scroll da página de fundo
};

const closeModal = () => {
  buyModal.classList.remove("is-active");
  buyModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = ""; // Reativa scroll
  // Reseta estado do formulário após fechamento da animação
  setTimeout(() => {
    leadForm.reset();
    leadFeedback.textContent = "";
    leadFeedback.className = "form-feedback";
    modalBodyForm.style.display = "block";
    modalBodySuccess.style.display = "none";
  }, 300);
};

// Modal Vanilla desativado. O React (main.jsx) agora escuta os cliques nestes botões.
// buyTriggers.forEach(trigger => trigger.addEventListener("click", openModal));
modalClose.addEventListener("click", closeModal);
buyModal.addEventListener("click", (e) => {
  if (e.target === buyModal) closeModal();
});

// Envio do formulário de Pedido para o Supabase
if (leadForm) {
  leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(leadForm);
    const name = formData.get("name");
    const email = formData.get("email");
    const phone = formData.get("phone");

    leadFeedback.textContent = "Processando seu pedido...";
    leadFeedback.className = "form-feedback";

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ name, email, phone, status: 'pending' })
      });

      if (response.ok) {
        modalBodyForm.style.display = "none";
        modalBodySuccess.style.display = "block";
      } else {
        const err = await response.json();
        throw new Error(err.message || "Erro de validação no servidor");
      }
    } catch (error) {
      console.error("Erro ao registrar pedido:", error);
      leadFeedback.textContent = "Ops! Ocorreu um erro ao salvar o pedido. Tente novamente.";
      leadFeedback.className = "form-feedback is-error";
    }
  });
}

// ==========================================
// FORMULÁRIO DE CONTATO (MENSAGENS)
// ==========================================
const contactForm = document.getElementById("js-contact-form");
const contactFeedback = document.getElementById("js-contact-feedback");

if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(contactForm);
    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");

    contactFeedback.textContent = "Enviando mensagem...";
    contactFeedback.className = "form-feedback";

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ name, email, message })
      });

      if (response.ok) {
        contactFeedback.textContent = "Mensagem enviada com sucesso! Entraremos em contato.";
        contactFeedback.className = "form-feedback is-success";
        contactForm.reset();
      } else {
        throw new Error("Falha ao salvar contato.");
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem de suporte:", error);
      contactFeedback.textContent = "Não foi possível enviar sua mensagem. Tente novamente.";
      contactFeedback.className = "form-feedback is-error";
    }
  });
}
