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
    runTransaction,
    getDocs,
    onSnapshot,
    query,
    where,
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
    console.log("Firebase POS initialisé.");
} catch (e) {
    console.error("Erreur d'initialisation de Firebase:", e);
    document.body.innerHTML = "<p>Erreur critique: Impossible d'initialiser la base de données.</p>";
}

// --- Cache et État ---
let menuCache = [];
let stockCache = [];
let pendingOrders = [];
let currentTable = null;
let currentTicket = []; // Ticket local avant envoi

// --- Éléments DOM ---
const loginScreen = document.getElementById('login-screen');
const posInterface = document.getElementById('pos-interface');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmail = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const tableSelector = document.getElementById('table-selector');
const currentTableDisplay = document.getElementById('current-table-display');
const menuGrid = document.getElementById('menu-grid');
const ticketItemsList = document.getElementById('ticket-items-list');
const ticketTotal = document.getElementById('ticket-total');
const sendToKitchenBtn = document.getElementById('send-to-kitchen-btn');
const payBillBtn = document.getElementById('pay-bill-btn');
const posMessage = document.getElementById('pos-message');

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
        posInterface.style.display = 'block';
        loadMenuAndStock();
    } else {
        userId = null;
        loginScreen.style.display = 'block';
        posInterface.style.display = 'none';
        currentTable = null;
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
        console.error("Erreur de connexion:", error);
        loginError.textContent = "Email ou mot de passe incorrect.";
    }
});

logoutButton.addEventListener('click', () => signOut(auth));

// --- Chargement des Données ---
async function loadMenuAndStock() {
    try {
        const menuSnapshot = await getDocs(query(collection(db, menuCollectionPath)));
        menuCache = menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMenu();
        console.log("Menu chargé:", menuCache.length);

        onSnapshot(query(collection(db, stockCollectionPath)), (snapshot) => {
            stockCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Stock mis à jour:", stockCache.length);
        });
    } catch (e) {
        console.error("Erreur chargement données initiales:", e);
    }
}

// --- Gestion du POS ---
function renderMenu() {
    menuGrid.innerHTML = '';
    menuCache.forEach(item => {
        const button = document.createElement('button');
        button.className = "p-3 bg-gray-50 border rounded-md shadow-sm text-left h-24 flex flex-col justify-between hover:bg-blue-100";
        button.dataset.id = item.id;
        button.innerHTML = `
            <span class="font-semibold text-sm">${item.name}</span>
            <span class="text-gray-700">${item.price.toFixed(2)} €</span>
        `;
        menuGrid.appendChild(button);
    });
}

tableSelector.addEventListener('click', (e) => {
    if (e.target.classList.contains('table-btn')) {
        const tableId = e.target.dataset.table;
        if (tableId === currentTable) return;

        currentTable = tableId;
        currentTableDisplay.textContent = `Table: ${currentTable}`;

        document.querySelectorAll('.table-btn').forEach(btn => btn.classList.remove('table-active'));
        e.target.classList.add('table-active');

        loadPendingOrders(currentTable);
    }
});

let ordersListener = null;
function loadPendingOrders(tableId) {
    if (ordersListener) ordersListener();

    const q = query(
        collection(db, ordersCollectionPath),
        where("table", "==", tableId),
        where("status", "in", ["En attente", "En préparation"])
    );

    ordersListener = onSnapshot(q, (snapshot) => {
        pendingOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentTicket = []; // Reset local ticket
        
        const combinedItems = pendingOrders.flatMap(o => o.items);
        renderTicket(combinedItems, false);

        payBillBtn.disabled = combinedItems.length === 0;
        sendToKitchenBtn.disabled = true;
    });
}

menuGrid.addEventListener('click', (e) => {
    if (!currentTable) {
        alert("Veuillez d'abord sélectionner une table.");
        return;
    }
    const button = e.target.closest('button[data-id]');
    if (button) {
        const menuItem = menuCache.find(m => m.id === button.dataset.id);
        if (menuItem) {
            currentTicket.push({ ...menuItem });
            const allItems = [...pendingOrders.flatMap(o => o.items), ...currentTicket];
            renderTicket(allItems, true);
        }
    }
});

