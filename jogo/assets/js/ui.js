import { CASES, KNOWLEDGE, MISSION_STEPS } from "./data.js?v=3.0.1";
import { outcomeLabel, outcomeScore } from "./epidemic.js?v=3.0.1";

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const number = (value) => Math.round(value).toLocaleString("pt-BR");
const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

export class GameUI extends EventTarget {
  constructor(state, audio) {
    super();
    this.state = state;
    this.audio = audio;
    this.els = {
      boot: document.querySelector("#boot-screen"),
      alert: document.querySelector("#alert-screen"),
      chapter: document.querySelector("#chapter-screen"),
      start: document.querySelector("#start-button"),
      continue: document.querySelector("#continue-button"),
      loadStatus: document.querySelector("#load-status"),
      systemState: document.querySelector("#system-state"),
      saveSummary: document.querySelector("#save-summary"),
      bootProgress: document.querySelector("#boot-progress"),
      hud: document.querySelector("#hud"),
      missionLabel: document.querySelector("#mission-label"),
      objective: document.querySelector("#mission-objective"),
      progress: document.querySelector("#mission-progress"),
      day: document.querySelector("#hud-day"),
      cases: document.querySelector("#hud-cases"),
      contagion: document.querySelector("#hud-contagion"),
      resources: document.querySelector("#hud-resources"),
      knowledge: document.querySelector("#hud-knowledge"),
      vaccination: document.querySelector("#hud-vaccination"),
      sample: document.querySelector("#inventory-chip"),
      reticle: document.querySelector("#reticle"),
      interaction: document.querySelector("#interaction-prompt"),
      interactionLabel: document.querySelector("#interaction-label"),
      controlHint: document.querySelector("#control-hint"),
      dialogue: document.querySelector("#dialogue"),
      speakerInitial: document.querySelector("#speaker-initial"),
      speakerName: document.querySelector("#speaker-name"),
      speakerRole: document.querySelector("#speaker-role"),
      dialogueText: document.querySelector("#dialogue-text"),
      dialogueCounter: document.querySelector("#dialogue-counter"),
      dialogueNext: document.querySelector("#dialogue-next"),
      toastRegion: document.querySelector("#toast-region"),
      unlock: document.querySelector("#knowledge-unlock"),
      unlockTitle: document.querySelector("#unlock-title"),
      unlockMore: document.querySelector("#unlock-more"),
      panelDialog: document.querySelector("#panel-dialog"),
      panelContent: document.querySelector("#panel-content"),
      knowledgeDialog: document.querySelector("#knowledge-dialog"),
      knowledgeList: document.querySelector("#knowledge-list"),
      settingsDialog: document.querySelector("#settings-dialog"),
      pauseDialog: document.querySelector("#pause-dialog"),
      reportDialog: document.querySelector("#report-dialog"),
      report: document.querySelector("#mission-report"),
      srStatus: document.querySelector("#screen-reader-status"),
      touchControls: document.querySelector("#touch-controls"),
    };
    this.currentUnlock = null;
    this.typing = null;
    this.settingsOrigin = null;
    this.chapterResolve = null;
    this.bind();
    this.applySettings(state.settings);
    this.renderKnowledge();
  }

