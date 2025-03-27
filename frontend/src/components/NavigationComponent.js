import { useEffect, useRef } from "react";

const NavigationComponent = ({ start, end, map, clear }) => {
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
        const edges = await edgesRes.json();

        const graph = buildGraph(nodes, edges);
        const shortestPath = dijkstra(graph, start.id, end.id);

        if (!shortestPath || shortestPath.length === 0) {
          console.warn("⚠️ Nincs elérhető útvonal.");
          return;
        }

        const pathCoordinates = shortestPath.map((nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          const [lng, lat] = JSON.parse(node.coordinates)[0];
          return { lat, lng };
        });

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
        console.error("❌ Hiba az útvonal kiszámításakor:", error);
      }
    };

    fetchAndDrawPath();
  }, [start, end, map, clear]);

  return null;
};

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
    graph[edge.fromNodeId].push({ node: edge.toNodeId, weight: edge.distance });
    graph[edge.toNodeId].push({ node: edge.fromNodeId, weight: edge.distance }); // ha kétirányú
  });

  return graph;
}

export default NavigationComponent;
