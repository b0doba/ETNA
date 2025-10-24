import React from "react";
import { useNavigate } from "react-router-dom";
import "../InfoPage.css";

const InfoPage = () => {
  const navigate = useNavigate();

  return (
    <div className="info-page">
      <header className="info-header">
        <button className="back-button" onClick={() => navigate("/map")}>
          Vissza
        </button>
        <h1>Weboldal működése</h1>
      </header>

      <main className="info-content">
        <h2>Főbb funkciók</h2>
        <p>
          A kampusztérképes rendszer célja, hogy vizuálisan, gyorsan és pontosan jelenítse meg
          az egyetemi infrastruktúrát. Az alábbi fő funkciók közösek vagy egymást kiegészítik
          a két felhasználói szerepkör között.
        </p>

        <h3>Keresés és kiemelés</h3>
        <p>
          A keresőmező segítségével bármely épület, terem vagy fontos pont (pl. mosdó, büfé, iroda)
          megkereshető. A találatokat automatikusan kiemeli a rendszer kék színnel, és a térkép a megfelelő helyre zoomol.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h3>Útvonaltervezés</h3>
        <p>
          A felhasználó két pont (pl. „A épület” → „B302 terem”) megadásával útvonalat kérhet.
          A rendszer az adatbázisban tárolt node- és edge-hálózat alapján kiszámítja a
          legrövidebb útvonalat, megjeleníti a térképen, valamint kiírja a távolságot és
          a becsült menetidőt. A navigáció figyelembe veszi az épületeken belüli szinteket
          és a lépcsők (<code>stairs</code>) kapcsolatát is.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h3>Nézetváltás (külső / belső nézet)</h3>
        <p>
          A rendszer egy gombnyomással képes váltani a külső (épületszintű) és a belső (szintszintű) nézet között.
          Külső nézetben az egész kampusz látható, az épületek szürke árnyalatban jelennek meg,
          míg belső nézetben egy kiválasztott épület szintjei jelennek meg egy jobb oldali slider segítségével.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h3>Szintváltás (slideres megoldás)</h3>
        <p>
          Belső nézetben a felhasználó slider segítségével válthat az adott épület szintjei között.
          A térkép ilyenkor nem töltődik újra, csak a <code>map.data</code> réteg frissül a megfelelő
          <code>floorId</code>-hoz tartozó adatokkal, így a váltás zökkenőmentes és gyors.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h3>Épületcsoportok kiemelése</h3>
        <p>
          A térképi épületcsoportokra kattintva a rendszer kiemeli az adott épületeket.
          A kiemelés (highlight) vizuálisan megkülönbözteti az aktív objektumot,
          miközben a többi halvány színnel marad látható.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h3>Helymeghatározás</h3>
        <p>
          A térkép alsó sarkában található helymeghatározás gombra kattintva a felhasználó
          megtekintheti az aktuális pozícióját a kampuszon belül.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h3>Információs oldal</h3>
        <p>
          Az oldal jobb felső sarkában található információs fülre kattintva a felhasználó
          elolvashatja az oldal működési útmutatóját és a főbb funkciók leírását.
        </p>
        <p className="image-placeholder">Kééép</p>

        <h2>Felhasználó</h2>
        <p>
          A felhasználói felület egyszerű és intuitív, minden funkció egy-két kattintással elérhető.
          A cél, hogy a hallgatók, oktatók és látogatók könnyen eligazodjanak a kampuszon.
        </p>

        <h3>Fő funkciók lépésenként:</h3>
        <ol>
          <li>Keresés indítása: a bal felső keresőmezőbe beírható egy épület vagy terem neve.</li>
          <li>Kiemelés: a találat azonnal kék színnel jelenik meg.</li>
          <li>Útvonaltervezés: két pont megadásával a rendszer kiszámítja az optimális útvonalat.</li>
          <li>Szintváltás: ha a célpont több emeletes épületben van, a slider segítségével lehet váltani.</li>
          <li>Nézetváltás: egy koppintással váltható a külső és belső térképi nézet.</li>
          <li>Navigáció törlése: a jobb felső ikonra kattintva törölhető az aktuális útvonal.</li>
        </ol>

        <h3>Egyéb lehetőségek:</h3>
        <ul>
          <li>A térkép mozgatható, nagyítható és forgatható nézetet biztosít.</li>
          <li>Kattintásra megjelennek az adott épület vagy terem adatai.</li>
        </ul>

        <p className="image-placeholder">Kééép</p>
      </main>
    </div>
  );
};

export default InfoPage;
