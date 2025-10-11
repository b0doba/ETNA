import { useEffect, useRef } from "react";

const NavigationComponent = ({ start, end, map, clear, currentFloor, isBuildingView, floors, onRouteNodes }) => {
  const polylineRef = useRef(null);
  const zoomListenerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    if (clear) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      if (zoomListenerRef.current) {
        window.google.maps.event.removeListener(zoomListenerRef.current);
        zoomListenerRef.current = null;
      }
    }
  }, [clear, map]);

  useEffect(() => {
    const fetchAndDrawPath = async () => {
      if (!start || !end || !map) return;

      try {
        const [nodesRes, edgesRes] = await Promise.all([
          fetch("/api/nodes"),
          fetch("/api/edges"),
        ]);

        const nodes = await nodesRes.json();
        const rawEdges = await edgesRes.json();

        const edges = rawEdges.map((edge) => ({
          ...normalizeEdge(edge),
          fromNode: edge.fromNode,
          toNode: edge.toNode
        }));

        const getFloorNumberById = (floorId) => {
          const floor = floors.find(f => f.properties?.id === floorId);
          return floor?.properties?.number ?? null;
        };

        const filteredEdges = edges.filter(edge => {
          const fromFloor = getFloorNumberById(edge.fromNode?.floorId);
          const toFloor = getFloorNumberById(edge.toNode?.floorId);

          if (isBuildingView) {
            return (
              edge.type === "hallway" &&
              (fromFloor === currentFloor || toFloor === currentFloor)
            );
          } else {
            return edge.type === "path";
          }
        });

        const edgeMap = buildEdgeMap(filteredEdges);

        const graph = buildGraph(nodes, edges); // vagy filteredEdges, ha a kinti részt is szűrni akarod
        const shortestPath = dijkstra(graph, start.id, end.id);

        if (!shortestPath || shortestPath.length === 0) {
          console.warn("Nincs elérhető útvonal.");
          return;
        }

        const pathCoordinates = [];
        for (let i = 0; i < shortestPath.length - 1; i++) {
          const fromId = shortestPath[i];
          const toId = shortestPath[i + 1];

          const edgeKey = makeEdgeKey(fromId, toId);
          const edge = edgeMap.get(edgeKey);
          if (!edge) continue;

          const fromNode = nodes.find((n) => n.id === fromId);
          const toNode   = nodes.find((n) => n.id === toId);
          if (!fromNode || !toNode) continue;

          const isForward = edge.fromNodeId === fromId;
          const waypoints = isForward ? edge.waypoints : [...edge.waypoints].reverse();

          const fromCoord = JSON.parse(fromNode.coordinates)[0];
          pathCoordinates.push({ lat: fromCoord[1], lng: fromCoord[0] });

          waypoints.forEach(([lng, lat]) => pathCoordinates.push({ lat, lng }));

          const toCoord = JSON.parse(toNode.coordinates)[0];
          pathCoordinates.push({ lat: toCoord[1], lng: toCoord[0] });
        }

        const formatDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
        const formatTimeRange = (meters) => {
          // kb. 1.2–1.6 m/s gyalogtempó → 72–96 m/perc
          const fast = meters / 96; // perc
          const slow = meters / 72; // perc
          const toMin = (x) => Math.max(1, Math.round(x));
          return `${toMin(fast)}–${toMin(slow)} perc`;
        };

        // 1) path koordináták eddig is készültek… (marad minden)

        // 2) pathNodes (ID → teljes node objektum)
        const nodesById = new Map(nodes.map(n => [n.id, n]));
        const pathNodes = shortestPath.map(id => nodesById.get(id)).filter(Boolean);

        // 3) teljes táv a választott élek mentén
        let totalMeters = 0;
        for (let i = 0; i < shortestPath.length - 1; i++) {
          const fromId = shortestPath[i];
          const toId   = shortestPath[i + 1];
          const w = (graph[fromId]?.find(n => Number(n.node) === Number(toId))?.weight) ?? 0;
          totalMeters += Number(w) || 0;
        }

        // 4) meta és visszahívás a Map felé
        const meta = {
          distance: formatDistance(totalMeters),
          time: formatTimeRange(totalMeters),
        };

        onRouteNodes?.(pathNodes, meta);


        // régi polyline eltávolítása
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }
        if (zoomListenerRef.current) {
          window.google.maps.event.removeListener(zoomListenerRef.current);
          zoomListenerRef.current = null;
        }

        // --- NYILAS MEGJELENÍTÉS ---
        const computeArrowScale = () => {
          const z = map.getZoom() ?? 18;
          // szoba felirat méretezéshez hasonlóan, de sokkal kisebb tartomány
          // zoom 15 → 0.5px, zoom 22 → 2px
          const minZoom = 15;
          const maxZoom = 22;
          const minScale = 0.5;
          const maxScale = 2;

          const clamped = Math.max(minZoom, Math.min(maxZoom, z));
          const t = (clamped - minZoom) / (maxZoom - minZoom);
          return minScale + t * (maxScale - minScale);
        };


        const arrowColor = "#1a73e8"; // Google-kék, nyugodtan állíthatod
        const basePolyline = new window.google.maps.Polyline({
          path: pathCoordinates,
          geodesic: true,
          strokeColor: arrowColor,     // halvány alávonal – ha nem kell, tedd 0-ra az opacity-t
          strokeOpacity: 0.25,
          strokeWeight: 5,
          // FONTOS: a nyilak IRÁNYA a path sorrendjét követi (start → end)!
          icons: [
            {
              icon: {
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: computeArrowScale(),
                strokeColor: arrowColor,
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: arrowColor,
                fillOpacity: 1,
              },
              offset: "0",         // első nyíl eltolása a vonal elejétől
              repeat: "28px",      // nyilak sűrűsége: 20–40px között érdemes
            },
          ],
        });

        basePolyline.setMap(map);
        polylineRef.current = basePolyline;

        // Zoomhoz igazodó nyílméret
        zoomListenerRef.current = map.addListener("zoom_changed", () => {
          if (!polylineRef.current) return;
          const scale = computeArrowScale();
          const icons = polylineRef.current.get("icons") || [];
          if (icons[0]?.icon) {
            icons[0].icon = {
              ...icons[0].icon,
              scale,
            };
            polylineRef.current.set("icons", icons);
          }
        });

      } catch (error) {
        console.error("Hiba az útvonal kiszámításakor:", error);
      }
    };

    fetchAndDrawPath();

    // takarítás komponens/param váltáskor
    return () => {
      if (zoomListenerRef.current) {
        window.google.maps.event.removeListener(zoomListenerRef.current);
        zoomListenerRef.current = null;
      }
      if (polylineRef.current && !clear) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [start, end, map, clear, currentFloor, isBuildingView, floors]);

  return null;
};



