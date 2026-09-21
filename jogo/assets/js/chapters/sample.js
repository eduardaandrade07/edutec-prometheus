import { DIALOGUES } from "../data.js?v=3.0.1";
import { closePanel, openPanel, setFeedback, unlockEntries } from "./helpers.js?v=3.0.1";

export async function run({ state, ui, world }) {
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell sample-activity">
      <header>
        <p class="eyebrow">ANALISADOR M-4 · ENTRADA DE MATERIAL</p>
        <h2>Qual amostra responde à hipótese?</h2>
        <p class="lead">Os três pacientes apresentam sinais respiratórios. Separe o material com maior chance de carregar pistas do local investigado.</p>
      </header>
      <div class="sample-tray" role="group" aria-label="Materiais disponíveis">
        <button class="sample-card" data-sample="water"><span class="sample-symbol">H₂O</span><strong>AMOSTRA AMBIENTAL</strong><small>Água do sistema do Setor Aurora</small><b>LACRE A-14</b></button>
        <button class="sample-card" data-sample="blood"><span class="sample-symbol">BLD</span><strong>AMOSTRA SANGUÍNEA</strong><small>Paciente P-084 · triagem geral</small><b>LACRE B-22</b></button>
        <button class="sample-card" data-sample="respiratory"><span class="sample-symbol">RSP</span><strong>AMOSTRA RESPIRATÓRIA</strong><small>Paciente P-071 · região investigada</small><b>LACRE R-01</b></button>
      </div>
      <div data-feedback class="activity-feedback">Selecione um recipiente para colocá-lo na bandeja de leitura.</div>
      <div id="sample-validation" class="sample-validation" hidden>
        <div class="validation-file">
          <span><small>ID</small><strong>AMOSTRA #001</strong></span>
          <span><small>ORIGEM</small><strong>P-071</strong></span>
          <span><small>COLETA</small><strong>22:18</strong></span>
          <span><small>LACRE</small><strong>R-01</strong></span>
        </div>
        <p>Confirme os três vínculos antes da análise:</p>
        <div class="validation-checks">
          <button data-check="identity">IDENTIDADE CONFERE</button>
          <button data-check="seal">LACRE ÍNTEGRO</button>
          <button data-check="record">HORÁRIO REGISTRADO</button>
        </div>
        <button id="authorize-sample" class="button button--primary" disabled>VALIDAR AMOSTRA <span>0/3</span></button>
      </div>
    </section>`);

  return new Promise((resolve) => {
    const checks = new Set();
    root.querySelectorAll("[data-sample]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-sample]").forEach((item) => item.classList.remove("is-selected"));
        if (button.dataset.sample !== "respiratory") {
          ui.audio.beep("error");
          button.classList.add("is-rejected");
          setFeedback(root, "Esse material pode responder a outras perguntas, mas não é o mais direto para a hipótese respiratória atual.", "warning");
          return;
        }
        ui.audio.beep("confirm");
        button.classList.add("is-selected");
        root.querySelector("#sample-validation").hidden = false;
        setFeedback(root, "Amostra respiratória posicionada. Agora confirme se o resultado poderá ser ligado à origem correta.", "success");
      });
    });

    root.querySelectorAll("[data-check]").forEach((button) => {
      button.addEventListener("click", () => {
        checks.add(button.dataset.check);
        button.classList.add("is-checked");
        button.disabled = true;
        ui.audio.beep("focus");
        const authorize = root.querySelector("#authorize-sample");
        authorize.querySelector("span").textContent = `${checks.size}/3`;
        authorize.disabled = checks.size !== 3;
      });
    });

    root.querySelector("#authorize-sample").addEventListener("click", async () => {
      ui.audio.beep("unlock");
      state.setFlag("sampleValidated");
      state.addEvidence(2);
      state.adjust({ day: 1, resources: -3, knowledge: 8 });
      state.log("sample_validated", { type: "respiratory", traceable: true });
      world.markComplete("analyzer-screen");
      unlockEntries(state, ui, ["biologicalSample", "sampleQuality", "geneticMaterial", "dnaRna"]);
      closePanel(ui);
      await ui.playDialogue(DIALOGUES.sampleResult);
      resolve();
    }, { once: true });
  });
}
