import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { stations } from "./stations";
import type { Station } from "./types";

const mapCenter: [number, number] = [3.07, 101.65];

const map = L.map("map", {
  center: mapCenter,
  zoom: 11,
  zoomControl: true,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

const typeColors: Record<string, string> = {
  LRT: "#E0115F",
  MRT: "#FFD700",
  "Commuter rail": "#DC2420",
  Monorail: "#009688",
  BRT: "#9C27B0",
  "Airport rail link": "#2196F3",
};

const allTypes = Object.keys(typeColors);

function getColor(types: string[]): string {
  for (const t of types) {
    const color = typeColors[t];
    if (color) return color;
  }
  return "#666666";
}

function typeSummary(types: string[]): string {
  return types.join(", ");
}

function linesSummary(lines: string[]): string {
  return lines.join("<br>");
}

function codesSummary(codes: string[]): string {
  return codes.join(" / ");
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const markerLayer = L.layerGroup().addTo(map);
let allMarkers: { station: Station; marker: L.Marker }[] = [];

const searchInput = document.getElementById("search") as HTMLInputElement;
const resultsList = document.getElementById("results") as HTMLUListElement;
const stationDetails = document.getElementById("station-details") as HTMLDivElement;
const countLabel = document.getElementById("count-label") as HTMLDivElement;
const distanceSlider = document.getElementById("distance-slider") as HTMLInputElement;
const distanceLabel = document.getElementById("distance-label") as HTMLDivElement;
const typeFiltersContainer = document.getElementById("type-filters") as HTMLDivElement;

let selectedMarker: L.Marker | null = null;
const markerMap = new Map<string, L.Marker>();

function createMarker(station: Station): L.Marker {
  const color = getColor(station.type);
  const icon = L.divIcon({
    className: "station-marker",
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  const marker = L.marker([station.latitude, station.longitude], { icon });

  marker.bindTooltip(station.station_name, { direction: "top", offset: [0, -8] });

  marker.on("click", () => {
    showStation(station);
    if (selectedMarker) selectedMarker.setZIndexOffset(0);
    marker.setZIndexOffset(1000);
    selectedMarker = marker;
  });

  return marker;
}

for (const station of stations) {
  const marker = createMarker(station);
  allMarkers.push({ station, marker });
  markerMap.set(station.station_name, marker);
}

let activeTypeFilters = new Set(allTypes);
let maxDistanceKm = 150;

function getFilteredStations(): Station[] {
  const center = map.getCenter();
  return stations.filter((s) => {
    if (!s.type.some((t) => activeTypeFilters.has(t))) return false;
    if (maxDistanceKm < 150) {
      const d = haversineKm(center.lat, center.lng, s.latitude, s.longitude);
      if (d > maxDistanceKm) return false;
    }
    return true;
  });
}

function applyFilters(): void {
  const filtered = getFilteredStations();
  const filteredSet = new Set(filtered);

  markerLayer.clearLayers();
  for (const { station, marker } of allMarkers) {
    if (filteredSet.has(station)) {
      markerLayer.addLayer(marker);
    }
  }

  countLabel.textContent = `Showing ${filtered.length} stations`;

  const q = searchInput.value.trim().toLowerCase();
  if (q.length >= 1) {
    const searchResults = filtered.filter(
      (s) =>
        s.station_name.toLowerCase().includes(q) ||
        s.station_code.some((c) => c.toLowerCase().includes(q)) ||
        s.line.some((l) => l.toLowerCase().includes(q))
    );
    renderSearchResults(searchResults, q.length >= 1);
  }
}

function showStation(station: Station): void {
  stationDetails.innerHTML = `
    <h3>${station.station_name}</h3>
    <table>
      <tr><td><strong>Code</strong></td><td>${codesSummary(station.station_code)}</td></tr>
      <tr><td><strong>Line(s)</strong></td><td>${linesSummary(station.line)}</td></tr>
      <tr><td><strong>Type</strong></td><td>${typeSummary(station.type)}</td></tr>
      <tr><td><strong>Lat</strong></td><td>${station.latitude.toFixed(5)}</td></tr>
      <tr><td><strong>Lon</strong></td><td>${station.longitude.toFixed(5)}</td></tr>
    </table>
  `;
}

function renderSearchResults(results: Station[], isActive: boolean): void {
  resultsList.innerHTML = "";
  if (!isActive || results.length === 0) {
    resultsList.classList.remove("active");
    if (isActive) {
      const li = document.createElement("li");
      li.textContent = "No stations found";
      li.classList.add("no-results");
      resultsList.appendChild(li);
      resultsList.classList.add("active");
    }
    return;
  }
  resultsList.classList.add("active");
  for (const station of results.slice(0, 50)) {
    const li = document.createElement("li");
    li.textContent = `${station.station_name} (${codesSummary(station.station_code)})`;
    li.addEventListener("click", () => {
      const marker = markerMap.get(station.station_name);
      if (marker) {
        map.setView([station.latitude, station.longitude], 15);
        marker.fire("click");
      }
      resultsList.classList.remove("active");
      searchInput.value = station.station_name;
    });
    resultsList.appendChild(li);
  }
}

// Type filter checkboxes
for (const type of allTypes) {
  const label = document.createElement("label");
  label.className = "type-checkbox";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = true;
  cb.addEventListener("change", () => {
    if (cb.checked) activeTypeFilters.add(type);
    else activeTypeFilters.delete(type);
    applyFilters();
  });
  const dot = document.createElement("span");
  dot.className = "type-dot";
  dot.style.background = typeColors[type];
  label.append(cb, dot, document.createTextNode(" " + type));
  typeFiltersContainer.appendChild(label);
}

// Distance slider
distanceSlider.addEventListener("input", () => {
  maxDistanceKm = parseInt(distanceSlider.value);
  distanceLabel.textContent = maxDistanceKm >= 150 ? "No limit" : `${maxDistanceKm} km`;
  applyFilters();
});

// Search
let searchTimeout: ReturnType<typeof setTimeout>;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = getFilteredStations();
    const results = q.length >= 1
      ? filtered.filter(
          (s) =>
            s.station_name.toLowerCase().includes(q) ||
            s.station_code.some((c) => c.toLowerCase().includes(q)) ||
            s.line.some((l) => l.toLowerCase().includes(q))
        )
      : [];
    renderSearchResults(results, q.length >= 1);
  }, 150);
});

document.addEventListener("click", (e) => {
  if (!(e.target as HTMLElement).closest(".search-section")) {
    resultsList.classList.remove("active");
  }
});

// ─── Route planner ──────────────────────────────────────────────

const routeFrom = document.getElementById("route-from") as HTMLSelectElement;
const routeTo = document.getElementById("route-to") as HTMLSelectElement;
const routeBtn = document.getElementById("route-btn") as HTMLButtonElement;
const routeInfo = document.getElementById("route-info") as HTMLDivElement;

// Build network graph: stations are nodes; edges connect stations on the same line
const sortedNames = [...stations]
  .map((s) => s.station_name)
  .sort((a, b) => a.localeCompare(b));

for (const name of sortedNames) {
  const opt1 = document.createElement("option");
  opt1.value = name;
  opt1.textContent = name;
  const opt2 = opt1.cloneNode(true) as HTMLOptionElement;
  routeFrom.appendChild(opt1);
  routeTo.appendChild(opt2);
}

function stationIndex(name: string): number {
  return stations.findIndex((s) => s.station_name === name);
}

// Build adjacency list: group stations by line, sort by code, connect consecutive + same-coord interchanges
function buildGraph(): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (let i = 0; i < stations.length; i++) adj.set(i, []);

  const addEdge = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return;
    if (!adj.get(a)!.includes(b)) adj.get(a)!.push(b);
    if (!adj.get(b)!.includes(a)) adj.get(b)!.push(a);
  };

  // Group by line, sort by station code, connect consecutive
  const byLine = new Map<string, number[]>();
  for (let i = 0; i < stations.length; i++) {
    for (const line of stations[i].line) {
      if (!byLine.has(line)) byLine.set(line, []);
      byLine.get(line)!.push(i);
    }
  }

  for (const [line, indices] of byLine) {
    indices.sort((a, b) => {
      // Find matching code prefix for this line, sort alphanumerically
      const codeA = stations[a].station_code.find((c) => c.match(/^[A-Z]+/)?.[0]) ?? "";
      const codeB = stations[b].station_code.find((c) => c.match(/^[A-Z]+/)?.[0]) ?? "";
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
    for (let i = 0; i < indices.length - 1; i++) {
      addEdge(indices[i], indices[i + 1]);
    }
  }

  // Connect interchanges (stations at the same lat/lng)
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      if (
        stations[i].latitude === stations[j].latitude &&
        stations[i].longitude === stations[j].longitude
      ) {
        addEdge(i, j);
      }
    }
  }

  // Connect stations with matching station_code (e.g. KD01 vs KJ17 on same physical station)
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      if (
        stations[i].station_code.some((c) => stations[j].station_code.includes(c))
      ) {
        addEdge(i, j);
      }
    }
  }

  return adj;
}

