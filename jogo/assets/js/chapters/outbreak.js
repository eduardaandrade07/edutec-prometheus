import { DIALOGUES } from "../data.js?v=3.0.1";
import { closePanel, openPanel, setFeedback, unlockEntries } from "./helpers.js?v=3.0.1";

const DIRECT_CONTACTS = new Set(["C-12", "C-22", "C-31", "C-40"]);

export async function run({ state, ui, world }) {
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell outbreak-activity">
      <header><p class="eyebrow eyebrow--amber">MAPA EPIDEMIOLÓGICO · DIA ${String(state.day).padStart(2, "0")}</p><h2>Encontre a cadeia invisível</h2><p class="lead">Os três casos iniciais estão em vermelho. Selecione os contatos diretamente ligados a eles para priorizar acompanhamento.</p></header>
      <div class="contact-layout">
        <div class="contact-network" aria-label="Rede simplificada de contatos">
          <svg viewBox="0 0 100 100" role="img" aria-label="Linhas conectando casos iniciais e contatos">
            <line x1="17" y1="45" x2="31" y2="27" class="risk-edge"/><line x1="17" y1="45" x2="48" y2="52" class="risk-edge"/>
            <line x1="48" y1="20" x2="68" y2="32" class="risk-edge"/><line x1="80" y1="50" x2="72" y2="72" class="risk-edge"/>
            <line x1="31" y1="27" x2="35" y2="78"/><line x1="68" y1="32" x2="58" y2="82"/>
          </svg>
          <span class="network-zone">SETOR AURORA</span>
          <button class="network-node is-case" style="--x:17%;--y:45%" disabled><b>P-071</b><small>CASO</small></button>
          <button class="network-node is-case" style="--x:48%;--y:20%" disabled><b>P-084</b><small>CASO</small></button>
          <button class="network-node is-case" style="--x:80%;--y:50%" disabled><b>P-109</b><small>CASO</small></button>
          <button class="network-node" style="--x:31%;--y:27%" data-contact="C-12"><b>C-12</b><small>CONTATO</small></button>
          <button class="network-node" style="--x:48%;--y:52%" data-contact="C-22"><b>C-22</b><small>CONTATO</small></button>
          <button class="network-node" style="--x:68%;--y:32%" data-contact="C-31"><b>C-31</b><small>CONTATO</small></button>
          <button class="network-node" style="--x:72%;--y:72%" data-contact="C-40"><b>C-40</b><small>CONTATO</small></button>
          <button class="network-node is-secondary" style="--x:35%;--y:78%" data-contact="C-18"><b>C-18</b><small>2º NÍVEL</small></button>
          <button class="network-node is-secondary" style="--x:58%;--y:82%" data-contact="C-29"><b>C-29</b><small>2º NÍVEL</small></button>
        </div>
        <aside class="trace-queue"><small>FILA PRIORITÁRIA</small><strong id="trace-count">0 / 4</strong><div id="trace-list"><p>Nenhum contato selecionado.</p></div><span>CAPACIDADE DA EQUIPE: 4</span></aside>
      </div>
      <div data-feedback class="activity-feedback">Linhas destacadas representam vínculos diretos já confirmados pelos relatos.</div>
      <div class="panel-actions"><button id="register-trace" class="button button--primary" disabled>REGISTRAR RASTREAMENTO</button></div>
      <p class="concept-note">Rede fictícia e simplificada: rastreamento real exige consentimento, sigilo, confirmação e equipes treinadas.</p>
    </section>`);

  return new Promise((resolve) => {
    const traced = new Set();
    const updateQueue = () => {
      root.querySelector("#trace-count").textContent = `${traced.size} / 4`;
      root.querySelector("#trace-list").innerHTML = traced.size
        ? [...traced].map((id) => `<span>${id}<b>VÍNCULO DIRETO</b></span>`).join("")
        : "<p>Nenhum contato selecionado.</p>";
      root.querySelector("#register-trace").disabled = traced.size !== 4;
    };

    root.querySelectorAll("[data-contact]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.contact;
        if (!DIRECT_CONTACTS.has(id)) {
          button.classList.add("is-rejected");
          setFeedback(root, `${id} aparece em um segundo nível. Com a capacidade atual, priorize primeiro quem teve vínculo direto com um caso.`, "warning");
          ui.audio.beep("error");
          return;
        }
        traced.add(id);
        button.classList.add("is-traced");
        button.disabled = true;
        updateQueue();
        setFeedback(root, `${id} adicionado à fila de acompanhamento.`, "success");
        ui.audio.beep("confirm");
      });
    });

    root.querySelector("#register-trace").addEventListener("click", async () => {
      state.setFlag("outbreakMapped");
      state.addEvidence(3);
      state.adjust({ day: 1, resources: -8, knowledge: 10, cases: 6, contagion: 2 });
      state.log("contacts_traced", { contacts: [...traced] });
      world.markComplete("outbreak-map-screen");
      unlockEntries(state, ui, ["epidemiology", "transmission", "contactTracing"]);
      closePanel(ui);
      await ui.playDialogue(DIALOGUES.outbreakReady);
      resolve();
    }, { once: true });
  });
}
