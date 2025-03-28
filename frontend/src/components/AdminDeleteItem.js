import React, { useEffect, useState } from "react";
import "../AdminLook.css";

const API_BASE_URL = "http://localhost:5000/api";

const AdminDeleteItem = ({refreshMap }) => {
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

    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        const formattedItems = data.features.map((feature) => {
          const baseItem = {
            id: feature.properties.id,
            name: feature.properties.name || feature.properties.number, // Név vagy szám
          };

          // Ha az elem egy emelet, csatoljuk az épület nevét
          if (category === "floor" && feature.properties.building) {
            baseItem.name += ` (${feature.properties.building})`;
          }

          // Ha az elem egy terem, csatoljuk az épület nevét
          if (category === "room" && feature.properties.building) {
            baseItem.name += ` (${feature.properties.building})`;
          }

          return baseItem;
        });

        setItems(formattedItems);
      })
      .catch((error) => console.error("❌ Hiba az adatok lekérésekor:", error));
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

    try {
      const response = await fetch(apiUrl, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Hiba történt a törlés során.");
      }

      alert("✅ Sikeresen törölve!");
      setItems(items.filter((item) => item.id !== selectedItem));
      setSelectedItem("");
      setIsVisible(false); 
      refreshMap();
    } catch (error) {
      console.error("🚨 Törlési hiba:", error);
      alert("❌ Nem sikerült törölni az elemet.");
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
        <select onChange={(e) => setCategory(e.target.value)}>
            <option value="">Válassz</option>
            <option value="building">Épület</option>
            <option value="floor">Emelet</option>
            <option value="room">Terem</option>
        </select>
        {category && (
            <>
            <label className="delete-container-lowtitle">Elem kiválasztása:</label>
            <select onChange={(e) => setSelectedItem(e.target.value)}>
                <option value="">Válassz egy elemet</option>
                {items.map((item) => (
                <option key={item.id} value={item.id}>
                    {item.name}
                </option>
                ))}
            </select>
                <button  className="delete-btn" onClick={handleDelete} disabled={!selectedItem}>Törlés</button>
                <button className="close-btn" onClick={() => setIsVisible(false)}>Mégse</button>
            </>
        )}
        </div>
    )}
</div>
  );
};

export default AdminDeleteItem;