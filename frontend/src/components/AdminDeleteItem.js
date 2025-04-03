import React, { useEffect, useState } from "react";
import "../AdminLook.css";

const API_BASE_URL = "http://localhost:5000/api";

const AdminDeleteItem = ({ refreshMap, setShowEdgeForm, setSelectedData }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const tarshIcon = "assets/icons/waste-basket.svg";
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    if (!category) return;

    let apiUrl = "";
    if (category === "building") apiUrl = `${API_BASE_URL}/buildings`;
    if (category === "floor") apiUrl = `${API_BASE_URL}/floors`;
    if (category === "room") apiUrl = `${API_BASE_URL}/rooms`;
    if (category === "node") apiUrl = `${API_BASE_URL}/nodes`;
    if (category === "edge") apiUrl = `${API_BASE_URL}/edges`;

    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        let formattedItems = [];

        if (category === "node") {
          formattedItems = data.map((item) => ({
            id: item.id,
            name: `Node #${item.id} (${item.building?.name || "nincs épület"})`,
          }));
        } else if (category === "edge") {
          formattedItems = data.map((item) => {
            const fromNode = item.fromNode;
            const toNode = item.toNode;
        
            const fromStr = `${fromNode?.id} (${fromNode?.building?.name || "nincs épület"})`;
            const toStr = `${toNode?.id} (${toNode?.building?.name || "nincs épület"})`;
        
            return {
              id: item.id,
              name: `id:${item.id}: -- ${fromStr} → ${toStr}`,
            };
          });
        } else {
          formattedItems = data.features.map((feature) => {
            let name = feature.properties.name || feature.properties.number;
            if ((category === "floor" || category === "room") && feature.properties.building) {
              name += ` (${feature.properties.building})`;
            }
            return {
              id: feature.properties.id,
              name,
            };
          });
        }

        setItems(formattedItems);
      })
      .catch((error) => console.error("Hiba az adatok lekérésekor:", error));
  }, [category]);

  const handleDelete = async () => {
    if (!selectedItem) {
      alert("Válassz egy elemet a törléshez!");
      return;
    }

    let apiUrl = "";
    if (category === "building") apiUrl = `${API_BASE_URL}/deleteBuilding/${selectedItem}`;
    if (category === "floor") apiUrl = `${API_BASE_URL}/deleteFloor/${selectedItem}`;
    if (category === "room") apiUrl = `${API_BASE_URL}/deleteRoom/${selectedItem}`;
    if (category === "node") apiUrl = `${API_BASE_URL}/nodes/${selectedItem}`;
    if (category === "edge") apiUrl = `${API_BASE_URL}/edges/${selectedItem}`;

    try {
      const response = await fetch(apiUrl, { method: "DELETE" });

      if (!response.ok) throw new Error("Hiba történt a törlés során.");

      alert("Sikeresen törölve!");
      setItems(items.filter((item) => item.id !== selectedItem));
      setSelectedItem("");
      setIsVisible(false);
      refreshMap();
    } catch (error) {
      console.error("🚨 Törlési hiba:", error);
      alert("Nem sikerült törölni az elemet.");
    }
  };

  return (
    <div>
      <button className="delete-icon-btn" onClick={() => setIsVisible(!isVisible)}>
        <img src={tarshIcon} alt="Törlés" />
      </button>
      {isVisible && (
        <div className="delete-container">
          <div className="delete-container-title">Elem törlése</div>
          <label className="delete-container-lowtitle">Kategória:</label>
          <select onChange={(e) => { setCategory(e.target.value); setSelectedItem(""); setItems([]); }}>
            <option value="">Válassz</option>
            <option value="building">Épület</option>
            <option value="floor">Emelet</option>
            <option value="room">Terem</option>
            <option value="node">Node</option>
            <option value="edge">Edge</option>
          </select>

          {category && (
            <>
              <label className="delete-container-lowtitle">Elem kiválasztása:</label>
              <select onChange={(e) => setSelectedItem(e.target.value)} value={selectedItem}>
                <option value="">Válassz egy elemet</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <button className="delete-btn" onClick={handleDelete} disabled={!selectedItem}>Törlés</button>
              <button className="close-btn" onClick={() => setIsVisible(false)}>Mégse</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDeleteItem;
