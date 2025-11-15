import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    getDoc
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
    console.log("Firebase Admin initialisé.");
} catch (e) {
    console.error("Erreur d'initialisation de Firebase:", e);
    document.body.innerHTML = "<p>Erreur critique: Impossible d'initialiser la base de données.</p>";
}

// --- Cache et État ---
let ingredientsCache = [];
let currentRecipe = []; // Recette en cours de construction

// --- Éléments DOM ---
const loginScreen = document.getElementById('login-screen');
const adminDashboard = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmail = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const stockForm = document.getElementById('stock-form');
const stockList = document.getElementById('stock-list');
const menuForm = document.getElementById('menu-form');
const menuList = document.getElementById('menu-list');
const recipeIngredientSelect = document.getElementById('recipe-ingredient');
const addToRecipeBtn = document.getElementById('add-to-recipe-btn');
const currentRecipeList = document.getElementById('current-recipe-list');
const clearMenuFormBtn = document.getElementById('clear-menu-form-btn');
const ordersList = document.getElementById('orders-list');
const tabLinks = document.querySelectorAll('.tab-link');
const tabContents = document.querySelectorAll('.tab-content');

// --- Collections Cibles ---
const stockCollectionPath = `/artifacts/${appId}/public/data/ingredients`;
const menuCollectionPath = `/artifacts/${appId}/public/data/menu`;
const ordersCollectionPath = `/artifacts/${appId}/public/data/orders`;

// --- Gestion de l'Authentification ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        userEmail.textContent = user.email;
        loginScreen.style.display = 'none';
        adminDashboard.style.display = 'block';
        setupDataListeners();
    } else {
        userId = null;
        loginScreen.style.display = 'block';
        adminDashboard.style.display = 'none';
    }
    lucide.createIcons();
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = "Email ou mot de passe incorrect.";
        console.error("Erreur de connexion:", error);
    }
});

logoutButton.addEventListener('click', () => signOut(auth));

// --- Navigation par Onglets ---
tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.dataset.tab;

        tabLinks.forEach(l => l.classList.remove('tab-active'));
        link.classList.add('tab-active');

        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
        lucide.createIcons();
    });
});

// --- Gestion des Données en Temps Réel ---
function setupDataListeners() {
    if (!userId) return;

    // Écouteur pour le STOCK
    onSnapshot(query(collection(db, stockCollectionPath)), (snapshot) => {
        ingredientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStockList();
        updateRecipeIngredientSelect();
    });

    // Écouteur pour le MENU
    onSnapshot(query(collection(db, menuCollectionPath)), (snapshot) => {
        const menuItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMenuList(menuItems);
    });

    // Écouteur pour les COMMANDES
    onSnapshot(query(collection(db, ordersCollectionPath)), (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrdersList(orders);
    });
}

// --- Fonctions de Rendu ---
function renderStockList() {
    stockList.innerHTML = '';
    ingredientsCache.forEach(ing => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${ing.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${ing.stock}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${ing.unit}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-red-600 hover:text-red-900" data-id="${ing.id}" data-action="delete-stock">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        stockList.appendChild(tr);
    });
    lucide.createIcons();
}

function updateRecipeIngredientSelect() {
    recipeIngredientSelect.innerHTML = '<option value="">Choisir...</option>';
    ingredientsCache.forEach(ing => {
        const option = document.createElement('option');
        option.value = ing.id;
        option.textContent = `${ing.name} (${ing.unit})`;
        recipeIngredientSelect.appendChild(option);
    });
}

function renderMenuList(menuItems) {
    menuList.innerHTML = '';
    menuItems.forEach(item => {
        const recipeText = item.recipe?.map(ing => {
            const cached = ingredientsCache.find(i => i.id === ing.ingredientId);
            return `${ing.qty} ${cached?.unit || ''} ${cached?.name || 'Inconnu'}`;
        }).join(', ') || 'N/A';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.price.toFixed(2)} €</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-xs">${recipeText}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button class="text-blue-600 hover:text-blue-900" data-id="${item.id}" data-action="edit-menu">
                    <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
                <button class="text-red-600 hover:text-red-900" data-id="${item.id}" data-action="delete-menu">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        menuList.appendChild(tr);
    });
    lucide.createIcons();
}