  bind() {
    this.els.start.addEventListener("click", () => this.dispatchEvent(new Event("start")));
    this.els.continue.addEventListener("click", () => this.dispatchEvent(new Event("continue")));
    document.querySelector("#enter-lab-button").addEventListener("click", () => this.dispatchEvent(new Event("enterlab")));
    document.querySelector("#knowledge-button")?.addEventListener("click", () => this.openKnowledge());
    document.querySelector("#pause-button")?.addEventListener("click", () => this.dispatchEvent(new Event("pause")));
    document.querySelector("#resume-button")?.addEventListener("click", () => this.dispatchEvent(new Event("resume")));
    document.querySelector("#menu-button")?.addEventListener("click", () => this.dispatchEvent(new Event("menu")));
    document.querySelector("#chapter-continue")?.addEventListener("click", () => this.closeChapter());
    this.els.unlockMore.addEventListener("click", () => {
      this.els.unlock.hidden = true;
      this.openKnowledge(this.currentUnlock);
    });

    document.querySelectorAll("[data-open-settings]").forEach((button) => button.addEventListener("click", () => this.openSettings()));
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
    document.querySelector("#settings-form")?.addEventListener("submit", () => this.saveSettings());
    this.els.settingsDialog.addEventListener("close", () => {
      this.saveSettings();
      this.endModal();
      if (this.settingsOrigin === "pause" && this.state.paused) this.showPause();
      this.settingsOrigin = null;
    });
    this.els.knowledgeDialog.addEventListener("close", () => this.endModal());
    this.els.panelDialog.addEventListener("close", () => this.endModal());
    this.els.pauseDialog.addEventListener("close", () => { if (!this.els.settingsDialog.open) this.endModal(); });
    this.els.reportDialog.addEventListener("cancel", (event) => event.preventDefault());
    this.els.panelDialog.addEventListener("cancel", (event) => { if (this.els.panelDialog.dataset.locked === "true") event.preventDefault(); });
    this.els.dialogueNext.addEventListener("click", () => this.advanceDialogue());

    window.addEventListener("keydown", (event) => {
      if (event.code !== "Enter" || event.repeat) return;
      if (!this.els.dialogue.hidden) {
        event.preventDefault();
        this.advanceDialogue();
      } else if (this.els.chapter.classList.contains("is-visible")) {
        event.preventDefault();
        this.closeChapter();
      } else if (this.els.boot.classList.contains("is-visible") && !this.els.start.disabled) {
        event.preventDefault();
        this.dispatchEvent(new Event(this.state.hasSave ? "continue" : "start"));
      }
    });
  }

  ready() {
    this.els.start.disabled = false;
    this.els.loadStatus.innerHTML = "<span></span> Sistema pronto";
    this.els.systemState.textContent = "PRONTO";
    this.refreshBoot();
  }

  refreshBoot() {
    const hasSave = this.state.hasSave;
    this.els.continue.hidden = !hasSave;
    this.els.saveSummary.hidden = !hasSave;
    if (hasSave) {
      const step = MISSION_STEPS[this.state.currentStep] || MISSION_STEPS[0];
      this.els.saveSummary.textContent = `ARQUIVO SALVO · CAPÍTULO ${step.chapter} · DIA ${String(this.state.day).padStart(2, "0")} · ${number(this.state.cases)} CASOS`;
      this.els.bootProgress.textContent = `${Math.round((this.state.currentStep / MISSION_STEPS.length) * 100)}% CONCLUÍDO`;
    } else {
      this.els.bootProgress.textContent = this.state.completed ? "CAMPANHA CONCLUÍDA" : "NÃO INICIADO";
    }
  }

  fail(message) {
    this.els.start.disabled = true;
    this.els.loadStatus.textContent = message;
    this.els.systemState.textContent = "INDISPONÍVEL";
  }

  showAlert() {
    this.els.boot.classList.remove("is-visible");
    this.els.alert.classList.add("is-visible");
    this.audio.beep("alert");
  }

  enterGame(isTouch) {
    this.els.boot.classList.remove("is-visible");
    this.els.alert.classList.remove("is-visible");
    this.els.hud.hidden = false;
    this.els.touchControls.hidden = !isTouch;
    this.updateMetrics(this.state.metrics());
    this.announce("Laboratório Prometheus. Siga o objetivo indicado no canto superior da tela.");
  }

  hideGame() {
    this.els.hud.hidden = true;
    this.els.touchControls.hidden = true;
  }

  showBoot() {
    this.closeAllDialogs();
    this.hideGame();
    this.els.alert.classList.remove("is-visible");
    this.els.chapter.classList.remove("is-visible");
    this.els.boot.classList.add("is-visible");
    this.refreshBoot();
  }

