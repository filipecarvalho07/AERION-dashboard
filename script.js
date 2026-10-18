
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const colors = {
  friend: "#00efce",
  unknown: "#159bff",
  threat: "#ffc247",
  critical: "#ff4055"
};

const targets = [
  { id: "A-01", kind: "friend", x: -.50, y: -.55, speed: 280, heading: 138, zone: "A2" },
  { id: "A-03", kind: "friend", x: -.22, y: .42, speed: 310, heading: 225, zone: "C4" },
  { id: "T-02", kind: "threat", x: .42, y: -.42, speed: 480, heading: 48, zone: "C7" },
  { id: "T-04", kind: "critical", x: .55, y: -.08, speed: 612, heading: 320, zone: "B3" },
  { id: "T-05", kind: "threat", x: -.62, y: -.05, speed: 390, heading: 270, zone: "D4" },
  { id: "T-07", kind: "unknown", x: .38, y: .39, speed: 350, heading: 155, zone: "A1" },
  { id: "C-01", kind: "unknown", x: -.45, y: .12, speed: 220, heading: 260, zone: "A1" }
];

let selectedId = "T-04";
let elapsed = 0;
let sweepPaused = false;
let simulationPaused = false;
let simulationSpeed = 1;
let radarRange = 100;

const alerts = [
  { id: 1, time: "14:28", priority: "Crítica", target: "T-04", description: "Contato não identificado na zona B3.", status: "Pendente" },
  { id: 2, time: "14:24", priority: "Alta", target: "T-02", description: "Contato simulado na zona C7.", status: "Pendente" },
  { id: 3, time: "14:18", priority: "Baixa", target: "A-01", description: "Contato identificado como amigo.", status: "Resolvido" },
  { id: 4, time: "14:12", priority: "Média", target: "T-05", description: "Múltiplos contatos na região D4.", status: "Visualizado" },
  { id: 5, time: "14:05", priority: "Média", target: "T-07", description: "Contato aguardando identificação.", status: "Pendente" }
];

function getTarget() {
  return targets.find(t => t.id === selectedId) || targets[0];
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.style.display = "none", 2500);
}

