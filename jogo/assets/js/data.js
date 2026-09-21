export const CHAPTERS = [
  { index: 1, code: "P-01", title: "O PRIMEIRO CASO", description: "Três pacientes chegaram do mesmo setor. Antes de procurar uma causa, organize o que realmente sabemos.", concepts: ["investigação", "sintomas", "evidências"] },
  { index: 2, code: "P-02", title: "A AMOSTRA", description: "Os relatos criaram uma hipótese. Agora você precisa escolher e validar a evidência biológica que poderá testá-la.", concepts: ["coleta", "qualidade", "rastreabilidade"] },
  { index: 3, code: "P-03", title: "O AGENTE DESCONHECIDO", description: "Existe material genético na amostra. Use uma busca dirigida para transformar um sinal quase invisível em algo detectável.", concepts: ["PCR", "DNA e RNA", "detecção"] },
  { index: 4, code: "P-04", title: "A ASSINATURA", description: "Uma PCR positiva responde se um alvo foi encontrado. O sequenciamento poderá revelar a ordem das bases e comparar o agente.", concepts: ["sequenciamento", "genoma", "identificação"] },
  { index: 5, code: "P-05", title: "O SURTO", description: "Enquanto o laboratório investigava, novos casos apareceram. Reconstrua conexões e use recursos limitados para conter a transmissão.", concepts: ["epidemiologia", "transmissão", "rastreamento"] },
  { index: 6, code: "P-06", title: "A VACINA", description: "A sequência revelou um possível alvo. Desenvolver uma vacina exige evidência, testes, tempo, produção e distribuição.", concepts: ["vacinas", "pesquisa", "distribuição"] },
  { index: 7, code: "P-07", title: "A MUTAÇÃO", description: "Uma nova sequência chegou da zona norte. Encontre a alteração e descubra se os dados sustentam alguma consequência.", concepts: ["mutação", "variante", "incerteza"] },
  { index: 8, code: "P-08", title: "A ÚLTIMA DECISÃO", description: "As evidências estão na mesa, mas não existe recurso para proteger todos ao mesmo tempo. Ciência e sociedade se encontram aqui.", concepts: ["equidade", "risco", "comunicação"] },
];

export const CASES = [
  { id: "P-071", age: 34, origin: "Setor Aurora", arrival: "21:08", symptoms: "Febre, fadiga, tosse seca", onset: "Há 31 horas" },
  { id: "P-084", age: 52, origin: "Setor Aurora", arrival: "21:46", symptoms: "Febre, fadiga, tosse seca", onset: "Há 29 horas" },
  { id: "P-109", age: 27, origin: "Setor Aurora", arrival: "22:51", symptoms: "Febre, fadiga, tosse seca", onset: "Há 34 horas" },
];

