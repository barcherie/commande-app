import React, { useState } from 'react';
import { parseJVD } from '../parsers/jvdParser';
import { parseSSA } from '../parsers/ssaParser';

export default function CSVImporter({ onDataLoaded }) {
  const [parserType, setParserType] = useState('ssa');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (parserType === 'jvd') {
      const reader = new FileReader();
      reader.onload = () => {
        const csvText = reader.result;
        const produits = parseJVD(csvText).map(p => ({
          reference: p.reference,
          quantite: p.quantity,
          prix: p.purchasePrice,
        }));

        if (produits.length === 0) {
          alert("Aucun produit JVD valide trouvé.");
        }

        onDataLoaded(produits);
      };
      reader.readAsText(file);
    } else {
      parseSSA(file, (produits) => {
        if (produits.length === 0) {
          alert("Aucun produit SSA valide trouvé.");
        }
        onDataLoaded(produits);
      });
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
