# Resto-Opulence - Blueprint

## Overview

Resto-Opulence is a comprehensive restaurant management solution built as a modern, framework-less web application. It leverages Firebase for its backend services, including authentication and a real-time database with Firestore. The project is divided into three distinct interfaces:

1.  **Public Ordering Site (`public.html`):** A customer-facing portal where users can view the menu, see real-time item availability based on stock, and place orders for takeout.
2.  **Point of Sale (POS) Interface (`pos.html`):** A tablet-friendly interface for servers to manage tables, take orders, send them to the kitchen, and process payments.
3.  **Admin Back-Office (`admin.html`):** A central dashboard for restaurant managers to control the entire system. This includes managing menu items, creating complex recipes, and tracking inventory in real-time.

The application is built using modern web standards (HTML, CSS, JavaScript with ES Modules) and is designed to be highly interactive and resilient.

## Style, Design, and Features

### Core Architecture
- **Backend:** Firebase (Authentication, Firestore)
- **Frontend:** Vanilla JavaScript (ES Modules), HTML, TailwindCSS
- **Database:** Firestore is used for storing menu items, ingredients (stock), and orders.
- **Real-time Updates:** The application heavily uses Firestore's `onSnapshot` to ensure all interfaces (Admin, POS, Public) reflect the current state of the menu, stock, and orders in real-time. For example, if an admin updates the stock, the public menu and POS interface will instantly reflect which items are available or sold out.
- **Authentication:**
    - **Admin/POS:** Email & Password authentication for staff.
    - **Public:** Anonymous authentication for a seamless customer experience.

### Visual Design ("Opulence")
- **Typography:** Use of the "Inter" font family, with a strong hierarchy to guide the user's eye.
- **Color Palette:** A modern and clean palette using shades of gray, with a vibrant blue for primary actions and accents. Green is used for success states (confirming orders) and red for destructive actions.
- **UI Components:** Clean, card-based layouts with subtle drop shadows to create a sense of depth. Icons from the Lucide library are used to enhance clarity and visual appeal.
- **Responsiveness:** All interfaces are designed to be fully responsive, from mobile phones to large desktop screens.

### Key Features
#### Public Ordering (`public.html`)
- **Dynamic Menu:** Displays menu items fetched from Firestore.
- **Real-time Stock Check:** Items are automatically marked as "Épuisé" (Sold Out) if any ingredient in their recipe is out of stock. This check happens in real-time.
- **Shopping Cart:** A fully functional cart to add or remove items.
- **Atomic Ordering:** When a customer confirms an order, the application uses a **Firestore Transaction** to:
    1. Create the order document.
    2. Atomically deduct the required ingredients from the stock.
    This prevents race conditions and ensures stock levels are always accurate.
- **Order Confirmation:** Displays a success message with a unique order ID.

#### POS System (`pos.html`)
- **Table Management:** Servers can select a table to manage its order.
- **Order Taking:** An interactive menu grid allows servers to quickly add items to the current table's ticket.
- **Kitchen Communication:** Orders can be sent to the kitchen, which creates or updates an order document with an "En attente" (Pending) status.
- **Atomic Payment & Stock Deduction:** When a server cashes out a table, a **Firestore Transaction** is used to:
    1. Mark all the table's orders as "Payée" (Paid).
    2. Atomically deduct the ingredients for all served items from the inventory.

#### Admin Dashboard (`admin.html`)
- **Tabbed Interface:** Easy navigation between Menu, Stock, and Order management.
- **Stock Management (Inventaire):** Full CRUD (Create, Read, Update, Delete) functionality for ingredients, including name, unit, and current stock level.
- **Menu Management (Fiches Recettes):**
    - Full CRUD for menu items (dishes).
    - **Advanced Recipe Builder:** An intuitive interface to create a detailed recipe for each menu item by selecting from the list of available ingredients and specifying quantities. This recipe is the foundation for the automated stock deduction system.
- **Live Order Tracking:** A real-time view of all orders as they are placed from the POS or the public site.

## Current Action Plan

The user requested to make the project functional and update it. The current codebase has a solid foundation but contains a critical vulnerability in its stock management logic and can be improved with modern web development practices.

1.  **Create a Project Blueprint:** Document the application's architecture, features, and the plan for the update in `blueprint.md`.
2.  **Add a Central Navigation Page:** Create an `index.html` file to serve as a welcoming landing page, providing clear navigation to the three main sections of the application (Public, POS, Admin).
3.  **Correct Stock Deduction Algorithm:** The most critical task. The current `writeBatch` method for deducting stock in `public.html` and `pos.html` is prone to race conditions. This will be refactored to use atomic `runTransaction` operations in both files. This guarantees data consistency, ensuring that stock levels are always accurate and items cannot be oversold.
4LAGER
4.  **Modernize Codebase:**
    - **Componentization:** Move the monolithic JavaScript logic from `<script>` tags in each HTML file into separate, more maintainable JavaScript files (`public.js`, `pos.js`, `admin.js`).
    - **Styling:** Consolidate repeating Tailwind/CSS styles into a shared `style.css` file to ensure a consistent look and feel across the application.
5.  **Enhance User Interface:** The visual design will be polished to better match the "Opulence" theme, improving layout, spacing, and user feedback to create a more premium experience.
6.  **Set up Firebase Project:**
    - Add Firebase Hosting.
    - Create a web app to get a valid Firebase configuration.
    - Create a `firebase-config.js` to store and export the configuration, to be imported by the other JS files. This makes the configuration reusable and easy to manage.
    - Configure the MCP server for a better development experience.
