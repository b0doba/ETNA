import React, { useRef, useEffect, useState } from "react";
import "../AdminLook.css";

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_API_KEY;
const API_BASE_URL = "http://localhost:5000/api";

// Google Maps API betöltése
const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    if (document.getElementById("google-maps-script")) {
      document.getElementById("google-maps-script").addEventListener("load", resolve);
      document.getElementById("google-maps-script").addEventListener("error", () =>
        reject(new Error("Google Maps API betöltési hiba."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&libraries=drawing`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google Maps API betöltési hiba."));
    document.body.appendChild(script);
  });
};

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
  const gridLines = useRef([]);
  const [selectedData, setSelectedData] = useState(null);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);
  const newPolygon = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildings,floors, rooms] = await Promise.all([
          fetchGeoJSON(`${API_BASE_URL}/buildings`),
          fetchGeoJSON(`${API_BASE_URL}/floors`),
          fetchGeoJSON(`${API_BASE_URL}/rooms`),
        ]);

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
          styles: [{
            featureType: "all",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }],
        });

        // Drawing Manager inicializálása
        drawingManager.current = new window.google.maps.drawing.DrawingManager({
          drawingMode: null, // Alapértelmezett: nincs rajzolás
          drawingControl: true,
          drawingControlOptions: {
            position: window.google.maps.ControlPosition.TOP_LEFT,
            drawingModes: [
              window.google.maps.drawing.OverlayType.POLYGON,
              //window.google.maps.drawing.OverlayType.MARKER,
            ], // Csak poligon engedélyezett
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

            polygon.setMap(map.current);
            
            window.google.maps.event.addListener(drawingManager.current, "overlaycomplete", (event) => {
              console.log("✅ Alakzat létrehozva!");
            
              newPolygon.current = event.overlay;
              newPolygon.current.setEditable(true); // Az alakzat szerkeszthető lesz
            
              drawingManager.current.setDrawingMode(null); // Automatikusan kikapcsolja a rajzolási módot
            
              setSelectedData({
                id: Date.now(),
                category: "",
                coordinates: newPolygon.current.getPath().getArray().map(latLng => [latLng.lng(), latLng.lat()]),
              });
            
              console.log("🔴 Rajzolás mód KI: visszaállt a kézi mozgatás.");
            });
            
            //Kattintáskor az adott objektumot kiválasztjuk
            polygon.addListener("click", () => {

              activeEdges.forEach(edge => edge.setMap(null));
              activeEdges = [];


              const { id, category, name, shortName, group, number, height } = feature.properties;
              
              let selectedObject = { id, category, polygon};
              
              if (category === "building") {
                selectedObject = {
                  ...selectedObject,
                  name: name || "",
                  shortName: shortName || "",
                  group: group || "",
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
              
              console.log("📍 Kiválasztott objektum:", selectedFeature.current);

              let firstEdge = new window.google.maps.Polyline({
                path: [coordinates[0], coordinates[1]], // Az első szakasz
                strokeColor: "red",
                strokeWeight: 4,
                map: map.current,
              });
          
              let lastEdge = new window.google.maps.Polyline({
                path: [coordinates[coordinates.length - 2], coordinates[coordinates.length - 1]], // Az utolsó szakasz
                strokeColor: "red",
                strokeWeight: 4,
                map: map.current,
              });
              
              activeEdges.push(firstEdge, lastEdge);

              //Kiemelő vonalak frissítése szerkesztés közben
              const updateHighlightEdges = () => {
                const path = polygon.getPath();
                if (path.getLength() > 1) {
                  firstEdge.setPath([path.getAt(0), path.getAt(1)]); // Első él frissítése
                  lastEdge.setPath([path.getAt(path.getLength() - 2), path.getAt(path.getLength() - 1)]); // Utolsó él frissítése
                }
              };
          
              // Ha szerkesztik a poligont, frissítjük a kiemelést
              polygon.getPath().addListener("set_at", updateHighlightEdges); // Ha meglévő pontot módosítanak
              polygon.getPath().addListener("insert_at", updateHighlightEdges); // Ha új pontot adnak hozzá
              polygon.addListener("dragend", updateHighlightEdges); // Ha az egész poligont mozgatják
          
              // Azonnali kiemelés
              updateHighlightEdges();
            });
          });
        };

        addGeoJSONToMap(buildings, "blue", "building");
        addGeoJSONToMap(floors, "green", "floor");
        addGeoJSONToMap(rooms, "red", "room");

        const drawGrid = () => {
          if (!map.current) return;

          // Korábbi vonalak törlése
          gridLines.current.forEach((line) => line.setMap(null));
          gridLines.current = [];

          const bounds = map.current.getBounds();
          if (!bounds) return;

          const gridSizeLatLng = 0.0003; // Kb. 50 méteres rács

          const northEast = bounds.getNorthEast();
          const southWest = bounds.getSouthWest();

          const startLat = Math.floor(southWest.lat() / gridSizeLatLng) * gridSizeLatLng;
          const startLng = Math.floor(southWest.lng() / gridSizeLatLng) * gridSizeLatLng;
          const endLat = northEast.lat();
          const endLng = northEast.lng();

          // Függőleges vonalak
          for (let lng = startLng; lng < endLng; lng += gridSizeLatLng) {
            gridLines.current.push(
              new window.google.maps.Polyline({
                path: [
                  { lat: startLat, lng },
                  { lat: endLat, lng },
                ],
                strokeColor: "#000000",
                strokeOpacity: 0.1,
                strokeWeight: 0.5,
                map: map.current,
              })
            );
          }

          // Vízszintes vonalak
          for (let lat = startLat; lat < endLat; lat += gridSizeLatLng) {
            gridLines.current.push(
              new window.google.maps.Polyline({
                path: [
                  { lat, lng: startLng },
                  { lat, lng: endLng },
                ],
                strokeColor: "#000000",
                strokeOpacity: 0.3,
                strokeWeight: 1,
                map: map.current,
              })
            );
          }
        };

        drawGrid();
        map.current.addListener("idle", drawGrid);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    initMap();
  }, [mapRefreshTrigger]);

  const simplifyPolygon = (points, tolerance = 0.0001, minDistance = 0.000001) => {
    if (points.length < 3) return points; // 📌 Mindig legalább 3 pont kell egy poligonhoz
  
    const sqTolerance = tolerance * tolerance;
    const sqMinDistance = minDistance * minDistance;
  
    // Euklideszi távolság négyzetes formában
    const getSqDist = (p1, p2) => {
      const dx = p1[0] - p2[0]; // lng
      const dy = p1[1] - p2[1]; // lat
      return dx * dx + dy * dy;
    };

    // 🔍 Túl közeli pontok eltávolítása
  const removeClosePoints = (points) => {
    return points.filter((point, index, arr) => {
      if (index === 0) return true; // Az első pontot mindig megtartjuk
      return getSqDist(point, arr[index - 1]) > sqMinDistance; // Csak akkor tartjuk meg, ha távolabb van az előzőtől
    });
  };
  
    // Legtávolabbi pont keresése
    const findFurthest = (points, first, last) => {
      let maxDist = 0;
      let index = -1;
      for (let i = first + 1; i < last; i++) {
        const dist = getSqDist(points[i], points[first]);
        if (dist > maxDist) {
          maxDist = dist;
          index = i;
        }
      }
      return index;
    };
  
    const simplify = (points, first, last) => {
      if (last - first < 2) return [points[first]]; // 📌 Minimum 3 pont kell
  
      let index = findFurthest(points, first, last);
      if (index !== -1 && getSqDist(points[index], points[first]) > sqTolerance) {
        return [...simplify(points, first, index), points[index], ...simplify(points, index, last)];
      }
      return [points[first]];
    };
    
    let filteredPoints = removeClosePoints(points);
    let simplified = [...simplify(filteredPoints, 0, filteredPoints.length - 1), filteredPoints[filteredPoints.length - 1]];
    //Ha a poligon túl egyszerűsödött, visszaállítjuk az eredetit
    if (simplified.length < 3) {
      console.warn("❗ Poligon túl egyszerűsítve, visszaállítás eredeti pontra");
      return points;
    }
  
    return simplified;
  };

  const handleSave = async () => {
    if (!selectedData || !newPolygon.current) return;
  
    const coordinates = newPolygon.current
      .getPath()
      .getArray()
      .map((latLng) => [latLng.lng(), latLng.lat()]);
  
    if (!selectedData.category) {
      alert("Válassz kategóriát!");
      return;
    }
  
    const payload = {
      id: selectedData.id,
      category: selectedData.category,
      coordinates,
      name: selectedData.name || "",
      shortName: selectedData.shortName || "",
      floorId: selectedData.floorId || null,
      buildingId: selectedData.buildingId || null,
    };
  
    try {
      const response = await fetch(`${API_BASE_URL}/saveObject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) throw new Error("Hiba a mentés során");
  
      alert("✅ Mentés sikeres!");
      setSelectedData(null);
    } catch (error) {
      alert("❌ Mentési hiba");
    }
  };  

  //Kijelölt objektum mentése az API-ba
  async function saveUpdatedFeature() {
    if (!selectedFeature.current) {
      console.warn("❌ Nincs kiválasztott objektum!");
      return;
    }

    if (!selectedFeature.current.polygon) {
      console.warn("❌ A kiválasztott objektumnak nincs polygon referenciája!");
      return;
    }
  
    let coordinates = selectedFeature.current.polygon
      .getPath()
      .getArray()
      .map((latLng) => [latLng.lng(), latLng.lat()]);
  
    const simplifiedCoordinates = simplifyPolygon(coordinates, 0.0001);

    // Ha az első és utolsó koordináta nem azonos, zárjuk le a poligont
    if (
    simplifiedCoordinates.length > 1 &&
    (simplifiedCoordinates[0][0] !== simplifiedCoordinates[simplifiedCoordinates.length - 1][0] ||
      simplifiedCoordinates[0][1] !== simplifiedCoordinates[simplifiedCoordinates.length - 1][1])
  ) {
    console.log("🔄 Poligon lezárása...");
    simplifiedCoordinates.push([...simplifiedCoordinates[0]]);
  }

  // Az infoboxból frissített adatok átvétele
  const updatedProperties = { ...selectedFeature.current, ...selectedData };
  
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
            number: updatedProperties.number || 0,
            height: updatedProperties.height || 0,
            type: updatedProperties.type || "",
          },
        },
      ],
    };
  
    //console.log("Mentésre kerül:", JSON.stringify(updatedFeature, null, 2));
  
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
  
      alert(`✅ Mentés sikeres!\nTípus: ${updatedProperties.category}\nID: ${updatedProperties.id}`);

      setSelectedData(null);
      
      // Frissítsük az állapotot, hogy tükrözze a módosításokat
      selectedFeature.current = updatedProperties;
      setSelectedData(null);
      setMapRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("🚨 Hiba a mentés során:", error);
      alert("❌ Nem sikerült a mentés.");
    }
  }

  return (
    <div className="admin-map-container">
      {loading && <p>Betöltés...</p>}
      {error && <p>Hiba történt: {error}</p>}
      {selectedData && (
        <div className="info-box">
          <label>Kategória:</label>
            <select onChange={(e) => setSelectedData({ ...selectedData, category: e.target.value })}>
              <option value="">Válassz</option>
              <option value="building">Épület</option>
              <option value="floor">Emelet</option>
              <option value="room">Terem</option>
            </select>
            {selectedData.category === "building" && (
              <div className="info-fields">
                <label>Név:</label>
                <input type="text" value={selectedData.name} onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })} />
                <label>Rövid név:</label>
                <input type="text" value={selectedData.shortName || ""} onChange={(e) => setSelectedData({ ...selectedData, shortName: e.target.value })} />
                <label>Csoport:</label>
                <input type="text" value={selectedData.group || ""} onChange={(e) => setSelectedData({ ...selectedData, group: e.target.value })} />
              </div>
            )}
            {selectedData.category === "floor" && (
              <div className="info-fields">
                <label>Emelet száma:</label>
                <input type="number" value={selectedData.number} onChange={(e) => setSelectedData({ ...selectedData, number: parseInt(e.target.value) })} />
                <label>Magasság:</label>
                <input type="number" step="0.1" value={selectedData.height} onChange={(e) => setSelectedData({ ...selectedData, height: parseFloat(e.target.value) })} />
              </div>
            )}
            {selectedData.category === "room" && (
              <div className="info-fields">
                <label>Név:</label>
                <input type="text" value={selectedData.name} onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })} />
                <label>Típus:</label>
                <input type="text" value={selectedData.type} onChange={(e) => setSelectedData({ ...selectedData, type: e.target.value })} />
              </div>
            )}
            <div className="info-box-buttons">
              <button className="info-box-save" onClick={selectedData.id ? saveUpdatedFeature : handleSave} disabled={!selectedData.category}>Mentés</button>
              <button className="info-box-btn" onClick={() => setSelectedData(null)}>Bezárás</button>
            </div>
          </div>
        )}
      <button className="save-button" onClick={saveUpdatedFeature}>Kijelölt objektum mentése</button>
      <div ref={mapContainer} className="map-container"/>
    </div>
  );
};

export default AdminMap;
