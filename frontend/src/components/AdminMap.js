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
  const [filter, setFilter] = useState(null);
  const newPolygon = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshMap = () => {
    //console.log(" Térkép frissítése...");
    setMapRefreshTrigger((prev) => prev + 1);
  };

  const applyFilter = (filterData) => {
    //console.log(" Szűrés alkalmazása:", filterData);
    setFilter(filterData);
  };
  
  const resetFilter = () => {
    setFilter(null);
    //console.log(" Szűrés visszaállítva");
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
              const { category, buildingId, floorNumber } = filter;
            
              if (category === "building") {
                if (type === "node") {
                  const hasBuilding = feature.properties.buildingId != null;
                  const noFloor = feature.properties.floorId == null;
                  if (!(hasBuilding && noFloor)) return;
                } else if (type !== "building") {
                  return;
                }
            
                if (buildingId && feature.properties.id !== Number(buildingId)) return;
              }
            
              if (category === "floor") {
                if (type === "floor") {
                  if (feature.properties.number !== Number(floorNumber)) return;
                } else if (type === "room") {
                  const floor = floors.find(f => f.id === feature.properties.floorId);
                  if (!floor || floor.number !== Number(floorNumber)) return;
                } else {
                  return; // Csak floor és room jelenhet meg
                }
              }
            
              // outdoor edges és node-ok külön kezelése
              if (category === "node_edge") {
                // csak outdoor edge-ek ÉS exit típusú node-ok
                if (type === "node") {
                  if (feature.properties.type !== "exit") return;
                } else if (type === "edge") {
                  if (feature.properties.type !== "outdoor") return;
                } else {
                  return; // minden mást elrejtünk (épület, floor, room)
                }
              }
            }

            polygon.setMap(map.current);

            window.google.maps.event.addListener(drawingManager.current, "overlaycomplete", (event) => {
              console.log("Alakzat létrehozva!");
              drawingManager.current.setDrawingMode(null); // Automatikusan kikapcsolja a rajzolási módot

              if (event.type === "marker") {
                const position = event.overlay.getPosition();
                const coordinates = [[position.lng(), position.lat()]];
            
                //console.log("Új node koordinátái:", coordinates);
            
                setSelectedData({
                  category: "node",
                  coordinates,
                });
            
                return; // ne fusson tovább polygon esetén
              }

              if(event.type === "polygon"){

                newPolygon.current = event.overlay;
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
          if (filter?.category === "floor") return;
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
        });
                
        //Nodok megjelenítése és kiemelése
        nodesRaw.forEach((node) => {
          if (filter?.category === "floor") return;
          const { id, name, coordinates } = node;
        
          let parsedCoordinates;
          if (typeof coordinates === "string") {
            try {
              parsedCoordinates = JSON.parse(coordinates);
            } catch (error) {
              console.warn(`JSON.parse hiba a node-nál (id: ${id}):`, coordinates);
              return;
            }
          } else if (Array.isArray(coordinates)) {
            parsedCoordinates = coordinates;
          } else {
            console.warn(`Érvénytelen koordináták (id: ${id}):`, coordinates);
            return;
          }
        
          if (!Array.isArray(parsedCoordinates) || !Array.isArray(parsedCoordinates[0]) || parsedCoordinates[0].length !== 2) {
            console.warn(`Érvénytelen parsed koordináták (id: ${id}):`, parsedCoordinates);
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

  const simplifyPolygon = (points, minDistance = 0.0000001) => {
    if (points.length < 4) return points; // Ha túl kevés pont van, nem módosítunk

    const sqMinDistance = minDistance * minDistance;

    // Euklideszi távolság négyzetes formában
    const getSqDist = (p1, p2) => {
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        return dx * dx + dy * dy;
    };

    let filteredPoints = [];

    for (let i = 0; i < points.length; i++) {
        let isDuplicate = false;

        for (let j = 0; j < filteredPoints.length; j++) {
            if (getSqDist(points[i], filteredPoints[j]) < sqMinDistance) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            filteredPoints.push(points[i]);
        }
    }

    // Egyenes vonalon lévő felesleges pontok eltávolítása
    const removeCollinearPoints = (points) => {
        if (points.length < 4) return points;

        const isCollinear = (p1, p2, p3) => {
            return Math.abs((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1])) < 1e-10;
        };

        let result = [points[0]]; // Az első pontot mindig megtartjuk

        for (let i = 1; i < points.length - 1; i++) {
            if (!isCollinear(points[i - 1], points[i], points[i + 1])) {
                result.push(points[i]); // Csak akkor tartjuk meg, ha nem egy egyenes része
            }
        }

        result.push(points[points.length - 1]); // Az utolsó pontot mindig megtartjuk
        return result;
    };

    // Egyenes vonalakat egyszerűsítjük
    filteredPoints = removeCollinearPoints(filteredPoints);

    // Ha az utolsó pont nem egyezik meg az elsővel, biztosítjuk a zártságot
    if (filteredPoints.length > 2 &&
        (filteredPoints[0][0] !== filteredPoints[filteredPoints.length - 1][0] ||
         filteredPoints[0][1] !== filteredPoints[filteredPoints.length - 1][1])) {
        filteredPoints.push([...filteredPoints[0]]);
    }

    return filteredPoints;
};

const simplifyPolyline = (points, minDistance = 0.0000001) => {
  if (points.length < 3) return points;

  const sqMinDistance = minDistance * minDistance;

  const getSqDist = (p1, p2) => {
      const dx = p1[0] - p2[0];
      const dy = p1[1] - p2[1];
      return dx * dx + dy * dy;
  };

  // Távolság alapú szűrés
  let filteredPoints = [];
  for (let i = 0; i < points.length; i++) {
      let isDuplicate = false;

      for (let j = 0; j < filteredPoints.length; j++) {
          if (getSqDist(points[i], filteredPoints[j]) < sqMinDistance) {
              isDuplicate = true;
              break;
          }
      }

      if (!isDuplicate) {
          filteredPoints.push(points[i]);
      }
  }

  // Kollineáris pontok kiszűrése
  const removeCollinearPoints = (points) => {
      if (points.length < 3) return points;

      const isCollinear = (p1, p2, p3) => {
          return Math.abs((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1])) < 1e-8;
      };

      let result = [points[0]];
      for (let i = 1; i < points.length - 1; i++) {
          if (!isCollinear(points[i - 1], points[i], points[i + 1])) {
              result.push(points[i]);
          }
      }
      result.push(points[points.length - 1]);
      return result;
  };

  return removeCollinearPoints(filteredPoints);
};

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
        type: selectedData.type || "",
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
  
      const waypoints = selectedFeature.current.polyline
        .getPath()
        .getArray()
        .map((latLng) => [latLng.lng(), latLng.lat()]);

      const simplifiedWaypoints = simplifyPolyline(waypoints, 0.0000001);
  
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
      .map((latLng) => [latLng.lng(), latLng.lat()]);
  
    const simplifiedCoordinates = simplifyPolygon(coordinates, 0.00001);

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
