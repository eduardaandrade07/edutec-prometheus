import { DIALOGUES } from "../data.js?v=3.0.1";
import { outcomeLabel, outcomeScore, projectDay } from "../epidemic.js?v=3.0.1";
import { closePanel, metricSnapshot, openPanel, setFeedback, unlockEntries } from "./helpers.js?v=3.0.1";

const ALLOCATIONS = {
  central: { label: "Priorizar Região Central", short: "CENTRAL", effects: { vaccination: 18, contagion: -4, resources: -18 }, note: "Mais pessoas recebem a primeira dose, mas a cadeia mais rápida permanece menos coberta." },
  north: { label: "Priorizar Região Norte", short: "NORTE", effects: { vaccination: 22, contagion: -12, resources: -18 }, note: "Menos pessoas recebem doses, porém a cadeia de maior velocidade é atingida primeiro." },
  split: { label: "Distribuição proporcional", short: "DIVISÃO", effects: { vaccination: 20, contagion: -8, resources: -22 }, note: "As duas regiões recebem doses, mas nenhuma alcança cobertura tão concentrada nesta fase." },
};

const COMMUNICATION = {
  now: { label: "Publicar dados e incertezas agora", effects: { contagion: -4, resources: -4, knowledge: 2 }, note: "A população recebe contexto cedo; a equipe precisa corrigir informações conforme novas evidências chegam." },
  verify: { label: "Aguardar validação independente", effects: { day: 1, knowledge: 5, cases: 3 }, note: "O relatório ganha robustez, mas a informação pública chega um dia depois." },
};

export async function run({ state, ui }) {
  await ui.playDialogue(DIALOGUES.finale);
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell finale-activity">
      <header><p class="eyebrow eyebrow--amber">COMITÊ PROMETHEUS · DECISÃO FINAL</p><h2>Não existe escolha sem consequência</h2><p class="lead">Há 30 mil doses para a primeira fase. Compare tamanho populacional, velocidade de transmissão e capacidade de resposta.</p></header>
      <div id="final-metrics">${metricSnapshot(state.metrics())}</div>
      <div id="allocation-step">
        <p class="section-label">01 · ALOCAÇÃO DA PRIMEIRA FASE</p>
        <div class="region-comparison">
          <article><span>REGIÃO A</span><h3>CENTRAL</h3><dl><div><dt>POPULAÇÃO</dt><dd>100.000</dd></div><div><dt>TRANSMISSÃO</dt><dd>18%</dd></div><div><dt>CAPACIDADE LOCAL</dt><dd>ALTA</dd></div></dl></article>
          <article class="is-alert"><span>REGIÃO B</span><h3>NORTE</h3><dl><div><dt>POPULAÇÃO</dt><dd>30.000</dd></div><div><dt>TRANSMISSÃO</dt><dd>46%</dd></div><div><dt>CAPACIDADE LOCAL</dt><dd>LIMITADA</dd></div></dl></article>
        </div>
        <div class="allocation-options">
          ${Object.entries(ALLOCATIONS).map(([id, item]) => `<button data-allocation="${id}"><strong>${item.label}</strong><small>${item.note}</small></button>`).join("")}
        </div>
      </div>
      <div id="communication-step" hidden>
        <div class="recovered-log"><span>ARQUIVO RECUPERADO · 48H ANTES</span><strong>Um alerta de baixa confiança foi retido pelo sistema automático para evitar um falso alarme.</strong><p>O registro não prova intenção, mas mostra como regras institucionais também afetam a velocidade da ciência.</p></div>
        <p class="section-label">02 · COMUNICAÇÃO DO RELATÓRIO</p>
        <div class="communication-options">
          ${Object.entries(COMMUNICATION).map(([id, item]) => `<button data-communication="${id}"><strong>${item.label}</strong><small>${item.note}</small></button>`).join("")}
        </div>
      </div>
      <div data-feedback class="activity-feedback">A melhor justificativa considera mais de um indicador e reconhece incertezas.</div>
      <div class="panel-actions"><button id="finalize-protocol" class="button button--primary" hidden>CONFIRMAR PROTOCOLO</button></div>
    </section>`);

  return new Promise((resolve) => {
    let allocation = null;
    let communication = null;
    root.querySelectorAll("[data-allocation]").forEach((button) => {
      button.addEventListener("click", () => {
        allocation = button.dataset.allocation;
        root.querySelectorAll("[data-allocation]").forEach((item) => item.classList.toggle("is-selected", item === button));
        root.querySelector("#communication-step").hidden = false;
        setFeedback(root, `${ALLOCATIONS[allocation].short}: estratégia registrada. Agora decida como comunicar o que aconteceu.`, "success");
        ui.audio.beep("confirm");
      });
    });

    root.querySelectorAll("[data-communication]").forEach((button) => {
      button.addEventListener("click", () => {
        communication = button.dataset.communication;
        root.querySelectorAll("[data-communication]").forEach((item) => item.classList.toggle("is-selected", item === button));
        root.querySelector("#finalize-protocol").hidden = false;
        setFeedback(root, "As duas decisões estão prontas. O relatório mostrará seus efeitos combinados.", "success");
        ui.audio.beep("unlock");
      });
    });

    root.querySelector("#finalize-protocol").addEventListener("click", () => {
      if (!allocation || !communication) return;
      const allocationData = ALLOCATIONS[allocation];
      const communicationData = COMMUNICATION[communication];
      const combined = { day: 1, cases: 0, deaths: 0 };
      [allocationData.effects, communicationData.effects].forEach((effects) => {
        Object.entries(effects).forEach(([key, value]) => { combined[key] = (combined[key] || 0) + value; });
      });
      const projectedMetrics = { ...state.metrics() };
      Object.entries(combined).forEach(([key, value]) => {
        if (key in projectedMetrics) projectedMetrics[key] += value;
      });
      const projection = projectDay(projectedMetrics);
      combined.cases += projection.newCases;
      combined.deaths += projection.deaths;
      state.adjust(combined);
      state.recordDecision("vaccine-allocation", allocation, allocationData.label, allocationData.effects);
      state.recordDecision("public-communication", communication, communicationData.label, communicationData.effects);
      state.addEvidence(2);
      state.log("protocol_finalized", { allocation, communication });
      unlockEntries(state, ui, ["scienceSociety", "biotechnology", "evidenceDecisions"]);
      const score = outcomeScore(state);
      const outcome = outcomeLabel(score);
      state.recordDecision("outcome", outcome.level, outcome.title, { score });
      state.finish();
      closePanel(ui);
      resolve({ score, outcome });
    }, { once: true });
  });
}
