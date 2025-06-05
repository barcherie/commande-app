import React, { useState } from "react";
import CSVImporter from "./CSVImporter";

// ─── Parser XML pour product ou combination ────────────────────────────────
function parseXMLToObject(xmlString, tag) {
  if (!xmlString) return null;
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlString, "application/xml");
  const el     = doc.querySelector(tag);
  if (!el) return null;
  const getText = t => el.querySelector(t)?.textContent.trim() || "";
  return {
    id:              getText("id"),
    wholesale_price: parseFloat(getText("wholesale_price") || "0"),
    price:           parseFloat(getText("price")           || "0"),
    quantity:        parseInt(  getText("quantity")        || "0", 10)
  };
}

// ─── Récupère un produit ou une combinaison depuis query.php ───────────────
async function fetchProductOrCombination(reference) {
  try {
    const res = await fetch(`http://localhost:4000/api/product/${encodeURIComponent(reference)}`);
    const data = await res.json();

    if (!data.found) {
      return {
        prestaId: null,
        isCombination: false,
        purchasePrice: 0,
        salePrice: 0,
        stock: 0
      };
    }

    return {
      prestaId: data.is_combination ? data.id_product_attribute : data.id_product,
      isCombination: data.is_combination,
      purchasePrice: data.wholesale_price,
      salePrice: data.price,
      stock: data.stock
    };
  } catch (err) {
    console.error("❌ Erreur API :", err);
    return {
      prestaId: null,
      isCombination: false,
      purchasePrice: 0,
      salePrice: 0,
      stock: 0
    };
  }
}


// ─── Calcule le taux de marge brute (%) ────────────────────────────────────
function calcMarge(pvHT, paHT) {
  return pvHT > 0
    ? (((pvHT - paHT) / pvHT) * 100).toFixed(1) + "%"
    : "–";
}

// ─── Met à jour le stock + prix achat (produit parent si combination) ──────
const updateStock = async (reference, newStock, newPrice, isCombination) => {
  try {
    const payload = isCombination
      ? { reference, stock: newStock }
      : { reference, stock: newStock, wholesale_price: newPrice };

    if (isCombination) {
      await fetch("http://localhost:4000/api/update-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, wholesale_price: newPrice })
      });
    }

    const response = await fetch("http://localhost:4000/api/update-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors de la mise à jour');
    }

    alert(`✅ Stock et prix mis à jour pour ${reference}`);
  } catch (err) {
    alert(`❌ Erreur de mise à jour : ${err.message}`);
  }
};

// ─── Composant principal ───────────────────────────────────────────────────
export default function CommandeView() {
  const [produits, setProduits] = useState([]);

  const onChangeQuantite = (index, newQty) => {
    setProduits(prev =>
      prev.map((p, i) =>
        i === index ? { ...p, quantite: newQty } : p
      )
    );
  };

  const enrichWithAPI = async (rows) => {
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const detect = pattern =>
      headers.find(h => new RegExp(pattern, "i").test(h)) || "";

    const refKey   = detect("^ref");
    const titreKey = detect("titre|name");
    const brandKey = detect("brand");
    const prixKey  = detect("^prix|price");
    const qteKey   = detect("qt[eé]|\\bqty\\b|quantit");

    const data = await Promise.all(
      rows.map(async row => {
        const reference = row[refKey]   ?? "";
        const titre     = row[titreKey] ?? "";
        const brand     = row[brandKey] ?? "";
        const prixCSV   = parseFloat(row[prixKey] || "0");
        const quantite  = parseInt(row[qteKey]  || "0", 10);
        
        const api = await fetchProductOrCombination(reference);
        console.log("🔍 Référence API :", reference);
        console.log("📦 Données API retournées :", api);
        return {
          reference,
          titre,
          brand,
          prixCSV,
          quantite,
          ...api,
          tauxMarge: calcMarge(api.salePrice, api.purchasePrice)
        };
      })
    );

    setProduits(data);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Commande Produits</h1>
      <CSVImporter onDataLoaded={enrichWithAPI} />
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded-lg text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2">Référence</th>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Marque</th>
              <th className="px-4 py-2">Prix CSV</th>
              <th className="px-4 py-2">Qté CSV</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Prix achat</th>
              <th className="px-4 py-2">Prix vente HT</th>
              <th className="px-4 py-2">Marge</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((p, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2">{p.reference}</td>
                <td className="px-4 py-2">{p.titre}</td>
                <td className="px-4 py-2">{p.brand}</td>
                <td className="px-4 py-2">{(p.prixCSV ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min="0"
                    className="w-16 border rounded px-1"
                    value={p.quantite}
                    onChange={e => onChangeQuantite(i, parseInt(e.target.value, 10) || 0)}
                  />
                </td>
                <td className="px-4 py-2">{p.stock}</td>
                <td className="px-4 py-2">{(p.purchasePrice ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{(p.salePrice     ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2">{p.tauxMarge}</td>
                <td className="px-4 py-2">
                  <button
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={() =>
                      updateStock(
                        p.reference,
                        p.quantite,
                        p.prixCSV,
                        p.isCombination
                      )
                    }
                  >
                    MAJ Stock + Prix
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
