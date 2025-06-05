
# 📦 Commande App – Gestion de commandes fournisseurs & mise à jour PrestaShop

Cette application React permet d'importer des fichiers CSV de fournisseurs (SSA, JVD...), de traiter automatiquement les produits et déclinaisons référencés, puis de **mettre à jour les stocks et les prix d’achat** dans un site PrestaShop via une API personnalisée.

---

## 🚀 Fonctionnalités principales

- 🔍 Import de fichiers CSV (SSA ou JVD)
- 🧠 Détection intelligente des colonnes (`Référence`, `Qté`, `Prix`, etc.)
- 🔄 Appels API PrestaShop pour :
  - Mettre à jour le **stock** produit ou déclinaison
  - Mettre à jour le **prix d’achat** (toujours sur le produit parent)
- 📊 Affichage complet :
  - Prix d’achat actuel
  - Stock actuel
  - Prix CSV
  - Taux de marge
- ✏️ Modification de la quantité avant envoi
- ✅ Interface claire et réactive

---

## 🛠️ Installation

1. **Cloner le dépôt**

```bash
git clone https://github.com/ton-utilisateur/commande-app.git
cd commande-app
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Lancer le projet en local**

```bash
npm run dev
# ou pour Create React App
npm start
```

---

## 🖇️ API attendue

Le frontend communique avec un **serveur proxy Node.js ou PHP** situé sur `http://localhost:4000/api/`. Il doit exposer les routes suivantes :

| Méthode | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/product/:reference` | Récupère un produit simple |
| `GET` | `/api/combination/:reference` | Récupère une déclinaison |
| `GET` | `/api/combination-full/:reference` | Récupère le produit parent d'une déclinaison |
| `POST` | `/api/update-product` | Met à jour le stock et/ou le prix d’achat |

> ⚠️ Ces routes doivent gérer les références PrestaShop (produit ou déclinaison) via un module proxy (type `stockfix`).

---

## 📄 Format des fichiers CSV supportés

### ✅ SSA

| No. d'article | Titre | Brand | Prix | Qté |
|---------------|-------|-------|------|-----|
| 123456        | Nom du produit | Marque | 12,34 € | 2 |

### ✅ JVD

| Product        | Description | Unit | Price | Amount |
|----------------|-------------|------|-------|--------|
| 121482-1012    | Nom produit | 1    | € 9,99 | 5      |

> Le format `121482-1012` est automatiquement interprété comme une déclinaison.

---

## ✅ Ajouter un nouveau fournisseur

Pour ajouter un fournisseur avec un format CSV spécifique :

1. Créer un fichier `src/parsers/nomDuFournisseurParser.js`
2. Exporter une fonction `parseNom(csvText)` qui retourne un tableau de :

```js
{ reference: string, quantite: number, prix: number }
```

3. L'ajouter dans `CSVImporter.jsx` avec un `<option>` et un `switch`.

---

## 📦 Structure du projet

```
src/
├── components/
│   └── CSVImporter.jsx
│   └── CommandeView.jsx
├── parsers/
│   └── ssaParser.js
│   └── jvdParser.js
└── App.jsx
```

---

## 🙌 Crédits

Développé pour [Besançon Archerie](https://besancon-archerie.fr) 🎯  
Avec ❤️ pour le tir à l’arc, la performance, et les outils propres.

---

## 📜 Licence

Projet interne – pas destiné à la redistribution sans autorisation.