function renderTicket(items, allowEdit) {
    ticketItemsList.innerHTML = '';
    const aggregatedItems = items.reduce((acc, item) => {
        if (!acc[item.id]) {
            acc[item.id] = { ...item, qty: 0 };
        }
        acc[item.id].qty += 1;
        return acc;
    }, {});

    let total = 0;
    Object.values(aggregatedItems).forEach(item => {
        const li = document.createElement('li');
        li.className = "py-2 flex justify-between items-center";
        li.innerHTML = `
            <div>
                <span class="font-medium">${item.name}</span>
                <span class="text-gray-600"> (x${item.qty})</span>
            </div>
            <span class="font-semibold">${(item.price * item.qty).toFixed(2)} €</span>
        `;
        ticketItemsList.appendChild(li);
        total += item.price * item.qty;
    });

    ticketTotal.textContent = `${total.toFixed(2)} €`;
    if (allowEdit) {
        sendToKitchenBtn.disabled = currentTicket.length === 0;
    }
}

// --- Actions (Cuisine, Paiement) ---
sendToKitchenBtn.addEventListener('click', async () => {
    if (currentTicket.length === 0 || !currentTable) return;

    const total = currentTicket.reduce((sum, item) => sum + item.price, 0);

    try {
        await addDoc(collection(db, ordersCollectionPath), {
            table: currentTable,
            items: currentTicket,
            total: total,
            status: "En attente",
            createdAt: serverTimestamp()
        });
        currentTicket = [];
        sendToKitchenBtn.disabled = true;
        showPosMessage("Commande envoyée en cuisine.", "success");
    } catch (error) {
        console.error("Erreur envoi cuisine:", error);
        showPosMessage("Erreur d'envoi.", "error");
    }
});

payBillBtn.addEventListener('click', async () => {
    if (pendingOrders.length === 0 || !currentTable) return;

    showPosMessage("Encaissement en cours...", "info");
    payBillBtn.disabled = true;

    const itemsToPay = pendingOrders.flatMap(order => order.items);

    try {
        await runTransaction(db, async (transaction) => {
            const stockDeductions = new Map();
            for (const item of itemsToPay) {
                const menuItem = menuCache.find(m => m.id === item.id);
                if (!menuItem || !menuItem.recipe) continue;
                for (const recipeItem of menuItem.recipe) {
                    const currentDeduction = stockDeductions.get(recipeItem.ingredientId) || 0;
                    stockDeductions.set(recipeItem.ingredientId, currentDeduction + recipeItem.qty);
                }
            }

            const stockRefs = Array.from(stockDeductions.keys()).map(id => doc(db, stockCollectionPath, id));
            const stockDocs = await Promise.all(stockRefs.map(ref => transaction.get(ref)));

            for (let i = 0; i < stockDocs.length; i++) {
                const stockDoc = stockDocs[i];
                const ingredientId = stockDoc.id;
                const qtyToDeduct = stockDeductions.get(ingredientId);
                if (!stockDoc.exists() || stockDoc.data().stock < qtyToDeduct) {
                    throw new Error(`Stock insuffisant pour: ${ingredientId}`);
                }
            }

            stockDocs.forEach(stockDoc => {
                const ingredientId = stockDoc.id;
                const newStock = stockDoc.data().stock - stockDeductions.get(ingredientId);
                transaction.update(stockDoc.ref, { stock: newStock });
            });

            for (const order of pendingOrders) {
                const orderRef = doc(db, ordersCollectionPath, order.id);
                transaction.update(orderRef, { status: "Payée" });
            }
        });

        showPosMessage("Paiement réussi. Stock déduit.", "success");
        payBillBtn.disabled = false; // Re-enable in case of new orders

    } catch (error) {
        console.error("Erreur lors de l'encaissement:", error);
        showPosMessage(`Échec: ${error.message}`, "error");
        payBillBtn.disabled = false;
    }
});

function showPosMessage(message, type = "success") {
    posMessage.textContent = message;
    posMessage.className = `text-center text-sm mt-2 ${type === 'success' ? 'text-green-600' : (type === 'error' ? 'text-red-600' : 'text-blue-600')}`;
    setTimeout(() => { posMessage.textContent = ''; }, 4000);
}
