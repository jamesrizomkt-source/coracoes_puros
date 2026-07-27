# Regras de Layout e Estilo do Projeto "Corações Puros"

**ATENÇÃO AGENTES:** O arquivo `styles.css` sofreu múltiplas regressões de código recentemente devido a resoluções incorretas de conflitos de merge (merge conflicts). Sob nenhuma hipótese os valores abaixo devem ser sobrescritos por valores antigos.

## 1. Hero Shapes (Bolhas decorativas)
A seção `.hero` possui elementos absolutos que interferem no `.site-header` se posicionados incorretamente.
- **`z-index`**: O `.hero-shape` DEVE ter `z-index: 0;`. O `.hero-content` e `.hero-book` DEVEM ter `z-index: 2;` para garantir legibilidade dos textos acima das bolhas.
- **`.hero-shape-one`**: DEVE ter no mínimo `top: 120px;` (ou um valor que o mantenha fisicamente abaixo dos links de navegação do menu, para que sua cor laranja sólida não sobreponha e esconda o menu azul quando a página não está scrollada). Valores como `top: 50px` ou `top: -120px` estão **PROIBIDOS** pois causam quebra visual.

## 2. Imagens
- **Distorção do Livro**: A tag global `img { max-width: 100%; height: auto; }` DEVE SEMPRE manter `height: auto;`. A remoção desta regra causa um esmagamento vertical severo no mock up do livro (`.hero-book`), visto que o HTML dita `height="1679"`. Jamais remova `height: auto;` do reset padrão do `img`.

## 3. Altura do Hero e Espaçamentos
- A classe `.hero` usa `min-height: 75svh;` (e não `92svh`) para evitar excesso de espaço em branco (whitespace) nas telas grandes acima e abaixo do conteúdo. Se necessitar ajustar grid gaps ou paddings, mantenha a coesão compacta e equilibrada da dobra principal.

*Por favor, leia esta regra e aplique imediatamente o julgamento visual crítico ao alterar qualquer classe no hero section.*

## 4. Regra Absoluta: Commits e GitHub
- **AUTORIZAÇÃO EXPLÍCITA:** NUNCA execute `git push` ou `git commit` sem a autorização prévia e explícita do usuário. Esta é uma regra rígida. Qualquer alteração no código deve ser apresentada ao usuário primeiro. Somente após a aprovação clara do usuário, você poderá "subir para o github".