  showChapter(chapter) {
    this.startModal();
    document.querySelector("#chapter-index").textContent = String(chapter.index).padStart(2, "0");
    document.querySelector("#chapter-code").textContent = `ARQUIVO ${chapter.code}`;
    document.querySelector("#chapter-title").textContent = chapter.title;
    document.querySelector("#chapter-description").textContent = chapter.description;
    document.querySelector("#chapter-concepts").innerHTML = chapter.concepts.map((concept) => `<span>${escapeHTML(concept)}</span>`).join("");
    this.els.chapter.classList.add("is-visible");
    this.audio.beep("unlock");
    this.announce(`Capítulo ${chapter.index}: ${chapter.title}. ${chapter.description}`);
    return new Promise((resolve) => { this.chapterResolve = resolve; });
  }

  closeChapter() {
    if (!this.els.chapter.classList.contains("is-visible")) return;
    this.els.chapter.classList.remove("is-visible");
    const resolve = this.chapterResolve;
    this.chapterResolve = null;
    this.endModal();
    resolve?.();
  }

  setObjective(stepIndex) {
    const data = MISSION_STEPS[stepIndex];
    if (!data) return;
    this.els.objective.textContent = data.objective;
    this.els.missionLabel.textContent = `CAPÍTULO ${String(data.chapter).padStart(2, "0")}`;
    this.els.progress.textContent = `${Math.min(stepIndex + 1, MISSION_STEPS.length)}/${MISSION_STEPS.length}`;
    this.announce(`Novo objetivo: ${data.objective}`);
  }

  updateMetrics(metrics) {
    if (!metrics) return;
    this.els.day.textContent = String(metrics.day).padStart(2, "0");
    this.els.cases.textContent = number(metrics.cases);
    this.els.contagion.textContent = `${number(metrics.contagion)}%`;
    this.els.resources.textContent = number(metrics.resources);
    this.els.knowledge.textContent = `${number(metrics.knowledge)}%`;
    this.els.vaccination.textContent = `${number(metrics.vaccination)}%`;
  }

  setSample(value) {
    this.els.sample.hidden = !value;
    if (!value) return;
    const label = document.querySelector("#inventory-label");
    const name = document.querySelector("#inventory-name");
    if (this.state.sequenceComplete) {
      label.textContent = "AGENTE IDENTIFICADO";
      name.textContent = "VESPER-7 · RNA";
    } else if (this.state.pcrComplete) {
      label.textContent = "RESULTADO MOLECULAR";
      name.textContent = "PCR POSITIVA · V7";
    } else if (this.state.sampleValidated) {
      label.textContent = "AMOSTRA VALIDADA";
      name.textContent = "AMOSTRA #001 · R-01";
    } else {
      label.textContent = "TRANSPORTANDO";
      name.textContent = "AMOSTRA #001";
    }
  }

  setInteraction(target) {
    const active = Boolean(target);
    this.els.interaction.hidden = !active;
    this.els.reticle.classList.toggle("is-active", active);
    if (target) this.els.interactionLabel.textContent = target.label;
  }

  dismissControlHint() {
    this.els.controlHint.classList.add("is-dismissed");
    window.setTimeout(() => { this.els.controlHint.hidden = true; }, 650);
  }

  toast(message, type = "default", duration = 3000) {
    const item = document.createElement("div");
    item.className = `toast${type === "amber" ? " toast--amber" : ""}`;
    item.textContent = message;
    this.els.toastRegion.append(item);
    window.setTimeout(() => {
      item.classList.add("is-leaving");
      window.setTimeout(() => item.remove(), 240);
    }, duration);
  }

  announce(message) {
    this.els.srStatus.textContent = "";
    requestAnimationFrame(() => { this.els.srStatus.textContent = message; });
  }

  startModal() {
    this.state.modalOpen = true;
    this.dispatchEvent(new CustomEvent("modalchange", { detail: true }));
  }

  endModal() {
    const anyOpen = [this.els.panelDialog, this.els.knowledgeDialog, this.els.settingsDialog, this.els.pauseDialog, this.els.reportDialog]
      .some((dialog) => dialog.open) || !this.els.dialogue.hidden || this.els.chapter.classList.contains("is-visible");
    this.state.modalOpen = anyOpen;
    this.dispatchEvent(new CustomEvent("modalchange", { detail: anyOpen }));
  }

