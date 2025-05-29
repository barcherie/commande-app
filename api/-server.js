const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const PORT = 4000;

const API_KEY = '3BDQHX4LUKMMEP3GSUWSE5WIEDLZR3QG';
const API_URL = 'https://besancon-archerie.fr/boutique/api';

// Autorise le frontend React (port 3000)
app.use(cors({ origin: 'http://localhost:3000' }));

// Route pour chercher un produit par référence
app.get('/api/product/:reference', async (req, res) => {
  const reference = req.params.reference;
  const url = `${API_URL}/products/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64'),
        'Accept': 'application/xml'
      }
    });

    const text = await response.text();
    res.type('text/xml').send(text);
  } catch (err) {
    console.error('Erreur API PrestaShop :', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit.' });
  }
});

app.listen(PORT, () => {
  console.log(`API proxy en écoute sur http://localhost:${PORT}`);
});

// Route pour chercher une déclinaison (combination) par référence
app.get('/api/combination/:reference', async (req, res) => {
  const reference = req.params.reference;
  const url = `${API_URL}/combinations/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64'),
        'Accept': 'application/xml'
      }
    });

    const text = await response.text();
    res.type('text/xml').send(text);
  } catch (err) {
    console.error('Erreur API combination PrestaShop :', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la déclinaison.' });
  }
});

app.get('/api/combination-full/:reference', async (req, res) => {
  const reference = req.params.reference;
  const combinationUrl = `${API_URL}/combinations/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;

  try {
    const response = await fetch(combinationUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64'),
        'Accept': 'application/xml'
      }
    });

    const xml = await response.text();
    const match = xml.match(/<id_product><!\[CDATA\[(\d+)\]\]><\/id_product>/);
    if (!match) return res.status(404).send('Combination not found');

    const idProduct = match[1];
    const productUrl = `${API_URL}/products/${idProduct}`;
    const productRes = await fetch(productUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64'),
        'Accept': 'application/xml'
      }
    });

    const productXml = await productRes.text();
    res.type('text/xml').send(productXml);
  } catch (err) {
    console.error('Erreur combination + product PrestaShop :', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la déclinaison ou produit parent.' });
  }
});
