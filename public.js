import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { firebaseConfig, appId } from './firebase-config.js';

// --- Initialisation de Firebase ---
let app, auth, db, userId;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setLogLevel('debug');
    console.log("Firebase Public initialisé.");
} catch (e) {
    console.error("Erreur d'initialisation de Firebase:", e);
    document.body.innerHTML = "<p>Erreur critique: Impossible d'initialiser la base de données.</p>";
}

// --- Cache de données ---
let menuCache = [];
let stockCache = [];
let currentCart = []; // { id, name, price, recipe }

// --- Éléments DOM ---
const loadingScreen = document.getElementById('loading-screen');
const orderInterface = document.getElementById('order-interface');
const menuGrid = document.getElementById('menu-grid');
const cartItemsList = document.getElementById('cart-items-list');
const cartEmpty = document.getElementById('cart-empty');
const cartTotal = document.getElementById('cart-total');
const orderForm = document.getElementById('order-form');
const confirmOrderBtn = document.getElementById('confirm-order-btn');
const orderMessage = document.getElementById('order-message');
const orderFormContainer = document.getElementById('order-form-container');
const orderSuccess = document.getElementById('order-success');
const orderIdDisplay = document.getElementById('order-id');

// --- Collections Cibles ---
const stockCollectionPath = `/artifacts/${appId}/public/data/ingredients`;
const menuCollectionPath = `/artifacts/${appId}/public/data/menu`;
const ordersCollectionPath = `/artifacts/${appId}/public/data/orders`;

// --- Authentification Anonyme ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        console.log("Client anonyme connecté:", userId);
        setupDataListeners();
    } else {
        signInAnonymously(auth).catch((error) => {
            console.error("Erreur de connexion anonyme:", error);
            orderMessage.textContent = "Impossible de se connecter au service.";
        });
    }
});

// --- Chargement des Données en Temps Réel ---
function setupDataListeners() {
    if (!userId) return;

    const stockQuery = query(collection(db, stockCollectionPath));
    onSnapshot(stockQuery, (snapshot) => {
        stockCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Stock mis à jour:", stockCache.length);
        renderMenu();
    });

    const menuQuery = query(collection(db, menuCollectionPath));
    onSnapshot(menuQuery, (snapshot) => {
        menuCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Menu mis à jour:", menuCache.length);
        renderMenu();
        loadingScreen.style.display = 'none';
        orderInterface.style.display = 'grid';
    });
}

// --- Logique d'Affichage ---
function checkStockAvailability(menuItem) {
    if (!menuItem.recipe || menuItem.recipe.length === 0) {
        return true; // Toujours dispo si pas de recette
    }
    for (const recipeItem of menuItem.recipe) {
        const stockItem = stockCache.find(s => s.id === recipeItem.ingredientId);
        if (!stockItem || stockItem.stock < recipeItem.qty) {
            return false;
        }
    }
    return true;
}

function renderMenu() {
    if (menuCache.length === 0 || stockCache.length === 0) return;

    menuGrid.innerHTML = '';
    menuCache.forEach(item => {
        const isAvailable = checkStockAvailability(item);
        const recipeText = item.recipe?.map(ing => stockCache.find(i => i.id === ing.ingredientId)?.name || '').join(', ') || '';

        const card = document.createElement('div');
        card.className = `p-4 bg-white border rounded-lg shadow-sm flex flex-col justify-between ${!isAvailable ? 'opacity-50' : ''}`;
        card.innerHTML = `
            <div>
                <h3 class="font-semibold text-lg">${item.name}</h3>
                <p class="text-sm text-gray-500 mb-2">${recipeText}</p>
            </div>
            <div class="flex justify-between items-center mt-3">
                <span class="font-bold text-gray-800">${item.price.toFixed(2)} €</span>
                <button class="btn btn-sm ${isAvailable ? 'btn-primary' : 'btn-disabled'}" data-id="${item.id}" ${!isAvailable ? 'disabled' : ''}>
                    ${isAvailable ? '<i data-lucide="plus" class="inline-block w-4 h-4"></i> Ajouter' : 'Épuisé'}
                </button>
            </div>
        `;
        menuGrid.appendChild(card);
    });
    lucide.createIcons();
}