  openDialog(dialog) {
    this.startModal();
    if (!dialog.open) dialog.showModal();
  }

  closeAllDialogs() {
    [this.els.panelDialog, this.els.knowledgeDialog, this.els.settingsDialog, this.els.pauseDialog, this.els.reportDialog]
      .forEach((dialog) => { if (dialog.open) dialog.close(); });
    this.els.dialogue.hidden = true;
    this.els.chapter.classList.remove("is-visible");
    this.state.modalOpen = false;
  }

  async playDialogue(lines) {
    if (!lines?.length) return;
    this.startModal();
    this.els.dialogue.hidden = false;
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    return new Promise((resolve) => {
      this.dialogueResolve = resolve;
      this.renderDialogueLine();
    });
  }

  renderDialogueLine() {
    const line = this.dialogueLines[this.dialogueIndex];
    this.els.speakerInitial.textContent = line.initial;
    this.els.speakerName.textContent = line.speaker.toUpperCase();
    this.els.speakerRole.textContent = line.role.toUpperCase();
    this.els.dialogueCounter.textContent = `${this.dialogueIndex + 1} / ${this.dialogueLines.length}`;
    this.els.dialogueNext.innerHTML = this.dialogueIndex === this.dialogueLines.length - 1 ? "CONCLUIR <kbd>↵</kbd>" : "CONTINUAR <kbd>↵</kbd>";
    this.typeText(line.text);
    this.announce(`${line.speaker}: ${line.text}`);
  }

  typeText(text) {
    if (this.typing?.frame) cancelAnimationFrame(this.typing.frame);
    const speedMap = { slow: 34, normal: 20, fast: 9, instant: 0 };
    const interval = this.state.settings.reducedEffects ? 0 : speedMap[this.state.settings.dialogueSpeed] ?? 20;
    if (!interval) {
      this.els.dialogueText.textContent = text;
      this.typing = null;
      return;
    }
    const start = performance.now();
    this.typing = { text, frame: null };
    const tick = (now) => {
      const count = Math.min(text.length, Math.floor((now - start) / interval));
      this.els.dialogueText.textContent = text.slice(0, count);
      if (count >= text.length) this.typing = null;
      else this.typing.frame = requestAnimationFrame(tick);
    };
    this.typing.frame = requestAnimationFrame(tick);
  }

  advanceDialogue() {
    if (this.typing) {
      cancelAnimationFrame(this.typing.frame);
      this.els.dialogueText.textContent = this.typing.text;
      this.typing = null;
      return;
    }
    this.audio.beep("confirm");
    if (this.dialogueIndex < this.dialogueLines.length - 1) {
      this.dialogueIndex += 1;
      this.renderDialogueLine();
      return;
    }
    this.els.dialogue.hidden = true;
    const resolve = this.dialogueResolve;
    this.dialogueResolve = null;
    this.endModal();
    resolve?.();
  }

  unlockKnowledge(key) {
    const entry = KNOWLEDGE[key];
    if (!entry) return;
    this.currentUnlock = key;
    this.els.unlockTitle.textContent = entry.title;
    this.els.unlock.hidden = false;
    this.audio.beep("unlock");
    this.renderKnowledge(key);
    window.setTimeout(() => { if (!this.els.unlock.matches(":hover")) this.els.unlock.hidden = true; }, 6200);
  }