export const DIALOGUES = {
  helena: [
    { speaker: "Dra. Helena", role: "Diretora científica", initial: "H", text: "Você chegou. Três pacientes deram entrada em menos de duas horas — todos vindos do Setor Aurora." },
    { speaker: "Dra. Helena", role: "Diretora científica", initial: "H", text: "Os sintomas mostram que existe um problema, mas não revelam qual agente o causou. Comece comparando os registros clínicos." },
  ],
  caio: [
    { speaker: "Dr. Caio", role: "Epidemiologista · chamada remota", initial: "C", text: "O padrão de tempo e localização sugere uma exposição em comum. Ainda é uma hipótese — precisamos de uma evidência biológica." },
    { speaker: "Dr. Caio", role: "Epidemiologista · chamada remota", initial: "C", text: "A equipe clínica separou materiais de três origens. Escolha a amostra que melhor responde à hipótese e confira sua rastreabilidade." },
  ],
  sampleResult: [
    { speaker: "Lia", role: "Pesquisadora molecular", initial: "L", text: "A amostra respiratória está íntegra e vinculada ao paciente correto. Uma boa análise começa muito antes de a máquina ser ligada." },
    { speaker: "Lia", role: "Pesquisadora molecular", initial: "L", text: "A triagem encontrou RNA compatível com um agente ainda desconhecido. Vamos procurar um marcador específico usando PCR." },
  ],
  pcrResult: [
    { speaker: "Lia", role: "Pesquisadora molecular", initial: "L", text: "A região-alvo ultrapassou o limite de detecção. A PCR é positiva para o marcador V7, mas isso ainda não mostra o genoma completo." },
    { speaker: "Dra. Helena", role: "Diretora científica", initial: "H", text: "Agora sabemos que o alvo estava presente. Sequencie a amostra para descobrir a assinatura genética do agente." },
  ],
  sequenceResult: [
    { speaker: "Lia", role: "Pesquisadora molecular", initial: "L", text: "A sequência é compatível com Vesper-7, um agente viral fictício de RNA. Identificamos o agente; o diagnóstico de cada paciente continua dependendo da equipe clínica." },
    { speaker: "Dr. Caio", role: "Epidemiologista · chamada urgente", initial: "C", text: "Chegaram mais nove notificações. A identificação mudou nossa pergunta: não é mais apenas ‘o que é?’, mas ‘como está se espalhando?’" },
  ],
  outbreakReady: [
    { speaker: "Dr. Caio", role: "Epidemiologista", initial: "C", text: "O mapa mostra pessoas, não pontos abstratos. Rastrear contatos ajuda a interromper cadeias, mas cada busca consome tempo e equipe." },
    { speaker: "Augusto", role: "Coordenação de recursos", initial: "A", text: "Recebemos um fundo emergencial, mas ele não paga tudo. Testar, isolar, comunicar e pesquisar competem pelos mesmos recursos." },
  ],
  vaccineReady: [
    { speaker: "Dra. Helena", role: "Diretora científica", initial: "H", text: "A contenção desacelerou o surto, mas não encerrou a ameaça. A assinatura genética revelou um alvo conservado para pesquisa de vacina." },
    { speaker: "Augusto", role: "Coordenação de recursos", initial: "A", text: "O consórcio liberou financiamento adicional. Mesmo assim, cada etapa precisa de evidência antes da próxima: desenvolver não é apertar um botão." },
  ],
  mutationAlert: [
    { speaker: "Lia", role: "Pesquisadora molecular", initial: "L", text: "Recebemos uma sequência diferente. Uma base mudou. Isso é uma mutação; chamar de variante exige observar um conjunto estável de diferenças." },
    { speaker: "Dr. Caio", role: "Epidemiologista", initial: "C", text: "A mudança genética, sozinha, não prova maior transmissão. Compare-a com os dados de campo antes de concluir." },
  ],
  finale: [
    { speaker: "Dra. Helena", role: "Diretora científica", initial: "H", text: "Você transformou sintomas em hipóteses, amostras em dados e dados em decisões. Agora há doses suficientes apenas para a primeira fase." },
    { speaker: "Augusto", role: "Coordenação de recursos", initial: "A", text: "A Região Central tem mais habitantes. A Região Norte é menor, mas apresenta transmissão muito mais alta. A escolha terá consequências diferentes." },
  ],
};

