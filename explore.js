/* Mapa e descobertas: interação acessível por toque, mouse e teclado. */
(() => {
  'use strict';
  const areas = {
    saude: ['Vermelha','Saúde humana','Pesquise como células, genes e proteínas ajudam a compreender doenças e desenvolver formas de cuidado.','#a8432a'],
    industrial: ['Branca','Indústria','Descubra onde processos biológicos transformam matérias-primas e reduzem etapas industriais.','#6e685c'],
    agricola: ['Verde','Agricultura','Acompanhe a relação entre plantas, solo e soluções biológicas para produzir alimentos.','#5f6b37'],
    marinha: ['Azul','Recursos marinhos','Explore organismos aquáticos e o conhecimento que nasce da biodiversidade dos oceanos.','#2e5b78'],
    alimentar: ['Amarela','Alimentos','Entenda como a fermentação transforma alimentos e abre possibilidades de nutrição.','#a97c22'],
    ambiental: ['Cinza','Meio ambiente','Observe como sistemas vivos podem indicar alterações ambientais e apoiar a recuperação.','#625d54'],
    bioinformatica: ['Dourada','Bioinformática','Conecte sequências biológicas e análise de dados para encontrar padrões invisíveis.','#8f7238'],
    etica: ['Roxa','Ética e regulamentação','Considere direitos, evidências e responsabilidade antes de aplicar uma inovação.','#6b5470'],
    florestal: ['Marrom','Florestas','Investigue o patrimônio genético das árvores e os caminhos para conservar a biodiversidade.','#6b4c32'],
    forense: ['Preta','Investigação forense','Entenda como vestígios biológicos e análise genética ajudam a responder perguntas.','#48453f'],
    enzimas: ['Laranja','Enzimas','Veja como catalisadores biológicos tornam transformações mais específicas e eficientes.','#b55d26']
  };

  const key = 'prometheus-descobertas-v1';
  let completed = [];
  try { completed = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { completed = []; }
  if (!Array.isArray(completed)) completed = [];
  const progress = document.querySelector('[data-mapa-progresso]');
  const paintProgress = () => {
    if (progress) progress.textContent = `${completed.length} de 11 descobertas feitas neste navegador`;
    document.querySelectorAll('.mapa__vivo .area').forEach(node => {
      node.dataset.concluida = String(completed.includes(node.dataset.pagina));
    });
  };
  paintProgress();

  const map = document.getElementById('mapaVivo');
  if (map) {
    const nodes = [...map.querySelectorAll('.area[data-pagina]')];
    const viewer = document.getElementById('mapaVisor');
    const update = node => {
      const id = node.dataset.pagina;
      const data = areas[id];
      if (!data || !viewer) return;
      nodes.forEach(n => n.classList.toggle('is-preview', n === node));
      viewer.style.setProperty('--cor-visita', data[3]);
      viewer.querySelector('[data-visor-numero]').textContent = node.querySelector('.area__numero').textContent;
      viewer.querySelector('[data-visor-campo]').textContent = data[1];
      viewer.querySelector('[data-visor-titulo]').textContent = `Biotecnologia ${data[0]}`;
      viewer.querySelector('[data-visor-texto]').textContent = data[2];
      viewer.querySelector('[data-visor-link]').href = `areas/${id}/index.html`;
      viewer.querySelector('[data-visor-estado]').textContent = completed.includes(id) ? 'Descoberta concluída' : 'Descoberta disponível';
    };
    nodes.forEach(node => {
      node.addEventListener('mouseenter', () => update(node));
      node.addEventListener('focus', () => update(node));
    });
    if (nodes.length) update(nodes[0]);
  }

  const mission = document.querySelector('[data-missao]');
  if (mission) {
    const id = mission.dataset.missao;
    const pieces = [...mission.querySelectorAll('[data-peca]')];
    const slots = [...mission.querySelectorAll('[data-espaco]')];
    const feedback = mission.querySelector('[data-feedback]');
    const connection = mission.querySelector('[data-conexao]');
    let order = [];
    let certos = [];

    function draw() {
      pieces.forEach(p => { p.hidden = order.includes(p.dataset.peca); });
      slots.forEach((slot, i) => {
        const selected = pieces.find(p => p.dataset.peca === order[i]);
        slot.classList.toggle('has-piece', Boolean(selected));
        slot.classList.toggle('is-certo', Boolean(certos[i]));
        slot.innerHTML = `<b>${String(i + 1).padStart(2, '0')} · ${['Observar','Interpretar','Aplicar'][i]}${certos[i] ? ' ✓' : ''}</b>${selected ? selected.textContent : 'Coloque aqui uma etapa'}`;
      });
    }
    function check() {
      if (order.filter(Boolean).length < 3) return;
      if (order.join(',') === '1,2,3') {
        certos = [true, true, true];
        draw();
        mission.classList.add('is-complete');
        feedback.textContent = mission.dataset.explicacao;
        if (connection) connection.hidden = false;
        if (!completed.includes(id)) {
          completed.push(id);
          try { localStorage.setItem(key, JSON.stringify(completed)); } catch (_) { /* navegação privada */ }
          paintProgress();
        }
        return;
      }
      // Mantém as etapas certas e devolve as outras para tentar de novo
      let acertos = 0;
      order = order.map((v, i) => {
        if (v === String(i + 1)) { certos[i] = true; acertos++; return v; }
        return null;
      });
      draw();
      feedback.textContent = acertos
        ? `${acertos} de 3 etapas no lugar certo (marcadas com ✓). As outras voltaram para as peças: tente outra ordem.`
        : 'Nenhuma etapa no lugar certo ainda. As peças voltaram: pense no que vem primeiro — observar, depois interpretar, depois aplicar.';
    }
    function place(value, index) {
      if (mission.classList.contains('is-complete')) return;
      if (!pieces.some(p => p.dataset.peca === value) || order.includes(value)) return;
      if (index === undefined) index = [0, 1, 2].find(i => !order[i]);
      if (index === undefined || index > 2 || order[index]) return;
      order[index] = value;
      draw();
      if (order.filter(Boolean).length < 3) feedback.textContent = 'Toque ou clique nas peças para colocá-las na linha, na ordem: observar, interpretar, aplicar.';
      check();
    }
    pieces.forEach(piece => {
      piece.addEventListener('click', () => place(piece.dataset.peca));
      piece.addEventListener('dragstart', event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', piece.dataset.peca); });
    });
    slots.forEach((slot, i) => {
      slot.addEventListener('click', () => {
        if (order[i] && !certos[i] && !mission.classList.contains('is-complete')) { order[i] = null; draw(); }
      });
      slot.addEventListener('dragover', event => { event.preventDefault(); slot.classList.add('is-over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('is-over'));
      slot.addEventListener('drop', event => {
        event.preventDefault();
        slot.classList.remove('is-over');
        place(event.dataTransfer.getData('text/plain'), i);
      });
    });
    mission.querySelector('[data-reiniciar]').addEventListener('click', () => {
      order = []; certos = [];
      mission.classList.remove('is-complete');
      if (connection) connection.hidden = true;
      draw();
      feedback.textContent = 'Toque ou clique nas peças para colocá-las na linha, na ordem: observar, interpretar, aplicar.';
    });
    draw();
    feedback.textContent = 'Toque ou clique nas peças para colocá-las na linha, na ordem: observar, interpretar, aplicar.';

    const scale = mission.querySelector('[data-escala]');
    if (scale) {
      const views = [
        ['Organismo','Uma questão de saúde começa com uma pessoa e seu contexto. Uma observação isolada não determina um tratamento.','01'],
        ['Célula','Dentro das células, proteínas executam tarefas e podem ser estudadas como possíveis alvos de pesquisa.','02'],
        ['DNA','A sequência genética traz pistas; interpretá-las exige evidências, validação e cuidado com a privacidade.','03']
      ];
      scale.querySelectorAll('[data-nivel]').forEach(button => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.nivel);
          const item = views[index];
          scale.dataset.nivel = String(index);
          scale.querySelector('[data-escala-simbolo]').textContent = item[2];
          scale.querySelector('[data-escala-titulo]').textContent = item[0];
          scale.querySelector('[data-escala-texto]').textContent = item[1];
          scale.querySelectorAll('[data-nivel]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        });
      });
    }
  }
})();
