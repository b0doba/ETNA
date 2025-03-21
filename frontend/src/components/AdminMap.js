import React, { useRef, useEffect, useState } from "react";
import loadGoogleMapsScript from "./loadGoogleMap";
import "../AdminLook.css";
import ObjectFilter from "./ObjectFilter";
import DeleteItem from "./DeleteItem";

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
  const gridLines = useRef([]);
  const [selectedData, setSelectedData] = useState(null);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);
  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  //const [rooms, setRooms] = useState([]);
  const newPolygon = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshMap = () => {
    console.log("🔄 Térkép frissítése...");
    setMapRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildings,floors, rooms] = await Promise.all([
          fetchGeoJSON(`${API_BASE_URL}/buildings`),
          fetchGeoJSON(`${API_BASE_URL}/floors`),
          fetchGeoJSON(`${API_BASE_URL}/rooms`),
        ]);

        setBuildings(buildings.features.map(feature => ({
          id: feature.properties.id,
          name: feature.properties.name,
          group: feature.properties.group,
        })));
        
        setFloors(floors.features.map(feature => ({
          id: feature.properties.id,
          number: feature.properties.number,
          building: feature.properties.building,
          buildingId: feature.properties.buildingId
        })));
        
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
              //window.google.maps.drawing.OverlayType.RECTANGLE, //- téglalap
              //window.google.maps.drawing.OverlayType.MARKER,
              //window.google.maps.drawing.OverlayType.POLYLINE,
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

            polygon.setMap(map.current);

            window.google.maps.event.addListener(drawingManager.current, "overlaycomplete", (event) => {
              console.log("✅ Alakzat létrehozva!");
            
              newPolygon.current = event.overlay;
              newPolygon.current.setEditable(true); // Az alakzat szerkeszthető lesz
            
              drawingManager.current.setDrawingMode(null); // Automatikusan kikapcsolja a rajzolási módot
            
              // 🔥 Koordináták lekérése a poligonból
              const coordinates = newPolygon.current.getPath().getArray().map(latLng => [latLng.lng(), latLng.lat()]);

              const firstPoint = coordinates[0];
              const lastPoint = coordinates[coordinates.length - 1];

              if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
                coordinates.push([...firstPoint]); // Ha nem azonos, hozzáadjuk az elsőt a végére
                console.log("Poligon lezárva az első és utolsó pont összeillesztésével.");
              }
            
              console.log("📍 Új alakzat koordinátái:", coordinates);
              
              if (!coordinates || coordinates.length === 0) {
                alert("Hiba: Az alakzatnak kell koordinátákkal rendelkeznie!");
                return;
              }

              // Beállítjuk az adatokat, most már a koordinátákkal együtt!
              setSelectedData({
                coordinates: coordinates, // A megfelelő koordináták átadása
              });
            });
            
            //Kattintáskor az adott objektumot kiválasztjuk
            polygon.addListener("click", () => {

              activeEdges.forEach(edge => edge.setMap(null));
              activeEdges = [];

              const { id, category, name, shortName, group, number, height, type } = feature.properties;
              
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

  const simplifyPolygon = (points, minDistance = 0.000001) => {
    if (points.length < 3) return points; // Ha túl kevés pont van, nem módosítunk

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
        if (points.length < 3) return points;

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

  const handleSave = async () => {
    if (!selectedData || !selectedData.category) {
      alert("Válassz kategóriát és adj meg minden szükséges adatot!");
      return;
    }
  
    let apiUrl = "";
    let payload = {};

    if (!selectedData.coordinates || selectedData.coordinates.length === 0) {
      alert("Az épületnek kell koordinátákkal rendelkeznie!");
      return;
    }
  
    if (selectedData.category === "building") {
      apiUrl = `${API_BASE_URL}/createBuildings`;
      payload = {
        name: selectedData.name || "",
        shortName: selectedData.shortName || null,
        group: selectedData.group || null,
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
    }
  
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) throw new Error("Hiba a mentés során");
  
      const data = await response.json();
      console.log("✅ Sikeres válasz az API-tól:", data);
      alert("✅ Mentés sikeres!");
      setSelectedData(null);
      refreshMap();
    } catch (error) {
      console.error("🚨 Hiba a mentés során:", error);
      alert("❌ Nem sikerült menteni az adatokat.");
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
          {!selectedData.id && (
            <div className="info-fields">
            <label>Kategória:</label>
              <select onChange={(e) => setSelectedData({ ...selectedData, category: e.target.value })}>
                <option value="">Válassz</option>
                <option value="building">Épület</option>
                <option value="floor">Emelet</option>
                <option value="room">Terem</option>
              </select>
            </div>
          )}
          {selectedData.category === "building" && (
            <div className="info-fields">
              {selectedData.id && selectedData.category === "building" && (
                <>
                  <label>Név:</label>
                  <input type="text" value={selectedData.name || ""} onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })} />
                  <label>Rövid név:</label>
                  <input type="text" value={selectedData.shortName || ""} onChange={(e) => setSelectedData({ ...selectedData, shortName: e.target.value })} />
                  <label>Csoport:</label>
                  <input type="text" value={selectedData.group || ""} onChange={(e) => setSelectedData({ ...selectedData, group: e.target.value })} />
                </>
              )}
              {!selectedData.id && selectedData.category === "building" && (
                 <>
                  <label>Név:</label>
                  <input type="text" value={selectedData.name || ""} onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })} />
                  <label>Rövid név:</label>
                  <input type="text" value={selectedData.shortName || ""} onChange={(e) => setSelectedData({ ...selectedData, shortName: e.target.value })} />
                  <label>Csoport:</label>
                  <input type="text" value={selectedData.group || ""} onChange={(e) => setSelectedData({ ...selectedData, group: e.target.value })} />
                  <label>Szintek száma:</label>
                  {<input
                    type="number"
                    value={selectedData.numberOfFloors || ""}
                    onChange={(e) =>
                      setSelectedData({ ...selectedData, numberOfFloors: e.target.value !== "" ? parseInt(e.target.value, 10) : null })
                    }
                  />}
                 </>
                )}
            </div>
            )}
            {selectedData.category === "floor" && (
              <div className="info-fields">
                {!selectedData.id && (
                  <>
                    <label>Épület:</label>
                    <select
                    onChange={(e) => setSelectedData({ ...selectedData, buildingId: parseInt(e.target.value,10) })}
                    >
                      <option value="">Válassz épületet</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>{building.name}</option>
                      ))}
                    </select>
                    <label>Emelet száma:</label>
                    <input type="number" value={selectedData.number || ""} onChange={(e) => setSelectedData({ ...selectedData, number: e.target.value !== "" ? parseInt(e.target.value, 10) : null  })} />
                    <label>Magasság:</label>
                    <input type="number" step="0.1" value={selectedData.height || ""} onChange={(e) => setSelectedData({ ...selectedData, height: e.target.value !== "" ? parseInt(e.target.value, 10) : null  })} />
                  </>
                )}
                  {selectedData.id && selectedData.category === "floor" && (
                    <>
                      <label>Emelet száma:</label>
                      <input type="number" value={selectedData.number || ""} onChange={(e) => setSelectedData({ ...selectedData, number: e.target.value !== "" ? parseInt(e.target.value, 10) : null  })} />
                      <label>Magasság:</label>
                      <input type="number" step="0.1" value={selectedData.height || ""} onChange={(e) => setSelectedData({ ...selectedData, height: e.target.value !== "" ? parseInt(e.target.value, 10) : null  })} />
                    </>
                  )}
              </div>
            )}
            {selectedData.category === "room" && (
              <div className="info-fields">
                {!selectedData.id && (
                <>
                <label>Épület:</label>
                <select
                  onChange={(e) => {
                    const selectedBuildingId = parseInt(e.target.value, 10);
                    const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
                    setSelectedData({
                      ...selectedData,
                      buildingId: selectedBuildingId,
                      buildingName: selectedBuilding ? selectedBuilding.name : "",
                    });
                  }}>
                    <option value="">Válassz épületet</option>
                    {buildings.map((building) => (
                      <option key={building.id} value={building.id}>{building.name}</option>
                    ))}
                  </select>
                  <label>Emelet:</label>
                  <select
                  onChange={(e) => setSelectedData({ ...selectedData, floorId: parseInt(e.target.value, 10) || null})}
                  disabled={!selectedData.buildingId}>
                  <option value="">Válassz emeletet</option>
                  {floors
                    .filter(floor => floor.buildingId === selectedData.buildingId)
                    .map((floor) => (
                      <option key={floor.id} value={floor.id}>{floor.number}. emelet</option>
                    ))}
                </select>
                  <label>Név:</label>
                  <input type="text" value={selectedData.name || ""} onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })} />
                  <label>Típus:</label>
                  <input type="text" value={selectedData.type || ""} onChange={(e) => setSelectedData({ ...selectedData, type: e.target.value })} />
                </>
              )}
              {selectedData.id && selectedData.category === "room" && (
                <>
                  <label>Név:</label>
                  <input type="text" value={selectedData.name || ""} onChange={(e) => setSelectedData({ ...selectedData, name: e.target.value })} />
                  <label>Típus:</label>
                  <input type="text" value={selectedData.type || ""} onChange={(e) => setSelectedData({ ...selectedData, type: e.target.value })} />
                </>
              )}
            </div>
            )}
            <div className="info-box-buttons">
              <button className="info-box-save" onClick={selectedData.id ? saveUpdatedFeature : handleSave} disabled={!selectedData.category}>Mentés</button>
              <button className="info-box-btn" onClick={() => setSelectedData(null)}>Bezárás</button>
            </div>
          </div>
        )}
      <ObjectFilter buildings={buildings} floors={floors} />
      <DeleteItem refreshMap={refreshMap} />
      <div ref={mapContainer} className="admin-map-container"/>
    </div>
  );
};

export default AdminMap;
