import { DIALOGUES } from "../data.js?v=3.0.1";
import { closePanel, openPanel, setFeedback, unlockEntries, wait } from "./helpers.js?v=3.0.1";

const READS = ["AUGCGAUACG", "AUACGUUAGC", "UUAGCCGAUA", "CGAUAGGUCA", "GGUCAUACCG"];

export async function run({ state, ui, world }) {
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell sequence-activity">
      <header><p class="eyebrow eyebrow--blue">SEQUENCIADOR S-9 · AMOSTRA #001</p><h2>Leia a assinatura genética</h2><p class="lead">A PCR encontrou um marcador. Agora obtenha trechos da sequência e compare o conjunto com o banco de referências.</p></header>
      <div class="sequence-workspace">
        <div class="read-stack" id="read-stack" aria-live="polite">
          ${READS.map((read, index) => `<div><small>LEITURA ${String(index + 1).padStart(2, "0")}</small><code data-read="${index}">··········</code></div>`).join("")}
        </div>
        <div class="assembled-sequence">
          <small>SEQUÊNCIA CONSENSO</small>
          <code id="consensus">AGUARDANDO LEITURAS</code>
          <div class="sequence-ruler"><span>5′</span><i></i><span>3′</span></div>
        </div>
      </div>
      <div id="reference-panel" hidden>
        <p class="section-label">COMPARAÇÃO COM REFERÊNCIAS</p>
        <div class="reference-grid">
          <button data-reference="boreal"><span>REF-B12</span><strong>AGENTE BOREAL</strong><b>41,2%</b><small>similaridade</small></button>
          <button data-reference="nova"><span>REF-N03</span><strong>NOVA-3</strong><b>58,4%</b><small>similaridade</small></button>
          <button data-reference="vesper"><span>REF-V07</span><strong>VESPER-7</strong><b>96,8%</b><small>similaridade</small></button>
        </div>
      </div>
      <div data-feedback class="activity-feedback">Inicie a leitura para revelar a ordem das bases.</div>
      <div class="panel-actions"><button id="sequence-action" class="button button--primary">INICIAR LEITURA</button></div>
      <p class="concept-note">Sequências e referências são fictícias e reduzidas para fins educacionais.</p>
    </section>`);

  return new Promise((resolve) => {
    const action = root.querySelector("#sequence-action");
    action.addEventListener("click", async () => {
      action.disabled = true;
      action.textContent = "LENDO BASES…";
      for (let index = 0; index < READS.length; index += 1) {
        root.querySelector(`[data-read="${index}"]`).textContent = READS[index];
        root.querySelector(`[data-read="${index}"]`).closest("div").classList.add("is-read");
        ui.audio.beep("focus");
        await wait(state.settings.reducedEffects ? 60 : 330);
      }
      root.querySelector("#consensus").textContent = "AUGCGAUACGUUAGCCGAUAGGUCAUACCG";
      root.querySelector("#consensus").classList.add("is-ready");
      root.querySelector("#reference-panel").hidden = false;
      action.hidden = true;
      setFeedback(root, "A ordem das bases foi reconstruída. Compare-a com referências conhecidas.", "success");

      root.querySelectorAll("[data-reference]").forEach((button) => {
        button.addEventListener("click", () => {
          root.querySelectorAll("[data-reference]").forEach((item) => item.classList.remove("is-selected"));
          if (button.dataset.reference !== "vesper") {
            button.classList.add("is-rejected");
            setFeedback(root, "A semelhança é baixa para sustentar essa identificação. Procure a referência que explica melhor o conjunto de bases.", "warning");
            ui.audio.beep("error");
            return;
          }
          button.classList.add("is-selected");
          setFeedback(root, "Correspondência de 96,8%: assinatura compatível com Vesper-7, agente viral fictício de RNA.", "success");
          ui.audio.beep("unlock");
          action.hidden = false;
          action.disabled = false;
          action.textContent = "REGISTRAR IDENTIFICAÇÃO";
          action.onclick = async () => {
            state.setFlag("sequenceComplete");
            state.addEvidence(4);
            state.adjust({ day: 2, resources: -14, knowledge: 16, cases: 9, contagion: 6 });
            state.log("agent_identified", { agent: "Vesper-7", match: 96.8, genome: "RNA" });
            world.markComplete("sequencer-screen");
            unlockEntries(state, ui, ["sequencing", "identificationDiagnosis", "epidemiology"]);
            closePanel(ui);
            await ui.playDialogue(DIALOGUES.sequenceResult);
            resolve();
          };
        });
      });
    }, { once: true });
  });
}
