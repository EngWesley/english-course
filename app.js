const TOTAL_DIAS = 252;
const STORAGE_KEY = 'englishCourseState';

const PHASES = [
  { id: 1, nome: 'Consolidação A2', semanas: '1-4', inicio: 1, fim: 28, meta: 'Solidificar o A2 e eliminar lacunas básicas.' },
  { id: 2, nome: 'Transição A2→B1', semanas: '5-10', inicio: 29, fim: 70, meta: 'Atingir B1 sólido com comunicação básica eficiente.' },
  { id: 3, nome: 'Consolidação B1', semanas: '11-16', inicio: 71, fim: 112, meta: 'Pensar em inglês e estabilizar o nível intermediário.' },
  { id: 4, nome: 'Transição B1→B2', semanas: '17-22', inicio: 113, fim: 154, meta: 'Chegar ao B2 para contexto profissional.' },
  { id: 5, nome: 'Consolidação B2 / Entrada C1', semanas: '23-28', inicio: 155, fim: 196, meta: 'Fluência avançada com traços de C1.' },
  { id: 6, nome: 'Refinamento C1', semanas: '29-36', inicio: 197, fim: 252, meta: 'Comunicação profissional e acadêmica fluente.' }
];

const TYPE_CLASS = {
  grammar: 'type-grammar',
  vocabulary: 'type-vocabulary',
  listening: 'type-listening',
  reading: 'type-reading',
  speaking: 'type-speaking',
  writing: 'type-writing'
};

let COURSE = [];

function todayIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const base = {
    dataInicio: todayIso(),
    diasConcluidos: [],
    checklistsDia: {},
    palavrasAprendidas: 0,
    streak: 0,
    ultimoAcesso: todayIso()
  };
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    return base;
  }
  try {
    return { ...base, ...JSON.parse(raw) };
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    return base;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDiaAtual(state) {
  const diff = daysBetween(state.dataInicio, todayIso()) + 1;
  return Math.max(1, Math.min(TOTAL_DIAS, diff));
}

function getPhaseByDay(dia) {
  return PHASES.find((p) => dia >= p.inicio && dia <= p.fim) || PHASES[PHASES.length - 1];
}

function calcularStreak(state) {
  const done = new Set(state.diasConcluidos);
  const atual = getDiaAtual(state);
  let streak = 0;
  for (let d = atual; d >= 1; d -= 1) {
    if (done.has(d)) streak += 1;
    else break;
  }
  state.streak = streak;
  state.ultimoAcesso = todayIso();
  saveState(state);
  return streak;
}

function marcarDiaConcluido(state, dia) {
  if (!state.diasConcluidos.includes(dia)) {
    state.diasConcluidos.push(dia);
    state.diasConcluidos.sort((a, b) => a - b);
  }
  calcularStreak(state);
  saveState(state);
}

function salvarChecklist(state, dia, atividadeIndex) {
  const key = String(dia);
  const list = state.checklistsDia[key] || [];
  if (list.includes(atividadeIndex)) {
    state.checklistsDia[key] = list.filter((i) => i !== atividadeIndex);
  } else {
    state.checklistsDia[key] = [...list, atividadeIndex].sort((a, b) => a - b);
  }
  saveState(state);
}

function calcularProgresso(state) {
  const geral = (state.diasConcluidos.length / TOTAL_DIAS) * 100;
  const fases = PHASES.map((phase) => {
    const total = phase.fim - phase.inicio + 1;
    const concluidos = state.diasConcluidos.filter((d) => d >= phase.inicio && d <= phase.fim).length;
    return { fase: phase.id, porcentagem: (concluidos / total) * 100, concluidos, total };
  });
  return { geral, fases };
}

function getStatusDia(state, dia) {
  if (state.diasConcluidos.includes(dia)) return 'concluido';
  if (dia === getDiaAtual(state)) return 'atual';
  return 'futuro';
}

function showToast(message) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function loadCourse() {
  const response = await fetch('data/curso.json');
  const json = await response.json();
  COURSE = json.dias || [];
}

function phaseStatus(state, phase) {
  const atual = getDiaAtual(state);
  if (atual > phase.fim) return 'done';
  if (atual >= phase.inicio && atual <= phase.fim) return 'current';
  return 'future';
}

function initDashboard(state) {
  const atual = getDiaAtual(state);
  const dia = COURSE[atual - 1];
  const progresso = calcularProgresso(state);
  const phase = getPhaseByDay(atual);
  const phaseProg = progresso.fases.find((f) => f.fase === phase.id);

  document.getElementById('progressText').textContent = `${state.diasConcluidos.length}/${TOTAL_DIAS} dias concluídos`;
  document.getElementById('progressBar').style.width = `${progresso.geral.toFixed(1)}%`;
  document.getElementById('currentPhaseName').textContent = `Fase ${phase.id} — ${phase.nome}`;
  document.getElementById('currentPhaseMeta').textContent = phase.meta;
  document.getElementById('phaseBar').style.width = `${phaseProg.porcentagem.toFixed(1)}%`;
  document.getElementById('streakValue').textContent = calcularStreak(state);
  document.getElementById('daysDone').textContent = state.diasConcluidos.length;
  document.getElementById('wordsCount').textContent = state.palavrasAprendidas;
  document.getElementById('weekCount').textContent = Math.ceil(atual / 7);
  document.getElementById('nextActivity').textContent = dia?.atividades?.[0]?.instrucao || 'Abra a aula de hoje para iniciar.';

  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';
  PHASES.forEach((p) => {
    const item = document.createElement('article');
    item.className = `timeline-item ${phaseStatus(state, p)}`;
    item.innerHTML = `<strong>Fase ${p.id}</strong><p>${p.nome}</p><small class="muted">Semanas ${p.semanas}</small>`;
    timeline.appendChild(item);
  });
}

function createActivityCard(state, diaData, activity, idx) {
  const checked = (state.checklistsDia[String(diaData.dia)] || []).includes(idx);
  const tipo = activity.tipo.toLowerCase();
  return `
    <article class="activity">
      <input type="checkbox" data-idx="${idx}" ${checked ? 'checked' : ''} />
      <div>
        <div class="activity-header">
          <span class="activity-type ${TYPE_CLASS[tipo] || ''}"><i class="${activity.icone}"></i> ${activity.tipo}</span>
          <span class="badge">${activity.duracao}</span>
        </div>
        <p>${activity.instrucao}</p>
        <a class="btn" href="${activity.link}" target="_blank" rel="noopener noreferrer">Abrir Material →</a>
      </div>
    </article>`;
}

function initHoje(state) {
  const qs = new URLSearchParams(window.location.search);
  const requested = Number(qs.get('dia') || getDiaAtual(state));
  const dia = Math.max(1, Math.min(TOTAL_DIAS, requested));
  const diaData = COURSE[dia - 1];
  const checks = state.checklistsDia[String(dia)] || [];
  const checkedCount = checks.length;

  document.getElementById('dayTitle').textContent = `Dia ${dia} — ${diaData.titulo}`;
  document.getElementById('phaseBadge').textContent = `Fase ${diaData.fase}`;
  document.getElementById('dayProgressText').textContent = `${checkedCount}/${diaData.atividades.length} atividades concluídas`;
  document.getElementById('dayProgressBar').style.width = `${(checkedCount / diaData.atividades.length) * 100}%`;
  document.getElementById('activities').innerHTML = diaData.atividades.map((a, i) => createActivityCard(state, diaData, a, i)).join('');
  document.getElementById('motivationCard').innerHTML = `<h2>Nota motivacional</h2><p>${diaData.nota_motivacional}</p>`;

  const markBtn = document.getElementById('markDayDone');
  const done = state.diasConcluidos.includes(dia);
  markBtn.disabled = done;
  if (done) markBtn.textContent = '✅ Dia já concluído';

  document.getElementById('activities').addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      salvarChecklist(state, dia, Number(event.target.dataset.idx));
      initHoje(state);
    }
  });

  markBtn.addEventListener('click', () => {
    const total = diaData.atividades.length;
    const atuais = (state.checklistsDia[String(dia)] || []).length;
    if (atuais < total) {
      const confirmou = window.confirm('Nem todas as atividades foram marcadas. Deseja concluir o dia mesmo assim?');
      if (!confirmou) return;
    }
    marcarDiaConcluido(state, dia);
    showToast(`Dia ${dia} marcado como concluído!`);
    initHoje(state);
  });

  document.getElementById('prevDay').href = `hoje.html?dia=${Math.max(1, dia - 1)}`;
  document.getElementById('nextDay').href = `hoje.html?dia=${Math.min(TOTAL_DIAS, dia + 1)}`;
}

