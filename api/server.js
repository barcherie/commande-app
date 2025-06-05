const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const CONTROLLER_URL = 'https://besancon-archerie.fr/boutique/modules/stockfix/update.php';
const QUERY_URL = 'https://besancon-archerie.fr/boutique/modules/stockfix/query.php';
const TOKEN = 'XmvuvrkWBse9ENzYc-OCOU7eUKYVVkjU37JCjLUcyn0';

// 🔁 Mise à jour stock + prix d'achat
app.post('/api/update-product', async (req, res) => {
  const { reference, wholesale_price, stock } = req.body;

  if (!reference) {
    return res.status(400).json({ error: 'Reference is required' });
  }

  try {
    const url = new URL(CONTROLLER_URL);
    url.searchParams.set('token', TOKEN);
    url.searchParams.set('reference', reference);
    if (wholesale_price !== undefined) url.searchParams.set('wholesale', wholesale_price);
    if (stock !== undefined) url.searchParams.set('stock', stock);

    const response = await fetch(url.toString());
    const text = await response.text();

    try {
      const data = JSON.parse(text);
      if (!response.ok) {
        return res.status(response.status).json({ error: data });
      }
      return res.json(data);
    } catch (jsonErr) {
      return res.status(500).json({ error: 'Invalid JSON returned: ' + text });
    }

  } catch (error) {
    return res.status(500).json({ error: error.toString() });
  }
});

// 📦 GET /api/product/:ref → appel query.php
app.get('/api/product/:ref', async (req, res) => {
  const { ref } = req.params;
  try {
    const url = new URL(QUERY_URL);
    url.searchParams.set('token', TOKEN);
    url.searchParams.set('reference', ref);

    const response = await fetch(url.toString());
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
});

// 🎯 GET /api/combination/:ref → alias vers query.php aussi
app.get('/api/combination/:ref', async (req, res) => {
  const { ref } = req.params;
  try {
    const url = new URL(QUERY_URL);
    url.searchParams.set('token', TOKEN);
    url.searchParams.set('reference', ref);

    const response = await fetch(url.toString());
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
});

app.listen(4000, () => {
  console.log('Server running on port 4000');
});