function renderCart() {
    cartItemsList.innerHTML = '';
    if (currentCart.length === 0) {
        cartItemsList.appendChild(cartEmpty);
        confirmOrderBtn.disabled = true;
        cartTotal.textContent = "0.00 €";
        return;
    }

    cartEmpty.remove();
    const aggregatedItems = currentCart.reduce((acc, item) => {
        if (!acc[item.id]) {
            acc[item.id] = { ...item, qty: 0 };
        }
        acc[item.id].qty += 1;
        return acc;
    }, {});

    let total = 0;
    Object.values(aggregatedItems).forEach(item => {
        const li = document.createElement('li');
        li.className = "py-3 flex justify-between items-center";
        li.innerHTML = `
            <div>
                <span class="font-medium text-sm">${item.name}</span>
                <span class="text-gray-600 text-sm"> (x${item.qty})</span>
            </div>
            <div class="flex items-center space-x-2">
                <span class="font-semibold text-sm">${(item.price * item.qty).toFixed(2)} €</span>
                <button class="text-red-500 hover:text-red-700" data-action="remove" data-id="${item.id}">
                    <i data-lucide="minus-circle" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        cartItemsList.appendChild(li);
        total += item.price * item.qty;
    });

    cartTotal.textContent = `${total.toFixed(2)} €`;
    confirmOrderBtn.disabled = false;
    lucide.createIcons();
}

// --- Actions du Client ---
menuGrid.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-id]');
    if (button && !button.disabled) {
        const menuItem = menuCache.find(m => m.id === button.dataset.id);
        if (menuItem) {
            currentCart.push({ ...menuItem });
            renderCart();
        }
    }
});

cartItemsList.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action="remove"]');
    if (button) {
        const itemIndex = currentCart.findIndex(item => item.id === button.dataset.id);
        if (itemIndex > -1) {
            currentCart.splice(itemIndex, 1);
        }
        renderCart();
    }
});

// --- Algorithme 1 (Confirmation de Commande avec Transaction) ---
orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentCart.length === 0) return;

    confirmOrderBtn.disabled = true;
    confirmOrderBtn.innerHTML = 'Vérification...';
    orderMessage.textContent = '';

    const clientName = document.getElementById('client-name').value;
    const clientPhone = document.getElementById('client-phone').value;
    const total = currentCart.reduce((sum, item) => sum + item.price, 0);

    try {
        const newOrderId = await runTransaction(db, async (transaction) => {
            // 1. Calculer les déductions de stock nécessaires
            const stockDeductions = new Map();
            for (const cartItem of currentCart) {
                const menuItem = menuCache.find(m => m.id === cartItem.id);
                if (!menuItem || !menuItem.recipe) continue;
                for (const recipeItem of menuItem.recipe) {
                    const currentDeduction = stockDeductions.get(recipeItem.ingredientId) || 0;
                    stockDeductions.set(recipeItem.ingredientId, currentDeduction + recipeItem.qty);
                }
            }

            // 2. Lire le stock *dans* la transaction et vérifier la disponibilité
            const stockRefs = Array.from(stockDeductions.keys()).map(id => doc(db, stockCollectionPath, id));
            const stockDocs = await Promise.all(stockRefs.map(ref => transaction.get(ref)));

            for (let i = 0; i < stockDocs.length; i++) {
                const stockDoc = stockDocs[i];
                const ingredientId = stockDoc.id;
                const qtyToDeduct = stockDeductions.get(ingredientId);

                if (!stockDoc.exists() || stockDoc.data().stock < qtyToDeduct) {
                    throw new Error(`Stock insuffisant pour l'ingrédient: ${ingredientId}`);
                }
            }

            // 3. Si tout est en stock, déduire le stock
            stockDocs.forEach(stockDoc => {
                const ingredientId = stockDoc.id;
                const newStock = stockDoc.data().stock - stockDeductions.get(ingredientId);
                transaction.update(stockDoc.ref, { stock: newStock });
            });

            // 4. Créer la commande
            const newOrderRef = doc(collection(db, ordersCollectionPath));
            transaction.set(newOrderRef, {
                table: `Online-${clientName.split(' ')[0]}`,
                client: { name: clientName, phone: clientPhone },
                items: currentCart,
                total: total,
                status: "En attente",
                type: "Online",
                createdAt: serverTimestamp()
            });

            return newOrderRef.id; // Renvoyer le nouvel ID de commande
        });

        // 5. Transaction réussie -> Afficher le succès
        orderFormContainer.style.display = 'none';
        orderSuccess.style.display = 'block';
        orderIdDisplay.textContent = newOrderId.substring(0, 6).toUpperCase();
        currentCart = [];
        renderCart();
        lucide.createIcons();

    } catch (error) {
        console.error("Erreur de transaction: ", error);
        orderMessage.textContent = "Désolé, un article est en rupture de stock. Le menu a été mis à jour.";
        orderMessage.className = "text-center text-sm mt-3 text-red-600";
        confirmOrderBtn.disabled = false;
        confirmOrderBtn.innerHTML = 'Confirmer la commande';
    }
});