function showPage(pageId) {
  $$(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  $$(".nav").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  if (pageId === "radar") renderRadar("#bigRadar", true);
  if (pageId === "home") renderHome();
  if (pageId === "targets") renderTargetDetails();
  if (pageId === "alerts") renderAlerts();
}

$$(".nav").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

function radarSvg(size = 500, mini = false) {
  const center = size / 2;
  const radius = size * 0.42;
  const rangeScale = radarRange / 100;

  let svg = `
    <svg class="radar" viewBox="0 0 ${size} ${size}"
      role="img" aria-label="Radar de simulação">
      <defs>
        <radialGradient id="radarBackground">
          <stop offset="0%" stop-color="#00324b"/>
          <stop offset="100%" stop-color="#00101d"/>
        </radialGradient>
        <linearGradient id="radarBeam">
          <stop offset="0%" stop-color="#00eaff" stop-opacity=".55"/>
          <stop offset="100%" stop-color="#00eaff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <circle cx="${center}" cy="${center}" r="${radius}"
        fill="url(#radarBackground)" stroke="#00d9ff" stroke-width="1.5"/>
  `;

  for (let i = 1; i <= 4; i++) {
    svg += `<circle cx="${center}" cy="${center}"
      r="${radius * i / 4}" fill="none" stroke="#0879a4"
      stroke-width=".8"/>`;
  }

  for (let degree = 0; degree < 360; degree += 15) {
    const angle = degree * Math.PI / 180;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    svg += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}"
      stroke="#075174" opacity="${degree % 45 === 0 ? .65 : .25}"/>`;
  }

  svg += `
    <path d="M ${center - radius} ${center} H ${center + radius}
      M ${center} ${center - radius} V ${center + radius}"
      stroke="#00bde9" stroke-width="1"/>
    <text x="${center}" y="${center - radius - 8}" text-anchor="middle"
      fill="#00d9ff">N</text>
    <text x="${center}" y="${center + radius + 18}" text-anchor="middle"
      fill="#00d9ff">S</text>
    <text x="${center - radius - 14}" y="${center + 4}"
      fill="#00d9ff">O</text>
    <text x="${center + radius + 8}" y="${center + 4}"
      fill="#00d9ff">L</text>
    <g class="sweep ${sweepPaused ? "paused" : ""}">
      <path d="M ${center} ${center}
        L ${center} ${center - radius}
        A ${radius} ${radius} 0 0 1
        ${center + radius * .55} ${center - radius * .84} Z"
        fill="url(#radarBeam)"/>
      <line x1="${center}" y1="${center}"
        x2="${center}" y2="${center - radius}"
        stroke="#00eaff" stroke-width="1.5"/>
    </g>
  `;

  if (!mini) {
    [25, 50, 75, 100].forEach(value => {
      svg += `<text x="${center + radius * .63}"
        y="${center - radius * value / 100 - 4}"
        font-size="11" fill="#48a7d0">${Math.round(value * rangeScale)} km</text>`;
    });
  }

  const filter = $("#filter")?.value || "all";

  targets.forEach(target => {
    if (filter !== "all") {
      const matches =
        (filter === "friend" && target.kind === "friend") ||
        (filter === "unknown" && target.kind === "unknown") ||
        (filter === "threat" && ["threat", "critical"].includes(target.kind));

      if (!matches) return;
    }

    const x = center + target.x * radius;
    const y = center + target.y * radius;
    const color = colors[target.kind];
    const selected = target.id === selectedId;

    svg += `
      <g class="radar-target" data-target="${target.id}"
        style="color:${color}">
        ${selected ? `<circle cx="${x}" cy="${y}" r="16"
          fill="none" stroke="${color}" stroke-width="2">
          <animate attributeName="r" values="13;20;13"
            dur="2s" repeatCount="indefinite"/>
        </circle>` : ""}
        <circle cx="${x}" cy="${y}" r="6"
          fill="${color}" fill-opacity=".25" stroke="${color}" stroke-width="2"/>
        <text x="${x + 10}" y="${y - 10}" fill="${color}"
          stroke="#00101e" stroke-width="3" paint-order="stroke"
          font-size="12" font-weight="bold">${target.id}</text>
      </g>
    `;
  });

  return svg + `<circle cx="${center}" cy="${center}" r="3" fill="#00eaff"/></svg>`;
}

function bindRadar(container) {
  $(container).querySelectorAll("[data-target]").forEach(element => {
    element.addEventListener("click", () => {
      selectedId = element.dataset.target;
      renderRadar("#bigRadar", true);
      renderHome();
      renderTargetDetails();
      renderSelectedDetails();
      notify("Contato " + selectedId + " selecionado");
    });
  });
}

function renderRadar(selector, full = false) {
  const container = $(selector);
  if (!container) return;

  container.innerHTML = radarSvg(full ? 620 : 500, !full);
  bindRadar(selector);

  if (selector === "#bigRadar") renderSelectedDetails();
}

function renderSelectedDetails() {
  const target = getTarget();
  const container = $("#selectedDetails");
  if (!container) return;

  container.innerHTML = `
    <h2 style="color:${colors[target.kind]}">${target.id}</h2>
    ${detail("Classificação", target.kind)}
    ${detail("Distância", (Math.hypot(target.x, target.y) * 65 + 10).toFixed(1) + " km")}
    ${detail("Velocidade", target.speed + " m/s")}
    ${detail("Direção", target.heading + "°")}
    ${detail("Zona", target.zone)}
  `;
}

function detail(label, value) {
  return `<div class="detail"><span>${label}</span><b>${value}</b></div>`;
}

function renderHome() {
  const friends = targets.filter(t => t.kind === "friend").length;
  const threats = targets.filter(t => ["threat", "critical"].includes(t.kind)).length;
  const unknown = targets.filter(t => t.kind === "unknown").length;

  $("#targetCount").textContent = targets.length;
  $("#friendCount").textContent = friends;
  $("#threatCount").textContent = threats;
  $("#homeFriends").textContent = friends;
  $("#homeThreats").textContent = threats;
  $("#homeUnknown").textContent = unknown;
  $("#homeTotal").textContent = targets.length;

  $("#recentAlerts").innerHTML = alerts.slice(0, 4).map(alert => `
    <div class="alert">
      <span class="${priorityClass(alert.priority)}">⚠ ${alert.priority}</span>
      <span>${alert.time}</span>
      <span>${alert.description}</span>
    </div>
  `).join("");

  renderRadar("#homeRadar");
}

function renderTargetDetails() {
  const target = getTarget();

  $("#targetDetails").innerHTML = `
    <h2 style="color:${colors[target.kind]}">${target.id}</h2>
    ${detail("Tipo", target.kind)}
    ${detail("Velocidade", target.speed + " m/s")}
    ${detail("Direção", target.heading + "°")}
    ${detail("Zona", target.zone)}
  `;

  const startX = 10;
  const startY = 100;
  const endX = 290 + target.x * 80;
  const endY = 70 + target.y * 45;

  $("#trajectory").innerHTML = `
    <svg viewBox="0 0 400 160" style="width:100%;max-width:500px">
      <defs>
        <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke="#075078"/>
        </pattern>
      </defs>
      <rect width="400" height="160" fill="url(#grid)"/>
      <path d="M${startX} ${startY} L${endX} ${endY}"
        stroke="${colors[target.kind]}" stroke-width="2" stroke-dasharray="7 5"/>
      <circle cx="${startX}" cy="${startY}" r="6"
        fill="${colors[target.kind]}"/>
      <circle cx="${endX}" cy="${endY}" r="7"
        fill="none" stroke="${colors[target.kind]}" stroke-width="2"/>
      <text x="${startX + 10}" y="${startY - 10}" fill="${colors[target.kind]}">
        Atual
      </text>
      <text x="${endX - 5}" y="${endY - 12}" fill="${colors[target.kind]}">
        Estimativa
      </text>
    </svg>
  `;
}

function priorityClass(priority) {
  if (priority === "Crítica") return "red";
  if (priority === "Alta" || priority === "Média") return "yellow";
  return "green";
}

function renderAlerts() {
  const search = ($("#alertSearch").value || "").toLowerCase();
  const status = $("#alertStatus").value;

  const filtered = alerts.filter(alert => {
    const matchesText =
      `${alert.target} ${alert.description}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || alert.status === status;
    return matchesText && matchesStatus;
  });

  $("#alertList").innerHTML = filtered.map(alert => `
    <div class="alert">
      <div>
        <b class="${priorityClass(alert.priority)}">${alert.priority}</b>
        <p>${alert.time} · ${alert.target}</p>
        <span>${alert.description}</span>
      </div>
      <button data-alert="${alert.id}">${alert.status}</button>
    </div>
  `).join("") || "<p>Nenhum alerta encontrado.</p>";

  $$("[data-alert]").forEach(button => {
    button.addEventListener("click", () => {
      const alert = alerts.find(a => a.id === Number(button.dataset.alert));
      const statuses = ["Pendente", "Visualizado", "Resolvido"];
      alert.status = statuses[(statuses.indexOf(alert.status) + 1) % statuses.length];
      renderAlerts();
      renderHome();
      notify("Status atualizado: " + alert.status);
    });
  });
}

