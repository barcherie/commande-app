// src/parsers/jvdParser.js

import Papa from "papaparse";

export function parseJVD(file, callback) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function (results) {
      const produits = results.data
        .map((row) => {
          const reference = row["Product"]?.trim();
          const titre = row["Description"]?.trim();
          const unit = row["Unit"]?.trim();
          const price = parseFloat(row["Price"]?.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
          const quantite = parseInt(row["Amount"]) || 0;
          const orderTotal = parseFloat(row["Order total"]?.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
          const invoiced = row["Invoiced"]?.trim();
          const delivered = row["Delivered"]?.trim();
          const remark = row["Remark"]?.trim();

          return {
            reference,
            titre,
            unit,
            prix: price,
            quantite,
            orderTotal,
            invoiced,
            delivered,
            remark,
          };
        })
        .filter((p) => p.reference && p.reference.includes("-") && !isNaN(p.prix));

      callback(produits);
    },
  });
}
