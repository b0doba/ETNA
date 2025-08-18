import { useEffect, useRef } from "react";

const NavigationComponent = ({ start, end, map, clear, currentFloor, isBuildingView, floors }) => {
  const polylineRef = useRef(null);
  

  useEffect(() => {
    if (clear && polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  }, [clear]);

  useEffect(() => {
    const fetchAndDrawPath = async () => {      
      
      if (!start || !end || !map) return;

      try {
        const [nodesRes, edgesRes] = await Promise.all([
          fetch("http://localhost:5000/api/nodes"),
          fetch("http://localhost:5000/api/edges"),
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

        const graph = buildGraph(nodes, edges);
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
          const toNode = nodes.find((n) => n.id === toId);
          if (!fromNode || !toNode) continue;

          const isForward = edge.fromNodeId === fromId;
          const waypoints = isForward
            ? edge.waypoints
            : [...edge.waypoints].reverse();

          const fromCoord = JSON.parse(fromNode.coordinates)[0];
          pathCoordinates.push({ lat: fromCoord[1], lng: fromCoord[0] });

          waypoints.forEach(([lng, lat]) => {
            pathCoordinates.push({ lat, lng });
          });

          const toCoord = JSON.parse(toNode.coordinates)[0];
          pathCoordinates.push({ lat: toCoord[1], lng: toCoord[0] });
        }

        if (polylineRef.current) {
          polylineRef.current.setMap(null);
        }

        const polyline = new window.google.maps.Polyline({
          path: pathCoordinates,
          geodesic: true,
          strokeColor: "#0000FF",
          strokeOpacity: 0.6,
          strokeWeight: 4,
        });

        polyline.setMap(map);
        polylineRef.current = polyline;


      } catch (error) {
        console.error("Hiba az útvonal kiszámításakor:", error);
      }

    };

    fetchAndDrawPath();
  }, [start, end, map, clear]);

  return null;
};

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

  // út visszafejtése
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

  nodes.forEach((node) => {
    graph[node.id] = [];
  });

  edges.forEach((edge) => {
    const { fromNodeId, toNodeId, distance } = edge;

    if (!graph[fromNodeId] || !graph[toNodeId]) return;

    // Csak akkor adjuk hozzá, ha distance > 0 és nincs már benne
    if (distance > 0) {
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
