const { DOMParser, XMLSerializer } = require('xmldom');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 4001;

const API_KEY = '3BDQHX4LUKMMEP3GSUWSE5WIEDLZR3QG';
const API_URL = 'https://besancon-archerie.fr/boutique/api';

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Auth helper
function getAuthHeader() {
  return {
    'Authorization': 'Basic ' + Buffer.from(API_KEY + ':').toString('base64'),
    'Accept': 'application/xml'
  };
}

// ─── 1) PRODUCT by reference ─────────────────────────────────────────────
app.get('/api/product/:reference', async (req, res) => {
  const reference = req.params.reference;
  const url = `${API_URL}/products/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;
  console.log('[API] GET product →', url);
  try {
    const response = await fetch(url, { headers: getAuthHeader() });
    const xml = await response.text();
    res.type('text/xml').send(xml);
  } catch (err) {
    console.error('❌ Erreur API product :', err);
    res.status(500).json({ error: 'Erreur produit.' });
  }
});

// ─── 2) COMBINATION by reference ─────────────────────────────────────────
app.get('/api/combination/:reference', async (req, res) => {
  const reference = req.params.reference;
  const url = `${API_URL}/combinations/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;
  console.log('[API] GET combination →', url);
  try {
    const response = await fetch(url, { headers: getAuthHeader() });
    const xml = await response.text();
    res.type('text/xml').send(xml);
  } catch (err) {
    console.error('❌ Erreur API combination :', err);
    res.status(500).json({ error: 'Erreur combination.' });
  }
});