function renderOrdersList(orders) {
    ordersList.innerHTML = '';
    if (orders.length === 0) {
        ordersList.innerHTML = '<p class="text-gray-500">Aucune commande active pour le moment.</p>';
        return;
    }
    orders.forEach(order => {
        const itemsText = order.items.map(i => `${i.name} (x1)`).join(', ');
        const orderDiv = document.createElement('div');
        orderDiv.className = "p-4 border rounded-md bg-gray-50";
        orderDiv.innerHTML = `
            <p class="font-semibold">${order.table} - ${order.status}</p>
            <p class="text-sm text-gray-700">${itemsText}</p>
            <p class="text-xs text-gray-500 mt-1">Total: ${order.total.toFixed(2)} €</p>
        `;
        ordersList.appendChild(orderDiv);
    });
}

// --- Actions CRUD (Formulaires) ---
stockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('stock-name').value;
    const unit = document.getElementById('stock-unit').value;
    const stock = parseFloat(document.getElementById('stock-level').value);
    try {
        await addDoc(collection(db, stockCollectionPath), { name, unit, stock });
        stockForm.reset();
    } catch (error) {
        console.error("Erreur ajout ingrédient:", error);
    }
});

// Constructeur de Recette
addToRecipeBtn.addEventListener('click', () => {
    const ingredientId = recipeIngredientSelect.value;
    const qty = parseFloat(document.getElementById('recipe-qty').value);
    if (!ingredientId || !qty || qty <= 0) {
        alert("Veuillez sélectionner un ingrédient et une quantité valide.");
        return;
    }
    currentRecipe.push({ ingredientId, qty });
    renderCurrentRecipe();
    recipeIngredientSelect.value = '';
    document.getElementById('recipe-qty').value = '';
});

function renderCurrentRecipe() {
    currentRecipeList.innerHTML = '';
    currentRecipe.forEach((item, index) => {
        const ingredient = ingredientsCache.find(i => i.id === item.ingredientId);
        const li = document.createElement('li');
        li.className = "flex justify-between items-center text-sm bg-white p-1 rounded";
        li.innerHTML = `
            <span>${item.qty} ${ingredient?.unit || ''} - ${ingredient?.name || 'Inconnu'}</span>
            <button type="button" class="text-red-500" data-index="${index}" data-action="remove-recipe-item">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;
        currentRecipeList.appendChild(li);
    });
    lucide.createIcons();
}

currentRecipeList.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action="remove-recipe-item"]');
    if (button) {
        currentRecipe.splice(parseInt(button.dataset.index), 1);
        renderCurrentRecipe();
    }
});

// Ajout/Mise à jour de Plat
menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('menu-item-id').value;
    const name = document.getElementById('menu-name').value;
    const price = parseFloat(document.getElementById('menu-price').value);
    if (currentRecipe.length === 0) {
        alert("Veuillez ajouter au moins un ingrédient à la recette.");
        return;
    }
    const menuItem = { name, price, recipe: currentRecipe };
    try {
        if (id) {
            await setDoc(doc(db, menuCollectionPath, id), menuItem);
        } else {
            await addDoc(collection(db, menuCollectionPath), menuItem);
        }
        clearMenuForm();
    } catch (error) {
        console.error("Erreur sauvegarde plat:", error);
    }
});

clearMenuFormBtn.addEventListener('click', clearMenuForm);

function clearMenuForm() {
    menuForm.reset();
    document.getElementById('menu-item-id').value = '';
    currentRecipe = [];
    renderCurrentRecipe();
}

// --- Actions sur les listes (Delete/Edit) ---
stockList.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-action="delete-stock"]');
    if (button && confirm("Voulez-vous vraiment supprimer cet ingrédient ?")) {
        await deleteDoc(doc(db, stockCollectionPath, button.dataset.id));
    }
});

menuList.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-action="delete-menu"]');
    if (delBtn && confirm("Voulez-vous vraiment supprimer ce plat ?")) {
        await deleteDoc(doc(db, menuCollectionPath, delBtn.dataset.id));
    }

    const editBtn = e.target.closest('[data-action="edit-menu"]');
    if (editBtn) {
        const docSnap = await getDoc(doc(db, menuCollectionPath, editBtn.dataset.id));
        if (docSnap.exists()) {
            const item = docSnap.data();
            document.getElementById('menu-item-id').value = docSnap.id;
            document.getElementById('menu-name').value = item.name;
            document.getElementById('menu-price').value = item.price;
            currentRecipe = [...item.recipe];
            renderCurrentRecipe();
            window.scrollTo(0, 0);
        }
    }
});
