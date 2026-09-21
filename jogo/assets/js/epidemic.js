export const RESPONSE_ACTIONS = [
  { id: "testing", title: "TESTAGEM DIRECIONADA", cost: 17, icon: "T", description: "Confirma casos nos grupos ligados à cadeia conhecida.", effects: { knowledge: 10, contagion: -3 }, tag: "+10 conhecimento · −3% contágio" },
  { id: "tracing", title: "RASTREAMENTO AMPLIADO", cost: 15, icon: "R", description: "Expande a busca de conexões a partir dos casos confirmados.", effects: { knowledge: 6, contagion: -8 }, tag: "+6 conhecimento · −8% contágio" },
  { id: "isolation", title: "ISOLAMENTO FOCAL", cost: 22, icon: "I", description: "Prioriza apoio e separação temporária nas cadeias de maior risco.", effects: { contagion: -14 }, tag: "−14% contágio" },
  { id: "communication", title: "COMUNICAÇÃO PÚBLICA", cost: 11, icon: "C", description: "Orienta a população com instruções claras e atualizadas.", effects: { contagion: -6, knowledge: 2 }, tag: "−6% contágio · +2 conhecimento" },
  { id: "research", title: "PESQUISA APLICADA", cost: 19, icon: "P", description: "Aprofunda o conhecimento do agente e acelera a resposta seguinte.", effects: { knowledge: 14, contagion: -1 }, tag: "+14 conhecimento" },
];

export function projectDay(metrics, mitigation = 0) {
  const effectiveContagion = Math.max(0, metrics.contagion - mitigation);
  const protection = metrics.vaccination * 0.0024;
  const growthRate = Math.max(0.015, 0.07 + effectiveContagion * 0.006 - protection);
  const newCases = Math.max(1, Math.round(metrics.cases * growthRate));
  const deaths = newCases >= 18 ? Math.max(0, Math.round(newCases * 0.018)) : 0;
  return { newCases, deaths, growthRate };
}

export function applyResponseTurn(state, action) {
  const before = state.metrics();
  const projected = projectDay({
    ...before,
    contagion: Math.max(0, before.contagion + (action.effects.contagion || 0)),
    vaccination: before.vaccination,
  });
  const patch = {
    day: 1,
    resources: -action.cost,
    knowledge: action.effects.knowledge || 0,
    contagion: action.effects.contagion || 0,
    cases: projected.newCases,
    deaths: projected.deaths,
  };
  state.adjust(patch);
  state.recordDecision(`response-day-${state.day}`, action.id, action.title, patch);
  return {
    action,
    newCases: projected.newCases,
    deaths: projected.deaths,
    before,
    after: state.metrics(),
  };
}

export function outcomeScore(state) {
  const metrics = state.metrics();
  const responseChoices = state.decisions.filter((item) => item.type.startsWith("response-day-")).map((item) => item.choice);
  const diversity = new Set(responseChoices).size * 1.5;
  const strategic = diversity
    + (responseChoices.includes("tracing") ? 4 : 0)
    + (responseChoices.includes("isolation") ? 5 : 0)
    + (responseChoices.includes("communication") ? 2 : 0)
    + (state.decisions.find((item) => item.type === "vaccine-allocation")?.choice === "north" ? 6 : 0)
    + (state.decisions.find((item) => item.type === "vaccine-allocation")?.choice === "split" ? 3 : 0)
    + (state.decisions.find((item) => item.type === "public-communication")?.choice === "now" ? 2 : 0);
  const containment = (100 - metrics.contagion) * 0.30;
  const coverage = metrics.vaccination * 0.15;
  const evidence = metrics.knowledge * 0.12;
  const resourceCare = Math.min(100, metrics.resources * 2) * 0.04;
  const casePenalty = Math.min(25, metrics.cases / 3);
  const deathPenalty = metrics.deaths * 1.8;
  return Math.max(0, Math.min(100, Math.round(containment + coverage + evidence + resourceCare + strategic - casePenalty - deathPenalty + 18)));
}

export function outcomeLabel(score) {
  if (score >= 72) return { level: "controlled", title: "SURTO CONTROLADO", grade: "A", tone: "mint", text: "A resposta combinou velocidade, evidência e proteção da população." };
  if (score >= 55) return { level: "costly", title: "CONTROLADO COM GRANDES PERDAS", grade: "B", tone: "amber", text: "A transmissão foi interrompida, mas o custo humano e operacional foi alto." };
  return { level: "uncontrolled", title: "SURTO FORA DE CONTROLE", grade: "C", tone: "red", text: "As cadeias continuaram ativas. O relatório indica onde outra estratégia poderia mudar o resultado." };
}