$("#filter").addEventListener("change", () => renderRadar("#bigRadar", true));

$("#range").addEventListener("change", event => {
  radarRange = Number(event.target.value);
  renderRadar("#bigRadar", true);
});

$("#pauseSweep").addEventListener("click", () => {
  sweepPaused = !sweepPaused;
  $("#pauseSweep").textContent = sweepPaused
    ? "Retomar varredura"
    : "Pausar varredura";

  $$(".sweep").forEach(sweep => {
    sweep.classList.toggle("paused", sweepPaused);
  });
});

$("#resetRadar").addEventListener("click", () => {
  radarRange = 100;
  $("#range").value = "100";
  $("#filter").value = "all";
  renderRadar("#bigRadar", true);
  notify("Radar restaurado");
});

$("#alertSearch").addEventListener("input", renderAlerts);
$("#alertStatus").addEventListener("change", renderAlerts);

$("#saveDecision").addEventListener("click", () => {
  notify("Observação registrada nesta sessão.");
});

$("#simSpeed").addEventListener("change", event => {
  simulationSpeed = Number(event.target.value);
  notify("Velocidade ajustada");
});

$("#pauseSimulation").addEventListener("click", () => {
  simulationPaused = !simulationPaused;
  $("#pauseSimulation").textContent = simulationPaused
    ? "Retomar simulação"
    : "Pausar simulação";
});

$("#restartSimulation").addEventListener("click", () => {
  elapsed = 0;
  notify("Cronômetro reiniciado");
});

function tick() {
  if (simulationPaused) return;

  elapsed += simulationSpeed;

  const seconds = Math.floor(elapsed);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");

  $("#clock").textContent =
    `${hours}:${minutes}:${remainder}`;

  targets.forEach(target => {
    target.x += 0.0015 * simulationSpeed *
      (target.id === "T-04" ? -1 : 1);
    target.y += 0.0008 * simulationSpeed;

    if (target.x > .78 || target.x < -.78)
      target.x *= -1;

    if (target.y > .78)
      target.y = -.78;

    target.heading = (target.heading + 1) % 360;
  });

}

renderHome();
renderRadar("#bigRadar", true);
renderSelectedDetails();
renderTargetDetails();
renderAlerts();
setInterval(tick, 1000);
