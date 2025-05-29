const { DOMParser, XMLSerializer } = require('xmldom');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 4000;

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
// Fonction de nettoyage des champs non-éditables
function cleanReadOnlyFields(xml) {
  return xml
    .replace(/<manufacturer_name[\s\S]*?<\/manufacturer_name>/g, '')
    .replace(/<position_in_category[\s\S]*?<\/position_in_category>/g, '')
    .replace(/<date_add[\s\S]*?<\/date_add>/g, '')
    .replace(/<date_upd[\s\S]*?<\/date_upd>/g, '')
    .replace(/<id_default_image[\s\S]*?<\/id_default_image>/g, '')
    .replace(/<nb_downloadable[\s\S]*?<\/nb_downloadable>/g, '')
    .replace(/<available_date[\s\S]*?<\/available_date>/g, '')
    .replace(/<associations>[\s\S]*?<\/associations>/g, '');
    
}


// 1) PRODUCT by reference
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

// 2) COMBINATION by reference
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

// 3) COMBINATION-FULL → renvoie le product parent
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
      return res.status(404).json({ error: 'Combination not found' });
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

// 4) STOCK endpoint pour lire stock_availables
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

// 5) UPDATE-STOCK → patch sur stock_availables/:id
app.post('/api/update-stock', async (req, res) => {
  const { id, quantity: delta, isCombination } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing ID' });

  // 5.1) Lister stock_availables
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

    // 5.2) Récupérer le XML complet
    const getUrl = `${API_URL}/stock_availables/${stockAvailableId}`;
    console.log('[API] GET stock_available full →', getUrl);
    const getRes = await fetch(getUrl, { headers: getAuthHeader() });
    const originalXml = await getRes.text();
    if (!getRes.ok) {
      console.error('❌ Erreur GET stock_available full:', getRes.status, originalXml);
      return res.status(getRes.status).send(originalXml);
    }

    // 5.3) Modifier quantité
    const newQty = currentQty + delta;
    const updatedXml = originalXml.replace(
      /<quantity><!\[CDATA\[.*?\]\]><\/quantity>/,
      `<quantity><![CDATA[${newQty}]]></quantity>`
    );
    console.log('[API] PUT stock_available →', updatedXml);

    // 5.4) Envoyer le PUT
    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/xml'
      },
      body: updatedXml
    });
    const result = await putRes.text();
    console.log('[API] PUT response', putRes.status, result);

    if (!putRes.ok) {
      return res.status(putRes.status).send(result);
    }
    res.status(200).send(result);

  } catch (err) {
    console.error('❌ Erreur update-stock:', err);
    res.status(500).send('Erreur serveur');
  }
});

// ─── ROUTE : mettre à jour le prix d’achat (wholesale_price) ────────────────
app.post('/api/update-price', async (req, res) => {
  const { reference, wholesale_price } = req.body;
  if (!reference || wholesale_price == null) {
    return res.status(400).json({ error: 'reference et wholesale_price requis' });
  }

  try {
    let endpoint, idToUpdate;

    // 1) Lister les produits correspondant à la référence
    const prodListUrl = `${API_URL}/products/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;
    const prodListRes = await fetch(prodListUrl, { headers: getAuthHeader() });
    const prodListXml = await prodListRes.text();
    const prodDoc     = new DOMParser().parseFromString(prodListXml, 'application/xml');
    const prodNodes   = prodDoc.getElementsByTagName('product');

    if (prodNodes.length > 0) {
      // On a un produit
      endpoint   = 'products';
      idToUpdate = prodNodes[0].getElementsByTagName('id')[0].textContent.trim();
    } else {
      // 2) Sinon, lister les combinaisons
      const combListUrl = `${API_URL}/combinations/?filter%5Breference%5D=${encodeURIComponent(reference)}&display=full`;
      const combListRes = await fetch(combListUrl, { headers: getAuthHeader() });
      const combListXml = await combListRes.text();
      const combDoc     = new DOMParser().parseFromString(combListXml, 'application/xml');
      const combNodes   = combDoc.getElementsByTagName('combination');

      if (combNodes.length === 0) {
        return res.status(404).json({ error: 'Référence introuvable en product ou combination' });
      }
      endpoint   = 'combinations';
      idToUpdate = combNodes[0].getElementsByTagName('id')[0].textContent.trim();
    }

    const url = `${API_URL}/${endpoint}/${idToUpdate}`;

    // 3) Récupérer le XML complet
    const getRes      = await fetch(url, { headers: getAuthHeader() });
    const originalXml = await getRes.text();
    if (!getRes.ok) {
      return res.status(getRes.status).send(originalXml);
    }

    // 4) Parser en DOM
    const doc = new DOMParser().parseFromString(originalXml, 'application/xml');

    // 5) Supprimer les champs en lecture seule
    const readOnlyTags = [
      'manufacturer_name','position_in_category','date_add','date_upd',
      'id_default_image','id_default_combination','cache_default_attribute',
      'cache_is_pack','cache_has_attachments','is_virtual','type','state',
      'associations','quantity'
    ];
    for (const tag of readOnlyTags) {
      const nodes = doc.getElementsByTagName(tag);
      for (let i = nodes.length - 1; i >= 0; i--) {
        nodes[i].parentNode.removeChild(nodes[i]);
      }
    }

    // 6) Mettre à jour <wholesale_price>
    const wpEls = doc.getElementsByTagName('wholesale_price');
    if (wpEls.length === 0) {
      throw new Error('<wholesale_price> introuvable');
    }
    const wpEl = wpEls[0];
    // remplacer tout le contenu
    while (wpEl.firstChild) wpEl.removeChild(wpEl.firstChild);
    wpEl.appendChild(doc.createCDATASection(String(wholesale_price)));

    // 7) Sérialiser et envoyer le PUT
    const xmlPayload = new XMLSerializer().serializeToString(doc);
    const putRes     = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/xml'
      },
      body: xmlPayload
    });
    const result = await putRes.text();
    if (!putRes.ok) {
      return res.status(putRes.status).send(result);
    }
    res.status(200).send(result);

  } catch (err) {
    console.error('❌ Erreur update-price:', err);
    res.status(500).send('Erreur serveur');
  }
});


// 6) On oubliait pas le listen
app.listen(PORT, () => {
  console.log(`✅ API proxy running on http://localhost:${PORT}`);
});
