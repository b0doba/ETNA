import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchPanel from "./SearchPanel.js";
import loadGoogleMapsScript from "./loadGoogleMap";
import NavigationComponent from "./NavigationComponent";

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
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isBuildingView, setIsBuildingView] = useState(false);
  const [currentFloor, setCurrentFloor] = useState(null);
  const buildingsRef = useRef(null);
  const allFloorsRef = useRef(null);
  const [highlightedRoom, setHighlightedRoom] = useState(null);
  const [floorGroup, setFloorGroup] = useState(null); // gather mező
  const [availableFloorNumbers, setAvailableFloorNumbers] = useState([]);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [mapZoom, setMapZoom] = useState(18);
  const [mapCenter, setMapCenter] = useState({ lat: 47.693344, lng: 17.627529 });
  const [hudHidden, setHudHidden] = useState(false);
  const toggleHUD = () => setHudHidden(prev => !prev);
  const [clearRoute, setClearRoute] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const handleGroupSelect = (group) => {
    highlightBuilding(null, group); // A highlightBuilding-et hívjuk a kiválasztott csoportra
  };

  useEffect(() => {
    const initMap = async () => {
      try {
        await loadGoogleMapsScript();
        const [buildings,rooms, floors] = await Promise.all([
          fetchGeoJSON("http://localhost:5000/api/buildings"),
          fetchGeoJSON("http://localhost:5000/api/rooms"),
          fetchGeoJSON("http://localhost:5000/api/floors")
        ]);

        const nodesResponse = await fetch("http://localhost:5000/api/nodes");

        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps API nem érhető el.");
        }

        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        console.log("Térkép inicializálása...");

        const bounds = {
          north: mapCenter.lat + 0.2,
          south: mapCenter.lat - 0.2,
          east: mapCenter.lng + 0.5,
          west: mapCenter.lng - 0.5,
        };

        map.current = new window.google.maps.Map(mapContainer.current, {
          streetViewControl: false,
          mapTypeControl: false,
          zoom: mapZoom,
          center:  mapCenter,
          minZoom: 14,
          fullscreenControl: false,
          restriction: {
            latLngBounds: bounds,
            strictBounds: true,},
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "landscape",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        const addGeoJSONToMap = (geoJson) => {
          map.current.data.addGeoJson(geoJson);
        
          map.current.data.setStyle((feature) => {
            const category = feature.getProperty("category");
            const featureName = feature.getProperty("name");
            const buildingName = feature.getProperty("building");
            const floorNumber = feature.getProperty("number");
            const roomFloor = feature.getProperty("floor");
        
            // Kiemelt szoba
            if (highlightedRoom && category === "room" && featureName?.trim() === highlightedRoom.name.trim()) {
              return {
                fillColor: "red",
                strokeColor: "black",
                strokeWeight: 3,
                visible: roomFloor === currentFloor,
              };
            }
        
            // Belső nézet logika gather alapján (building -> gather)
            if (isBuildingView && (category === "floor" || category === "room")) {
              const relatedBuilding = buildings.features.find(
                (b) => b.properties.name.trim() === buildingName?.trim()
              );
              const buildingGather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
              const currentGather = floorGroup?.replace(/"/g, "").trim();
        
              if (buildingGather === currentGather) {
                if (category === "floor" && floorNumber === currentFloor) {
                  return {
                    fillColor: "lightgray",
                    strokeColor: "black",
                    strokeWeight: 1,
                    visible: true,
                  };
                }
        
                if (category === "room" && roomFloor === currentFloor) {
                  return {
                    fillColor: "gray",
                    strokeColor: "black",
                    strokeWeight: 1,
                    visible: true,
                  };
                }
        
                return { visible: false }; // Nem aktuális szint
              }
            }
        
            // Külső nézet: csak épületek
            if (!isBuildingView && category === "building") {
              return {
                fillColor: "gray",
                strokeColor: "black",
                strokeWeight: 1,
                visible: true,
              };
            }
        
            // Minden más rejtve
            return { visible: false };
          });
        };

        addGeoJSONToMap(buildings, "building");
        addGeoJSONToMap(floors, "floor");
        addGeoJSONToMap(rooms,"room");
        const nodesData = await nodesResponse.json();
        setNodes(nodesData);

        buildingsRef.current = buildings;
        allFloorsRef.current = floors;

        const infoWindow = new window.google.maps.InfoWindow();

        map.current.data.addListener("mouseover", (event) => {
          //const category = event.feature.getProperty("category") || "Ismeretlen";
          let displayText = event.feature.getProperty("name") || "Nincs név"; // Alapértelmezett

          const content = `
            <div class="custom-info-window">
              <div class="info-title">${displayText}</div>
            </div>
          `;

          infoWindow.setContent(content);
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map.current);
        });
        
        setTimeout(() => {
          document.querySelector(".gm-ui-hover-effect")?.remove();
        }, 100);

        map.current.data.addListener("mouseout", () => {
          infoWindow.close();
        });

        map.current.data.addListener("click", (event) => {
          const category = event.feature.getProperty("category");
        
          if (category === "building") {
            const buildingName = event.feature.getProperty("name");
            const gatherName = event.feature.getProperty("gather");

            //console.log("Rákattintott épület:", buildingName);

            if (!gatherName) {
              console.warn("Nincs 'gather' mező ehhez az épülethez:", buildingName);
              return;
            }
            setIsBuildingView(true);
            setSelectedBuilding(buildingName);
            setFloorGroup(gatherName);
        
            console.log("🏬 Összes floor.features (épületnévvel):", floors.features.map(f => ({
              floorNumber: f.properties.number,
              building: f.properties.building
            })));
            
            // Kiválasztott épület szintjeinek lekérése
            const floorsInGroup  = floors.features
              .filter((floor) => {
                const relatedBuilding = buildings.features.find(b => b.properties.name.trim() === floor.properties.building.trim());

                const cleanGather = (str) => str?.replace(/"/g, "").trim();

                const buildingGather = cleanGather(relatedBuilding?.properties?.gather);
                const match = buildingGather === cleanGather(gatherName);
                
                if (!match) {
                  console.log(`⛔ Kihagyott floor: épület = ${floor.properties.building}, nincs gather egyezés (${buildingGather} ≠ ${gatherName})`);
                }
                console.log("✅ Kiválasztott csoporthoz tartozó emeletek (gather alapján):");
                
                return match;

                
              })
              .sort((a, b) => a.properties.number - b.properties.number); // Szintek sorrendbe állítása

              console.log("Kiválasztott csoporthoz tartozó emeletek (gather alapján):");
              floorsInGroup.forEach(f => {
                const relatedBuilding = buildings.features.find(b => b.properties.name.trim() === f.properties.building.trim());
                const buildingGather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
                console.log(`🏢 épület: ${f.properties.building}, 🧱 szint: ${f.properties.number}, gather: ${buildingGather}`);
              });
            
            //console.log("Az összes szint az API válaszból:", floors.features);
            console.log("Kiválasztott csoporthoz tartozó emeletek:", floorsInGroup.map(f => ({
              floorNumber: f.properties.number,
              building: f.properties.building
            })));

            const uniqueFloorNumbers = [...new Set(floorsInGroup.map(f => f.properties.number))].sort((a, b) => a - b);
            console.log("Elérhető szintszámok a sliderhez:", uniqueFloorNumbers);
            setAvailableFloorNumbers(uniqueFloorNumbers);
            setCurrentFloor(uniqueFloorNumbers[0] ?? 0);

            const buildingFeature = buildings.features.find(
              (feature) => feature.properties.name === buildingName);

            console.log("Kiválasztott épület belülről: ",buildingFeature.geometry.coordinates);

            if (buildingFeature) {
              try {
                let coordinates = buildingFeature.geometry.coordinates;

                // Ellenőrizzük, hogy a koordináták megfelelő formátumban vannak-e
                if (buildingFeature.geometry.type === "Polygon") {
                    coordinates = coordinates[0]; // Az első poligon koordinátáit használjuk
                } else if (buildingFeature.geometry.type === "MultiPolygon") {
                    coordinates = coordinates[0][0]; // MultiPolygon esetén a legelső poligon első koordináta-listáját használjuk
                }

                if (!coordinates || coordinates.length === 0) {
                    throw new Error("Az épület koordinátái üresek vagy hibásak.");
                }

                const bounds = new window.google.maps.LatLngBounds();
                coordinates.forEach(([lng, lat]) => {
                    if (isFinite(lat) && isFinite(lng)) {
                        bounds.extend(new window.google.maps.LatLng(lat, lng));
                    }
                });

                const center = bounds.getCenter();
                if (center && isFinite(center.lat()) && isFinite(center.lng())) {
                  setMapCenter({ lat: center.lat(), lng: center.lng() });
                  setMapZoom(19);
                } else {
                    console.warn("Hibás középpont számítás:", center);
                }
            } catch (error) {
                console.error("Hiba az épület középpontjának meghatározásakor:", error);
            }
          }}
        });

        map.current.addListener("click", (event) => {
            setSelectedBuilding(null);
            setIsBuildingView(false);
            setCurrentFloor(null);
            setHighlightedRoom(null);
            setMapZoom(18);
            setFloorGroup(null);
        });

        nodesData.forEach((node) => {
          if (node.coordinates) {
            const [lng, lat] = JSON.parse(node.coordinates)[0];
        
            const iconDiv = document.createElement("div");
            iconDiv.style.position = "absolute";
            iconDiv.style.width = "24px";
            iconDiv.style.height = "24px";
            iconDiv.style.opacity = "0.4";
        
            const img = document.createElement("img");
            img.src = `/assets/icons/${node.iconUrl}`; 
            img.style.width = "12px";
            img.style.height = "12px";
            iconDiv.appendChild(img);
        
            const overlay = new window.google.maps.OverlayView();
            overlay.onAdd = function () {
              const panes = this.getPanes();
              panes.overlayImage.appendChild(iconDiv);
            };
            overlay.draw = function () {
              const projection = this.getProjection();
              const position = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(lat, lng));
              const zoom = map.current.getZoom();

              const baseSize = 7;
              const scale = 1 / Math.pow(2, zoom - 18);
              let size = baseSize / scale;

              // Limitáljuk a méretet 6 és 14 pixel közé
              size = Math.max(6, Math.min(size, 14));

              iconDiv.style.left = position.x - size / 2 + "px";
              iconDiv.style.top = position.y - size / 2 + "px";
              img.style.width = size + "px";
              img.style.height = size + "px";
            };
            overlay.onRemove = function () {
              if (iconDiv.parentNode) {
                iconDiv.parentNode.removeChild(iconDiv);
              }
            };
        
            overlay.setMap(map.current);
          }
        });

        console.log("Térkép sikeresen inicializálva!");
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };
    
    initMap();

    if (window.location.pathname === "/") {
      navigate("/map", { replace: true });
    }

  }, [navigate, isBuildingView, currentFloor, selectedBuilding, highlightedRoom, mapZoom, mapCenter, floorGroup]);

  const handleSearch = async (query) => {
    if (!query.trim()) return;
  
    try {
      const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
      const data = await response.json();
  
      console.log("Keresési eredmények:", data);
  
      if (data.buildings.length > 0) {
        setIsBuildingView(false); // Külső nézetre váltás
        setHighlightedRoom(null);

        setTimeout(() => {
          highlightBuilding(data.buildings[0]);
        }, 200); // Kiemelés kis késleltetéssel

      } else if (data.rooms.length > 0) {
        const room = data.rooms[0];
            setIsBuildingView(true);
            highlightRoom(room);
      } else {
        alert("Nincs találat!");
      }
    } catch (error) {
      console.error("Hiba a keresés során:", error);
    }
  };
  
  const highlightBuilding = (building = null, group = null) => {
    if (!map.current) return;

    if (building) {
        // Ha konkrét épületet keresünk, fókuszáljunk arra
        const coordinates = JSON.parse(building.coordinates);
        const bounds = new window.google.maps.LatLngBounds();
        coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
        map.current.fitBounds(bounds,120);
    }
    else if (group)
    {
      let latSum = 0, lngSum = 0, count = 0;
        const bounds = new window.google.maps.LatLngBounds();

        map.current.data.forEach((feature) => {
            const featureCategory = feature.getProperty("category");
            const featureGroup = feature.getProperty("group");

            if (featureCategory === "building" && featureGroup === group) {
                const geometry = feature.getGeometry(); // A teljes geometria lekérése
                if (geometry && geometry.getType() === "Polygon") {
                    const firstPath = geometry.getAt(0); // Az első alakzat lekérése
                    if (firstPath && firstPath.getAt) {
                        const firstCoordinate = firstPath.getAt(0); // Az első koordináta lekérése
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
            const center = { lat: latSum / count, lng: lngSum / count }; // Átlagolás
            map.current.panTo(center); // Simán odarepül
            map.current.fitBounds(bounds, 280); // Minden épület beleférjen a nézetbe
        }
    }

    map.current.data.setStyle((feature) => {
        const featureCategory = feature.getProperty("category"); // "building", "floor", "room"
        const featureGroup = feature.getProperty("group"); // Kollégiumok, Sportcsarnokok, stb.
        const featureName = feature.getProperty("name");

        if (featureCategory === "building") {
            if (group) {
                // Ha egy kategóriát választunk, emeljük ki az összes ebbe tartozó épületet
                return {
                    fillColor: featureGroup === group ? "red" : "gray",
                    strokeColor: "black",
                    strokeWeight: featureGroup === group ? 2 : 1,
                    visible: true,
                };
            } else if (building) {
                // Ha egy adott épületet keresünk, csak azt emeljük ki
                return {
                    fillColor: featureName === building.name ? "red" : "gray",
                    strokeColor: "black",
                    strokeWeight: featureName === building.name ? 2 : 1,
                    visible: true,
                };
            }
        }
        return { visible: false }; // Csak az épületek látszódjanak
    });
};
  
const highlightRoom = async (room) => {
  if (!map.current || !room) return;

  const buildingName = room.floor.building.name;
  const buildingGather = buildingsRef.current?.features?.find(
    b => b.properties.name.trim() === buildingName.trim()
  )?.properties?.gather?.replace(/"/g, "").trim();

  if (!buildingGather) {
    console.warn("Nincs 'gather' mező a szoba épületéhez:", buildingName);
    return;
  }

  // 🔥 Állítsuk be a belső nézetet és a kapcsolódó adatokat
  setIsBuildingView(true);
  setSelectedBuilding(buildingName);
  setFloorGroup(buildingGather);
  setCurrentFloor(room.floor.number);
  setHighlightedRoom(room);
  setMapZoom(19);

  // 🔥 Visszakeressük az összes emeletet, ami a gather csoporthoz tartozik
  const floorsInGroup = allFloorsRef.current?.features
    ?.filter(floor => {
      const relatedBuilding = buildingsRef.current?.features?.find(b => b.properties.name.trim() === floor.properties.building.trim());
      const gather = relatedBuilding?.properties?.gather?.replace(/"/g, "").trim();
      return gather === buildingGather;
    })
    ?.sort((a, b) => a.properties.number - b.properties.number);

  const uniqueFloors = [...new Set(floorsInGroup?.map(f => f.properties.number))];
  setAvailableFloorNumbers(uniqueFloors);

  // 🔍 Középpont beállítása
  const coordinates = JSON.parse(room.coordinates);
  const bounds = new window.google.maps.LatLngBounds();
  coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
  setTimeout(() => {
    map.current.fitBounds(bounds, 100);
  }, 300);
};

  const handleRouteSearch = async (startName, endName) => { //működik
    try {
      const [startRes, endRes] = await Promise.all([
        fetch(`http://localhost:5000/api/search?q=${startName}`),
        fetch(`http://localhost:5000/api/search?q=${endName}`)
      ]);
  
      const dataStart = await startRes.json();
      const dataEnd = await endRes.json();

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
  
      // Állítsuk be a NavigationComponent-hez szükséges értékeket
      setStartLocation({ id: startNode.id, coordinates: startNode.coordinates });
      setEndLocation({ id: endNode.id, coordinates: endNode.coordinates });
      setClearRoute(false);
  
    } catch (err) {
      console.error("Hiba az útvonalhoz szükséges node-ok lekérésénél:", err);
      alert("Nem sikerült betölteni az útvonalat.");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <button className="toggle-hud-btn" onClick={toggleHUD}>
    {hudHidden ? '▶' : '◀'}
    </button> 
      <SearchPanel
        hudHidden={hudHidden}
        onSearch={handleSearch}
        highlightBuilding={highlightBuilding} 
        highlightRoom={highlightRoom}
        onRouteSearch={handleRouteSearch}
        onGroupSelect={handleGroupSelect}
        onCancelRoute={() => {
          setStartLocation(null);
          setEndLocation(null);
          setClearRoute(true);
        }}
      />
      <NavigationComponent start={startLocation} end={endLocation} map={map.current} clear={clearRoute} />
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "red" }}>Hiba történt: {error}</p>}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      
      {isBuildingView && availableFloorNumbers.length > 0 && (
        <div className="slider-container">
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
    </div>
  );
};

export default MapComponent;
