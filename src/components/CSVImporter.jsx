import React, { useState } from 'react';
import { parseSSA } from '../parsers/ssaParser';
import { parseJVD } from '../parsers/jvdParser';

export default function CSVImporter({ onDataLoaded }) {
  const [parserType, setParserType] = useState('ssa');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const callback = (produits) => {
      if (!produits.length) {
        alert("Aucun produit valide trouvé dans le fichier.");
      }
      onDataLoaded(produits);
    };

    switch (parserType) {
      case "jvd":
        parseJVD(file, callback);
        break;
      case "ssa":
      default:
        parseSSA(file, callback);
        break;
    }
  };

  return (
    <div className="mb-4">
      <label className="block font-medium mb-2">Fournisseur :</label>
      <select
        value={parserType}
        onChange={(e) => setParserType(e.target.value)}
        className="mb-2 border px-2 py-1 rounded"
      >
        <option value="ssa">SSA</option>
        <option value="jvd">JVD</option>
      </select>

      <label className="block font-medium mb-2">Importer un fichier CSV :</label>
      <input type="file" accept=".csv" onChange={handleFileChange} />
    </div>
  );
}
