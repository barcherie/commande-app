import React, { useState } from "react";
import CSVImporter from "./CSVImporter";

function parseXMLToObject(xmlString, type = 'product') {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'application/xml');
  const item = xml.querySelector(type);
  if (!item) return null;

  const id = item.querySelector('id')?.textContent;
  const wholesale_price = parseFloat(item.querySelector('wholesale_price')?.textContent || '0');
  const price = parseFloat(item.querySelector('price')?.textContent || '0');
  const quantity = parseInt(item.querySelector('quantity')?.textContent || '0');

  return { id, wholesale_price, price, quantity };
}

async function fetchProductOrCombination(reference) {
  const fetchXML = async (url) => {
    const res = await fetch(url);
    const text = await res.text();
    return text;
  };

  const productXML = await fetchXML(`http://localhost:4000/api/product/${encodeURIComponent(reference)}`);
  let parsed = parseXMLToObject(productXML, 'product');
  if (parsed) return { ...parsed, isCombination: false };

  const parentXML = await fetchXML(`http://localhost:4000/api/combination-full/${encodeURIComponent(reference)}`);
  parsed = parseXMLToObject(parentXML, 'product');
  if (!parsed) return null;

  const combinationXML = await fetchXML(`http://localhost:4000/api/combination/${encodeURIComponent(reference)}`);
  const stockOnly = parseXMLToObject(combinationXML, 'combination');

  return {
    ...parsed,
    quantity: stockOnly?.quantity ?? parsed.quantity,
    isCombination: true,
    combinationReference: reference
  };
}

function calcHT(ttc) {
  return ttc; // le prix retourné est déjà HT
}

function calcMargePourcentage(ht, achat) {
  if (!ht || ht === 0) return '❌';
  return (((ht - achat) / ht) * 100).toFixed(1) + '%';
}

async function updateStock(prestaId, quantity, isCombination) {
  const endpoint = isCombination ? 'combinations' : 'products';
  const url = `https://besancon-archerie.fr/boutique/api/${endpoint}/${prestaId}`;
  const payload = `
    <${endpoint}>
      <id>${prestaId}</id>
      <quantity>${quantity}</quantity>
    </${endpoint}>
  `;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'Basic ' + btoa('3BDQHX4LUKMMEP3GSUWSE5WIEDLZR3QG:'),
      'Content-Type': 'application/xml'
    },
    body: payload
  });

  const result = await response.text();
  alert(`Stock mis à jour (ID ${prestaId})\nRéponse : ${result}`);
}

export default function CommandeView() {
  const [produits, setProduits] = useState([]);

  const enrichWithAPI = async (data) => {
    const enriched = await Promise.all(
      data.map(async (item) => {
        const apiData = await fetchProductOrCombination(item.reference);
        const prixHT = apiData ? calcHT(apiData.price) : null;
        const tauxMarge = apiData ? calcMargePourcentage(prixHT, apiData.wholesale_price) : '❌';

        return {
          ...item,
          prestaId: apiData?.id,
          isCombination: apiData?.isCombination ?? false,
          stock: apiData?.quantity ?? '❌',
          prixAchatPresta: apiData?.wholesale_price ?? '❌',
          prixVenteHT: prixHT ?? '❌',
          tauxMarge: tauxMarge,
        };
      })
    );
    setProduits(enriched);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Commande Produits</h1>
      <CSVImporter onDataLoaded={enrichWithAPI} />
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Référence</th>
              <th className="px-4 py-2 text-left">Nom du produit</th>
              <th className="px-4 py-2 text-left">Marque</th>
              <th className="px-4 py-2 text-left">Prix (CSV)</th>
              <th className="px-4 py-2 text-left">Quantité</th>
              <th className="px-4 py-2 text-left">Stock</th>
              <th className="px-4 py-2 text-left">Prix achat Presta</th>
              <th className="px-4 py-2 text-left">Prix vente HT</th>
              <th className="px-4 py-2 text-left">Taux de marge</th>
              <th className="px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((prod, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-4 py-2">{prod.reference}</td>
                <td className="px-4 py-2">{prod.titre}</td>
                <td className="px-4 py-2">{prod.brand}</td>
                <td className="px-4 py-2">{prod.prix.toFixed(2)}</td>
                <td className="px-4 py-2">{prod.quantite}</td>
                <td className="px-4 py-2">{prod.stock}</td>
                <td className="px-4 py-2">{typeof prod.prixAchatPresta === 'number' ? prod.prixAchatPresta.toFixed(2) : prod.prixAchatPresta}</td>
                <td className="px-4 py-2">{typeof prod.prixVenteHT === 'number' ? prod.prixVenteHT.toFixed(2) : prod.prixVenteHT}</td>
                <td className="px-4 py-2">{prod.tauxMarge}</td>
                <td className="px-4 py-2">
                  <button
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={() => updateStock(prod.prestaId, prod.quantite, prod.isCombination)}
                  >
                    MAJ Stock
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