export const KNOWLEDGE = {
  investigation: { category: "INVESTIGAÇÃO", title: "Evidência antes da conclusão", body: "Uma investigação reúne informações clínicas, epidemiológicas e laboratoriais. Cada tipo de evidência responde a uma pergunta diferente. Hipóteses ficam mais confiáveis quando dados independentes apontam na mesma direção.", fact: "Observar um padrão é o começo da investigação — não o fim." },
  infectiousAgent: { category: "DIAGNÓSTICO", title: "Agente infeccioso", body: "Vírus, bactérias, fungos e parasitas são grupos que podem conter agentes infecciosos. Sintomas semelhantes podem ser provocados por agentes diferentes, por isso a identificação exige outras evidências.", fact: "Sintomas descrevem o que ocorre; identificar o agente investiga uma possível causa." },
  biologicalSample: { category: "DIAGNÓSTICO", title: "Amostra biológica", body: "Amostras podem carregar células, moléculas e material genético que funcionam como pistas. O tipo de amostra, a identificação, a coleta e a conservação influenciam a qualidade do resultado.", fact: "Procedimentos reais de coleta pertencem a profissionais treinados; o jogo usa uma representação abstrata." },
  sampleQuality: { category: "DIAGNÓSTICO", title: "Qualidade e rastreabilidade", body: "Um resultado só pode ser interpretado com segurança quando sabemos de onde veio a amostra, quando foi coletada e se permaneceu íntegra. Erros anteriores à análise podem comprometer todo o processo.", fact: "Uma máquina precisa de uma boa amostra e de um contexto confiável." },
  identificationDiagnosis: { category: "DIAGNÓSTICO", title: "Identificação × diagnóstico", body: "Identificação busca determinar qual agente está presente. Diagnóstico considera o paciente como um todo: sinais, histórico, exames e avaliação profissional.", fact: "Um resultado laboratorial isolado não substitui o diagnóstico clínico." },
  geneticMaterial: { category: "BIOLOGIA MOLECULAR", title: "Material genético", body: "DNA e RNA carregam informação genética. Organismos celulares armazenam sua informação no DNA; alguns vírus possuem genomas de RNA. Técnicas moleculares podem procurar sinais dessas moléculas em amostras.", fact: "Material genético funciona como uma assinatura que pode ser procurada e comparada." },
  dnaRna: { category: "GENÉTICA", title: "DNA e RNA", body: "DNA e RNA são moléculas relacionadas, mas não idênticas. No cenário fictício, o agente possui RNA; a plataforma converte sua informação em uma forma que o sistema consegue amplificar e ler.", fact: "O tipo de material genético influencia a estratégia de análise." },
  pcr: { category: "BIOLOGIA MOLECULAR", title: "PCR", body: "A PCR aumenta muitas vezes uma região genética escolhida. Isso transforma um sinal pequeno em algo mais fácil de detectar. É uma busca dirigida: o alvo precisa ser definido.", fact: "PCR responde muito bem à pergunta ‘este alvo está aqui?’." },
  sequencing: { category: "BIOLOGIA MOLECULAR", title: "Sequenciamento", body: "Sequenciar significa determinar a ordem das bases de um material genético. A sequência pode ser comparada a referências e usada para identificar parentescos e diferenças.", fact: "PCR procura uma região; sequenciamento revela a ordem das bases lidas." },
  epidemiology: { category: "EPIDEMIOLOGIA", title: "Epidemiologia básica", body: "A epidemiologia observa como eventos de saúde se distribuem em populações, no tempo e no espaço. Ela ajuda a formular hipóteses sobre transmissão e a medir efeitos de intervenções.", fact: "Laboratório identifica pistas; epidemiologia mostra o padrão coletivo." },
  transmission: { category: "EPIDEMIOLOGIA", title: "Transmissão", body: "Uma cadeia de transmissão conecta casos ao longo do tempo. Reduzir contatos de risco, agir rapidamente e informar a população pode diminuir novas conexões.", fact: "Contágio não é destino: decisões alteram a velocidade da cadeia." },
  contactTracing: { category: "EPIDEMIOLOGIA", title: "Rastreamento de contatos", body: "Rastrear contatos busca pessoas que podem ter sido expostas para orientar testagem, acompanhamento e outras medidas. O processo usa tempo e equipes, mas produz conhecimento acionável.", fact: "Encontrar conexões cedo pode impedir que uma cadeia cresça sem ser percebida." },
  isolation: { category: "EPIDEMIOLOGIA", title: "Isolamento", body: "O isolamento separa pessoas infectadas ou sob avaliação conforme orientação de saúde, reduzindo oportunidades de transmissão. Precisa ser proporcional, apoiado e combinado a outras medidas.", fact: "Uma intervenção funciona melhor quando é guiada por evidências e acompanhada de suporte." },
  vaccineDevelopment: { category: "VACINAS", title: "Desenvolvimento de vacinas", body: "Identificar um alvo é apenas o começo. Desenvolvimento, testes, avaliação, produção e distribuição exigem tempo, recursos e controle de qualidade.", fact: "Vacinas resultam de um processo de evidências, não de uma única descoberta." },
  vaccination: { category: "VACINAS", title: "Vacinação", body: "Vacinação protege indivíduos e pode reduzir a circulação de um agente. O impacto depende de cobertura, tempo, características do agente e acesso equitativo.", fact: "Produzir doses e fazê-las chegar às pessoas são desafios diferentes." },
  mutation: { category: "GENÉTICA", title: "Mutação", body: "Mutação é uma alteração na sequência genética. Muitas não produzem efeito relevante; algumas podem modificar características e precisam ser estudadas com dados adicionais.", fact: "Encontrar uma mudança não revela automaticamente sua consequência." },
  variant: { category: "GENÉTICA", title: "Variante", body: "Uma variante é uma versão genética distinguível por um conjunto de mutações. Para entender sua importância, cientistas combinam sequência, laboratório, clínica e epidemiologia.", fact: "Sequência detecta a diferença; múltiplas evidências ajudam a interpretar o efeito." },
  evidenceDecisions: { category: "BIOTECNOLOGIA", title: "Decisões baseadas em evidências", body: "Decidir sob pressão exige comparar qualidade dos dados, benefício esperado, custo, tempo e incerteza. Uma escolha responsável também acompanha resultados e pode ser revisada.", fact: "Evidência não elimina valores e limites — torna as escolhas mais justificáveis." },
  scienceSociety: { category: "BIOTECNOLOGIA", title: "Ciência e sociedade", body: "Respostas de saúde pública afetam pessoas de modos diferentes. Transparência, comunicação, confiança e equidade importam tanto quanto a capacidade técnica.", fact: "Ferramentas científicas ganham sentido quando ajudam decisões humanas responsáveis." },
  biotechnology: { category: "BIOTECNOLOGIA", title: "Biotecnologia em ação", body: "Biotecnologia aplica sistemas, moléculas e processos biológicos para investigar e resolver problemas. No surto, ela conecta amostras, PCR, sequenciamento, vigilância e vacinas.", fact: "A tecnologia não decide sozinha; ela amplia o que podemos observar e fazer." },
};

