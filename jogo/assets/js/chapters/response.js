import { applyResponseTurn, RESPONSE_ACTIONS } from "../epidemic.js?v=3.0.1";
import { closePanel, metricSnapshot, openPanel, setFeedback, unlockEntries } from "./helpers.js?v=3.0.1";

export async function run({ state, ui, world }) {
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell response-activity">
      <header><p class="eyebrow eyebrow--amber">CENTRO DE RESPOSTA · RECURSOS LIMITADOS</p><h2>Três dias para mudar a curva</h2><p class="lead">Escolha uma ação principal por dia. Casos continuam surgindo enquanto a equipe trabalha; nenhuma medida resolve tudo sozinha.</p></header>
      <div id="response-metrics">${metricSnapshot(state.metrics())}</div>
      <div class="round-track"><span class="is-active">DIA 1</span><span>DIA 2</span><span>DIA 3</span></div>
      <div class="response-grid">
        ${RESPONSE_ACTIONS.map((action) => `
          <button class="response-option" data-response="${action.id}">
            <span class="response-icon">${action.icon}</span>
            <span><strong>${action.title}</strong><small>${action.description}</small><b>${action.tag}</b></span>
            <em>−${action.cost}</em>
          </button>`).join("")}
      </div>
      <div data-feedback class="activity-feedback">Analise custo e efeito. O próximo dia será calculado depois da sua decisão.</div>
      <div id="turn-result" class="turn-result" hidden></div>
      <div class="panel-actions"><button id="next-response-day" class="button button--primary" hidden>AVANÇAR PARA O DIA 2</button></div>
      <p class="concept-note">Modelo epidemiológico propositalmente simplificado: os valores servem para comparar decisões, não para prever surtos reais.</p>
    </section>`);

  return new Promise((resolve) => {
    const priorTurns = state.decisions.filter((decision) => decision.type.startsWith("response-day-")).slice(-3);
    let round = Math.min(3, priorTurns.length);
    const used = priorTurns.map((decision) => decision.choice);
    const nextButton = root.querySelector("#next-response-day");

    const updateRoundTrack = () => {
      root.querySelectorAll(".round-track span").forEach((item, index) => {
        item.classList.toggle("is-complete", index < round);
        item.classList.toggle("is-active", index === round && round < 3);
      });
    };

    const refreshOptions = (enabled = true) => {
      root.querySelectorAll("[data-response]").forEach((button) => {
        const action = RESPONSE_ACTIONS.find((item) => item.id === button.dataset.response);
        button.disabled = !enabled || action.cost > state.resources;
        button.classList.toggle("is-unaffordable", action.cost > state.resources);
      });
    };

    const choose = (button) => {
      const action = RESPONSE_ACTIONS.find((item) => item.id === button.dataset.response);
      if (!action || action.cost > state.resources) return;
      ui.audio.beep("confirm");
      const result = applyResponseTurn(state, action);
      used.push(action.id);
      round += 1;
      button.classList.add("is-selected");
      refreshOptions(false);
      root.querySelector("#response-metrics").innerHTML = metricSnapshot(state.metrics());
      updateRoundTrack();
      root.querySelector("#turn-result").hidden = false;
      root.querySelector("#turn-result").innerHTML = `
        <span><small>AÇÃO</small><strong>${action.title}</strong></span>
        <span><small>NOVOS CASOS</small><strong>+${result.newCases}</strong></span>
        <span><small>CONTÁGIO</small><strong>${result.before.contagion}% → ${result.after.contagion}%</strong></span>
        <span><small>RECURSOS</small><strong>${result.before.resources} → ${result.after.resources}</strong></span>`;
      setFeedback(root, `${action.title} alterou a trajetória, mas a transmissão continuou durante o dia.`, "success");
      nextButton.hidden = false;
      nextButton.textContent = round < 3 ? `AVANÇAR PARA O DIA ${round + 1}` : "ENCERRAR CICLO DE RESPOSTA";
    };

    root.querySelectorAll("[data-response]").forEach((button) => button.addEventListener("click", () => choose(button)));
    updateRoundTrack();
    if (round >= 3) {
      refreshOptions(false);
      nextButton.hidden = false;
      nextButton.textContent = "ENCERRAR CICLO DE RESPOSTA";
      setFeedback(root, "Os três dias já foram calculados. Registre o ciclo para continuar.", "success");
    } else {
      refreshOptions();
      if (round > 0) setFeedback(root, `Resposta retomada no dia ${round + 1}. Métricas e recursos anteriores foram preservados.`, "success");
    }

    nextButton.addEventListener("click", () => {
      if (round >= 3) {
        state.setFlag("responseComplete");
        state.log("response_cycle_complete", { actions: used });
        world.markComplete("response-screen");
        unlockEntries(state, ui, ["isolation", "evidenceDecisions"]);
        closePanel(ui);
        resolve();
        return;
      }
      root.querySelectorAll("[data-response]").forEach((button) => button.classList.remove("is-selected"));
      root.querySelector("#turn-result").hidden = true;
      nextButton.hidden = true;
      setFeedback(root, `Dia ${round + 1}: os recursos restantes não permitem executar todas as opções.`, "default");
      refreshOptions();
    });
  });
}
