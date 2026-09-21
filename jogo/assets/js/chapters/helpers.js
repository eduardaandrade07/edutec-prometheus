export const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function openPanel(ui, html, locked = true) {
  ui.els.panelDialog.dataset.locked = String(locked);
  ui.els.panelContent.innerHTML = html;
  ui.openDialog(ui.els.panelDialog);
  return ui.els.panelContent;
}

export function closePanel(ui) {
  if (ui.els.panelDialog.open) ui.els.panelDialog.close();
  ui.els.panelDialog.dataset.locked = "false";
}

export function setFeedback(root, html, tone = "default") {
  const element = root.querySelector("[data-feedback]");
  if (!element) return;
  element.className = `activity-feedback${tone === "warning" ? " activity-feedback--warning" : ""}${tone === "success" ? " activity-feedback--success" : ""}`;
  element.innerHTML = html;
}

export function metricSnapshot(metrics) {
  return `
    <div class="activity-metrics" aria-label="Indicadores atuais">
      <span><small>DIA</small><strong>${String(metrics.day).padStart(2, "0")}</strong></span>
      <span><small>CASOS</small><strong>${metrics.cases}</strong></span>
      <span><small>CONTÁGIO</small><strong>${metrics.contagion}%</strong></span>
      <span><small>RECURSOS</small><strong>${metrics.resources}</strong></span>
      <span><small>CONHEC.</small><strong>${metrics.knowledge}%</strong></span>
      <span><small>VACINAÇÃO</small><strong>${metrics.vaccination}%</strong></span>
    </div>`;
}

export function unlockEntries(state, ui, keys) {
  const unlocked = state.unlockMany(keys);
  unlocked.forEach((key, index) => {
    window.setTimeout(() => ui.unlockKnowledge(key), index * 700);
  });
}
