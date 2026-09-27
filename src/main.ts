import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { stations } from "./stations";
import type { Station } from "./types";

const map = L.map("map", {
  center: [3.07, 101.65],
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

const markerLayer = L.layerGroup();

const searchInput = document.getElementById("search") as HTMLInputElement;
const resultsList = document.getElementById("results") as HTMLUListElement;
const stationDetails = document.getElementById("station-details") as HTMLDivElement;

let selectedMarker: L.Marker | null = null;
const markerMap = new Map<string, L.Marker>();

for (const station of stations) {
  const color = getColor(station.type);
  const icon = L.divIcon({
    className: "station-marker",
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const marker = L.marker([station.latitude, station.longitude], { icon });

  marker.bindTooltip(station.station_name, {
    direction: "top",
    offset: [0, -8],
  });

  marker.on("click", () => {
    showStation(station);
    if (selectedMarker) {
      selectedMarker.setZIndexOffset(0);
    }
    marker.setZIndexOffset(1000);
    selectedMarker = marker;
  });

  markerLayer.addLayer(marker);
  markerMap.set(station.station_name, marker);
}

map.addLayer(markerLayer);

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

// Search
function filterStations(query: string): Station[] {
  const q = query.toLowerCase();
  return stations.filter(
    (s) =>
      s.station_name.toLowerCase().includes(q) ||
      s.station_code.some((c) => c.toLowerCase().includes(q)) ||
      s.line.some((l) => l.toLowerCase().includes(q))
  );
}

let searchTimeout: ReturnType<typeof setTimeout>;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchInput.value.trim();
    if (q.length < 1) {
      resultsList.innerHTML = "";
      resultsList.classList.remove("active");
      return;
    }
    const results = filterStations(q);
    resultsList.innerHTML = "";
    resultsList.classList.add("active");

    if (results.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No stations found";
      li.classList.add("no-results");
      resultsList.appendChild(li);
      return;
    }

    for (const station of results.slice(0, 50)) {
      const li = document.createElement("li");
      li.textContent = `${station.station_name} (${codesSummary(station.station_code)})`;
      li.addEventListener("click", () => {
        const marker = markerMap.get(station.station_name);
        if (marker) {
          map.setView([station.latitude, station.longitude], 15);
          marker.fire("click");
        }
        resultsList.innerHTML = "";
        resultsList.classList.remove("active");
        searchInput.value = station.station_name;
      });
      resultsList.appendChild(li);
    }
  }, 150);
});

document.addEventListener("click", (e) => {
  if (!(e.target as HTMLElement).closest(".search-container")) {
    resultsList.classList.remove("active");
  }
});

// Legend control
class LegendControl extends L.Control {
  onAdd(_map: L.Map): HTMLElement {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = "<h4>Legend</h4>";
    for (const [label, color] of Object.entries(typeColors)) {
      div.innerHTML += `
        <div class="legend-item">
          <span style="background:${color};display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;"></span>
          ${label}
        </div>
      `;
    }
    return div;
  }
}

new LegendControl({ position: "bottomright" }).addTo(map);