function initPlano(state) {
  const timeline = document.getElementById('phaseTimeline');
  timeline.innerHTML = '';
  PHASES.forEach((p) => {
    const status = phaseStatus(state, p);
    const label = status === 'done' ? 'Concluída' : status === 'current' ? 'Atual' : 'Futura';
    const box = document.createElement('article');
    box.className = `phase-item ${status}`;
    box.innerHTML = `<h3>Fase ${p.id} — ${p.nome}</h3><p>Semanas ${p.semanas}</p><p>${p.meta}</p><span class="badge">${label}</span>`;
    timeline.appendChild(box);
  });

  const grid = document.getElementById('daysGrid');
  grid.innerHTML = COURSE.map((d) => {
    const status = getStatusDia(state, d.dia);
    const icon = status === 'concluido' ? '✅' : status === 'atual' ? '🔵' : '⬜';
    return `<a class="day-tile ${status === 'concluido' ? 'done' : status === 'atual' ? 'current' : ''}" href="hoje.html?dia=${d.dia}">
      <strong>Dia ${d.dia} ${icon}</strong>
      <small>${d.titulo}</small>
    </a>`;
  }).join('');
}

function renderSkills(state) {
  const counts = { Listening: 0, Speaking: 0, Reading: 0, Writing: 0, Grammar: 0, Vocabulary: 0 };
  state.diasConcluidos.forEach((d) => {
    const day = COURSE[d - 1];
    if (!day) return;
    day.atividades.forEach((a) => {
      if (counts[a.tipo] !== undefined) counts[a.tipo] += 1;
    });
  });
  const max = Math.max(...Object.values(counts), 1);
  const container = document.getElementById('skillsBars');
  container.innerHTML = Object.entries(counts).map(([name, val]) => `
    <div class="skill-row">
      <label>${name} (${val})</label>
      <div class="progress"><span style="width:${(val / max) * 100}%"></span></div>
    </div>
  `).join('');
}