// ─── 3) COMBINATION-FULL → renvoie le product parent ────────────────────
app.get('/api/combination-full/:reference', async (req, res) => {
  const reference = req.params.reference;
  const url = `${API_URL}/combinations/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;
  console.log('[API] GET combination-full →', url);
  try {
    const response = await fetch(url, { headers: getAuthHeader() });
    const xml = await response.text();
    const match = xml.match(/<id_product><!\[CDATA\[(\d+)\]\]><\/id_product>/);
    if (!match) {
      console.warn('[API] combination-full not found:', xml);
      return res.status(404).json({ error: 'Combination introuvable' });
    }
    const productId = match[1];
    const productUrl = `${API_URL}/products/${productId}`;
    console.log('[API] GET product parent →', productUrl);
    const productRes = await fetch(productUrl, { headers: getAuthHeader() });
    const productXml = await productRes.text();
    res.type('text/xml').send(productXml);
  } catch (err) {
    console.error('❌ Erreur API combination-full :', err);
    res.status(500).json({ error: 'Erreur combination complète.' });
  }
});

// ─── 4) STOCK endpoint pour lire stock_availables ────────────────────────
app.get('/api/stock/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (!['product','combination'].includes(type)) {
    return res.status(400).json({ error: "Type invalide (product|combination)" });
  }
  const filter = type === 'combination'
    ? `filter[id_product_attribute]=${id}`
    : `filter[id_product]=${id}`;
  const url = `${API_URL}/stock_availables/?${filter}&display=full`;
  console.log('[API] GET stock list →', url);
  try {
    const listRes = await fetch(url, { headers: getAuthHeader() });
    const listXml = await listRes.text();
    if (!listRes.ok) {
      console.error('❌ Listing stock_availables error:', listRes.status, listXml);
      return res.status(listRes.status).send(listXml);
    }
    const doc = new DOMParser().parseFromString(listXml, 'application/xml');
    const node = doc.getElementsByTagName('stock_available')[0];
    if (!node) {
      console.warn('[API] stock_available not found in list');
      return res.status(404).json({ error: 'stock_available introuvable' });
    }
    const qtyText = node.getElementsByTagName('quantity')[0]?.textContent.trim() || '0';
    const quantity = parseInt(qtyText.replace(/\D/g,''), 10) || 0;
    res.json({ quantity });
  } catch (err) {
    console.error('❌ Erreur GET /api/stock:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── 5) UPDATE-STOCK → patch sur stock_availables/:id ───────────────────
app.post('/api/update-stock', async (req, res) => {
  const { id, quantity: delta, isCombination } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing ID' });

  const filter = isCombination
    ? `filter[id_product_attribute]=${id}`
    : `filter[id_product]=${id}`;
  const listUrl = `${API_URL}/stock_availables/?${filter}&display=full`;
  console.log('[API] update-stock → listing →', listUrl);

  try {
    const listRes = await fetch(listUrl, { headers: getAuthHeader() });
    const listXml = await listRes.text();
    if (!listRes.ok) {
      console.error('❌ Listing stock_availables for update:', listRes.status, listXml);
      return res.status(listRes.status).send(listXml);
    }

    const doc = new DOMParser().parseFromString(listXml, 'application/xml');
    const nodes = Array.from(doc.getElementsByTagName('stock_available'));
    let chosen = null;
    for (const node of nodes) {
      const pid  = node.getElementsByTagName('id_product')[0]?.textContent.trim();
      const paId = node.getElementsByTagName('id_product_attribute')[0]?.textContent.trim();
      if (!isCombination && pid === String(id) && paId === '0') { chosen = node; break; }
      if (isCombination && paId === String(id)) { chosen = node; break; }
    }
    if (!chosen) {
      console.warn('[API] update-stock: no matching stock_available');
      return res.status(404).send('stock_available introuvable pour cet ID');
    }

    const stockAvailableId = chosen.getElementsByTagName('id')[0].textContent.trim();
    const currentQty = parseInt(chosen.getElementsByTagName('quantity')[0].textContent.trim(),10);
    console.log(`[API] Found stock_available ID=${stockAvailableId}, qty=${currentQty}`);

    // GET complet
    const getUrl = `${API_URL}/stock_availables/${stockAvailableId}`;
    const getRes = await fetch(getUrl, { headers: getAuthHeader() });
    const originalXml = await getRes.text();
    if (!getRes.ok) {
      console.error('❌ Erreur GET stock_available full:', getRes.status, originalXml);
      return res.status(getRes.status).send(originalXml);
    }

    // Update quantité
    const newQty = currentQty + delta;
    const updatedXml = originalXml.replace(
      /<quantity><!\[CDATA\[.*?\]\]><\/quantity>/,
      `<quantity><![CDATA[${newQty}]]></quantity>`
    );
    console.log('[API] PUT stock_available →', updatedXml);

    // PUT final
    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/xml'
      },
      body: updatedXml
    });
    const result = await putRes.text();
    if (!putRes.ok) {
      return res.status(putRes.status).send(result);
    }
    res.status(200).send(result);

  } catch (err) {
    console.error('❌ Erreur update-stock:', err);
    res.status(500).send('Erreur serveur');
  }
});

// ─── 6) UPDATE-PRICE → patch wholesale_price du produit parent ────────────
app.post('/api/update-price', async (req, res) => {
  const { reference, wholesale_price } = req.body;
  if (!reference || wholesale_price == null) {
    return res.status(400).json({ error: 'reference et wholesale_price requis' });
  }

  try {
    // Étape 1: Récupérer l'ID du produit parent
    const combUrl = new URL(`${API_URL}/combinations`);
    combUrl.searchParams.set('filter[reference]', reference);
    combUrl.searchParams.set('display', 'full');
    const combRes = await fetch(combUrl.toString(), { headers: getAuthHeader() });
    const combXml = await combRes.text();
    const combDoc = new DOMParser().parseFromString(combXml, 'application/xml');
    const combNode = combDoc.getElementsByTagName('combination')[0];
    const idProdNode = combNode && combNode.getElementsByTagName('id_product')[0];
    const productId = idProdNode ? idProdNode.textContent.trim() : null;

    if (!productId) {
      return res.status(404).json({ error: 'Référence introuvable' });
    }

    // Étape 2: Obtenir le prix actuel du produit
    const prodUrl = new URL(`${API_URL}/products/${productId}`);
    const prodRes = await fetch(prodUrl.toString(), { headers: getAuthHeader() });
    const prodXml = await prodRes.text();
    const prodDoc = new DOMParser().parseFromString(prodXml, 'application/xml');
    const priceNode = prodDoc.getElementsByTagName('price')[0];
    const currentPrice = priceNode ? priceNode.textContent.trim() : null;

    if (currentPrice === null) {
      return res.status(500).json({ error: 'Impossible de récupérer le prix actuel du produit' });
    }

    // Étape 3: Construire le payload minimal
    const minimalPayload =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<prestashop>' +
        '<product>' +
          `<id><![CDATA[${productId}]]></id>` +
          `<price><![CDATA[${currentPrice}]]></price>` +
          `<wholesale_price><![CDATA[${wholesale_price}]]></wholesale_price>` +
        '</product>' +
      '</prestashop>';

    // Étape 4: Envoyer la requête PUT
    const putRes = await fetch(prodUrl.toString(), {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/xml' },
      body: minimalPayload
    });
    const result = await putRes.text();
    if (!putRes.ok) {
      return res.status(putRes.status).send(result);
    }
    res.send(result);
  } catch (err) {
    console.error('Erreur update-price:', err);
    res.status(500).send('Erreur serveur');
  }
});


// ─── Listen ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ API proxy running on http://localhost:${PORT}`);
});
