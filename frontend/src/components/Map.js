import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPanel from "./SearchPanel.js";
import loadGoogleMapsScript from "./loadGoogleMap";
import NavigationComponent from "./NavigationComponent";
//import Map3DControls from "./Map3DControls";


const fetchGeoJSON = async (url) => {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Hiba az adatok lekérésekor (${url}):`, error);
    return { type: "FeatureCollection", features: [] };
  }
};

const MapComponent = () => {
  const navigate = useNavigate();

  const map = useRef(null);
  const mapContainer = useRef(null);
  const buildingsRef = useRef(null);
  const allFloorsRef = useRef(null);
  const roomsRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const [routeUI, setRouteUI] = useState(null);
  const BUILD_STEP_WHITELIST = new Set(["exit", "stairs", "EXIT", "STAIRS"]);
  const lastRouteNamesRef = useRef({ start: "", end: "" });
  const routeEndpointsRef = useRef({ start: null, end: null });

  // const focusRunIdRef = useRef(0);
  // const nextRunId = () => (++focusRunIdRef.current);
  // const isStale = (id) => id !== focusRunIdRef.current;

  // const awaitViewSettled = async () => {
  //   await wait(0);
  //   await wait(0);
  //   await onceIdleOrTimeout(map.current, 500);
  // };

  const buildingLabelOverlaysRef = useRef(new Map());
  const buildingLabelZoomListenerRef = useRef(null);
  const roomLabelOverlaysRef = useRef(new Map());
  const roomLabelZoomListenerRef = useRef(null);

  const [currentMapId, setCurrentMapId] = useState("538b561c396b44f6");
  const [is3DView, setIs3DView] = useState(false);
  const MAP_ID_2D = "538b561c396b44f6";
  const MAP_ID_3D = "5d7ea9da5f5e03b3";

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isBuildingView, setIsBuildingView] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(null);
  const [availableFloorNumbers, setAvailableFloorNumbers] = useState([]);
  const [floorGroup, setFloorGroup] = useState(null);

  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [nodes, setNodes] = useState([]);

  const [mapZoom, setMapZoom] = useState(18);
  const [mapCenter, setMapCenter] = useState({ lat: 47.693344, lng: 17.627529 });

  const [hudHidden, setHudHidden] = useState(false);
  const [clearRoute, setClearRoute] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedGroup, setSelectedGroup] = useState(null);

  const [searchHighlightedRoom, setSearchHighlightedRoom] = useState(null);
  const [routeHighlightedRooms, setRouteHighlightedRooms] = useState({ start: null, end: null });
  const [searchHighlightedBuilding, setSearchHighlightedBuilding] = useState(null);
  const [routeHighlightedBuildings, setRouteHighlightedBuildings] = useState({ start: null, end: null });

  const toggleHUD = () => setHudHidden(prev => !prev);

  const handleGroupSelect = (group) => {
    
    if (startLocation || endLocation) cancelRoute();

    if (selectedGroup === group) {
      setSelectedGroup(null);
      setSearchHighlightedRoom(null);
      setSearchHighlightedBuilding(null);
    } else {
      setIsBuildingView(false);
      setSelectedGroup(group);
      highlightSearchBuilding(null, group); // kiemelés beállítása
    }
  };

  const scaleBetween = (value, minIn, maxIn, minOut, maxOut) => {
    const v = Math.max(minIn, Math.min(maxIn, value));
    const t = (v - minIn) / (maxIn - minIn || 1);
    return minOut + t * (maxOut - minOut);
  };

  const handleStepClick = async (step) => {
  setRouteUI(prev => prev ? { ...prev, activeStepId: step.id } : prev);

  try {
    if (step.type === "node" && step.node) {
      await focusNode(step.node);
    } else if (step.type === "room" && step.room) {
      await focusRoom(step.room);
    } else if (step.type === "building" && step.building) {
      await focusBuilding(step.building);
    }
  } catch (e) {
    console.warn("Step fókusz hiba:", e);
  }
};


  const handleCloseSteps = () => {
    setRouteUI(null);
  };

  const nodeKindToStepKind = (t) => {
    const k = (t || "").toLowerCase();
    if (k === "stairs") return "transition";     // ikon/stílus nálad már kész
    if (k === "exit")   return "transition";
    return "indoor";
  };

  // MapComponent.js – a komponensen belül
  const stepHintForType = (t) => {
    const k = (t || "").toLowerCase();
    if (k === "stairs")
      return "Bizonyosodj meg róla, hogy a megfelelő szinten vagy.";
    if (k === "exit")
      return "Az épületre kattintva belső nézetet, mellé kattintva külső nézetet kapsz.";
    return null;
  };


  const overlaysRef = useRef([]);
  const infoWindowRef = useRef(null);
  const dataListenersSetRef = useRef(false);
  const mapListenersRef = useRef([]);

  useEffect(() => {
    const initMap = async () => {
      await loadGoogleMapsScript();

      const bounds = {
        north: mapCenter.lat + 0.1,
        south: mapCenter.lat - 0.1,
        east: mapCenter.lng + 0.25,
        west: mapCenter.lng - 0.25,
      };

      map.current = new window.google.maps.Map(mapContainer.current, {
        mapId: currentMapId,
        center: mapCenter,
        zoom: mapZoom,
        minZoom: 15,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        tilt: is3DView ? 45 : 0,
        heading: is3DView ? 45 : 0,
        restriction: { latLngBounds: bounds, strictBounds: true },
      });

      window._currentMapInstance = map.current;

      console.log("Map példány létrehozva");
      setMapReady(true);
    };

    initMap();
}, []); // << csak egyszer fusson


  useEffect(() => {
    if (!mapReady || !map.current) return;
    const loadData = async () => {
      try {
        // await loadGoogleMapsScript();

        const [buildings,rooms, floors] = await Promise.all([
          fetchGeoJSON("http://localhost:5000/api/buildings"),
          fetchGeoJSON("http://localhost:5000/api/rooms"),
          fetchGeoJSON("http://localhost:5000/api/floors")
        ]);

        const nodesResponse = await fetch("http://localhost:5000/api/nodes");

        const getFloorNumberById = (floorId) => {
          const floor = floors.features.find(f => f.properties?.id === floorId);
          return floor?.properties?.number ?? null;
        };
        
        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        const addGeoJSONToMap = (geoJson) => {
          map.current.data.addGeoJson(geoJson);
          map.current.data.setStyle(getFeatureStyle);
        };

        // window._currentMapInstance = map.current;

        addGeoJSONToMap(buildings, "building");
        addGeoJSONToMap(floors, "floor");
        addGeoJSONToMap(rooms,"room");
        const nodesData = await nodesResponse.json();
        setNodes(nodesData);

        buildingsRef.current = buildings;
        allFloorsRef.current = floors;
        roomsRef.current = rooms;

        overlaysRef.current.forEach((ov) => ov.setMap(null));
        overlaysRef.current = [];

        map.current.data.forEach((f) => map.current.data.remove(f));
        map.current.data.addGeoJson(buildings);
        map.current.data.addGeoJson(floors);
        map.current.data.addGeoJson(rooms);
        map.current.data.setStyle(getFeatureStyle);

        if (!isBuildingView) {
          renderBuildingShortLabels();
        } else {
          clearBuildingShortLabels();
        }

        // InfoWindow singleton
        if (!infoWindowRef.current) {
          infoWindowRef.current = new window.google.maps.InfoWindow();
        }

        // DATA LISTENEREK CSAK EGYSZER
        if (!dataListenersSetRef.current) {
          const data = map.current.data;
          const infoWindow = infoWindowRef.current;

          data.addListener("mouseover", (event) => {
            const displayText = event.feature.getProperty("name") || "Nincs név";
            const content = `
              <div class="custom-info-window">
                <div class="info-title">${displayText}</div>
              </div>`;
            infoWindow.setContent(content);
            infoWindow.setPosition(event.latLng);
            infoWindow.open(map.current);
          });

          data.addListener("mouseout", () => infoWindow.close());

          data.addListener("click", (event) => {
            const category = event.feature.getProperty("category");
            if (category === "building") {
              const buildingName = event.feature.getProperty("name");
              const gatherName = event.feature.getProperty("gather");
              if (gatherName) focusOnBuilding(buildingName, gatherName);
            }
          });

          // Map click is csak egyszer:
          mapListenersRef.current.push(
            map.current.addListener("click", () => {
              setSelectedBuilding(null);
              setIsBuildingView(false);
              setCurrentFloor(null);
              setMapZoom(18);
              setFloorGroup(null);
            })
          );

          dataListenersSetRef.current = true;
        }


      nodesData.forEach((node) => {

        const nodeFloorNumber = getFloorNumberById(node.floorId);

        if (
          (isBuildingView && nodeFloorNumber !== currentFloor) ||
          (!isBuildingView && node.floorId !== null)
        ) {
          return;
        }

        if (node.coordinates && node.iconUrl) {
          const [lng, lat] = JSON.parse(node.coordinates)[0];
      
          const iconDiv = document.createElement("div");
          iconDiv.style.position = "absolute";
          
          const img = document.createElement("img");
          img.src = `/assets/icons/${node.iconUrl}`; 
          img.style.width = "30px";
          img.style.height = "30px";
          iconDiv.appendChild(img);
      
          const overlay = new window.google.maps.OverlayView();
          let currentZoom = map.current.getZoom();

          overlay.onAdd = function () {
            const panes = this.getPanes();
            panes.overlayImage.appendChild(iconDiv);

            map.current.addListener("zoom_changed", () => {
              currentZoom = map.current.getZoom();
              overlay.draw(); 
            });
          };
          overlay.draw = function () {
            const projection = this.getProjection();
            if (!projection) return; 
            const position = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(lat, lng));
          
            if (currentZoom >= 17) {
              iconDiv.style.display = "block";
          
              // 🔧 Méret zoom szerint
              const baseSize = 40;
              const maxZoom = 21;
              const minZoom = 17;
              const clampedZoom = Math.min(Math.max(currentZoom, minZoom), maxZoom);
          
              // Lineáris skálázás (közeli zoomnál kisebb, távolinál nagyobb)
              const scaleFactor = 1 + ((maxZoom - clampedZoom) * 0.3); // pl. zoom 17 → x2.2, zoom 21 → x1
              const size = baseSize / scaleFactor;
          
              img.style.width = `${size}px`;
              img.style.height = `${size}px`;

              let opacity = 1;
              if (currentZoom <= 16) {
                opacity = 0;
              } else if (currentZoom >= 21) {
                opacity = 1;
              } else {
                opacity = (currentZoom - 18) / (21 - 18); // Lineáris skála
              }

              iconDiv.style.opacity = opacity.toFixed(2);
          
              iconDiv.style.left = `${position.x}px`;
              iconDiv.style.top = `${position.y}px`;
              iconDiv.style.transform = "translate(-50%, -50%)"; // középre igazítás
            } else {
              iconDiv.style.display = "none";
            }
          };
          overlay.onRemove = function () {
            if (iconDiv.parentNode) {
              iconDiv.parentNode.removeChild(iconDiv);
            }
          };
      
          overlay.setMap(map.current);

          overlaysRef.current.push(overlay);
        }
      });

        console.log("Térkép sikeresen inicializálva!");
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };
    
    loadData();

    if (window.location.pathname === "/") {
      navigate("/map", { replace: true });
    }

  }, [navigate, isBuildingView, currentFloor, selectedBuilding, searchHighlightedRoom, floorGroup, currentMapId, mapReady]);


  useEffect(() => {
    if (!map.current) return;
    map.current.data.setStyle(getFeatureStyle);
  }, [searchHighlightedBuilding,
      routeHighlightedBuildings,
      searchHighlightedRoom,
      routeHighlightedRooms,
      isBuildingView,
      currentFloor,
      floorGroup,
      selectedGroup,
  ]);

  useEffect(() => {
    if (!mapReady || !map.current) return;

    if (!isBuildingView) {
      renderBuildingShortLabels();
    } else {
      clearBuildingShortLabels();
    }

    return () => {
      // takarítás, ha a komponens unmountol
      clearBuildingShortLabels();
    };
  }, [isBuildingView, selectedGroup, mapReady, currentMapId]);

  useEffect(() => {
    if (!mapReady || !map.current) return;

    if (isBuildingView && currentFloor != null) {
      renderRoomLabels();
    } else {
      clearRoomLabels();
    }

    return () => {
      // takarítás unmountkor
      clearRoomLabels();
    };
  }, [isBuildingView, currentFloor, floorGroup, selectedGroup, mapReady, currentMapId]);

  const buildStepsFromNodes = (pathNodes = [], startLabel, endLabel) => {
    const steps = [];

    // START – room vagy building (ha van), különben csak cím
    const startTarget = routeEndpointsRef.current.start;
    if (startTarget?.floor) {
      steps.push({
        id: "start",
        title: startLabel || "Kezdőpont",
        kind: "transition",
        type: "room",
        room: startTarget
      });
    } else if (startTarget?.coordinates) {
      steps.push({
        id: "start",
        title: startLabel || "Kezdőpont",
        kind: "transition",
        type: "building",
        building: startTarget
      });
    } else {
      steps.push({ id: "start", title: startLabel || "Kezdőpont", kind: "transition" });
    }

    // Közbenső node-ok (csak stairs/exit, ahogy eddig)
    pathNodes.forEach((n, i) => {
      const t = (n.type || n.nodeType || "").toLowerCase();
      if (!BUILD_STEP_WHITELIST.has(t)) return;
      steps.push({
        id: n.id ?? `n${i}`,
        title: n.name || t.toUpperCase(),
        kind: nodeKindToStepKind(t),
        type: "node",
        node: n,
        hint: stepHintForType(t),
      });
    });

    // END – room vagy building
    const endTarget = routeEndpointsRef.current.end;
    if (endTarget?.floor) {
      steps.push({
        id: "end",
        title: endLabel || "Úticél",
        kind: "transition",
        type: "room",
        room: endTarget
      });
    } else if (endTarget?.coordinates) {
      steps.push({
        id: "end",
        title: endLabel || "Úticél",
        kind: "transition",
        type: "building",
        building: endTarget
      });
    } else {
      steps.push({ id: "end", title: endLabel || "Úticél", kind: "transition" });
    }

    return {
      startLabel,
      endLabel,
      totalDistance: "—",
      totalTime: "—",
      steps,
      activeStepId: steps[0]?.id,
    };
  };


  const onceIdleOrTimeout = (mp, timeoutMs = 500) =>
  new Promise((resolve) => {
    let done = false;
    const off = window.google.maps.event.addListenerOnce(mp, "idle", () => {
      if (done) return;
      done = true;
      resolve();
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      window.google.maps.event.removeListener(off);
      resolve();
    }, timeoutMs);
  });

  // Zoom fokozatos léptetése (pl. 16 → 19)
  const smoothZoom = async (mp, targetZoom, stepMs = 120) => {
    const clamp = (z) => Math.max(mp.minZoom || 3, Math.min(z, mp.maxZoom || 21));
    let current = mp.getZoom() ?? 18;
    targetZoom = clamp(targetZoom);

    const dir = targetZoom > current ? 1 : -1;
    while (current !== targetZoom) {
      current = clamp(current + dir);
      mp.setZoom(current);
      // kis szünet a következő lépés előtt
      await new Promise((r) => setTimeout(r, stepMs));
    }
  };

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const ensureViewForStart = async (startNode, opts = {}) => {
    const { preferOutdoor = false } = opts;
    if (!startNode) return;

    // Ha épületből jött a start (preferOutdoor), maradjunk külső nézetben,
    // függetlenül attól, hogy a node-nak van-e floorId-ja.
    if (preferOutdoor) {
      if (isBuildingView) setIsBuildingView(false);
      // Stabilizálás – várd meg a stílus/nézet átállását
      await wait(0);
      await wait(0);
      await onceIdleOrTimeout(map.current, 600);

      if (preferOutdoor && isBuildingView) {
      setIsBuildingView(false);
      await wait(0);
      await onceIdleOrTimeout(map.current, 400);
      }
      return;
    }

    // Egyébként marad a korábbi logika:
    if (startNode.floorId) {
      const floorsFC = allFloorsRef.current?.features || [];
      const buildingsFC = buildingsRef.current?.features || [];
      const floorF = floorsFC.find(f => f.properties?.id === startNode.floorId);
      const floorNumber = floorF?.properties?.number ?? null;
      const buildingName = floorF?.properties?.building ?? null;
      const buildingF = buildingsFC.find(b => b.properties?.name?.trim() === buildingName?.trim());
      const gather = buildingF?.properties?.gather?.replace(/"/g, "").trim() ?? null;

      if (!isBuildingView) setIsBuildingView(true);
      if (gather && floorGroup !== gather) setFloorGroup(gather);
      if (floorNumber !== null && currentFloor !== floorNumber) setCurrentFloor(floorNumber);
    } else {
      if (isBuildingView) setIsBuildingView(false);
    }

    await wait(0);
    await wait(0);
    await onceIdleOrTimeout(map.current, 600);
  };

  // „Fly to” élmény: először finom csúszás, majd sima rázum
  const flyTo = async (mp, latLng, targetZoom = 19, zoomStepMs = 120) => {
    if (!mp || !latLng) return;
    mp.panTo(latLng);
    await onceIdleOrTimeout(mp, 600);
    await smoothZoom(mp, targetZoom, zoomStepMs);
  };

  const getFeatureStyle = (feature) => {
    const category = feature.getProperty("category");
    const featureName = feature.getProperty("name");
    const buildingName = feature.getProperty("building");
    const floorNumber = feature.getProperty("number");
    const roomFloor = feature.getProperty("floor");
    const featureGroup = feature.getProperty("group");
  
    if (category === "room" && !isBuildingView) {
      return { visible: false };
    }

    const isSearchHighlighted =
      searchHighlightedRoom && featureName === searchHighlightedRoom.name.trim();
    const isRouteStart =
      routeHighlightedRooms.start && featureName === routeHighlightedRooms.start.name.trim();
    const isRouteEnd =
      routeHighlightedRooms.end && featureName === routeHighlightedRooms.end.name.trim();

    // ⬅️ Csak belső nézetben engedjük megjelenni a kiemelt szobát
    if (isBuildingView && (isSearchHighlighted || isRouteStart || isRouteEnd) && roomFloor === currentFloor) {
      return {
        fillColor: "blue",
        strokeColor: "black",
        strokeWeight: 0.1,
        visible: true,
      };
    }
  
    if (isBuildingView && (category === "floor" || category === "room")) {
      const relatedBuilding = buildingsRef.current?.features?.find(
        (b) => b.properties.name.trim() === buildingName?.trim()
      );
      const buildingGather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
      const currentGather = floorGroup?.replace(/"/g, "").trim();
  
      if (buildingGather !== currentGather) return { visible: false };
  
      if (category === "floor" && floorNumber === currentFloor) {
        return {
          fillColor: "lightgray",
          strokeColor: "lightgray",
          strokeWeight: 0.2,
          visible: true,
        };
      }
  
      if (category === "room" && roomFloor === currentFloor) {
        return {
          fillColor: "gray",
          strokeColor: "black",
          strokeWeight: 0,
          visible: true,
        };
      }
  
      return { visible: false };
    }
  
    if (!isBuildingView && category === "building") {
      const clean = str => (str || "").replace(/"/g, "").trim();
      const isSearchHighlighted =
        searchHighlightedBuilding &&
        (
          (searchHighlightedBuilding.name && clean(featureName) === clean(searchHighlightedBuilding.name)) ||
          (!searchHighlightedBuilding.name && searchHighlightedBuilding.group && clean(featureGroup) === clean(searchHighlightedBuilding.group))
        );
  
      const isRouteStart = routeHighlightedBuildings.start && featureName === routeHighlightedBuildings.start.name;
      const isRouteEnd = routeHighlightedBuildings.end && featureName === routeHighlightedBuildings.end.name;
      const isGroupHighlighted = selectedGroup && clean(featureGroup) === clean(selectedGroup);
  
      let fillColor = "gray";
      let strokeWeight = 0.1;
  
      if (isSearchHighlighted || isGroupHighlighted) {
        fillColor = "blue";
        strokeWeight = 0.1;
      } else if (isRouteStart || isRouteEnd) {
        fillColor = "blue";
        strokeWeight = 0.1;
      }
  
      return {
        fillColor,
        strokeColor: "black",
        strokeWeight,
        visible: true,
      };
    }
  
    return { visible: false };
  };

  // Poligon bounds-középpont számítás
  const getFeatureCenterLatLng = (feature) => {
    const geom = feature.getGeometry();
    if (!geom) return null;

    const bounds = new window.google.maps.LatLngBounds();

    const addPathToBounds = (path) => {
      for (let i = 0; i < path.getLength(); i++) {
        bounds.extend(path.getAt(i));
      }
    };

    const walkGeometry = (g) => {
      const t = g.getType();
      if (t === "Polygon") {
        const p = g.getAt(0);
        if (p) addPathToBounds(p);
      } else if (t === "MultiPolygon") {
        for (let i = 0; i < g.getLength(); i++) {
          const poly = g.getAt(i);
          const p = poly.getAt(0);
          if (p) addPathToBounds(p);
        }
      } else if (t === "GeometryCollection") {
        for (let i = 0; i < g.getLength(); i++) {
          walkGeometry(g.getAt(i));
        }
      }
    };

    walkGeometry(geom);
    if (bounds.isEmpty()) return null;
    return bounds.getCenter();
  };

  const getRoomLabelText = (feature) => {
    const name = (feature.getProperty("name") || "").trim();
    if (!name) return "";
    // ha szeretnéd rövidíteni a nagyon hosszú neveket:
    return name.length > 20 ? name.slice(0, 20) + "…" : name;
  };

  const createOrUpdateRoomLabel = (feature) => {
    if (!map.current) return;

    const labelText = getRoomLabelText(feature);
    if (!labelText) return;

    const center = getFeatureCenterLatLng(feature);
    if (!center) return;

    const key = feature.getProperty("id") ?? `${feature.getProperty("name")}-${feature.getProperty("floor")}`;
    if (!key) return;

    let overlay = roomLabelOverlaysRef.current.get(key);
    let labelDiv;

    if (!overlay) {
      labelDiv = document.createElement("div");
      labelDiv.className = "room-name-label";
      labelDiv.style.position = "absolute";
      labelDiv.style.transform = "translate(-50%, -50%)";
      labelDiv.style.pointerEvents = "none";
      labelDiv.style.fontWeight = "500";
      labelDiv.style.letterSpacing = "0.2px";
      labelDiv.style.textShadow = "0 0 2px rgba(255,255,255,0.8)";
      labelDiv.style.color = "#6b7280";      // halvány szürke
      labelDiv.style.opacity = "0.7";        // kicsit áttetsző
      labelDiv.style.whiteSpace = "nowrap";
      labelDiv.style.userSelect = "none";
      labelDiv.innerText = labelText;

      overlay = new window.google.maps.OverlayView();
      overlay.onAdd = function () {
        const panes = this.getPanes();
        // nem kell egéresemény → overlayImage elég
        panes.overlayImage.appendChild(labelDiv);
      };
      overlay.draw = function () {
        const proj = this.getProjection();
        if (!proj || !map.current) return;

        // középre igazítás
        const pos = proj.fromLatLngToDivPixel(center);
        labelDiv.style.left = `${pos.x}px`;
        labelDiv.style.top  = `${pos.y}px`;

        const z = map.current.getZoom() ?? 18;

        // --- 1) Agresszívebb (exponenciális) skálázás ---
        // 22-es zoomnál ~16px, minden egyes "kifelé" lépésnél ~0.82-szeresére csökken.
        // (tetszés szerint hangolható a 16 és 0.82)
        const baseAtMaxZoom = 16;      // px a legnagyobb zoomnál
        const decayPerStep  = 0.82;    // mennyire csökken zoomonként
        const sizePx = Math.max(7, baseAtMaxZoom * Math.pow(decayPerStep, 22 - z));
        labelDiv.style.fontSize = `${sizePx.toFixed(1)}px`;

        // --- 2) Elrejtés, ha túl "kicsi" a szoba a képernyőn ---
        // Kb. becslünk a szoba képernyőn látszó méretére egy bounding box-szal.
        const pixelBounds = (() => {
          // a feature alakzatát kirajzoló polygon első gyűrűjét mintavételezzük
          const geom = feature.getGeometry();
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

          const addPath = (path) => {
            for (let i = 0; i < path.getLength(); i++) {
              const ll = path.getAt(i);
              const p = proj.fromLatLngToDivPixel(ll);
              if (!p) continue;
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            }
          };

          const walk = (g) => {
            const t = g.getType();
            if (t === "Polygon") {
              const ring = g.getAt(0);
              if (ring) addPath(ring);
            } else if (t === "MultiPolygon") {
              for (let i = 0; i < g.getLength(); i++) {
                const poly = g.getAt(i);
                const ring = poly.getAt(0);
                if (ring) addPath(ring);
              }
            } else if (t === "GeometryCollection") {
              for (let i = 0; i < g.getLength(); i++) {
                walk(g.getAt(i));
              }
            }
          };

          walk(geom);
          if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return { w: 0, h: 0, area: 0 };
          }
          const w = Math.max(0, maxX - minX);
          const h = Math.max(0, maxY - minY);
          return { w, h, area: w * h };
        })();

        // Ha a szoba bounding box-a túl kicsi a képernyőn, akkor rejtsük a feliratot.
        // (küszöb hangolható: 250–800 közti értékek jók; alább 500)
        const tooSmall = pixelBounds.area < 500;

        // További, zoom alapú megjelenítési szabályok:
        // - 16 alatt általában rejtsük el a szobafeliratokat
        // - különben áttetszőség a zoom függvényében (finom halványítás)
        if (z < 16 || tooSmall) {
          labelDiv.style.display = "none";
        } else {
          labelDiv.style.display = "block";
          const opacity = Math.max(0.45, Math.min(0.9, 0.45 + (z - 16) * 0.1));
          labelDiv.style.opacity = opacity.toFixed(2);
        }

        // (marad: pointer-events: none; transform: translate(-50%, -50%); stb.)
      };


      overlay.onRemove = function () {
        if (labelDiv.parentNode) labelDiv.parentNode.removeChild(labelDiv);
      };
      overlay.setMap(map.current);

      roomLabelOverlaysRef.current.set(key, overlay);
    } else {
      overlay.draw && overlay.draw();
    }
  };

  // A felirat szövege (shortName > névből rövidítés)
  const getBuildingLabelText = (feature) => {
    const shortName = (feature.getProperty("shortName") || "").trim();
    if (shortName) return shortName;

    const name = (feature.getProperty("name") || "").trim();
    if (!name) return "";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  };

  // Egy épület címkéjének létrehozása/frissítése
  const createOrUpdateBuildingLabel = (feature) => {
    if (!map.current) return;

    const labelText = getBuildingLabelText(feature);
    if (!labelText) return;

    const center = getFeatureCenterLatLng(feature);
    if (!center) return;

    const key = feature.getProperty("id") ?? feature.getProperty("name");
    if (!key) return;

    let overlay = buildingLabelOverlaysRef.current.get(key);
    let labelDiv;

    if (!overlay) {
      labelDiv = document.createElement("div");
      labelDiv.className = "building-shortname-label";
      labelDiv.style.position = "absolute";
      labelDiv.style.transform = "translate(-50%, -50%)";
      labelDiv.style.pointerEvents = "none";
      labelDiv.style.fontWeight = "600";
      labelDiv.style.letterSpacing = "0.5px";
      labelDiv.style.textShadow = "0 0 3px rgba(255,255,255,0.8)";
      labelDiv.style.color = "#000";
      labelDiv.style.opacity = "0.5";
      labelDiv.style.whiteSpace = "nowrap";
      labelDiv.style.userSelect = "none";
      labelDiv.innerText = labelText;

      overlay = new window.google.maps.OverlayView();
      overlay.onAdd = function () {
        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(labelDiv);
      };
      overlay.draw = function () {
        const proj = this.getProjection();
        if (!proj) return;
        const pos = proj.fromLatLngToDivPixel(center);
        labelDiv.style.left = `${pos.x}px`;
        labelDiv.style.top  = `${pos.y}px`;

        const z = map.current.getZoom() ?? 18;

        // Zoom 15–22 között 12–36 px-ig skálázunk
        const sizePx = scaleBetween(z, 15, 22, 12, 36);
        labelDiv.style.fontSize = `${sizePx.toFixed(1)}px`;

        // Opcionális: kicsit halványabb távolról, erősebb közelről
        const op = scaleBetween(z, 15, 22, 0.35, 0.7);
        labelDiv.style.opacity = `${op.toFixed(2)}`;

        // Ha nagyon messze vagyunk, el is rejthetjük (opcionális):
        labelDiv.style.display = z < 14 ? "none" : "block";
      };
      overlay.onRemove = function () {
        if (labelDiv.parentNode) labelDiv.parentNode.removeChild(labelDiv);
      };
      overlay.setMap(map.current);

      buildingLabelOverlaysRef.current.set(key, overlay);
    } else {
      overlay.draw && overlay.draw();
    }
  };

  const renderRoomLabels = () => {
    if (!map.current) return;

    // töröljük a régieket, hogy ne duplikálódjon
    roomLabelOverlaysRef.current.forEach((ov) => ov.setMap(null));
    roomLabelOverlaysRef.current.clear();

    const clean = (s) => (s || "").replace(/"/g, "").trim();

    map.current.data.forEach((feature) => {
      if (feature.getProperty("category") !== "room") return;

      const roomFloor = feature.getProperty("floor");
      if (roomFloor !== currentFloor) return;

      // csoport-szűrés a floorGroup alapján (mint a stíluslogikában)
      if (floorGroup) {
        const buildingName = feature.getProperty("building");
        const relatedBuilding = buildingsRef.current?.features?.find(
          (b) => clean(b.properties?.name) === clean(buildingName)
        );
        const buildingGather = clean(relatedBuilding?.properties?.gather);
        const currentGather = clean(floorGroup);
        if (buildingGather !== currentGather) return;
      }

      createOrUpdateRoomLabel(feature);
    });

    if (roomLabelZoomListenerRef.current) {
      window.google.maps.event.removeListener(roomLabelZoomListenerRef.current);
      roomLabelZoomListenerRef.current = null;
    }
    roomLabelZoomListenerRef.current = map.current.addListener("zoom_changed", () => {
      roomLabelOverlaysRef.current.forEach((ov) => ov.draw && ov.draw());
    });
  };

  const clearRoomLabels = () => {
    roomLabelOverlaysRef.current.forEach((ov) => ov.setMap(null));
    roomLabelOverlaysRef.current.clear();
    if (roomLabelZoomListenerRef.current) {
      window.google.maps.event.removeListener(roomLabelZoomListenerRef.current);
      roomLabelZoomListenerRef.current = null;
    }
  };

  // Összes épület rövidnév címkéjének kirajzolása (külső nézet)
  const renderBuildingShortLabels = () => {
    if (!map.current) return;

    // töröljük a régieket, hogy ne duplikálódjon
    buildingLabelOverlaysRef.current.forEach((ov) => ov.setMap(null));
    buildingLabelOverlaysRef.current.clear();

    map.current.data.forEach((feature) => {
      if (feature.getProperty("category") === "building") {
        if (!isBuildingView) {
          const clean = (s) => (s || "").replace(/"/g, "").trim();
          if (selectedGroup) {
            const fg = clean(feature.getProperty("group"));
            if (fg !== clean(selectedGroup)) return;
          }
          createOrUpdateBuildingLabel(feature);
        }
      }
    });

    if (buildingLabelZoomListenerRef.current) {
      window.google.maps.event.removeListener(buildingLabelZoomListenerRef.current);
      buildingLabelZoomListenerRef.current = null;
    }
    buildingLabelZoomListenerRef.current = map.current.addListener("zoom_changed", () => {
      buildingLabelOverlaysRef.current.forEach((ov) => ov.draw && ov.draw());
    });
  };

  // Címkék eltakarítása
  const clearBuildingShortLabels = () => {
    buildingLabelOverlaysRef.current.forEach((ov) => ov.setMap(null));
    buildingLabelOverlaysRef.current.clear();
    if (buildingLabelZoomListenerRef.current) {
      window.google.maps.event.removeListener(buildingLabelZoomListenerRef.current);
      buildingLabelZoomListenerRef.current = null;
    }
  };

  
  const handleSearch = async (query) => {
    if (!query.trim()) return;
  
    try {
      const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
      const data = await response.json();
  
      console.log("Keresési eredmények:", data);
  
      if (data.buildings.length > 0) {
        setIsBuildingView(false); // Külső nézetre váltás
        setSearchHighlightedRoom(null);

        setTimeout(() => {
          setSearchHighlightedRoom(null);
          highlightSearchBuilding(data.buildings[0]);
        }, 200); // Kiemelés kis késleltetéssel

      } else if (data.rooms.length > 0) {
        const room = data.rooms[0];
            setIsBuildingView(true);
            highlightSearchRoom(room);
      } else {
        alert("Nincs találat!");
      }
    } catch (error) {
      console.error("Hiba a keresés során:", error);
    }
  };

  const highlightSearchBuilding = (building = null, group = null) => {
    if (!map.current) return;
  
    if (building) {
      setSearchHighlightedBuilding(building);
      setRouteHighlightedBuildings({ start: null, end: null });
  
      const coordinates = JSON.parse(building.coordinates);
      const bounds = new window.google.maps.LatLngBounds();
      coordinates.forEach(([lng, lat]) =>
        bounds.extend(new window.google.maps.LatLng(lat, lng))
      );
      map.current.panTo(bounds.getCenter());
      window.google.maps.event.addListenerOnce(map.current, "idle", () => {
        map.current.fitBounds(bounds, 100);
        // zoom plafon a túl közeli nézet elkerülésére
        window.google.maps.event.addListenerOnce(map.current, "idle", () => {
          const z = map.current.getZoom();
          if (z > 19) map.current.setZoom(19);
        });
      });
    }
  
    else if (group) {
      setSearchHighlightedBuilding(null); // egyéni épület ne zavarjon bele
      setRouteHighlightedBuildings({ start: null, end: null });
  
      let latSum = 0, lngSum = 0, count = 0;
      const bounds = new window.google.maps.LatLngBounds();
  
      map.current.data.forEach((feature) => {
        const featureCategory = feature.getProperty("category");
        const featureGroup = feature.getProperty("group");
  
        if (featureCategory === "building" && featureGroup === group) {
          const geometry = feature.getGeometry();
          if (geometry && geometry.getType() === "Polygon") {
            const firstPath = geometry.getAt(0);
            if (firstPath && firstPath.getAt) {
              const firstCoordinate = firstPath.getAt(0);
              if (firstCoordinate) {
                latSum += firstCoordinate.lat();
                lngSum += firstCoordinate.lng();
                count++;
                bounds.extend(firstCoordinate);
              }
            }
          }
        }
      });
  
      if (count > 0) {
        const center = { lat: latSum / count, lng: lngSum / count };
        map.current.panTo(center);
        setTimeout(()=> {
          map.current.fitBounds(bounds, 200);
        },200)
      }
  
      setSearchHighlightedBuilding({ name: null, group });
    }
  };
  
  const highlightRouteBuilding = (building, isStart = false) => {
    if (!map.current || !building) return;
  
    setRouteHighlightedBuildings(prev => ({
      ...prev,
      [isStart ? "start" : "end"]: building,
    }));
  
    const coordinates = JSON.parse(building.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) =>
      bounds.extend(new window.google.maps.LatLng(lat, lng))
    );
  };

    const focusOnBuilding = (buildingName, gatherName) => {
      if (!buildingName || !gatherName) return;
    
      const floors = allFloorsRef.current?.features || [];
      const buildings = buildingsRef.current?.features || [];
    
      setIsBuildingView(true);
      setSelectedBuilding(buildingName);
      setFloorGroup(gatherName);
    
      const floorsInGroup = floors
        .filter((floor) => {
          const relatedBuilding = buildings.find(
            (b) => b.properties.name.trim() === floor.properties.building.trim()
          );
          const cleanGather = (str) => str?.replace(/"/g, "").trim();
          const buildingGather = cleanGather(relatedBuilding?.properties?.gather);
          return buildingGather === cleanGather(gatherName);
        })
        .sort((a, b) => a.properties.number - b.properties.number);
    
      const uniqueFloorNumbers = [...new Set(floorsInGroup.map(f => f.properties.number))].sort((a, b) => a - b);
      setAvailableFloorNumbers(uniqueFloorNumbers);
      setCurrentFloor(uniqueFloorNumbers[0] ?? 0);
    
      const buildingFeature = buildings.find((b) => b.properties.name === buildingName);
      if (!buildingFeature) return;
    
      try {
        let coordinates = buildingFeature.geometry.coordinates;
    
        if (buildingFeature.geometry.type === "Polygon") {
          coordinates = coordinates[0];
        } else if (buildingFeature.geometry.type === "MultiPolygon") {
          coordinates = coordinates[0][0];
        }
    
        const bounds = new window.google.maps.LatLngBounds();
        coordinates.forEach(([lng, lat]) => {
          if (isFinite(lat) && isFinite(lng)) {
            bounds.extend(new window.google.maps.LatLng(lat, lng));
          }
        });
    
        const center = bounds.getCenter();
        if (center && isFinite(center.lat()) && isFinite(center.lng())) {
          //setMapCenter({ lat: center.lat(), lng: center.lng() });
          //setMapZoom(19);
        } else {
          console.warn("Hibás középpont számítás:", center);
        }

        // Illeszkedjünk az épülethez, majd finoman zoomoljunk 21-re
        map.current.fitBounds(bounds, 80);
        window.google.maps.event.addListenerOnce(map.current, "idle", async () => {
          // Ha a fitBounds túl messze állt meg, húzzuk fel 21-re; ha túl közel, rögzítsük 21-en
          const z = map.current.getZoom() ?? 18;
          if (z < 21) {
            await smoothZoom(map.current, 20, 20); // lépcső 80ms, ízlés szerint állítható
          } else {
            map.current.setZoom(20);
          }
        });

      } catch (error) {
        console.error("Hiba az épület fókuszálásakor:", error);
      }
    };    

    const focusNode = async (node) => {
      if (!node || !map.current) return;

      // ha van floorId → belső nézet, különben külső
      if (node.floorId) {
        // állítsd be az épület/floor nézetet
        const floorsFC = allFloorsRef.current?.features || [];
        const buildingsFC = buildingsRef.current?.features || [];
        const floorF = floorsFC.find(f => f.properties?.id === node.floorId);
        const floorNumber = floorF?.properties?.number ?? null;
        const buildingName = floorF?.properties?.building ?? null;
        const buildingF = buildingsFC.find(b => b.properties?.name?.trim() === buildingName?.trim());
        const gather = buildingF?.properties?.gather?.replace(/"/g, "").trim() ?? null;

        if (!isBuildingView) setIsBuildingView(true);
        if (gather && floorGroup !== gather) setFloorGroup(gather);
        if (floorNumber !== null && currentFloor !== floorNumber) setCurrentFloor(floorNumber);

        await onceIdleOrTimeout(map.current, 300);
        const [lng, lat] = JSON.parse(node.coordinates)[0];
        await flyTo(map.current, { lat, lng }, 21, 90);   // beltér: 20 körüli zoom jó
      } else {
        // kültér
        if (isBuildingView) setIsBuildingView(false);
        await onceIdleOrTimeout(map.current, 300);
        const [lng, lat] = JSON.parse(node.coordinates)[0];
        await flyTo(map.current, { lat, lng }, 20, 100);
      }
    };

  const focusRoom = async (room) => {
    if (!room || !map.current) return;
    const buildingName = room.floor.building.name;
    const buildingGather = buildingsRef.current?.features?.find(
      b => b.properties.name.trim() === buildingName.trim()
    )?.properties?.gather?.replace(/"/g, "").trim();

    setIsBuildingView(true);
    setSelectedBuilding(buildingName);
    if (buildingGather) setFloorGroup(buildingGather);
    setCurrentFloor(room.floor.number);

    await onceIdleOrTimeout(map.current, 300);
    const coords = JSON.parse(room.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coords.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
    map.current.fitBounds(bounds, 80);
    await onceIdleOrTimeout(map.current, 250);
    // finom rázúm
    await smoothZoom(map.current, 21, 80);
  };

  const focusBuilding = async (building) => {
    if (!building || !map.current) return;
    // végpontként az épületet kültérben mutatjuk
    if (isBuildingView) setIsBuildingView(false);
    await onceIdleOrTimeout(map.current, 250);

    const coordinates = JSON.parse(building.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
    map.current.fitBounds(bounds, 100);
    await onceIdleOrTimeout(map.current, 250);
    const z = map.current.getZoom() ?? 19;
    if (z > 20) map.current.setZoom(20);
  };

  
  const highlightSearchRoom = async (room) => {
    if (!map.current || !room) return;

    const buildingName = room.floor.building.name;
    const buildingGather = buildingsRef.current?.features?.find(
      b => b.properties.name.trim() === buildingName.trim()
    )?.properties?.gather?.replace(/"/g, "").trim();

    if (!buildingGather) {
      console.warn("Nincs 'gather' mező a szoba épületéhez:", buildingName);
      return;
    }

    // Állítsuk be a belső nézetet és a kapcsolódó adatokat
    setIsBuildingView(true);
    setSelectedBuilding(buildingName);
    setFloorGroup(buildingGather);
    setCurrentFloor(room.floor.number);
    setSearchHighlightedRoom(room);
    //setMapZoom(19);

    // Visszakeressük az összes emeletet, ami a gather csoporthoz tartozik
    const floorsInGroup = allFloorsRef.current?.features
      ?.filter(floor => {
        const relatedBuilding = buildingsRef.current?.features?.find(b => b.properties.name.trim() === floor.properties.building.trim());
        const gather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
        return gather === buildingGather;
      })
      ?.sort((a, b) => a.properties.number - b.properties.number);

    const uniqueFloors = [...new Set(floorsInGroup?.map(f => f.properties.number))];
    setAvailableFloorNumbers(uniqueFloors);

    // Középpont beállítása
    const coordinates = JSON.parse(room.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
    setTimeout(() => {
      map.current.fitBounds(bounds, 100);
    },200)
  };

  const highlightRouteRoom = async (room, isStart = false, opts = {}) => {
    const { allowViewSwitch = true } = opts; // ÚJ


    if (!map.current || !room) return;
    
    const buildingName = room.floor.building.name;
    const buildingGather = buildingsRef.current?.features?.find(
      b => b.properties.name.trim() === buildingName.trim()
    )?.properties?.gather?.replace(/"/g, "").trim();

    if (!buildingGather) {
      console.warn("Nincs 'gather' mező a szoba épületéhez:", buildingName);
      return;
    }

    // Állítsuk be a belső nézetet és a kapcsolódó adatokat
    if (allowViewSwitch) {
      setIsBuildingView(true);
      setSelectedBuilding(buildingName);
      setFloorGroup(buildingGather);
      setCurrentFloor(room.floor.number);
      setRouteHighlightedRooms(prev => ({
        ...prev,
        [isStart ? "start" : "end"]: room,
      }));
    }
    //setMapZoom(19);

    setRouteHighlightedRooms(prev => ({
      ...prev,
      [isStart ? "start" : "end"]: room,
    }));

    // Visszakeressük az összes emeletet, ami a gather csoporthoz tartozik
    const floorsInGroup = allFloorsRef.current?.features
      ?.filter(floor => {
        const relatedBuilding = buildingsRef.current?.features?.find(b => b.properties.name.trim() === floor.properties.building.trim());
        const gather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
        return gather === buildingGather;
      })
      ?.sort((a, b) => a.properties.number - b.properties.number);

    const uniqueFloors = [...new Set(floorsInGroup?.map(f => f.properties.number))];
    setAvailableFloorNumbers(uniqueFloors);

    // Középpont beállítása
    const coordinates = JSON.parse(room.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
  };

  const handleRouteSearch = async (startName, endName) => { //működik
    try {
      const [startRes, endRes] = await Promise.all([
        fetch(`http://localhost:5000/api/search?q=${startName}`),
        fetch(`http://localhost:5000/api/search?q=${endName}`)
      ]);
      
      const dataStart = await startRes.json();
      const dataEnd = await endRes.json();

      lastRouteNamesRef.current = { start: startName, end: endName };

      const startFromBuilding = !!dataStart.buildings?.[0];
      //const startFromRoom     = !!dataStart.rooms?.[0];

      let startNode = dataStart.nodes?.[0] ??
      (dataStart.buildings?.[0] &&
        nodes.find(n => n.buildingId === dataStart.buildings[0].id));

      let endNode = dataEnd.nodes?.[0] ??
        (dataEnd.buildings?.[0] &&
          nodes.find(n => n.buildingId === dataEnd.buildings[0].id));

      if (!startNode || !endNode) {
        alert("Nem található megfelelő kezdő vagy célpont.");
        return;
      }
      
      // 1) START/END highlighting (változatlan logika)
      if (dataStart.buildings?.[0]) {
        highlightRouteBuilding(dataStart.buildings[0], true);
      } else if (dataStart.rooms?.[0]) {
        await highlightRouteRoom(dataStart.rooms[0], true, { allowViewSwitch: true });
      }

      if (dataEnd.buildings?.[0]) {
        highlightRouteBuilding(dataEnd.buildings[0], false);
      } else if (dataEnd.rooms?.[0]) {
        await highlightRouteRoom(dataEnd.rooms[0], false, { allowViewSwitch: false });
      }

      // 2) FÓKUSZ mindig a START-ra, de a highlightolt *típusnak megfelelően*
      if (dataStart.rooms?.[0]) {
        await focusRoom(dataStart.rooms[0]);           // beltér + szint + fitBounds + zoom
      } else if (dataStart.buildings?.[0]) {
        await focusBuilding(dataStart.buildings[0]);   // kültér + fitBounds + zoom
      } else {
        // fallback: node
        const [sLng, sLat] = JSON.parse(startNode.coordinates)[0];
        await flyTo(map.current, { lat: sLat, lng: sLng }, 20, 100);
      }
  
      // Állítsuk be a NavigationComponent-hez szükséges értékeket
      setStartLocation({ id: startNode.id, coordinates: startNode.coordinates });
      setEndLocation({ id: endNode.id, coordinates: endNode.coordinates });
      setClearRoute(false);


      await ensureViewForStart(startNode, { preferOutdoor: startFromBuilding });

      // és csak utána repülj:
      const [sLng, sLat] = JSON.parse(startNode.coordinates)[0];
      await flyTo(map.current, { lat: sLat, lng: sLng }, 20, 100);

      routeEndpointsRef.current = {
        start:  dataStart.rooms?.[0] || dataStart.buildings?.[0] || null,
        end:    dataEnd.rooms?.[0]   || dataEnd.buildings?.[0]   || null
      };

  
    } catch (err) {
      console.error("Hiba az útvonalhoz szükséges node-ok lekérésénél:", err);
      alert("Nem sikerült betölteni az útvonalat.");
    }
  };
  
  // MapComponent-ben:
  const handleRouteNodes = (pathNodes, meta = {}) => {
    setRouteUI((prev) => {
      const ui = buildStepsFromNodes(
        pathNodes,
        lastRouteNamesRef.current.start,
        lastRouteNamesRef.current.end
      );

      if (meta?.distance) ui.totalDistance = meta.distance;
      if (meta?.time)     ui.totalTime     = meta.time;

      // ⬇️ MEGŐRZÉS: ha a korábbi aktív lépés még létezik, ne ugorjunk vissza az elejére
      const prevActive = prev?.activeStepId;
      if (prevActive && ui.steps.some(s => s.id === prevActive)) {
        ui.activeStepId = prevActive;
      }

      return ui;
    });
  };



  const cancelRoute = () => {
    setStartLocation(null);
    setEndLocation(null);
    setClearRoute(true);
    setRouteHighlightedRooms({ start: null, end: null });
    setRouteHighlightedBuildings({ start: null, end: null });
  };

  return (
    <div style={{ width: "100%", height: "100vh" }}>
    <button className="info-btn"
      onClick={() => navigate("/info")}
      title="Információ"
    >
      <img
        src="/assets/icons/information.svg"
        alt="Információ"
      />
    </button>
    <div className="top-ui-wrapper">
      <button className="toggle-hud-btn" onClick={toggleHUD}>
        {hudHidden ? '▶' : '◀'}
      </button>
      <SearchPanel
        hudHidden={hudHidden}
        onSearch={handleSearch}
        onRouteSearch={handleRouteSearch}
        onGroupSelect={handleGroupSelect}
        onCancelRoute={() => {
          setStartLocation(null);
          setEndLocation(null);
          setClearRoute(true);
          setRouteHighlightedRooms({ start: null, end: null });
          setRouteHighlightedBuildings({ start: null, end: null });
          setRouteUI(null);
        }}
        delHighlight={() => {
          setSearchHighlightedRoom(null);
          setSearchHighlightedBuilding(null);
        }}
         routeUI={routeUI}
         onStepClick={handleStepClick}
         onCloseSteps={handleCloseSteps}
         routeDisabled={!!selectedGroup}
        />
      </div>
      <NavigationComponent
        start={startLocation}
        end={endLocation}
        map={map.current}
        clear={clearRoute}
        currentFloor={currentFloor}
        isBuildingView={isBuildingView}
        floors={allFloorsRef.current?.features}
        onRouteNodes={handleRouteNodes}
      />
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "blue" }}>Hiba történt: {error}</p>}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      
      {isBuildingView && availableFloorNumbers.length > 0 && (
        <div className="slider-container"
          onWheel={(e) => {
            e.preventDefault();
            const currentIndex = availableFloorNumbers.indexOf(currentFloor);
            const delta = Math.sign(e.deltaY);
            let newIndex = currentIndex - delta;
        
            if (newIndex < 0) newIndex = 0;
            if (newIndex >= availableFloorNumbers.length) newIndex = availableFloorNumbers.length - 1;
        
            setCurrentFloor(availableFloorNumbers[newIndex]);
          }}
        >
          <p className="slider-label">Szint: {currentFloor}</p>
          <input
            type="range"
            min={0}
            max={availableFloorNumbers.length - 1}
            value={availableFloorNumbers.indexOf(currentFloor)}
            onChange={(e) => setCurrentFloor(availableFloorNumbers[Number(e.target.value)])}
            className="slider"
            orient="vertical"
          />
        </div>
      )}
      {/* <Map3DControls onToggle3D={(new3DState) => {
        setIs3DView(new3DState);
        setCurrentMapId(new3DState ? MAP_ID_3D : MAP_ID_2D);
      }} /> */}
    </div>
    
  );
};

export default MapComponent;