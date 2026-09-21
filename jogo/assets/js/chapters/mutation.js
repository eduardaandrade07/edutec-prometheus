import { DIALOGUES } from "../data.js?v=3.0.1";
import { closePanel, openPanel, setFeedback, unlockEntries } from "./helpers.js?v=3.0.1";

const ORIGINAL = "AUGCGUACGAUC";
const VARIANT = "AUGCGUAUGAUC";

function sequenceRow(sequence, interactive = false) {
  return [...sequence].map((base, index) => interactive
    ? `<button data-base="${index}" aria-label="Base ${index + 1}: ${base}">${base}</button>`
    : `<span>${base}</span>`).join("");
}

export async function run({ state, ui, world }) {
  await ui.playDialogue(DIALOGUES.mutationAlert);
  const root = openPanel(ui, `
    <section class="panel-shell activity-shell mutation-activity">
      <header><p class="eyebrow eyebrow--violet">VIGILÂNCIA GENÔMICA · AMOSTRA N-204</p><h2>Uma letra mudou. E agora?</h2><p class="lead">Compare a sequência original com a amostra da Zona Norte. Selecione a base diferente e depois avalie dados independentes.</p></header>
      <div class="sequence-comparison">
        <div><small>ORIGINAL · VESPER-7</small><code>${sequenceRow(ORIGINAL)}</code></div>
        <div><small>NOVA AMOSTRA · N-204</small><code>${sequenceRow(VARIANT, true)}</code></div>
        <div class="base-index">${[...ORIGINAL].map((_, index) => `<span>${index + 1}</span>`).join("")}</div>
      </div>
      <div id="mutation-evidence" hidden>
        <div class="mutation-callout"><span>C → U</span><div><strong>MUTAÇÃO ENCONTRADA · POSIÇÃO 8</strong><p>A alteração genética existe. Sozinha, ela ainda não mostra o efeito.</p></div></div>
        <p class="section-label">CRUZE OUTRAS FONTES DE EVIDÊNCIA</p>
        <div class="evidence-grid">
          <button data-evidence="field"><span>CAMPO</span><strong>FREQUÊNCIA DA VARIANTE</strong><small>8% → 26% das amostras em seis dias</small></button>
          <button data-evidence="clinical"><span>CLÍNICA</span><strong>GRAVIDADE OBSERVADA</strong><small>Sem diferença consistente até o momento</small></button>
          <button data-evidence="lab"><span>LABORATÓRIO</span><strong>RESPOSTA À VACINA</strong><small>Reconhecimento preservado em 93% no modelo</small></button>
        </div>
        <p class="evidence-counter">EVIDÊNCIAS CRUZADAS <strong id="evidence-count">0/3</strong></p>
      </div>
      <div id="variant-interpretation" hidden>
        <p class="section-label">INTERPRETAÇÃO MAIS SUSTENTADA</p>
        <div class="interpretation-options">
          <button data-interpretation="proof">A mutação prova, por si só, transmissão maior.</button>
          <button data-interpretation="monitor">Os dados sugerem vantagem de transmissão; é preciso monitorar e testar a hipótese.</button>
          <button data-interpretation="escape">A vacina certamente deixou de reconhecer o agente.</button>
        </div>
      </div>
      <div data-feedback class="activity-feedback">Comece comparando base por base.</div>
      <div class="panel-actions"><button id="register-variant" class="button button--primary" hidden>REGISTRAR NOVA VARIANTE</button></div>
    </section>`);

  return new Promise((resolve) => {
    root.querySelectorAll("[data-base]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.base);
        if (index !== 7) {
          button.classList.add("is-rejected");
          setFeedback(root, `Posição ${index + 1}: as bases são iguais nas duas sequências.`, "warning");
          ui.audio.beep("error");
          return;
        }
        button.classList.add("is-mutation");
        root.querySelector("#mutation-evidence").hidden = false;
        setFeedback(root, "Mutação C→U encontrada. Agora verifique se outras evidências ajudam a interpretar seu efeito.", "success");
        ui.audio.beep("unlock");
      });
    });

    const evidence = new Set();
    root.querySelectorAll("[data-evidence]").forEach((button) => {
      button.addEventListener("click", () => {
        evidence.add(button.dataset.evidence);
        button.classList.add("is-selected");
        button.disabled = true;
        root.querySelector("#evidence-count").textContent = `${evidence.size}/3`;
        ui.audio.beep("focus");
        if (evidence.size === 3) {
          root.querySelector("#variant-interpretation").hidden = false;
          setFeedback(root, "Genética, campo e laboratório contam partes diferentes da história. Interprete o conjunto.", "success");
        }
      });
    });

    root.querySelectorAll("[data-interpretation]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-interpretation]").forEach((item) => item.classList.remove("is-selected"));
        if (button.dataset.interpretation !== "monitor") {
          button.classList.add("is-rejected");
          setFeedback(root, button.dataset.interpretation === "proof"
            ? "A frequência aumentou, mas correlação e uma mutação isolada não são prova final de mecanismo."
            : "Os dados de laboratório ainda mostram reconhecimento alto; essa conclusão contradiz a evidência disponível.", "warning");
          ui.audio.beep("error");
          return;
        }
        button.classList.add("is-selected");
        root.querySelector("#register-variant").hidden = false;
        setFeedback(root, "Conclusão proporcional à evidência: variante sob monitoramento por possível vantagem de transmissão.", "success");
        ui.audio.beep("confirm");
      });
    });

    root.querySelector("#register-variant").addEventListener("click", () => {
      const growth = Math.max(4, Math.round(state.cases * 0.12));
      state.setFlag("mutationComplete");
      state.addEvidence(4);
      state.adjust({ day: 2, resources: -6, knowledge: 12, contagion: 10, cases: growth });
      state.recordDecision("variant-interpretation", "monitor", "Monitorar possível vantagem de transmissão", { contagion: 10 });
      state.log("variant_detected", { mutation: "C8U", evidence: [...evidence] });
      world.markComplete("variant-screen");
      unlockEntries(state, ui, ["mutation", "variant", "evidenceDecisions"]);
      closePanel(ui);
      resolve();
    }, { once: true });
  });
}