// ======== segédfüggvények maradnak ========

function normalizeEdge(edge) {
  try {
    const fromCoord = JSON.parse(edge.fromNode.coordinates)[0];
    const startWaypoint = edge.waypoints?.[0];
    if (!startWaypoint || !fromCoord) return edge;

    const [wLng, wLat] = startWaypoint;
    const [fLng, fLat] = fromCoord;

    const isForward =
      Math.abs(wLng - fLng) < 1 &&
      Math.abs(wLat - fLat) < 1;

    return isForward ? edge : { ...edge, waypoints: [...edge.waypoints].reverse() };
  } catch {
    return edge;
  }
}

function dijkstra(graph, startId, endId) {
  const distances = {};
  const previous = {};
  const queue = new Set();

  for (let node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    queue.add(node);
  }
  distances[String(startId)] = 0;

  while (queue.size > 0) {
    const current = [...queue].reduce((a, b) => (distances[a] < distances[b] ? a : b));
    queue.delete(current);

    if (current === String(endId)) break;

    for (let neighbor of graph[current]) {
      const alt = distances[current] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = current;
      }
    }
  }

  const path = [];
  let current = String(endId);
  while (current !== null) {
    path.unshift(Number(current));
    current = previous[current];
  }

  return path;
}

function buildGraph(nodes, edges) {
  const graph = {};
  nodes.forEach((node) => { graph[node.id] = []; });

  edges.forEach((edge) => {
    const { fromNodeId, toNodeId } = edge;
    const distance = Number(edge.distance);
    if (!graph[fromNodeId] || !graph[toNodeId]) return;
    if (Number.isFinite(distance) && distance > 0) {
      if (!graph[fromNodeId].some(e => e.node === toNodeId)) {
        graph[fromNodeId].push({ node: toNodeId, weight: distance });
      }
      if (!graph[toNodeId].some(e => e.node === fromNodeId)) {
        graph[toNodeId].push({ node: fromNodeId, weight: distance });
      }
    }
  });
  return graph;
}

function buildEdgeMap(edges) {
  const edgeMap = new Map();
  edges.forEach((edge) => {
    const key = makeEdgeKey(edge.fromNodeId, edge.toNodeId);
    edgeMap.set(key, edge);
  });
  return edgeMap;
}

function makeEdgeKey(a, b) {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export default NavigationComponent;
