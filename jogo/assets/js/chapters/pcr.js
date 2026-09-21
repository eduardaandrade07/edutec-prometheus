import { DIALOGUES } from "../data.js?v=3.0.1";
import { closePanel, openPanel, setFeedback, unlockEntries, wait } from "./helpers.js?v=3.0.1";

function renderCopies(container, count) {
  container.innerHTML = Array.from({ length: count }, (_, index) => `<span style="--i:${index}"><i></i><i></i><i></i><i></i><i></i><i></i></span>`).join("");
}

export async function run({ state, ui, world }) {
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell pcr-activity">
      <header><p class="eyebrow eyebrow--violet">ESTAÇÃO PCR · MARCADOR V7</p><h2>Torne o alvo detectável</h2><p class="lead">Amostra #001 contém pouco sinal. Insira o material e execute ciclos conceituais de amplificação até ultrapassar o limite de detecção.</p></header>
      <div class="pcr-console">
        <div class="pcr-question"><small>PERGUNTA PROGRAMADA</small><strong>O marcador genético V7 está nesta amostra?</strong></div>
        <div class="pcr-visual">
          <div class="rt-bridge" aria-label="Preparação conceitual do material genético">
            <span><small>AMOSTRA</small><strong>RNA</strong></span>
            <i aria-hidden="true">→</i>
            <span id="cdna-state"><small>CÓPIA COMPLEMENTAR</small><strong>AGUARDANDO</strong></span>
            <i aria-hidden="true">→</i>
            <span><small>ALVO</small><strong>V7</strong></span>
          </div>
          <div class="copy-counter"><small>CÓPIAS VISÍVEIS</small><strong id="copy-count">0</strong></div>
          <div id="dna-copies" class="dna-copies" aria-label="Representação das cópias do alvo"></div>
          <div class="detection-line"><span></span><small>LIMITE DE DETECÇÃO</small></div>
        </div>
        <div class="cycle-readout"><span>CICLO CONCEITUAL</span><strong id="cycle-count">—</strong><span>SINAL</span><strong id="signal-status">AUSENTE</strong></div>
      </div>
      <div data-feedback class="activity-feedback">O alvo só pode ser amplificado depois que a amostra é vinculada à busca.</div>
      <div class="panel-actions">
        <button id="insert-pcr" class="button button--quiet">PREPARAR RNA DA AMOSTRA</button>
        <button id="run-cycle" class="button button--primary" disabled>EXECUTAR CICLO</button>
      </div>
      <p class="concept-note">Visualização simplificada: representa a ideia de amplificação e detecção, não um procedimento laboratorial real.</p>
    </section>`);

  return new Promise((resolve) => {
    let cycle = 0;
    const copies = root.querySelector("#dna-copies");
    const runButton = root.querySelector("#run-cycle");
    root.querySelector("#insert-pcr").addEventListener("click", (event) => {
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = "RNA CONVERTIDO EM cDNA";
      const cdnaState = root.querySelector("#cdna-state");
      cdnaState.classList.add("is-ready");
      cdnaState.querySelector("strong").textContent = "DNA (cDNA)";
      runButton.disabled = false;
      renderCopies(copies, 1);
      root.querySelector("#copy-count").textContent = "1";
      root.querySelector("#cycle-count").textContent = "0/4";
      setFeedback(root, "Como o agente possui RNA, a plataforma criou primeiro uma cópia complementar de DNA. Agora a região V7 pode ser amplificada.", "success");
      ui.audio.beep("confirm");
    }, { once: true });

    runButton.addEventListener("click", async () => {
      if (cycle >= 4) return;
      runButton.disabled = true;
      cycle += 1;
      root.querySelector("#cycle-count").textContent = `${cycle}/4`;
      root.querySelector("#signal-status").textContent = "AMPLIFICANDO";
      root.querySelector(".pcr-visual").classList.add("is-cycling");
      ui.audio.beep("focus");
      await wait(state.settings.reducedEffects ? 80 : 430);
      const count = 2 ** cycle;
      renderCopies(copies, count);
      root.querySelector("#copy-count").textContent = String(count);
      root.querySelector(".pcr-visual").classList.remove("is-cycling");
      if (cycle < 4) {
        root.querySelector("#signal-status").textContent = "ABAIXO DO LIMITE";
        runButton.disabled = false;
        return;
      }
      root.querySelector("#signal-status").textContent = "DETECTADO";
      root.querySelector(".pcr-console").classList.add("is-positive");
      runButton.textContent = "REGISTRAR PCR POSITIVA";
      runButton.disabled = false;
      setFeedback(root, "O alvo V7 ultrapassou o limite de detecção. Resultado: PCR positiva.", "success");
      ui.audio.beep("unlock");
      runButton.addEventListener("click", async () => {
        state.setFlag("pcrComplete");
        state.addEvidence(3);
        state.adjust({ day: 1, resources: -12, knowledge: 14 });
        state.log("pcr_positive", { marker: "V7", conceptualCycles: 4 });
        world.markComplete("pcr-screen");
        unlockEntries(state, ui, ["pcr", "dnaRna"]);
        closePanel(ui);
        await ui.playDialogue(DIALOGUES.pcrResult);
        resolve();
      }, { once: true });
    });
  });
}
