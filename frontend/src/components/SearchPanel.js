import React, { useState, useEffect } from "react";
import searchIcon from "../assets/icons/arrow.svg";
import routeIcon from "../assets/icons/pitch.svg";
import "../App.css";

const SearchPanel = ({ onSearch, onRouteSearch, onGroupSelect  }) => {
  const [showRouteInputs, setShowRouteInputs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState("search");

  useEffect(() => {
    const fetchSuggestions = async (query) => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await fetch(`http://localhost:5000/api/search?q=${query}`);
        const data = await response.json();

        let results = [
          ...data.buildings.map((b) => ({ name: b.name, type: "Épület" })),
          ...data.rooms.map((r) => ({ name: r.name, type: "Terem" }))
        ];

        if (results.some(item => item.name === query)) {
          setSuggestions([]);
        } else {
          setSuggestions(results);
        }
      } catch (error) {
        console.error("Hiba a keresési javaslatok betöltésekor:", error);
      }
    };

    if (activeInput === "search") fetchSuggestions(searchQuery);
    if (activeInput === "start") fetchSuggestions(startPoint);
    if (activeInput === "destination") fetchSuggestions(destination);

  }, [searchQuery, startPoint, destination, activeInput]);
  
  // Keresési funkció az útvonalhoz
  const handleRouteSearch = () => {
    if (startPoint && destination) {
      console.log("Útvonaltervezés innen:", startPoint, "ide:", destination);
      // Itt lehet majd API hívást csinálni vagy útvonalat megjeleníteni
    } else {
      alert("Kérlek add meg mindkét helyet az útvonaltervezéshez!");
    }
  };

  const handleSearch = () => {
    onSearch(searchQuery);
    setSuggestions([]);
  };

  return (
    <>
    {/* Kategória gombok az oldal tetején */}
    <div className="category-buttons">
        <button className="category-btn" onClick={() => onGroupSelect("Kollégiumok")}>Kollégiumok</button>
        <button className="category-btn" onClick={() => onGroupSelect("Sportcsarnokok")}>Sportcsarnokok</button>
        <button className="category-btn" onClick={() => onGroupSelect("Parkolók")}>Parkolók</button>
        <button className="category-btn" onClick={() => onGroupSelect("\"Tanulmányi épületek\"")}>Tanulmányi Épületek</button>
        <button className="category-btn">Rendezvények</button>
      </div>
      {/* Keresőpanel */}
    <div className="search-panel">
      {!showRouteInputs ? (
        <div className="search-bar">
          <div className="autocomplete">
              <input
                type="text"
                placeholder="Keresés..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setActiveInput("search")}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              />
              {suggestions.length > 0 && activeInput === "search" && (
                <ul className="autocomplete-list">
                  {suggestions.map((item, index) => (
                    <li key={index} onClick={() => { setSearchQuery(item.name); setSuggestions([]);}}>
                      {item.name} ({item.type})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="search-btn" onClick={handleSearch}>
              <img src={searchIcon} alt="Keresés" />
            </button>
          <button className="route-btn" onClick={() => setShowRouteInputs(true)}>
            <img src={routeIcon} alt="Útvonaltervezés" />
          </button>
        </div>
      ) : (
        <div className="route-inputs">
          <input
            type="text"
            placeholder="Kiindulópont"
            value={startPoint}
            onChange={(e) => setStartPoint(e.target.value)}
          />
          <input
            type="text"
            placeholder="Úticél"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <button className="route-btn search-route-btn" onClick={handleRouteSearch}>
            Útvonaltervezés
          </button>
          <button className="route-btn" onClick={() => setShowRouteInputs(false)}>Vissza</button>
        </div>
      )}
      <p className="description">Írd le hova szeretnél menni!</p>
    </div>
    </>
  );
};

export default SearchPanel;