function initProgresso(state) {
  const atual = getDiaAtual(state);
  const grid = document.getElementById('contribGrid');
  grid.innerHTML = '';
  for (let d = 1; d <= TOTAL_DIAS; d += 1) {
    const cell = document.createElement('div');
    cell.className = 'contrib-cell';
    if (state.diasConcluidos.includes(d)) cell.classList.add('done');
    if (d === atual) cell.classList.add('today');
    cell.title = `Dia ${d}`;
    grid.appendChild(cell);
  }

  renderSkills(state);
  document.getElementById('wordsTotal').textContent = state.palavrasAprendidas;

  document.getElementById('wordsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('wordsInput');
    const add = Number(input.value || 0);
    if (add <= 0) return;
    state.palavrasAprendidas += add;
    saveState(state);
    document.getElementById('wordsTotal').textContent = state.palavrasAprendidas;
    input.value = '';
    showToast(`+${add} palavras adicionadas.`);
  });

  const tbody = document.getElementById('last7Table');
  tbody.innerHTML = '';
  const start = Math.max(1, atual - 6);
  for (let d = atual; d >= start; d -= 1) {
    const day = COURSE[d - 1];
    const checks = (state.checklistsDia[String(d)] || []).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>Dia ${d}</td><td>${state.diasConcluidos.includes(d) ? '✅ Concluído' : '⬜ Pendente'}</td><td>${checks}/${day.atividades.length}</td>`;
    tbody.appendChild(tr);
  }

  document.getElementById('resetCourse').addEventListener('click', () => {
    const ok = window.confirm('Tem certeza que deseja reiniciar todo o curso?');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    showToast('Curso reiniciado com sucesso.');
    setTimeout(() => window.location.reload(), 500);
  });
}

function collectResources() {
  const map = new Map();
  COURSE.forEach((dia) => {
    dia.atividades.forEach((a) => {
      const key = `${a.tipo}|${a.link}`;
      if (!map.has(key)) {
        map.set(key, {
          tipo: a.tipo,
          icone: a.icone,
          nome: a.link_texto,
          descricao: a.instrucao,
          fases: [dia.fase],
          link: a.link
        });
      } else {
        const current = map.get(key);
        if (!current.fases.includes(dia.fase)) current.fases.push(dia.fase);
      }
    });
  });
  return [...map.values()].sort((a, b) => a.tipo.localeCompare(b.tipo));
}

function resourceCard(r) {
  return `<article class="resource-card">
    <p class="activity-type ${(TYPE_CLASS[r.tipo.toLowerCase()] || '')}"><i class="${r.icone}"></i> ${r.tipo}</p>
    <h3>${r.nome}</h3>
    <p class="muted">${r.descricao}</p>
    <p class="muted">Fases recomendadas: ${r.fases.sort((a, b) => a - b).join(', ')}</p>
    <a class="btn" target="_blank" rel="noopener noreferrer" href="${r.link}">Acessar →</a>
  </article>`;
}

function initRecursos(state) {
  const atual = getDiaAtual(state);
  const today = COURSE[atual - 1];
  const todayResources = today.atividades.map((a) => ({
    tipo: a.tipo,
    icone: a.icone,
    nome: a.link_texto,
    descricao: a.instrucao,
    fases: [today.fase],
    link: a.link
  }));
  document.getElementById('todayResources').innerHTML = todayResources.map(resourceCard).join('');

  const allResources = collectResources();
  const phaseFilters = document.getElementById('phaseFilters');
  const typeFilters = document.getElementById('typeFilters');
  const list = document.getElementById('resourcesList');

  let phase = 'Todos';
  let tipo = 'Todos';

  function renderFilters() {
    phaseFilters.innerHTML = ['Todos', ...PHASES.map((p) => `Fase ${p.id}`)].map((label) => `
      <button type="button" class="chip ${phase === label ? 'active' : ''}" data-phase="${label}">${label}</button>`).join('');

    typeFilters.innerHTML = ['Todos', 'Grammar', 'Vocabulary', 'Listening', 'Reading', 'Speaking', 'Writing'].map((label) => `
      <button type="button" class="chip ${tipo === label ? 'active' : ''}" data-type="${label}">${label}</button>`).join('');
  }

  function renderList() {
    const filtered = allResources.filter((r) => {
      const phaseOk = phase === 'Todos' || r.fases.includes(Number(phase.replace('Fase ', '')));
      const typeOk = tipo === 'Todos' || r.tipo === tipo;
      return phaseOk && typeOk;
    });
    list.innerHTML = filtered.map(resourceCard).join('');
  }

  renderFilters();
  renderList();

  phaseFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-phase]');
    if (!btn) return;
    phase = btn.dataset.phase;
    renderFilters();
    renderList();
  });

  typeFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    tipo = btn.dataset.type;
    renderFilters();
    renderList();
  });
}

(async function init() {
  await loadCourse();
  const state = loadState();
  const page = document.body.dataset.page;
  if (page === 'dashboard') initDashboard(state);
  if (page === 'hoje') initHoje(state);
  if (page === 'plano') initPlano(state);
  if (page === 'progresso') initProgresso(state);
  if (page === 'recursos') initRecursos(state);
})();
