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

// ─── Récupère un produit ou une combinaison depuis l’API proxy ─────────────
async function fetchProductOrCombination(reference) {
  const safeFetchText = async url => {
    try {
      const res = await fetch(url);
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };

  // 1) Essayer comme product
  let xml = await safeFetchText(`http://localhost:4000/api/product/${encodeURIComponent(reference)}`);
  let p   = parseXMLToObject(xml, "product");
  if (p?.id) {
    return {
      prestaId:      p.id,
      isCombination: false,
      purchasePrice: p.wholesale_price,
      salePrice:     p.price,
      stock:         p.quantity
    };
  }

  // 2) Essayer comme combination
  xml = await safeFetchText(`http://localhost:4000/api/combination/${encodeURIComponent(reference)}`);
  let c = parseXMLToObject(xml, "combination");
  if (c?.id) {
    // récupérer parent pour prix
    const parentXml = await safeFetchText(`http://localhost:4000/api/combination-full/${encodeURIComponent(reference)}`);
    const pr        = parseXMLToObject(parentXml, "product") || { wholesale_price: 0, price: 0 };
    return {
      prestaId:      c.id,
      isCombination: true,
      purchasePrice: pr.wholesale_price,
      salePrice:     pr.price,
      stock:         c.quantity
    };
  }

  // 3) Rien trouvé → fallback
  return {
    prestaId:      null,
    isCombination: false,
    purchasePrice: 0,
    salePrice:     0,
    stock:         0
  };
}

// ─── Calcule le taux de marge brute (%) ────────────────────────────────────
function calcMarge(pvHT, paHT) {
  return pvHT > 0
    ? (((pvHT - paHT) / pvHT) * 100).toFixed(1) + "%"
    : "–";
}

// ─── Met à jour le stock via l’API proxy ───────────────────────────────────
async function updateStock(prestaId, qty, currentStock, isCombination, onSuccess) {
  try {
    const res  = await fetch("http://localhost:4000/api/update-stock", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: prestaId, quantity: qty, currentStock, isCombination })
    });
    const text = await res.text();
    if (!res.ok) {
      alert(`❌ MAJ stock échouée (${res.status})\n${text}`);
    } else {
      alert(`✅ MAJ stock OK\n${text}`);
      onSuccess(currentStock + qty);
    }
  } catch (e) {
    alert(`❌ Erreur réseau: ${e.message}`);
  }
}

// ─── Met à jour le prix d’achat (wholesale_price) via l’API proxy ──────────
async function updatePrice(reference, newPrice, onSuccess) {
  try {
    const res  = await fetch("http://localhost:4000/api/update-price", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reference, wholesale_price: newPrice })
    });
    const text = await res.text();
    if (!res.ok) {
      alert(`❌ MAJ prix échouée (${res.status})\n${text}`);
    } else {
      alert(`✅ MAJ prix OK\n${text}`);
      onSuccess(newPrice);
    }
  } catch (e) {
    alert(`❌ Erreur réseau: ${e.message}`);
  }
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function CommandeView() {
  const [produits, setProduits] = useState([]);

  // Handler pour éditer la Qté CSV en local
  const onChangeQuantite = (index, newQty) => {
    setProduits(prev =>
      prev.map((p, i) =>
        i === index ? { ...p, quantite: newQty } : p
      )
    );
  };

  // Charge et enrichit les données CSV via l’API
  const enrichWithAPI = async (rows) => {
    if (!rows.length) return;

    // Détection dynamique des colonnes CSV
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
                <td className="px-4 py-2 flex space-x-2">
                  <button
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={() =>
                      updateStock(
                        p.prestaId,
                        p.quantite,
                        p.stock,
                        p.isCombination,
                        newStock => {
                          setProduits(prev =>
                            prev.map((x, j) =>
                              j === i ? { ...x, stock: newStock } : x
                            )
                          );
                        }
                      )
                    }
                  >
                    MAJ Stock
                  </button>
                  <button
                    className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    onClick={() =>
                      updatePrice(
                        p.reference,
                        p.prixCSV,
                        newPrice => {
                          setProduits(prev =>
                            prev.map((x, j) =>
                              j === i ? { ...x, purchasePrice: newPrice } : x
                            )
                          );
                        }
                      )
                    }
                  >
                    MAJ Prix
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
