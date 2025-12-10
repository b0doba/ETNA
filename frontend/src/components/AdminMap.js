/* eslint-disable */

import React, { useRef, useEffect, useState } from "react";
import loadGoogleMapsScript from "./loadGoogleMap";
import "../AdminLook.css";
import AdminObjectFilter from "./AdminObjectFilter";
import AdminDeleteItem from "./AdminDeleteItem";
import AdminSelect from "./AdminSelect";

const API_BASE_URL = "http://localhost:5000/api";

// API-ból GeoJSON adatok lekérése
const fetchGeoJSON = async (url) => {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Hiba az adatok lekérésekor (${url}):`, error);
    return { type: "FeatureCollection", features: [] };
  }
};

// --- Segéd: gyűrű zárása ---
const closeRing = (pts) => {
  if (!pts?.length) return [];
  const f = pts[0], l = pts[pts.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) return [...pts, [f[0], f[1]]];
  return pts.slice();
};

// --- Segéd: egymásra eső PONTOK kiszűrése (csak duplikátokat törlünk!) ---
const dedupeNearPoints = (pts, eps = 1e-9) => {
  if (!pts || pts.length === 0) return [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    if (Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps) {
      out.push(b);
    }
  }
  return out;
};

// --- ORTOGONALIZÁLÁS: szigorúan 0°/90°-os élek, globális sarok-korrekcióval ---
/**
 * orthogonalizeAxisAligned(points, opts)
 * points: [[lng,lat], ...] lezárt/lezáratlan is jöhet
 * opts.ratio: H/V eldöntés küszöb (|dx| >= ratio*|dy| => H; |dy| >= ratio*|dx| => V)
 * Visszaad: lezárt, 90°-os gyűrű. Csak pontosan egymásra eső pontokat távolít el.
 */
const orthogonalizeAxisAligned = (points, opts = {}) => {
  const ratio = opts.ratio ?? 1.15;
  const eps = opts.eps ?? 1e-9;

  if (!points || points.length < 4) return closeRing(points ?? []);

  // 0) Lezárás + duplikált pontok kiszűrése (csak egymásra esők!)
  let ring = closeRing(points);
  ring = dedupeNearPoints(ring, eps);
  if (ring.length < 4) return closeRing(ring);

  const n = ring.length - 1; // utolsó = első
  const ori = new Array(n);  // 'H' vagy 'V' minden élre
  const yOfH = new Array(n); // vízszintes élek közös y-ja
  const xOfV = new Array(n); // függőleges élek közös x-e

  // 1) Élek címkézése + célértékek (H: y-átlag, V: x-átlag)
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[i+1];
    const dx = b[0] - a[0], dy = b[1] - a[1];

    let isH;
    if (Math.abs(dx) >= ratio * Math.abs(dy)) isH = true;
    else if (Math.abs(dy) >= ratio * Math.abs(dx)) isH = false;
    else {
      // köztes eset: amelyik komponens nagyobb abszolútértékben
      isH = Math.abs(dx) >= Math.abs(dy);
    }

    if (isH) {
      ori[i] = 'H';
      yOfH[i] = (a[1] + b[1]) / 2;
    } else {
      ori[i] = 'V';
      xOfV[i] = (a[0] + b[0]) / 2;
    }
  }

  // 2) Csomópontok újraszámolása: minden sarok (i) x-e a V él(ek)ből, y-a a H él(ek)ből jön
  const out = new Array(n + 1);
  for (let i = 0; i < n; i++) {
    // x komponens: a V él érintse a csúcsot (vagy i-1 vagy i él V)
    let x = ring[i][0];
    const iPrev = (i - 1 + n) % n;
    if (ori[i] === 'V') x = xOfV[i];
    else if (ori[iPrev] === 'V') x = xOfV[iPrev];

    // y komponens: a H él érintse a csúcsot (vagy i-1 vagy i él H)
    let y = ring[i][1];
    if (ori[iPrev] === 'H') y = yOfH[iPrev];
    else if (ori[i] === 'H') y = yOfH[i];

    out[i] = [x, y];
  }
  out[n] = [out[0][0], out[0][1]]; // zárás

  // 3) Csak egymásra eső (dupla) pontok és nulla hosszú élek törlése
  let cleaned = dedupeNearPoints(out, eps);
  cleaned = closeRing(cleaned);

  return cleaned;
};


const AdminMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const drawingManager = useRef(null);
  const selectedFeature = useRef(null);
  const [selectedData, setSelectedData] = useState(null);
  const [showEdgeForm, setShowEdgeForm] = useState(false);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [filter, setFilter] = useState({ category: "outdoor" });
  const newPolygon = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const newMarker = useRef(null);
  const [creationMode, setCreationMode] = useState(null);
  const nodeMarkersRef = useRef(new Map());    // nodeId -> google.maps.Marker
  const edgePolylinesRef = useRef(new Map());  // edgeId -> { polyline, fromNodeId, toNodeId }
  const nodeToEdgesRef = useRef(new Map());    // nodeId -> Set(edgeId)

  // végtelen kör frissítés elkerülésére
  const isSyncingRef = useRef(false);

  const resnapAllEdges = () => {
    edgePolylinesRef.current.forEach(({ polyline, fromNodeId, toNodeId }) => {
      const path = polyline.getPath();
      if (path.getLength() === 0) return;
      const fromPos = getNodeLatLng(fromNodeId);
      const toPos   = getNodeLatLng(toNodeId);
      if (fromPos) path.setAt(0, fromPos);
      if (toPos)   path.setAt(path.getLength() - 1, toPos);
    });
  };

  const getNodeLatLng = (nodeId) => {
  const m = nodeMarkersRef.current.get(nodeId);
  if (m) return m.getPosition();
  // fallback: ha a marker még nincs meg, próbáljuk a nodes tömbből
  const n = (nodes || []).find(nn => nn.id === nodeId) || (nodesRaw || []).find(nn => nn.id === nodeId);
  if (!n) return null;
  const coords = Array.isArray(n.coordinates) ? n.coordinates : JSON.parse(n.coordinates || "[]");
  if (!coords?.[0]) return null;
  const [lng, lat] = coords[0];
  return new window.google.maps.LatLng(lat, lng);
};

  const addEdgeToIndex = (edgeId, fromNodeId, toNodeId) => {
    if (!nodeToEdgesRef.current.has(fromNodeId)) nodeToEdgesRef.current.set(fromNodeId, new Set());
    if (!nodeToEdgesRef.current.has(toNodeId))   nodeToEdgesRef.current.set(toNodeId, new Set());
    nodeToEdgesRef.current.get(fromNodeId).add(edgeId);
    nodeToEdgesRef.current.get(toNodeId).add(edgeId);
  };

  const updateEdgesForNode = (nodeId, latLng) => {
    const ids = nodeToEdgesRef.current.get(nodeId);
    if (!ids) return;
    ids.forEach(edgeId => {
      const rec = edgePolylinesRef.current.get(edgeId);
      if (!rec) return;
      const path = rec.polyline.getPath();
      if (rec.fromNodeId === nodeId) {
        path.setAt(0, latLng);
      }
      if (rec.toNodeId === nodeId) {
        path.setAt(path.getLength() - 1, latLng);
      }
    });
  };

  const moveNodeToLatLng = (nodeId, latLng) => {
    const m = nodeMarkersRef.current.get(nodeId);
    if (!m) return;
    m.setPosition(latLng);
  };

  const latLngEq = (a, b, eps = 1e-12) =>
    Math.abs(a.lat() - b.lat()) < eps && Math.abs(a.lng() - b.lng()) < eps;


    const refreshMap = () => {
      //console.log(" Térkép frissítése...");
      setMapRefreshTrigger((prev) => prev + 1);
    };

    const applyFilter = (filterData) => {
      //console.log(" Szűrés alkalmazása:", filterData);
      setFilter(filterData);
    };
    
    const resetFilter = () => {
    setFilter({ category: "outdoor" }); // ⬅️ reset is kültérre áll vissza
  };

  const makeFloorIdToNumber = (floorsArr) => {
    const map = new Map();
    (floorsArr || []).forEach(f => map.set(f.id, f.number));
    return map;
  };
  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildingsGeo, floorsGeo, roomsGeo,  nodesRaw, edgesRaw] = await Promise.all([
          fetchGeoJSON(`${API_BASE_URL}/buildings`),
          fetchGeoJSON(`${API_BASE_URL}/floors`),
          fetchGeoJSON(`${API_BASE_URL}/rooms`),
          fetchGeoJSON(`${API_BASE_URL}/nodes`),
          fetchGeoJSON(`${API_BASE_URL}/edges`),
        ]);

        setBuildings(buildingsGeo.features.map(feature => ({
          id: feature.properties.id,
          name: feature.properties.name,
          group: feature.properties.group,
          gather: feature.properties.gather,
        })));
        
        setFloors(floorsGeo.features.map(feature => ({
          id: feature.properties.id,
          number: feature.properties.number,
          building: feature.properties.building,
          buildingId: feature.properties.buildingId
        })));

        setRooms(roomsGeo.features.map(feature => ({
          id: feature.properties.id,
          floorId: feature.properties.floorId,
        })))

        setNodes(nodesRaw.map(node => ({
          id: node.id,
          name: node.name || "Névtelen node",
          coordinates: node.coordinates,
          type: node.type,
          buildingId: node.buildingId,
          floorId: node.floorId,
          iconUrl: node.iconUrl,
        })));

        setEdges(edgesRaw.map(edge => ({
          id: edge.id,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          type: edge.type,
          iconUrl: edge.iconUrl,
          waypoints: edge.waypoints,
        })));


        const floorIdToNumber = makeFloorIdToNumber(floors);
        const isIndoorNodeForFloorNumber = (node, wantedNumber) => {
          if (node.floorId == null) return false;
          const num = floorIdToNumber.get(node.floorId);
          return num === Number(wantedNumber);
        };

        const isIndoorEdgeForFloorNumber = (edge, wantedNumber) => {
          // Edge akkor jelenjen meg beltérben, ha mindkét végpont az adott emeletszámon van
          const fromNode = nodes.find(n => n.id === edge.fromNodeId);
          const toNode   = nodes.find(n => n.id === edge.toNodeId);
          if (!fromNode || !toNode) return false;
          return isIndoorNodeForFloorNumber(fromNode, wantedNumber)
              && isIndoorNodeForFloorNumber(toNode, wantedNumber);
        };


        //console.log(" Lekért nodesRaw:", nodesRaw);
        
        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps API nem érhető el.");
        }

        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: 47.693344, lng: 17.627529 },
          zoom: 18,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "all",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            },
            {
              featureType: "landscape",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        // Drawing Manager inicializálása
        drawingManager.current = new window.google.maps.drawing.DrawingManager({
          drawingMode: null, // Alapértelmezett: nincs rajzolás
          drawingControl: true,
          drawingControlOptions: {
            position: window.google.maps.ControlPosition.TOP_LEFT,
            drawingModes: [
              window.google.maps.drawing.OverlayType.POLYGON,
              window.google.maps.drawing.OverlayType.MARKER,
            ],
          },
          polygonOptions: {
            editable: true,
            draggable: true,
            fillColor: "blue",
            strokeColor: "black",
            strokeWeight: 2,
          },
        });

        window.google.maps.event.addListener(drawingManager.current, "drawingmode_changed", () => {
          const mode = drawingManager.current.getDrawingMode();
          if (mode === window.google.maps.drawing.OverlayType.MARKER) setCreationMode("marker");
          else if (mode === window.google.maps.drawing.OverlayType.POLYGON) setCreationMode("polygon");
          else setCreationMode(null);
        });


        drawingManager.current.setMap(map.current);

        let activeEdges = [];

        // Létező épületek és szobák betöltése és szerkeszthetővé tétele
        const addGeoJSONToMap = (geoJson, color, type) => {

          geoJson.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
            const polygon = new window.google.maps.Polygon({
              paths: coordinates,
              editable: true,
              draggable: true,
              fillColor: color,
              strokeColor: "black",
              strokeWeight: 2,
            });

            if (filter) {
              const { category, floorNumber } = filter;

              if (category === "outdoor") {
                // Kültér: csak az épületek jelenhetnek meg a polygonok közül
                if (type !== "building") return;
              }

              if (category === "indoor") {
                // Beltér: az összes épület polygon TILOS, csak az adott emeletszámhoz tartozó floors & rooms
                if (type === "building") return;

                if (type === "floor") {
                  // csak azok a floor-ok, amelyek number === floorNumber
                  if (feature.properties.number !== Number(floorNumber)) return;
                } else if (type === "room") {
                  // csak azok a room-ok, amelyek floor-ja az adott emeletszám
                  const floor = floors.find(f => f.id === feature.properties.floorId);
                  if (!floor || floor.number !== Number(floorNumber)) return;
                } else {
                  // más polygon típus nincs
                  return;
                }
              }

              if (category === "all") {
                // mindent mutat
              }
            }


            polygon.setMap(map.current);

            window.google.maps.event.addListener(drawingManager.current, "overlaycomplete", (event) => {
              console.log("Alakzat létrehozva!");
              drawingManager.current.setDrawingMode(null); // Automatikusan kikapcsolja a rajzolási módot

              if (event.type === "marker") {

                newMarker.current = event.overlay;

                setCreationMode("marker"); 
                const position = event.overlay.getPosition();
                const coordinates = [[position.lng(), position.lat()]];
            
                //console.log("Új node koordinátái:", coordinates);
            
                setSelectedData({
                  category: "node",
                  coordinates,
                });

                               // jelezzük, hogy point alapú létrehozás            
                return; // ne fusson tovább polygon esetén
              }

              if(event.type === "polygon"){

                newPolygon.current = event.overlay;
                setCreationMode("polygon");    
                newPolygon.current.setEditable(true); // Az alakzat szerkeszthető lesz
              
              
                // 🔥 Koordináták lekérése a poligonból
                const coordinates = newPolygon.current.getPath().getArray().map(latLng => [latLng.lng(), latLng.lat()]);
  
                const firstPoint = coordinates[0];
                const lastPoint = coordinates[coordinates.length - 1];
  
                if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
                  coordinates.push([...firstPoint]); // Ha nem azonos, hozzáadjuk az elsőt a végére
                  //console.log("Poligon lezárva az első és utolsó pont összeillesztésével.");
                }
              
                //console.log("Új alakzat koordinátái:", coordinates);
                
                if (!coordinates || coordinates.length === 0) {
                  alert("Hiba: Az alakzatnak kell koordinátákkal rendelkeznie!");
                  return;
                }
  
                // Beállítjuk az adatokat, most már a koordinátákkal együtt!
                setSelectedData({
                  coordinates: coordinates, // A megfelelő koordináták átadása
                });
              }

              


            });

            activeEdges.forEach(edge => edge.setMap(null));
            activeEdges = [];
            
            //Kattintáskor az adott objektumot kiválasztjuk
            polygon.addListener("click", () => {

              activeEdges.forEach(edge => edge.setMap(null));
              activeEdges = [];
              
              const { id, category, name, shortName, group, number, height, type, gather } = feature.properties;
              
              let selectedObject = { id, category, polygon};  
              
              if (category === "building") {
                selectedObject = {
                  ...selectedObject,
                  name: name || "",
                  shortName: shortName || "",
                  group: group || "",
                  gather: gather || "",
                };
              } else if (category === "floor") {
                selectedObject = {
                  ...selectedObject,
                  number: number || 0,
                  height: height || 0,
                };
              } else if (category === "room") {
                selectedObject = {
                  ...selectedObject,
                  name: name || "",
                  type: type || "",
                };
              }
              
              selectedFeature.current = selectedObject;
              setSelectedData(selectedObject);
              console.log("Kiválasztott objektum:", selectedFeature.current);

              const path = polygon.getPath();
              const highlight = new window.google.maps.Polyline({
                path: path.getArray(),
                strokeColor: "red",
                strokeWeight: 4,
                map: map.current,
              });
              activeEdges.push(highlight);

              const updateHighlight = () => {
                highlight.setPath(polygon.getPath().getArray());
              };
          
              // Ha szerkesztik a poligont, frissítjük a kiemelést
              polygon.getPath().addListener("set_at", updateHighlight); // Ha meglévő pontot módosítanak
              polygon.getPath().addListener("insert_at", updateHighlight); // Ha új pontot adnak hozzá
              polygon.addListener("dragend", updateHighlight); // Ha az egész poligont mozgatják

            });
          });
        };

        //EDGE-k megjelenítése és kiemelése
        edgesRaw.forEach((edge) => {

          const cat = filter?.category;

          if (cat === "outdoor") {
            const outdoorTypes = new Set(["outdoor", "path"]);
            if (!outdoorTypes.has(edge.type)) return;
          }

          // Beltér: csak a kiválasztott emeletszám edge-jei
          if (cat === "indoor") {
            if (filter?.floorNumber == null) return;
            if (!isIndoorEdgeForFloorNumber(edge, filter.floorNumber)) return;
          }

          const path = edge.waypoints
            ? edge.waypoints.map(([lng, lat]) => ({ lat, lng }))
            : [];
        
          const polyline = new window.google.maps.Polyline({
            path,
            strokeColor: "blue",
            strokeWeight: 3,
            editable: true,
            map: map.current,
          });
          
          polyline.addListener("click", () => {
            activeEdges.forEach(e => e.setMap(null));
            activeEdges = [];

            const redEdge = new window.google.maps.Polyline({
              path: polyline.getPath().getArray(),
              strokeColor: "red",
              strokeWeight: 4,
              map: map.current,
            });

            activeEdges.push(redEdge);

            const coords = polyline.getPath().getArray().map(latLng => [latLng.lng(), latLng.lat()]);
            const edgeData = {
              id: edge.id,
              fromNodeId: edge.fromNodeId,
              toNodeId: edge.toNodeId,
              type: edge.type,
              iconUrl: edge.iconUrl,
              waypoints: coords,
              category: "edge",
              polyline,
            };

          


            setSelectedData(edgeData);
            selectedFeature.current = edgeData;
            console.log("Kiválasztott edge:", edgeData);
          });

          edgePolylinesRef.current.set(edge.id, { polyline, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId });
          addEdgeToIndex(edge.id, edge.fromNodeId, edge.toNodeId);

          (() => {
            const fromM = nodeMarkersRef.current.get(edge.fromNodeId);
            const toM   = nodeMarkersRef.current.get(edge.toNodeId);
            if (!fromM || !toM) return; // lehet, hogy a node-ok később jönnek – ez nem baj
            const path = polyline.getPath();
            if (path.getLength() === 0) return;
            const first = path.getAt(0);
            const last  = path.getAt(path.getLength() - 1);

            const fromPos = fromM.getPosition();
            const toPos   = toM.getPosition();

            if (!latLngEq(first, fromPos)) path.setAt(0, fromPos);
            if (!latLngEq(last, toPos))    path.setAt(path.getLength() - 1, toPos);
          })();

          polyline.getPath().addListener("set_at", (idx) => {
          const path = polyline.getPath();
          const last = path.getLength() - 1;
          if (idx !== 0 && idx !== last) return; // csak endpoint érdekes

          if (isSyncingRef.current) return;
          isSyncingRef.current = true;
          try {
            const rec = edgePolylinesRef.current.get(edge.id);
            if (!rec) return;
            const snapPos =
              idx === 0 ? getNodeLatLng(rec.fromNodeId) : getNodeLatLng(rec.toNodeId);
            if (snapPos) path.setAt(idx, snapPos); // visszapattintjuk
          } finally {
            isSyncingRef.current = false;
          }
        });

        // Ne lehessen új pontot beszúrni az elejére vagy végére
        polyline.getPath().addListener("insert_at", (idx) => {
          const path = polyline.getPath();
          const last = path.getLength() - 1;
          if (idx === 0 || idx === last) {
            path.removeAt(idx);
          }
        });
        });
                
        //Nodok megjelenítése és kiemelése
        nodesRaw.forEach((node) => {
          const cat = filter?.category;

          // Kültér: csak exit/outdoor típusú node
          if (cat === "outdoor") {
            const allowedNodeTypes = new Set(["exit", "outdoor"]);
            if (!allowedNodeTypes.has(node.type)) return;
          }

          // Beltér: csak a kiválasztott emeletszámon lévő node-ok
          if (cat === "indoor") {
            if (filter?.floorNumber == null) return;
            if (!isIndoorNodeForFloorNumber(node, filter.floorNumber)) return;
          }

          // "all" eset: mindent rajzol

          const { id, name, coordinates } = node;
          let parsedCoordinates = Array.isArray(coordinates)
            ? coordinates
            : (() => {
                try { return JSON.parse(coordinates); }
                catch { return null; }
              })();

          if (!Array.isArray(parsedCoordinates) || !Array.isArray(parsedCoordinates[0]) || parsedCoordinates[0].length !== 2) {
            console.warn(`Érvénytelen koordináták (id: ${id}):`, coordinates);
            return;
          }

          const [lng, lat] = parsedCoordinates[0];
          const position = { lat, lng };

          const marker = new window.google.maps.Marker({
            position,
            map: map.current,
            draggable: true,
            icon: {
              url: `/assets/icons/marker-stroked.svg`,
              scaledSize: new window.google.maps.Size(20, 20),
            },
          });

          // indexeld a markert a node azonosítóhoz:
          nodeMarkersRef.current.set(id, marker);

          // node húzás -> minden kapcsolt edge endpoint frissítése
          marker.addListener("drag", () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            try {
              updateEdgesForNode(id, marker.getPosition());
            } finally {
              isSyncingRef.current = false;
            }
          });

          marker.addListener("click", () => {

            activeEdges.forEach((e) => e.setMap(null));
            activeEdges = [];
        
            const highlight = new window.google.maps.Circle({
              strokeColor: "red",
              strokeOpacity: 1,
              strokeWeight: 2,
              fillColor: "red",
              fillOpacity: 0.5,
              map: map.current,
              center: marker.getPosition(),
              radius: 1,
            });
        
            activeEdges.push(highlight);
        
            const nodeData = {
              id,
              name,
              type: node.type,
              buildingId: node.buildingId,
              floorId: node.floorId,
              iconUrl: node.iconUrl,
              coordinates: parsedCoordinates,
              category: "node",
              marker,
            };
        
            setSelectedData(nodeData);
            selectedFeature.current = nodeData;
            console.log("Kiválasztott node:", nodeData);
          });
        });

        resnapAllEdges();

        addGeoJSONToMap(buildingsGeo, "blue", "building");
        addGeoJSONToMap(floorsGeo, "green", "floor");
        addGeoJSONToMap(roomsGeo, "red", "room");

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    initMap();
  }, [mapRefreshTrigger, filter]);

  const deleteSelectedOnServer = async () => {
    const sel = selectedFeature.current || selectedData;
    if (!sel?.id || !sel?.category) {
      alert("Nincs kijelölt törölhető objektum.");
      return;
    }
    if (!window.confirm("Biztosan törlöd a kiválasztott objektumot?")) return;

    try {
      const cat = sel.category;
      const id = sel.id;
      let res;

      // Épület – a szervered szerint: DELETE /deleteBuilding/:id
      if (cat === "building") {
        res = await fetch(`${API_BASE_URL}/deleteBuilding/${id}`, { method: "DELETE" });
      }
      // Emelet és terem – feltételezve hasonló mintázatot:
      else if (cat === "floor") {
        res = await fetch(`${API_BASE_URL}/deleteFloor/${id}`, { method: "DELETE" });
      } else if (cat === "room") {
        res = await fetch(`${API_BASE_URL}/deleteRoom/${id}`, { method: "DELETE" });
      }
      // Node és edge – REST mint korábban
      else if (cat === "node") {
        res = await fetch(`${API_BASE_URL}/nodes/${id}`, { method: "DELETE" });
      } else if (cat === "edge") {
        res = await fetch(`${API_BASE_URL}/edges/${id}`, { method: "DELETE" });
      } else {
        alert("Ismeretlen kategória, nem tudom törölni.");
        return;
      }

      if (!res?.ok) throw new Error("Szerver hiba a törlésnél.");

      alert("Törölve.");
      if (sel.polygon?.setMap) sel.polygon.setMap(null);
      if (sel.polyline?.setMap) sel.polyline.setMap(null);
      if (sel.marker?.setMap) sel.marker.setMap(null);
      setSelectedData(null);
      selectedFeature.current = null;
      refreshMap();
    } catch (e) {
      console.error(e);
      alert("Nem sikerült törölni.");
    }
  };


  const cancelCreation = () => {
    try {
      if (newPolygon.current) {
        newPolygon.current.setMap(null);
        newPolygon.current = null;
      }
      if (newMarker.current) {
        newMarker.current.setMap(null);
        newMarker.current = null;
      }
    } finally {
      setSelectedData(null);
      setCreationMode(null);
      refreshMap();
    }
  };

  // Csak egymást követő duplikált/0-hosszú pontok törlése (edge szerkesztéshez)
  const simplifyPolylineForEdit = (points, epsMeters = 0.01) => {
    if (!Array.isArray(points) || points.length < 2) return points || [];
    // fok ~ méter átváltás (durván, szélességi kör szerint)
    const epsDeg = epsMeters / 111320; // ~0.01 m alapértelmezés
    const sqEps = epsDeg * epsDeg;

    const sqDist = (a, b) => {
      const dx = a[0] - b[0], dy = a[1] - b[1];
      return dx*dx + dy*dy;
    };

    const out = [points[0]];
    for (let i = 1; i < points.length; i++) {
      if (sqDist(points[i], out[out.length - 1]) > sqEps) {
        out.push(points[i]);
      }
    }
    // ha valami okból 1 pont maradna, duplikáljuk hogy legalább 2 legyen
    if (out.length === 1 && points.length >= 2) out.push(points[points.length - 1]);
    return out;
  };

//   const simplifyPolygon = (points, minDistance = 0.0000001) => {
//     if (points.length < 4) return points; // Ha túl kevés pont van, nem módosítunk

//     const sqMinDistance = minDistance * minDistance;

//     // Euklideszi távolság négyzetes formában
//     const getSqDist = (p1, p2) => {
//         const dx = p1[0] - p2[0];
//         const dy = p1[1] - p2[1];
//         return dx * dx + dy * dy;
//     };

//     let filteredPoints = [];

//     for (let i = 0; i < points.length; i++) {
//         let isDuplicate = false;

//         for (let j = 0; j < filteredPoints.length; j++) {
//             if (getSqDist(points[i], filteredPoints[j]) < sqMinDistance) {
//                 isDuplicate = true;
//                 break;
//             }
//         }

//         if (!isDuplicate) {
//             filteredPoints.push(points[i]);
//         }
//     }

//     // Egyenes vonalon lévő felesleges pontok eltávolítása
//     const removeCollinearPoints = (points) => {
//         if (points.length < 4) return points;

//         const isCollinear = (p1, p2, p3) => {
//             return Math.abs((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1])) < 1e-10;
//         };

//         let result = [points[0]]; // Az első pontot mindig megtartjuk

//         for (let i = 1; i < points.length - 1; i++) {
//             if (!isCollinear(points[i - 1], points[i], points[i + 1])) {
//                 result.push(points[i]); // Csak akkor tartjuk meg, ha nem egy egyenes része
//             }
//         }

//         result.push(points[points.length - 1]); // Az utolsó pontot mindig megtartjuk
//         return result;
//     };

//     // Egyenes vonalakat egyszerűsítjük
//     filteredPoints = removeCollinearPoints(filteredPoints);

//     // Ha az utolsó pont nem egyezik meg az elsővel, biztosítjuk a zártságot
//     if (filteredPoints.length > 2 &&
//         (filteredPoints[0][0] !== filteredPoints[filteredPoints.length - 1][0] ||
//          filteredPoints[0][1] !== filteredPoints[filteredPoints.length - 1][1])) {
//         filteredPoints.push([...filteredPoints[0]]);
//     }

//     return filteredPoints;
// };

// const simplifyPolyline = (points, minDistance = 0.0000001) => {
//   if (points.length < 3) return points;

//   const sqMinDistance = minDistance * minDistance;

//   const getSqDist = (p1, p2) => {
//       const dx = p1[0] - p2[0];
//       const dy = p1[1] - p2[1];
//       return dx * dx + dy * dy;
//   };

//   // Távolság alapú szűrés
//   let filteredPoints = [];
//   for (let i = 0; i < points.length; i++) {
//       let isDuplicate = false;

//       for (let j = 0; j < filteredPoints.length; j++) {
//           if (getSqDist(points[i], filteredPoints[j]) < sqMinDistance) {
//               isDuplicate = true;
//               break;
//           }
//       }

//       if (!isDuplicate) {
//           filteredPoints.push(points[i]);
//       }
//   }

//   // Kollineáris pontok kiszűrése
//   const removeCollinearPoints = (points) => {
//       if (points.length < 3) return points;

//       const isCollinear = (p1, p2, p3) => {
//           return Math.abs((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1])) < 1e-8;
//       };

//       let result = [points[0]];
//       for (let i = 1; i < points.length - 1; i++) {
//           if (!isCollinear(points[i - 1], points[i], points[i + 1])) {
//               result.push(points[i]);
//           }
//       }
//       result.push(points[points.length - 1]);
//       return result;
//   };

//   return removeCollinearPoints(filteredPoints);
// };

  const handleSave = async () => {
    if (!selectedData || !selectedData.category) {
      alert("Válassz kategóriát és adj meg minden szükséges adatot!");
      return;
    }
  
    let apiUrl = "";
    let payload = {};

    /*if (!selectedData.coordinates || selectedData.coordinates.length === 0) {
      alert("Az épületnek kell koordinátákkal rendelkeznie!");
      return;
    }*/
  
    if (selectedData.category === "building") {
      apiUrl = `${API_BASE_URL}/createBuildings`;
      payload = {
        name: selectedData.name || "",
        shortName: selectedData.shortName || null,
        group: selectedData.group || "",
        gather: selectedData.gather || "",
        numberOfFloors: selectedData.numberOfFloors || 1,
        coordinates: selectedData.coordinates || [],
      };
    } else if (selectedData.category === "floor") {
      if (!selectedData.buildingId) {
        alert("Válassz egy épületet az emelethez!");
        return;
      }
      apiUrl = `${API_BASE_URL}/createFloors`;
      payload = {
        buildingId: selectedData.buildingId,
        number: selectedData.number || 0,
        height: selectedData.height || 0,
        coordinates: selectedData.coordinates || [],
      };
    } else if (selectedData.category === "room") {
      if (!selectedData.buildingId || !selectedData.floorId) {
        alert("Válassz egy épületet és emeletet a teremhez!");
        return;
      }
      apiUrl = `${API_BASE_URL}/createRooms`;
      payload = {
        floorId: selectedData.floorId,
        name: selectedData.name || "",
        type: selectedData.type && selectedData.type.trim() !== "" ? selectedData.type : "terem",
        coordinates: selectedData.coordinates || [],
      };
    } else if (selectedData.category === "node") {
      if (!selectedData.name || !selectedData.type || !selectedData.coordinates) {
        alert("Add meg a nevet, típust és helyet a node-hoz!");
        return;
      }
  
      apiUrl = `${API_BASE_URL}/nodes`;
      payload = {
        name: selectedData.name || "",
        type: selectedData.type || "",
        iconUrl: selectedData.iconUrl || null,
        floorId: selectedData.floorId || null,
        buildingId: selectedData.buildingId || null,
        coordinates: selectedData.coordinates, // ez már egy tömb: [[lng, lat]]
      };
    } else if (selectedData.category === "edge") {
      if (!selectedData.fromNodeId || !selectedData.toNodeId || !selectedData.type) {
        alert("Add meg az induló és cél node-ot, valamint a típust!");
        return;
      }
    
      apiUrl = `${API_BASE_URL}/edges`;
      payload = {
        fromNodeId: selectedData.fromNodeId,
        toNodeId: selectedData.toNodeId,
        type: selectedData.type,
        iconUrl: selectedData.iconUrl || null,
      };
    }
  
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) throw new Error("Hiba a mentés során");
  
      alert("Mentés sikeres!");
      setSelectedData(null);
      refreshMap();
    } catch (error) {
      console.error("🚨 Hiba a mentés során:", error);
      alert("Nem sikerült menteni az adatokat.");
    }
  };

  //Kijelölt objektum mentése az API-ba
  async function saveUpdatedFeature() {
    if (!selectedFeature.current) {
      console.warn("Nincs kiválasztott objektum!");
      return;
    }

    const updatedProperties = { ...selectedFeature.current, ...selectedData };

    if (selectedFeature.current.category === "node") {
  let finalCoordinates = updatedProperties.coordinates;

  if (selectedFeature.current.marker) {
    const pos = selectedFeature.current.marker.getPosition();
    finalCoordinates = [[pos.lng(), pos.lat()]];
  }

      const payload = {
        id: selectedFeature.current.id,
        name: updatedProperties.name || "",
        type: updatedProperties.type || "",
        iconUrl: updatedProperties.iconUrl || null,
        floorId: updatedProperties.floorId,
        buildingId: updatedProperties.buildingId,
        coordinates: finalCoordinates, // már parsed
      };
    
      try {
        const response = await fetch(`${API_BASE_URL}/nodes/${selectedFeature.current.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    
        if (!response.ok) throw new Error("Node mentése sikertelen.");
    
        alert("✅ Node frissítve!");
        setSelectedData(null);
        selectedFeature.current = updatedProperties;
        setMapRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("Hiba a node mentése során:", error);
        alert("Nem sikerült a node mentése.");
      }
    
      return;
    }

    if (selectedFeature.current.category === "edge") {
      if (!selectedFeature.current.polyline) {
        console.warn("Az edge-nek nincs polyline referenciája!");
        return;
      }

      const rec = edgePolylinesRef.current.get(selectedFeature.current.id);
        if (rec) {
          const path = rec.polyline.getPath();
          const fromPos = getNodeLatLng(rec.fromNodeId);
          const toPos   = getNodeLatLng(rec.toNodeId);
          if (fromPos) path.setAt(0, fromPos);
          if (toPos)   path.setAt(path.getLength() - 1, toPos);
        }
  
      const waypoints = selectedFeature.current.polyline
        .getPath()
        .getArray()
        .map((latLng) => [latLng.lng(), latLng.lat()]);

      const simplifiedWaypoints = simplifyPolylineForEdit(waypoints, 0.01);
  
      const payload = {
        id: selectedFeature.current.id,
        type: updatedProperties.type || "",
        iconUrl: updatedProperties.iconUrl || null,
        waypoints: simplifiedWaypoints,
      };
  
      try {
        const response = await fetch(`${API_BASE_URL}/edges/${selectedFeature.current.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
  
        if (!response.ok) throw new Error("Edge mentése sikertelen.");
  
        alert("✅ Útvonal (edge) frissítve!");
        setSelectedData(null);
        selectedFeature.current = updatedProperties;
        setMapRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("❌ Hiba az edge mentése során:", error);
        alert("❌ Nem sikerült az útvonal mentése.");
      }
  
      return; // Kilépünk, ha edge volt
    }

    if (!selectedFeature.current.polygon) {
      console.warn("A kiválasztott objektumnak nincs polygon referenciája!");
      return;
    }
  
    let coordinates = selectedFeature.current.polygon
      .getPath()
      .getArray()
      .map((ll) => [ll.lng(), ll.lat()]);

    // 0/90 fokosra húzás, csak duplikált pontok kiszedése
    const ortho = orthogonalizeAxisAligned(coordinates, {
      ratio: 1.15, // ha még marad ferdülés: 1.05; ha túl agresszív: 1.3
      eps: 1e-9
    });

    // biztos legyen lezárva (a fenti már zár)
    const simplifiedCoordinates = ortho;


    // 3) biztos zárás (ha a simplify levette volna)
    const first = simplifiedCoordinates[0];
    const last  = simplifiedCoordinates[simplifiedCoordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplifiedCoordinates.push([first[0], first[1]]);
    }


    // Ha az első és utolsó koordináta nem azonos, zárjuk le a poligont
    if (
    simplifiedCoordinates.length > 1 &&
    (simplifiedCoordinates[0][0] !== simplifiedCoordinates[simplifiedCoordinates.length - 1][0] ||
      simplifiedCoordinates[0][1] !== simplifiedCoordinates[simplifiedCoordinates.length - 1][1])
  ) {
    //console.log("Poligon lezárása...");
    simplifiedCoordinates.push([...simplifiedCoordinates[0]]);
  }
  
    const updatedFeature = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [simplifiedCoordinates],
          },
          properties: {
            id: selectedFeature.current.id,
            name: updatedProperties.name || "",
            shortName: updatedProperties.shortName || "",
            group: updatedProperties.group || "",
            gather: updatedProperties.gather || "",
            number: updatedProperties.number || 0,
            height: updatedProperties.height || 0,
            type: updatedProperties.type || "",
          },
        },
      ],
    };
  
    let endpoint;
    switch (selectedFeature.current.category) {
      case "building":
        endpoint = `${API_BASE_URL}/updateBuildings`;
        break;
      case "floor":
        endpoint = `${API_BASE_URL}/updateFloors`;
        break;
      case "room":
        endpoint = `${API_BASE_URL}/updateRooms`;
        break;
      default:
        console.error("Ismeretlen típusú objektum!", selectedFeature.current);
        return;
    }
  
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFeature),
      });
  
      if (!response.ok) {
        throw new Error(`Hiba a mentés során: ${response.statusText}`);
      }
  
      alert(`Mentés sikeres!\nTípus: ${updatedProperties.category}\nID: ${updatedProperties.id}`);

      setSelectedData(null);
      
      // Frissítsük az állapotot, hogy tükrözze a módosításokat
      selectedFeature.current = updatedProperties;
      setSelectedData(null);
      setMapRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Hiba a mentés során:", error);
      alert("Nem sikerült a mentés.");
    }
  }

  return (
    <div className="admin-map-container">
      {loading && <p>Betöltés...</p>}
      {error && <p>Hiba történt: {error}</p>}
      <AdminSelect
        selectedData={selectedData}
        setSelectedData={setSelectedData}
        buildings={buildings}
        floors={floors}
        handleSave={handleSave}
        saveUpdatedFeature={saveUpdatedFeature}
        showEdgeForm={showEdgeForm}
        setShowEdgeForm={setShowEdgeForm}
        nodes={nodes}
        onCancelCreation={cancelCreation}
        onDeleteSelected={deleteSelectedOnServer}
        creationMode={creationMode}
      />
      <AdminObjectFilter
        buildings={buildings}
        floors={floors}
        rooms={rooms}
        nodes={nodes}
        edges={edges}
        applyFilter={applyFilter}
        resetFilter={resetFilter}
      />
      <AdminDeleteItem refreshMap={refreshMap} />
      <button
        className="edge-btn"
        onClick={() => {
          setCreationMode("edge");  
          setShowEdgeForm(true); 
          setSelectedData({
            category: "edge",
            fromNodeId: null,
            toNodeId: null,
            type: "",
            iconUrl: "",
          });
        }}
      >Edge</button>
      <div ref={mapContainer} className="admin-map-container"/>
    </div>
  );
};

export default AdminMap;
