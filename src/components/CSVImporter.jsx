import React from 'react';
import Papa from 'papaparse';

export default function CSVImporter({ onDataLoaded }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const produits = results.data.map(row => ({
          reference: row['No. d\'article']?.trim(),
          titre: row['Titre']?.trim(),
          brand: row['Brand']?.trim(),
          prix: parseFloat(row['Prix']?.replace('€', '').replace(',', '.')) || 0,
          quantite: parseInt(row['Qté.']) || 0,
        })).filter(p => p.reference && !isNaN(p.prix));

        onDataLoaded(produits);
      },
    });
  };

  return (
    <div className="mb-4">
      <label className="block font-medium mb-2">Importer un fichier CSV :</label>
      <input type="file" accept=".csv" onChange={handleFileChange} />
    </div>
  );
}