const graph = buildGraph();

function shortestPath(fromIdx: number, toIdx: number): number[] | null {
  if (fromIdx === toIdx) return [fromIdx];
  const visited = new Set<number>();
  const prev = new Map<number, number>();
  const queue: number[] = [fromIdx];
  visited.add(fromIdx);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toIdx) {
      const path: number[] = [];
      let node: number | undefined = toIdx;
      while (node !== undefined) {
        path.unshift(node);
        node = prev.get(node);
      }
      return path;
    }
    for (const nb of graph.get(cur) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  return null;
}

let routePolyline: L.Polyline | null = null;
let routeMarkers: L.Marker[] = [];

function clearRoute() {
  if (routePolyline) map.removeLayer(routePolyline);
  for (const m of routeMarkers) map.removeLayer(m);
  routeMarkers = [];
  routePolyline = null;
}

function planRoute() {
  clearRoute();
  const fromName = routeFrom.value;
  const toName = routeTo.value;
  if (!fromName || !toName) {
    routeInfo.classList.remove("active");
    return;
  }

  const fromIdx = stationIndex(fromName);
  const toIdx = stationIndex(toName);
  if (fromIdx < 0 || toIdx < 0) return;

  const path = shortestPath(fromIdx, toIdx);
  if (!path) {
    routeInfo.innerHTML = "No route found between these stations.";
    routeInfo.classList.add("active");
    return;
  }

  // Draw polyline
  const latlngs: [number, number][] = path.map((i) => [
    stations[i].latitude,
    stations[i].longitude,
  ]);
  routePolyline = L.polyline(latlngs, {
    color: "#e94560",
    weight: 4,
    opacity: 0.8,
    dashArray: "8, 6",
  }).addTo(map);

  // Markers at major stations (first, last, interchange/multi-line)
  const pathSet = new Set(path);
  const showIdx = new Set<number>();
  showIdx.add(path[0]);
  showIdx.add(path[path.length - 1]);
  for (const i of path) {
    if (stations[i].line.length > 1 || stations[i].station_code.length > 1) {
      showIdx.add(i);
    }
  }

  for (const i of showIdx) {
    const color = getColor(stations[i].type);
    const icon = L.divIcon({
      className: "station-marker",
      html: `<div style="width:12px;height:12px;background:${color};border:2px solid #e94560;border-radius:50%;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    const m = L.marker([stations[i].latitude, stations[i].longitude], { icon }).addTo(map);
    m.bindTooltip(
      `${stations[i].station_name} (${stations[i].station_code.join("/")})`,
      { direction: "top" },
    );
    routeMarkers.push(m);
  }

  // Fit map to route
  map.fitBounds(routePolyline.getBounds().pad(0.15));

  // Route info
  const totalKm = latlngs.reduce((sum, _, idx) => {
    if (idx === 0) return 0;
    return sum + haversineKm(latlngs[idx - 1][0], latlngs[idx - 1][1], latlngs[idx][0], latlngs[idx][1]);
  }, 0);

  const linesUsed = new Set<string>();
  for (const i of path) for (const l of stations[i].line) linesUsed.add(l);

  routeInfo.innerHTML = `
    <strong>${fromName}</strong> → <strong>${toName}</strong><br>
    Stations: ${path.length} &middot; Distance: ${totalKm.toFixed(1)} km<br>
    Lines: ${[...linesUsed].join(", ")}
  `;
  routeInfo.classList.add("active");
}

routeBtn.addEventListener("click", planRoute);

// Clear route when selections change
routeFrom.addEventListener("change", () => { if (routeTo.value) planRoute(); });
routeTo.addEventListener("change", () => { if (routeFrom.value) planRoute(); });

// ─── Locate me ──────────────────────────────────────────────────
const locateBtn = document.getElementById("locate-btn") as HTMLButtonElement;
let userMarker: L.Marker | null = null;

locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locateBtn.textContent = "Geolocation not supported";
    return;
  }
  locateBtn.disabled = true;
  locateBtn.textContent = "Locating...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 14);

      if (userMarker) map.removeLayer(userMarker);
      const icon = L.divIcon({
        className: "station-marker",
        html: `<div style="width:18px;height:18px;background:#e94560;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      userMarker = L.marker([latitude, longitude], { icon }).addTo(map);
      userMarker.bindTooltip("You are here", { direction: "top" }).openTooltip();

      locateBtn.textContent = "📍 Use my location";
      locateBtn.disabled = false;
    },
    () => {
      locateBtn.textContent = "Location denied";
      locateBtn.disabled = false;
      setTimeout(() => {
        locateBtn.textContent = "📍 Use my location";
      }, 2500);
    },
  );
});

// Legend
class LegendControl extends L.Control {
  onAdd(_map: L.Map): HTMLElement {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = "<h4>Legend</h4>";
    for (const [label, color] of Object.entries(typeColors)) {
      div.innerHTML += `<div class="legend-item"><span style="background:${color};display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;"></span>${label}</div>`;
    }
    return div;
  }
}
new LegendControl({ position: "bottomright" }).addTo(map);