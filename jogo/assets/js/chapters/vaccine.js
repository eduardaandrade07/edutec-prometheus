import { DIALOGUES } from "../data.js?v=3.0.1";
import { closePanel, metricSnapshot, openPanel, setFeedback, unlockEntries, wait } from "./helpers.js?v=3.0.1";

const STAGES = [
  { id: "target", title: "ALVO", cost: 8, days: 1, effects: { knowledge: 5 }, note: "Confirmar que a região escolhida permanece reconhecível." },
  { id: "development", title: "DESENVOLVIMENTO", cost: 12, days: 3, effects: { knowledge: 8 }, note: "Criar uma candidata capaz de apresentar o alvo ao sistema imune." },
  { id: "tests", title: "TESTES", cost: 14, days: 5, effects: { knowledge: 10 }, note: "Avaliar segurança, resposta e qualidade antes do uso amplo." },
  { id: "production", title: "PRODUÇÃO", cost: 16, days: 4, effects: { knowledge: 3 }, note: "Produzir lotes com consistência e controle de qualidade." },
  { id: "distribution", title: "DISTRIBUIÇÃO", cost: 12, days: 2, effects: { vaccination: 38, contagion: -8 }, note: "Fazer as doses chegarem aos pontos de vacinação." },
];

export async function run({ state, ui, world }) {
  await ui.playDialogue(DIALOGUES.vaccineReady);
  if (!state.vaccineGrant) {
    state.setFlag("vaccineGrant");
    state.adjust({ resources: 70 });
    ui.toast("Consórcio científico: +70 recursos para o programa de vacina.");
  }

  const root = openPanel(ui, `
    <section class="panel-shell activity-shell vaccine-activity">
      <header><p class="eyebrow">PROGRAMA V-7 · DESENVOLVIMENTO</p><h2>Uma vacina é um processo</h2><p class="lead">Use a evidência do sequenciamento para escolher o alvo e avance apenas quando cada etapa produzir dados suficientes.</p></header>
      <div id="vaccine-metrics">${metricSnapshot(state.metrics())}</div>
      <div id="target-selector" class="target-selector">
        <p class="section-label">01 · DEFINIR ALVO</p>
        <div>
          <button data-target="variable"><strong>REGIÃO VARIÁVEL</strong><small>Muitas diferenças entre amostras</small></button>
          <button data-target="stable"><strong>PROTEÍNA EXTERNA ESTÁVEL</strong><small>Conservada nas sequências analisadas</small></button>
          <button data-target="marker"><strong>MARCADOR V7</strong><small>Útil para detecção, função protetora incerta</small></button>
        </div>
      </div>
      <div id="vaccine-pipeline" class="vaccine-pipeline" hidden>
        <div class="pipeline-stage is-complete"><span>✓</span><strong>IDENTIFICAÇÃO</strong><small>Vesper-7 · RNA</small></div>
        ${STAGES.map((stage, index) => `<button class="pipeline-stage" data-stage="${index}" ${index ? "disabled" : ""}><span>${String(index + 2).padStart(2, "0")}</span><strong>${stage.title}</strong><small>${stage.days} dia${stage.days > 1 ? "s" : ""} · −${stage.cost}</small></button>`).join("")}
      </div>
      <div data-feedback class="activity-feedback">A sequência mostra quais regiões são estáveis e quais mudam com frequência.</div>
      <div id="stage-detail" class="stage-detail" hidden></div>
      <div class="panel-actions"><button id="finish-vaccine" class="button button--primary" hidden>LIBERAR PRIMEIRO LOTE</button></div>
      <p class="concept-note">Etapas condensadas para o jogo. Processos reais envolvem avaliação científica e regulatória muito mais extensa.</p>
    </section>`);

  return new Promise((resolve) => {
    const completedStageIds = new Set(state.actions
      .filter((action) => action.action === "vaccine_stage")
      .map((action) => action.detail?.stage));
    let completed = STAGES.findIndex((stage) => !completedStageIds.has(stage.id));
    if (completed < 0) completed = STAGES.length;

    if (completed > 0) {
      root.querySelectorAll("[data-target]").forEach((button) => { button.disabled = true; });
      root.querySelector('[data-target="stable"]').classList.add("is-selected");
      root.querySelector("#vaccine-pipeline").hidden = false;
      root.querySelectorAll("[data-stage]").forEach((button) => {
        const index = Number(button.dataset.stage);
        button.disabled = index !== completed;
        if (index < completed) {
          button.classList.add("is-complete");
          button.querySelector("span").textContent = "✓";
        }
      });
      if (completed === STAGES.length) {
        root.querySelector("#finish-vaccine").hidden = false;
        root.querySelector("#stage-detail").hidden = false;
        root.querySelector("#stage-detail").innerHTML = "<small>PROGRAMA RETOMADO</small><strong>Todas as etapas foram concluídas. O primeiro lote está pronto para liberação.</strong>";
      } else {
        setFeedback(root, `Programa retomado na etapa ${completed + 2}. Tempo, recursos e evidências anteriores foram preservados.`, "success");
      }
    }
    root.querySelectorAll("[data-target]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-target]").forEach((item) => item.classList.remove("is-selected"));
        if (button.dataset.target !== "stable") {
          button.classList.add("is-rejected");
          setFeedback(root, button.dataset.target === "marker"
            ? "O marcador ajudou a detectar o agente, mas ainda não há evidência de que seja um bom alvo protetor."
            : "Uma região muito variável pode deixar de ser reconhecida. Procure o alvo sustentado pelas sequências.", "warning");
          ui.audio.beep("error");
          return;
        }
        button.classList.add("is-selected");
        root.querySelectorAll("[data-target]").forEach((item) => { item.disabled = true; });
        root.querySelector("#vaccine-pipeline").hidden = false;
        setFeedback(root, "Alvo sustentado pela evidência: região externa conservada. O desenvolvimento pode começar.", "success");
        ui.audio.beep("unlock");
      });
    });

    root.querySelectorAll("[data-stage]").forEach((button) => {
      button.addEventListener("click", async () => {
        const index = Number(button.dataset.stage);
        if (index !== completed) return;
        const stage = STAGES[index];
        button.disabled = true;
        button.classList.add("is-running");
        root.querySelector("#stage-detail").hidden = false;
        root.querySelector("#stage-detail").innerHTML = `<small>${stage.title} EM CURSO</small><strong>${stage.note}</strong><span><i></i></span>`;
        ui.audio.beep("focus");
        await wait(state.settings.reducedEffects ? 80 : 520);
        state.adjust({ day: stage.days, resources: -stage.cost, ...stage.effects });
        state.log("vaccine_stage", { stage: stage.id, cost: stage.cost, days: stage.days });
        root.querySelector("#vaccine-metrics").innerHTML = metricSnapshot(state.metrics());
        button.classList.remove("is-running");
        button.classList.add("is-complete");
        button.querySelector("span").textContent = "✓";
        completed += 1;
        root.querySelector(`[data-stage="${completed}"]`)?.removeAttribute("disabled");
        root.querySelector("#stage-detail").innerHTML = `<small>ETAPA CONCLUÍDA</small><strong>${stage.note}</strong>`;
        setFeedback(root, `${stage.title} concluída. Tempo, recursos e evidências foram atualizados.`, "success");
        ui.audio.beep("confirm");
        if (completed === STAGES.length) root.querySelector("#finish-vaccine").hidden = false;
      });
    });

    root.querySelector("#finish-vaccine").addEventListener("click", () => {
      state.setFlag("vaccineComplete");
      state.addEvidence(4);
      state.recordDecision("vaccine-target", "stable", "Alvo externo conservado", { vaccination: 38 });
      state.log("first_vaccine_lot", { coverage: state.vaccination });
      world.markComplete("vaccine-screen");
      unlockEntries(state, ui, ["vaccineDevelopment", "vaccination", "biotechnology"]);
      closePanel(ui);
      resolve();
    }, { once: true });
  });
}
