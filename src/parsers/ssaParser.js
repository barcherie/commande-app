//src/parsers/ssaParser.js

import Papa from "papaparse";

export function parseSSA(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const produits = results.data
        .map((row) => ({
          reference: row["No. d'article"]?.trim(),
          titre: row["Titre"]?.trim(),
          brand: row["Brand"]?.trim(),
          prix: parseFloat(row["Prix"]?.replace("€", "").replace(",", ".")) || 0,
          quantite: parseInt(row["Qté."]) || 0,
        }))
        .filter((p) => p.reference && !isNaN(p.prix));

      callback(produits);
    },
  });
}
