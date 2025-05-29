// Exemple de requête pour chercher un produit par référence
// Remplacez 'A062351' par une référence réelle

const API_KEY = '3BDQHX4LUKMMEP3GSUWSE5WIEDLZR3QG';
const BASE_URL = 'https://besancon-archerie.fr/boutique/api';

async function fetchProductByReference(reference) {
  const headers = {
    'Authorization': 'Basic ' + btoa(API_KEY + ':'),
    'Accept': 'application/xml'
  };

  const url = `${BASE_URL}/products/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;

  const response = await fetch(url, { headers });
  const text = await response.text();
  console.log('Réponse XML :', text);
}

// Exemple d'appel
fetchProductByReference('A062351');