export const MISSION_STEPS = [
  { chapter: 1, id: "helena", objective: "Localize e converse com a Dra. Helena.", target: "helena" },
  { chapter: 1, id: "cases", objective: "Compare os registros dos três pacientes.", target: "case-board" },
  { chapter: 1, id: "caio", objective: "Atenda o Dr. Caio na ala de triagem.", target: "caio-terminal" },
  { chapter: 2, id: "sample", objective: "Retire os materiais do armário de amostras.", target: "sample-locker" },
  { chapter: 2, id: "sample-intake", objective: "Valide a Amostra #001 no analisador.", target: "analyzer" },
  { chapter: 3, id: "pcr", objective: "Use a estação de PCR para procurar o marcador V7.", target: "pcr-machine" },
  { chapter: 4, id: "sequencing", objective: "Determine a assinatura genética no sequenciador.", target: "sequencer" },
  { chapter: 5, id: "outbreak", objective: "Reconstrua as conexões no mapa epidemiológico.", target: "outbreak-map" },
  { chapter: 5, id: "response", objective: "Defina a resposta dos próximos três dias.", target: "response-console" },
  { chapter: 6, id: "vaccine", objective: "Conduza o programa de desenvolvimento da vacina.", target: "vaccine-console" },
  { chapter: 7, id: "mutation", objective: "Compare a nova sequência no terminal de variantes.", target: "variant-terminal" },
  { chapter: 8, id: "finale", objective: "Reúna a equipe na mesa de decisão.", target: "final-console" },
];

export const DEFAULT_SETTINGS = { quality: "medium", volume: 45, textSize: "normal", dialogueSpeed: "normal", reducedEffects: false, highContrast: false };

export const DEFAULT_CAMPAIGN = {
  currentStep: 0,
  currentChapter: 1,
  day: 1,
  cases: 3,
  contagion: 18,
  resources: 100,
  knowledge: 8,
  vaccination: 0,
  deaths: 0,
  evidence: 0,
  helenaMet: false,
  casesCompared: false,
  caioConsulted: false,
  hasSample: false,
  sampleValidated: false,
  pcrComplete: false,
  sequenceComplete: false,
  outbreakMapped: false,
  responseComplete: false,
  vaccineGrant: false,
  vaccineComplete: false,
  mutationComplete: false,
  completed: false,
  unlockedKnowledge: [],
  decisions: [],
  actions: [],
};