  renderKnowledge(selectedKey) {
    const unlocked = [...this.state.unlockedKnowledge];
    const selected = selectedKey && unlocked.includes(selectedKey) ? selectedKey : unlocked[unlocked.length - 1];
    const nav = Object.entries(KNOWLEDGE).map(([key, entry]) => {
      const isUnlocked = unlocked.includes(key);
      return `<button data-knowledge-key="${key}" class="${key === selected ? "is-active" : ""}" ${isUnlocked ? "" : "disabled"}>${isUnlocked ? `${entry.category} · ${entry.title}` : "ARQUIVO BLOQUEADO"}</button>`;
    }).join("");
    const entry = selected ? KNOWLEDGE[selected] : null;
    const content = entry
      ? `<article class="knowledge-entry"><p class="eyebrow">${entry.category}</p><h3>${entry.title}</h3><p>${entry.body}</p><div class="knowledge-fact"><small>EM UMA FRASE</small><strong>${entry.fact}</strong></div></article>`
      : `<article class="knowledge-entry"><p class="eyebrow">SEM REGISTROS</p><h3>Investigue para desbloquear</h3><p>Conceitos aparecem aqui depois que você os utiliza durante a missão.</p></article>`;
    this.els.knowledgeList.innerHTML = `<nav class="knowledge-nav" aria-label="Conceitos desbloqueados">${nav}</nav>${content}`;
    this.els.knowledgeList.querySelectorAll("[data-knowledge-key]:not(:disabled)").forEach((button) => button.addEventListener("click", () => this.renderKnowledge(button.dataset.knowledgeKey)));
  }

  openKnowledge(key) {
    this.renderKnowledge(key);
    this.openDialog(this.els.knowledgeDialog);
  }

  openSettings() {
    this.settingsOrigin = this.els.pauseDialog.open ? "pause" : "other";
    if (this.els.pauseDialog.open) this.els.pauseDialog.close();
    const settings = this.state.settings;
    document.querySelector("#quality-setting").value = settings.quality;
    document.querySelector("#volume-setting").value = settings.volume;
    document.querySelector("#text-setting").value = settings.textSize;
    document.querySelector("#dialogue-speed-setting").value = settings.dialogueSpeed;
    document.querySelector("#effects-setting").checked = settings.reducedEffects;
    document.querySelector("#contrast-setting").checked = settings.highContrast;
    this.openDialog(this.els.settingsDialog);
  }

  saveSettings() {
    this.state.updateSettings({
      quality: document.querySelector("#quality-setting").value,
      volume: Number(document.querySelector("#volume-setting").value),
      textSize: document.querySelector("#text-setting").value,
      dialogueSpeed: document.querySelector("#dialogue-speed-setting").value,
      reducedEffects: document.querySelector("#effects-setting").checked,
      highContrast: document.querySelector("#contrast-setting").checked,
    });
    this.applySettings(this.state.settings);
  }

  applySettings(settings) {
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.reducedEffects = String(settings.reducedEffects);
    document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
    document.querySelector("#game-shell").dataset.quality = settings.quality;
    this.audio.updateVolume();
  }

  showPause() {
    if (this.els.settingsDialog.open || this.els.reportDialog.open) return;
    this.openDialog(this.els.pauseDialog);
  }

  hidePause() {
    if (this.els.pauseDialog.open) this.els.pauseDialog.close();
  }

