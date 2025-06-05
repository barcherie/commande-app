// src/parsers/jvdParser.js

export function parseJVD(csvText) {
  const lines = csvText.trim().split("\n").slice(1); // ignorer l'en-tête
  const rows = [];

  for (let line of lines) {
    const cols = line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/) // gère les virgules entre guillemets
      .map(c => c.replace(/^"|"$/g, '').trim());

    const [ref, , , priceRaw, qtyRaw] = cols;

    if (!ref || !ref.includes("-")) continue; // ignorer remises/frais

    const quantity = parseInt(qtyRaw, 10);
    const purchasePrice = parseFloat(
      priceRaw.replace(/[^\d,.-]/g, '').replace(",", ".")
    );

    rows.push({
      reference: ref,
      quantity,
      purchasePrice,
    });
  }

  return rows;
}
