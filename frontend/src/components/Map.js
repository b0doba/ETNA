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
  const [buildingFloors, setBuildingFloors] = useState([]);
  const [highlightedRoom, setHighlightedRoom] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [mapZoom, setMapZoom] = useState(18);
  const [mapCenter, setMapCenter] = useState({ lat: 47.693344, lng: 17.627529 });
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

        if (!window.google || !window.google.maps) {
          throw new Error("Google Maps API nem érhető el.");
        }

        if (!mapContainer.current) {
          throw new Error("A térkép konténer nem található.");
        }

        console.log("Térkép inicializálása...");

        map.current = new window.google.maps.Map(mapContainer.current, {
         
          streetViewControl: false,
          mapTypeControl: false,
          zoom: mapZoom,
          center:  mapCenter,
          fullscreenControl: false,
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

        const addGeoJSONToMap = (geoJson, type) => {
          map.current.data.addGeoJson(geoJson);
        
          map.current.data.setStyle((feature) => {
            const category = feature.getProperty("category"); // Ellenőrizzük a "category" mezőt
            const buildingName = feature.getProperty("building");
            const floorNumber = feature.getProperty("number");
            const featureName = feature.getProperty("name");
            const roomFloor = feature.getProperty("floor");
            let fillColor = "gray"; // Alapértelmezett szín
        
            if (category === "floor") fillColor = "lightgray";

            if (highlightedRoom && category === "room" && featureName?.trim() === highlightedRoom.name.trim()) {
              return { fillColor: "red", strokeColor: "black", strokeWeight: 3, visible: roomFloor === currentFloor };
          }
  
          // Az adott szint világosszürke legyen
          if (category === "floor" && buildingName === selectedBuilding && floorNumber === currentFloor) {
              return { fillColor: "lightgray", strokeColor: "black", strokeWeight: 1, visible: true };
          }
  
          // Az adott szinten lévő összes szoba szürke maradjon
          if (category === "room" && buildingName === selectedBuilding && roomFloor === currentFloor) {
              return { fillColor: "gray", strokeColor: "black", strokeWeight: 1, visible: true };
          }

            return {
              fillColor: fillColor,
              strokeColor: "black",
              strokeWeight: 1,
              visible: isBuildingView
              ? (category === "floor" && buildingName === selectedBuilding && floorNumber === currentFloor) ||
                (category === "room" && buildingName === selectedBuilding && feature.getProperty("floor") === currentFloor)
              : category === "building",
            };
          });
        };

        addGeoJSONToMap(buildings, "building");
        addGeoJSONToMap(rooms,"room");
        addGeoJSONToMap(floors, "floor");

        const infoWindow = new window.google.maps.InfoWindow();

        map.current.data.addListener("mouseover", (event) => {
          //const category = event.feature.getProperty("category") || "Ismeretlen";
          let displayText = event.feature.getProperty("name") || "Nincs név"; // Alapértelmezett

          // Ha az objektum egy "floor", akkor a "number" értéket használjuk
          /*if (category === "floor") {
            displayText = `Emelet: ${event.feature.getProperty("number")}`;
          }*/

          const content = `
            <div class="custom-info-window">
              <div class="info-title">${displayText}</div>
            </div>
          `;

          infoWindow.setContent(content);
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map.current);
        });

        // Az X gomb eltüntetése (kis késleltetéssel, hogy biztos működjön)
        
        setTimeout(() => {
          document.querySelector(".gm-ui-hover-effect")?.remove();
        }, 100);

        map.current.data.addListener("mouseout", () => {
          infoWindow.close();
        });

        // Building nézet és kilépés
        
        map.current.data.addListener("click", (event) => {
          const category = event.feature.getProperty("category");
        
          if (category === "building") {
            const buildingName = event.feature.getProperty("name");
            setSelectedBuilding(buildingName);
            setIsBuildingView(true);
            
            // Kiválasztott épület szintjeinek lekérése
            const floorsInBuilding = floors.features
              .filter((floor) => floor.properties.building === buildingName)
              .sort((a, b) => a.properties.number - b.properties.number); // Szintek sorrendbe állítása
            
            console.log("Az összes szint az API válaszból:", floors.features);


            setBuildingFloors(floorsInBuilding);
            setCurrentFloor(0); // Alapértelmezett szint mindig 0

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
                  setMapCenter(center);
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
          const feature = map.current.data.getFeatureById(event.featureId);

          if (!feature || feature.getProperty("category") !== "building") {
            setSelectedBuilding(null);
            setIsBuildingView(false);
            setCurrentFloor(null);
            setHighlightedRoom(null);
            setMapZoom(18);
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

  }, [navigate, isBuildingView, currentFloor, selectedBuilding, highlightedRoom, mapZoom, mapCenter]);


  const fetchBuildingFloors = async (buildingName) => {
    try {
        const response = await fetch(`http://localhost:5000/api/floors?building=${buildingName}`); //itt van a hiba
        const data = await response.json();

        // 🔥 Átalakítjuk a GeoJSON features tömböt egyszerűbb objektum tömbbé
        const floors = data.features.map((feature) => ({
            id: feature.properties.id,
            number: feature.properties.number,
            height: feature.properties.height,
            building: feature.properties.building,
            coordinates: JSON.stringify(feature.geometry.coordinates), // Eltároljuk a koordinátákat is!
        }));

        return floors; // Visszaadjuk a megfelelő struktúrát
    } catch (error) {
        console.error("Hiba a szintek betöltésekor:", error);
        return [];
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
            const center = { lat: latSum / count, lng: lngSum / count }; // 🔥 Átlagolás
            map.current.panTo(center); // 🔥 Simán odarepül
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
  
  const highlightRoom = async(room) => {
    if (!map.current) return;

    
    const buildingName = room.floor.building.name; 
    //console.log("Épület neve:", buildingName);
    
    const floors = await fetchBuildingFloors(buildingName);
    console.log(floors)

    setIsBuildingView(true);
    setSelectedBuilding(room.floor.building.name); 
    setBuildingFloors(floors);
    setCurrentFloor(room.floor.number);
    setHighlightedRoom(room);

    if(room){
    // **Terem középpontjának kiszámítása**
    const coordinates = JSON.parse(room.coordinates);
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend(new window.google.maps.LatLng(lat, lng)));
      setTimeout(() => {
        map.current.fitBounds(bounds,100);
      }, 400);
    }
  
    map.current.data.setStyle((feature) => {
      const category = feature.getProperty("category");
      const featureName = feature.getProperty("name");
      const buildingName = feature.getProperty("building");
      const floorNumber = feature.getProperty("number");
      const roomFloor = feature.getProperty("floor");
  
      // A keresett szoba kiemelése pirossal
      if (category === "room" && featureName?.trim() === room.name.trim()) {
        return { fillColor: "red", strokeColor: "black", strokeWeight: 3, visible: true };
      }

      // Az adott szint világosszürke
      if (category === "floor" && buildingName === room.floor.building.name && floorNumber === room.floor.number) {
        return { fillColor: "lightgray", strokeColor: "black", strokeWeight: 1, visible: true };
      }

      // Az adott szinten lévő összes szoba látható marad szürkében
      if (category === "room" && buildingName === room.floor.building.name && roomFloor === room.floor.number) {
        return { fillColor: "gray", strokeColor: "black", strokeWeight: 1, visible: true };
      }

      return { visible: false };
    });
  };

  const handleNavigate = (from, to) => {
    setStartLocation(from);
    setEndLocation(to);
  };

  const handleRouteSearch = async (start, destination) => {
    if (!start || !destination) {
      alert("Mindkét helyet meg kell adnod az útvonaltervezéshez!");
      return;
    }
  
    try {
      // Keresés a kezdő- és végpont szobához
      const responseStart = await fetch(`http://localhost:5000/api/search?q=${start}`);
      const responseEnd = await fetch(`http://localhost:5000/api/search?q=${destination}`);
  
      const dataStart = await responseStart.json();
      const dataEnd = await responseEnd.json();
  
      if (dataStart.rooms.length > 0 && dataEnd.rooms.length > 0) {
        const startRoom = dataStart.rooms[0];
        const endRoom = dataEnd.rooms[0];

        // Beltéri vagy épületközi útvonal?
        if (startRoom.floor.building.id === endRoom.floor.building.id) {
          // Beltéri útvonal keresése
          const pathResponse = await fetch(`http://localhost:5000/api/path?fromRoom=${startRoom.id}&toRoom=${endRoom.id}`);
          const pathData = await pathResponse.json();
  
          if (pathData.waypoints) {
            drawPathOnMap(pathData.waypoints);
          } else {
            alert("Nincs elérhető beltéri útvonal!");
          }
        } else {
          // Két épület közötti útvonal keresése
          const connectionResponse = await fetch(
            `http://localhost:5000/api/connection?fromBuilding=${startRoom.floor.building.id}&toBuilding=${endRoom.floor.building.id}&fromFloor=${startRoom.floor.number}&toFloor=${endRoom.floor.number}`
          );
          const connectionData = await connectionResponse.json();
  
          if (connectionData.waypoints) {
            drawPathOnMap(connectionData.waypoints);
          } else {
            alert("Nincs kapcsolat az épületek között!");
          }
        }

        // Épület nézet aktiválása és szobák kiemelése
        setIsBuildingView(true);
        highlightRoom(startRoom);
        highlightRoom(endRoom);
  
        // Útvonal kezdő- és végpontját térképre állítjuk
        handleNavigate(
          { lat: JSON.parse(startRoom.coordinates)[0][1], lng: JSON.parse(startRoom.coordinates)[0][0] },
          { lat: JSON.parse(endRoom.coordinates)[0][1], lng: JSON.parse(endRoom.coordinates)[0][0] }
        );
  
      } else {
        alert("Nincs elegendő találat az útvonaltervezéshez!");
      }
    } catch (error) {
      console.error("🚨 Hiba az útvonaltervezés során:", error);
    }
  };


  const drawPathOnMap = (waypoints) => {
    if (!map.current) return;
  
    // Előző útvonal törlése
    if (window.currentPath) {
      window.currentPath.setMap(null);
    }
  
    const pathCoordinates = waypoints.map(([lng, lat]) => ({ lat, lng }));
  
    window.currentPath = new window.google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 1.0,
      strokeWeight: 3,
    });
  
    window.currentPath.setMap(map.current);
  };
  
  
  

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <SearchPanel
        onSearch={handleSearch}
        highlightBuilding={highlightBuilding}
        highlightRoom={highlightRoom}
        onRouteSearch={handleRouteSearch}
        onGroupSelect={handleGroupSelect}
      />
      <NavigationComponent start={startLocation} end={endLocation} map={map.current} />
      {loading && <p>Betöltés...</p>}
      {error && <p style={{ color: "red" }}>Hiba történt: {error}</p>}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      
      { isBuildingView && buildingFloors.length > 0 && (
      <div className="slider-container">
        <p className="slider-label">Szint: {currentFloor}</p>
        <input
          type="range"
          min={0}
          max={buildingFloors.length - 1}
          value={currentFloor ?? 0}
          onChange={(e) => setCurrentFloor(Number(e.target.value))}
          className="slider"
          orient="vertical"
        />
      </div>
    )}
    </div>
  );
};

export default MapComponent;