  async showCases() {
    this.els.panelDialog.dataset.locked = "true";
    const files = CASES.map((item) => `
      <article class="case-file"><span><b>${item.id}</b><b>${item.arrival}</b></span><h3>PACIENTE · ${item.age} ANOS</h3><p><b>Origem:</b> ${item.origin}</p><p><b>Sinais:</b> ${item.symptoms}</p><p><b>Início:</b> ${item.onset}</p></article>`).join("");
    this.els.panelContent.innerHTML = `
      <section class="panel-shell"><header><p class="eyebrow">REDE SENTINELA · REGISTROS CLÍNICOS</p><h2>Três casos, um padrão?</h2><p class="lead">Sobreponha os dados para encontrar o que os relatos têm em comum.</p></header><div class="case-list">${files}</div><div id="case-pattern"></div><div class="panel-actions"><button id="compare-cases" class="button button--primary">COMPARAR REGISTROS</button></div></section>`;
    this.openDialog(this.els.panelDialog);
    return new Promise((resolve) => {
      const button = this.els.panelContent.querySelector("#compare-cases");
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "CRUZANDO DADOS…";
        this.audio.beep("confirm");
        await wait(this.state.settings.reducedEffects ? 80 : 650);
        this.els.panelContent.querySelectorAll(".case-file").forEach((card) => card.classList.add("is-matched"));
        this.els.panelContent.querySelector("#case-pattern").innerHTML = `<div class="shared-pattern"><span>≋</span><div><strong>PADRÃO COMPARTILHADO</strong><p>Mesma região, início em uma janela de cinco horas e conjunto semelhante de sintomas. Isso sustenta uma ligação entre os casos — ainda não identifica a causa.</p></div></div>`;
        button.disabled = false;
        button.textContent = "REGISTRAR EVIDÊNCIA";
        button.onclick = () => { this.els.panelDialog.close(); resolve(); };
      }, { once: true });
    });
  }

  showCampaignReport(result, elapsedMilliseconds) {
    const score = result?.score ?? outcomeScore(this.state);
    const outcome = result?.outcome ?? outcomeLabel(score);
    const minutes = Math.max(1, Math.round(elapsedMilliseconds / 60000));
    const metrics = this.state.metrics();
    const decisions = this.state.decisions.filter((item) => !item.type.startsWith("response-day-") && item.type !== "outcome");
    const coreKnowledge = ["pcr", "sequencing", "mutation", "vaccination", "epidemiology", "contactTracing", "vaccineDevelopment", "evidenceDecisions", "scienceSociety"];
    const learned = coreKnowledge.filter((key) => this.state.unlockedKnowledge.has(key)).map((key) => KNOWLEDGE[key]);
    this.els.report.innerHTML = `
      <section class="report-wrap final-report report--${outcome.tone}">
        <div class="report-status"><div><p class="eyebrow">PROTOCOLO CONCLUÍDO · ÍNDICE ${score}</p><h2>${outcome.title}</h2><p>${outcome.text}</p></div><div class="report-grade">${outcome.grade}</div></div>
        <div class="report-grid report-grid--six">
          <div><span>CASOS</span><strong>${number(metrics.cases)}</strong></div><div><span>ÓBITOS</span><strong>${number(metrics.deaths)}</strong></div><div><span>VACINAÇÃO</span><strong>${metrics.vaccination}%</strong></div><div><span>RECURSOS</span><strong>${metrics.resources}</strong></div><div><span>CONHECIMENTO</span><strong>${metrics.knowledge}%</strong></div><div><span>TEMPO</span><strong>${metrics.day} DIAS</strong></div>
        </div>
        <div class="report-columns">
          <div><p class="eyebrow">DECISÕES IMPORTANTES</p><div class="decision-list">${decisions.map((item) => `<div><span>${escapeHTML(item.type.replace(/-/g, " "))}</span><strong>${escapeHTML(item.label)}</strong></div>`).join("") || "<p>Nenhuma decisão registrada.</p>"}</div></div>
          <div><p class="eyebrow">CONCEITOS APRENDIDOS</p><div class="learned-list">${learned.map((entry) => `<div><span>✓</span>${escapeHTML(entry.title)}</div>`).join("")}</div></div>
        </div>
        <div class="report-reflection"><strong>O QUE O PROTOCOLO MOSTROU</strong><p>PCR, sequenciamento, epidemiologia e vacinação não são respostas isoladas. Cada ferramenta cria uma evidência diferente; o resultado depende de como elas são combinadas com tempo, recursos e responsabilidade pública.</p></div>
        <div class="report-actions"><button id="review-bank" class="button button--quiet">REVER BANCO DE CONHECIMENTO</button><button id="new-campaign" class="button button--primary">NOVA INVESTIGAÇÃO</button></div>
        <small class="report-session-time">TEMPO DE SESSÃO: ${minutes} MIN · CENÁRIO FICTÍCIO</small>
      </section>`;
    this.openDialog(this.els.reportDialog);
    this.els.report.querySelector("#review-bank").addEventListener("click", () => { this.els.reportDialog.close(); this.openKnowledge(); });
    this.els.report.querySelector("#new-campaign").addEventListener("click", () => this.dispatchEvent(new Event("newcampaign")));
  }
}
