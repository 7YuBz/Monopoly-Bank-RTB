// script.js

// 1. Firebase Configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyDfBeA7qrEiJT8gXIwjkuVI4ENt1qpNJ88",
    authDomain: "monopoly-bank-145e1.firebaseapp.com",
    projectId: "monopoly-bank-145e1",
    storageBucket: "monopoly-bank-145e1.firebasestorage.app",
    messagingSenderId: "776402836745",
    appId: "1:776402836745:web:afcbd0d24ffcb0b0a047d8",
    databaseURL: "https://monopoly-bank-145e1-default-rtdb.firebaseio.com/" // If using Realtime Database
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database(); // Using Realtime Database

// 2. Google Apps Script Web App URL (Replace with your deployed URL)
const GOOGLE_SHEETS_WEB_APP_URL = "YOUR_APPS_SCRIPT_WEB_APP_URL";

// DOM Elements
const appHeader = document.querySelector('.app-header');
const loggedInUserSpan = document.getElementById('loggedInUser'); // This ID is gone, replaced by playerIdSpan
const playerIdSpan = document.getElementById('playerId');
const playerIdentifierSpan = document.getElementById('playerIdentifier');
const themeToggleBtn = document.getElementById('themeToggleBtn'); // Updated ID
const logoutBtn = document.getElementById('logoutBtn');

const authSection = document.getElementById('authSection');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

const gameSection = document.getElementById('gameSection');
const currentBalanceSpan = document.getElementById('currentBalance');

const transferBtn = document.getElementById('transferBtn');
const bankControlBtn = document.getElementById('bankControlBtn');
const historyBtn = document.getElementById('historyBtn');
const chanceCardBtn = document.getElementById('chanceCardBtn');

const playerListGrid = document.getElementById('playerList');

// History Section Elements (New!)
const historySection = document.getElementById('historySection');
const transactionHistoryDiv = document.getElementById('transactionHistory');
const backToGameBtn = document.getElementById('backToGameBtn');


const resetGameBtn = document.getElementById('resetGameBtn');
const undoBtn = document.getElementById('undoBtn');

// Modals and their elements
const transferModal = document.getElementById('transferModal');
const bankControlModal = document.getElementById('bankControlModal');

const fromPlayerSelect = document.getElementById('fromPlayerSelect');
const toPlayerSelect = document.getElementById('toPlayerSelect');
const transferAmountInput = document.getElementById('transferAmount');
const confirmTransferBtn = document.getElementById('confirmTransferBtn');

const bankPlayerSelect = document.getElementById('bankPlayerSelect');
const bankAmountInput = document.getElementById('bankAmount');
const bankToPlayerBtn = document.getElementById('bankToPlayerBtn');
const playerToBankBtn = document.getElementById('playerToBankBtn');

let currentUser = null;
let playersRef = db.ref('players');
let transactionsRef = db.ref('transactions');
let lastTransaction = null; // For Undo functionality

// --- SweetAlert2 Helper Function ---
function showSweetAlert(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        confirmButtonText: 'ตกลง'
    });
}

// --- Helper Functions for Amount Handling ---

// Helper function to parse amount input (supports 'K' for thousands)
function parseAmountInput(inputString) {
    const cleanedString = String(inputString).trim().toUpperCase(); // Convert to string, trim, and uppercase
    let amount = parseFloat(cleanedString);

    if (isNaN(amount)) {
        return 0; // Return 0 or throw an error if not a valid number
    }

    if (cleanedString.endsWith('K')) {
        amount *= 1000;
    } else if (cleanedString.endsWith('M')) { // Added 'M' for millions
        amount *= 1000000;
    }
    // You can add more units if necessary (e.g., 'B' for billions)

    return Math.floor(amount); // Ensure it's an integer for money
}

// Helper function to format money for display (e.g., 15000000 -> ฿15,000,000)
function formatMoney(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '฿0';
    }
    // Set minimumFractionDigits and maximumFractionDigits to 0 for whole numbers
    return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}


// --- Authentication and UI State Management ---
auth.onAuthStateChanged(user => {
    if (user) {
        // Only show success alert if this is a fresh login, not just initial state check
        if (currentUser === null) {
            showSweetAlert('success', 'เข้าสู่ระบบสำเร็จ!', `ยินดีต้อนรับ ${user.email.split('@')[0]}`);
        }
        currentUser = user;
        playerIdSpan.textContent = user.email.split('@')[0]; // Display username from email
        playerIdentifierSpan.style.display = 'inline';
        authSection.style.display = 'none';
        gameSection.style.display = 'flex'; // Show game section
        historySection.style.display = 'none'; // Ensure history section is hidden initially
        logoutBtn.style.display = 'inline-block';
        initializeGame();
    } else {
        currentUser = null;
        playerIdSpan.textContent = '';
        playerIdentifierSpan.style.display = 'none';
        authSection.style.display = 'flex';
        gameSection.style.display = 'none';
        historySection.style.display = 'none'; // Ensure history section is hidden when logged out
        logoutBtn.style.display = 'none';
    }
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showSweetAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        return;
    }
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            showSweetAlert('error', 'เข้าสู่ระบบไม่สำเร็จ', error.message);
        });
});

registerBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showSweetAlert('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        return;
    }
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const user = userCredential.user;
            const defaultBalance = 15000000; // ตั้งค่าเริ่มต้น 15,000,000
            playersRef.child(user.uid).set({
                email: user.email,
                balance: defaultBalance,
                displayName: user.email.split('@')[0] // Simple display name from email
            }).then(() => {
                showSweetAlert('success', 'ลงทะเบียนสำเร็จ!', `ยินดีต้อนรับ ${user.email.split('@')[0]}`);
            }).catch(error => {
                console.error("Error creating player profile:", error);
                showSweetAlert('error', 'สร้างโปรไฟล์ผู้เล่นไม่สำเร็จ', `ลงทะเบียนสำเร็จ แต่สร้างโปรไฟล์ผู้เล่นไม่สำเร็จ: ${error.message}`);
            });
        })
        .catch(error => {
            showSweetAlert('error', 'ลงทะเบียนไม่สำเร็จ', error.message);
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// --- Theme Toggle ---
themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
});

// --- Game Logic ---
function initializeGame() {
    listenToPlayers();
    listenToTransactions();
}

function listenToPlayers() {
    playersRef.on('value', (snapshot) => {
        const players = snapshot.val();
        renderPlayerBalances(players);
        populatePlayerSelects(players); // Populate selects for modals
    });
}

function renderPlayerBalances(players) {
    playerListGrid.innerHTML = ''; // Clear existing player cards
    if (!players) return;

    const playerList = Object.keys(players).map(uid => ({ uid, ...players[uid] }));
    playerList.sort((a, b) => a.displayName.localeCompare(b.displayName)); // Sort alphabetically

    playerList.forEach(player => {
        if (currentUser && player.uid === currentUser.uid) {
            // Update current user's balance card
            currentBalanceSpan.textContent = formatMoney(player.balance);
        } else {
            // Render other players
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = `
                <h3>${player.displayName}</h3>
                <p>${formatMoney(player.balance)}</p>
            `;
            playerListGrid.appendChild(playerCard);
        }
    });
}

function populatePlayerSelects(players) {
    // Clear existing options
    bankPlayerSelect.innerHTML = '<option value="">เลือกผู้เล่น</option>';
    fromPlayerSelect.innerHTML = ''; // From player will be current user, so no 'เลือกผู้โอน'
    toPlayerSelect.innerHTML = '<option value="">เลือกผู้รับ</option>';

    if (!players) return;

    const playerList = Object.keys(players).map(uid => ({ uid, ...players[uid] }));
    playerList.sort((a, b) => a.displayName.localeCompare(b.displayName));

    playerList.forEach(player => {
        // For Bank Control and To Player Select
        const optionBank = document.createElement('option');
        optionBank.value = player.uid;
        optionBank.textContent = player.displayName;
        bankPlayerSelect.appendChild(optionBank);

        const optionTo = document.createElement('option');
        optionTo.value = player.uid;
        optionTo.textContent = player.displayName;
        toPlayerSelect.appendChild(optionTo);

        // For From Player (current user only, disabled)
        if (currentUser && player.uid === currentUser.uid) {
            const optionFrom = document.createElement('option');
            optionFrom.value = player.uid;
            optionFrom.textContent = player.displayName + " (คุณ)";
            fromPlayerSelect.appendChild(optionFrom);
            fromPlayerSelect.value = player.uid; // Set default selected
        }
    });
}

function listenToTransactions() {
    // Clear history display first to prevent duplicates on re-listen
    transactionHistoryDiv.innerHTML = '<p class="no-transactions-message">ยังไม่มีการทำรายการ</p>';

    // Listen for new transactions, limit to last 100 for display (can adjust)
    transactionsRef.limitToLast(100).on('child_added', (snapshot) => {
        const transaction = snapshot.val();
        // Ensure the "no transactions" message is removed if transactions exist
        const noTransactionsMessage = transactionHistoryDiv.querySelector('.no-transactions-message');
        if (noTransactionsMessage) {
            noTransactionsMessage.remove();
        }
        addTransactionToLog(transaction);

        // Basic notification for money received
        if (currentUser && transaction.toPlayerId === currentUser.uid && transaction.type !== 'PlayerToBank') {
            const fromDisplayName = transaction.fromPlayerName || 'ธนาคาร';
            showSweetAlert('info', 'ได้รับเงิน!', `คุณได้รับเงิน ${formatMoney(transaction.amount)} จาก ${fromDisplayName}!`);
        }
    });

    // Listen for removed transactions (e.g., from undo)
    transactionsRef.on('child_removed', (snapshot) => {
        const removedKey = snapshot.key;
        const logEntryToRemove = transactionHistoryDiv.querySelector(`[data-transaction-key="${removedKey}"]`);
        if (logEntryToRemove) {
            logEntryToRemove.remove();
            showSweetAlert('info', 'ธุรกรรมถูกย้อนกลับ', 'ธุรกรรมถูกย้อนกลับแล้ว!');
        }
        // If all transactions are removed, show the "no transactions" message again
        if (transactionHistoryDiv.children.length === 0) {
            transactionHistoryDiv.innerHTML = '<p class="no-transactions-message">ยังไม่มีการทำรายการ</p>';
        }
    });
}

function addTransactionToLog(transaction) {
    const transactionDiv = document.createElement('div');
    const timestamp = new Date(transaction.timestamp).toLocaleTimeString('th-TH'); // Use 'th-TH' locale
    let description = '';
    switch (transaction.type) {
        case 'Transfer':
            description = `[${timestamp}] ${transaction.fromPlayerName} โอน ${formatMoney(transaction.amount)} ให้ ${transaction.toPlayerName}`;
            break;
        case 'BankToPlayer':
            description = `[${timestamp}] ธนาคารโอน ${formatMoney(transaction.amount)} ให้ ${transaction.toPlayerName}`;
            break;
        case 'PlayerToBank':
            description = `[${timestamp}] ${transaction.fromPlayerName} จ่าย ${formatMoney(transaction.amount)} ให้ธนาคาร`;
            break;
        case 'Reset':
            description = `[${timestamp}] เกมถูกรีเซ็ตโดย ${transaction.initiatorName}`;
            break;
        default:
            description = `[${timestamp}] ${transaction.description || 'ธุรกรรมไม่ทราบประเภท'}`;
    }
    transactionDiv.textContent = description;
    transactionDiv.setAttribute('data-transaction-key', transaction.key || ''); // Store key for undo UI removal
    // Add to top of the log for newest first
    if (transactionHistoryDiv.firstChild && transactionHistoryDiv.firstChild.classList.contains('no-transactions-message')) {
        // If the first child is the "no transactions" message, replace it
        transactionHistoryDiv.innerHTML = '';
        transactionHistoryDiv.appendChild(transactionDiv);
    } else if (transactionHistoryDiv.firstChild) {
        transactionHistoryDiv.insertBefore(transactionDiv, transactionHistoryDiv.firstChild);
    } else {
        transactionHistoryDiv.appendChild(transactionDiv);
    }
}

// Helper to log transactions to Firebase and Google Sheets
async function logTransaction(transactionData) {
    // This helper now assumes the transaction is already written to Firebase via update()
    // and focuses only on sending to Google Sheets, or it could be refactored to take a path.
    // For simplicity, we'll assume the key is already generated if needed for sheets.
    sendToGoogleSheets("Transactions", [
        new Date().toLocaleString('th-TH'), // Use local time string for Sheets, specific locale
        transactionData.fromPlayerName || 'N/A',
        transactionData.toPlayerName || 'N/A',
        transactionData.amount, // Send raw amount to Sheets
        transactionData.type,
        transactionData.description || '',
        transactionData.initiatorName || 'N/A',
        transactionData.key // Include key for Sheets if available
    ]);
}

// Helper to send data to Google Sheets
async function sendToGoogleSheets(sheetName, data) {
    if (GOOGLE_SHEETS_WEB_APP_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL" || !GOOGLE_SHEETS_WEB_APP_URL) {
        console.warn("GOOGLE_SHEETS_WEB_APP_URL has not been configured. Skipping Google Sheets logging.");
        return;
    }
    try {
        const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for Apps Script GET/POST
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sheet: sheetName, data: data })
        });
        // Note: With 'no-cors', response.ok will always be false and status will be 0.
        // You'll need to check your Google Apps Script logs to confirm success.
        console.log(`Data sent to Google Sheets (sheet: ${sheetName}). Check Apps Script logs for confirmation.`);
    } catch (error) {
        console.error("Error sending data to Google Sheets:", error);
    }
}


// --- Modal Functionality ---
function openModal(modal) {
    modal.style.display = 'flex';
}

function closeModal(modal) {
    modal.style.display = 'none';
}

// Event listeners for opening modals
transferBtn.addEventListener('click', () => {
    // Ensure the current user is always the 'from' player
    if (currentUser && fromPlayerSelect) {
        fromPlayerSelect.value = currentUser.uid;
    }
    openModal(transferModal);
});
bankControlBtn.addEventListener('click', () => openModal(bankControlModal));

// Event listeners for closing modals
document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', (event) => {
        const modalId = event.target.dataset.modal;
        const modalToClose = document.getElementById(modalId);
        if (modalToClose) {
            closeModal(modalToClose);
        }
    });
});

window.addEventListener('click', (event) => {
    if (event.target === transferModal) {
        closeModal(transferModal);
    }
    if (event.target === bankControlModal) {
        closeModal(bankControlModal);
    }
});

// --- History Section Toggle (New!) ---
historyBtn.addEventListener('click', () => {
    gameSection.style.display = 'none';
    historySection.style.display = 'flex';
});

backToGameBtn.addEventListener('click', () => {
    historySection.style.display = 'none';
    gameSection.style.display = 'flex';
});

// --- Transaction Functions ---

// Transfer money between players
confirmTransferBtn.addEventListener('click', async () => {
    const fromPlayerId = fromPlayerSelect.value;
    const toPlayerId = toPlayerSelect.value;
    const amount = parseAmountInput(transferAmountInput.value);

    if (!fromPlayerId || !toPlayerId || amount <= 0) {
        showSweetAlert('warning', 'ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกผู้โอน, ผู้รับ และระบุจำนวนเงินที่ถูกต้อง');
        return;
    }
    if (fromPlayerId === toPlayerId) {
        showSweetAlert('warning', 'ทำรายการไม่สำเร็จ', 'ไม่สามารถโอนเงินให้ตัวเองได้');
        return;
    }
    if (!currentUser || currentUser.uid !== fromPlayerId) {
        showSweetAlert('error', 'สิทธิ์ไม่ถูกต้อง', 'คุณไม่มีสิทธิ์ในการทำรายการนี้');
        return;
    }

    try {
        const fromPlayerSnap = await playersRef.child(fromPlayerId).once('value');
        const toPlayerSnap = await playersRef.child(toPlayerId).once('value');

        const fromPlayer = fromPlayerSnap.val();
        const toPlayer = toPlayerSnap.val();

        if (!fromPlayer || !toPlayer) {
            showSweetAlert('error', 'ไม่พบผู้เล่น', 'ไม่พบข้อมูลผู้เล่นที่เกี่ยวข้อง');
            return;
        }
        if (fromPlayer.balance < amount) {
            showSweetAlert('error', 'ยอดเงินไม่พอ', `${fromPlayer.displayName} มีเงินไม่พอโอน: ${formatMoney(fromPlayer.balance)}`);
            return;
        }

        const newTransactionRef = transactionsRef.push();
        const transactionKey = newTransactionRef.key;

        const updates = {};
        updates[`players/${fromPlayerId}/balance`] = fromPlayer.balance - amount;
        updates[`players/${toPlayerId}/balance`] = toPlayer.balance + amount;

        const transactionData = {
            type: 'Transfer',
            fromPlayerId: fromPlayerId,
            fromPlayerName: fromPlayer.displayName,
            toPlayerId: toPlayerId,
            toPlayerName: toPlayer.displayName,
            amount: amount,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            key: transactionKey
        };
        updates[`transactions/${transactionKey}`] = transactionData;

        await db.ref().update(updates); // Atomic multi-path update

        lastTransaction = { key: transactionKey, data: transactionData }; // Store for undo

        showSweetAlert('success', 'โอนเงินสำเร็จ!', `โอนเงิน ${formatMoney(amount)} จาก ${fromPlayer.displayName} ไปยัง ${toPlayer.displayName} สำเร็จแล้ว`);
        closeModal(transferModal);
        transferAmountInput.value = ''; // Clear input

        // Send to Google Sheets
        logTransaction(transactionData); // Use the helper, it handles Sheets now

    } catch (error) {
        console.error("Error during transfer:", error);
        showSweetAlert('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโอนเงิน: ' + error.message);
    }
});

// Bank gives money to player
bankToPlayerBtn.addEventListener('click', async () => {
    const playerId = bankPlayerSelect.value;
    const amount = parseAmountInput(bankAmountInput.value);

    if (!playerId || amount <= 0) {
        showSweetAlert('warning', 'ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกผู้เล่นและระบุจำนวนเงินที่ถูกต้อง');
        return;
    }

    try {
        const playerSnap = await playersRef.child(playerId).once('value');
        const player = playerSnap.val();

        if (!player) {
            showSweetAlert('error', 'ไม่พบผู้เล่น', 'ไม่พบข้อมูลผู้เล่นที่เลือก');
            return;
        }

        const newTransactionRef = transactionsRef.push();
        const transactionKey = newTransactionRef.key;

        const updates = {};
        updates[`players/${playerId}/balance`] = player.balance + amount;

        const transactionData = {
            type: 'BankToPlayer',
            fromPlayerId: 'Bank',
            fromPlayerName: 'ธนาคาร',
            toPlayerId: playerId,
            toPlayerName: player.displayName,
            amount: amount,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            key: transactionKey,
            initiatorName: currentUser ? currentUser.email.split('@')[0] : 'N/A' // Add initiator
        };
        updates[`transactions/${transactionKey}`] = transactionData;

        await db.ref().update(updates); // Atomic multi-path update

        lastTransaction = { key: transactionKey, data: transactionData };

        showSweetAlert('success', 'โอนเงินสำเร็จ!', `ธนาคารโอนเงิน ${formatMoney(amount)} ให้ ${player.displayName} สำเร็จแล้ว`);
        closeModal(bankControlModal);
        bankAmountInput.value = '';
        bankPlayerSelect.value = '';

        logTransaction(transactionData);

    } catch (error) {
        console.error("Error Bank to Player:", error);
        showSweetAlert('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโอนเงินจากธนาคาร: ' + error.message);
    }
});

// Player pays money to Bank
playerToBankBtn.addEventListener('click', async () => {
    const playerId = bankPlayerSelect.value;
    const amount = parseAmountInput(bankAmountInput.value);

    if (!playerId || amount <= 0) {
        showSweetAlert('warning', 'ข้อมูลไม่ถูกต้อง', 'กรุณาเลือกผู้เล่นและระบุจำนวนเงินที่ถูกต้อง');
        return;
    }

    try {
        const playerSnap = await playersRef.child(playerId).once('value');
        const player = playerSnap.val();

        if (!player) {
            showSweetAlert('error', 'ไม่พบผู้เล่น', 'ไม่พบข้อมูลผู้เล่นที่เลือก');
            return;
        }
        if (player.balance < amount) {
            showSweetAlert('error', 'ยอดเงินไม่พอ', `${player.displayName} มีเงินไม่พอจ่ายธนาคาร: ${formatMoney(player.balance)}`);
            return;
        }

        const newTransactionRef = transactionsRef.push();
        const transactionKey = newTransactionRef.key;

        const updates = {};
        updates[`players/${playerId}/balance`] = player.balance - amount;

        const transactionData = {
            type: 'PlayerToBank',
            fromPlayerId: playerId,
            fromPlayerName: player.displayName,
            toPlayerId: 'Bank',
            toPlayerName: 'ธนาคาร',
            amount: amount,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            key: transactionKey,
            initiatorName: currentUser ? currentUser.email.split('@')[0] : 'N/A' // Add initiator
        };
        updates[`transactions/${transactionKey}`] = transactionData;

        await db.ref().update(updates); // Atomic multi-path update

        lastTransaction = { key: transactionKey, data: transactionData };

        showSweetAlert('success', 'ทำรายการสำเร็จ!', `${player.displayName} จ่ายเงิน ${formatMoney(amount)} ให้ธนาคารสำเร็จแล้ว`);
        closeModal(bankControlModal);
        bankAmountInput.value = '';
        bankPlayerSelect.value = '';

        logTransaction(transactionData);

    } catch (error) {
        console.error("Error Player to Bank:", error);
        showSweetAlert('error', 'เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการจ่ายเงินให้ธนาคาร: ' + error.message);
    }
});

// Chance Card - WIP
chanceCardBtn.addEventListener('click', () => {
    showSweetAlert('info', 'ฟีเจอร์กำลังพัฒนา', 'การ์ดโอกาสยังอยู่ระหว่างการพัฒนา!');
});

// Undo Last Transaction
undoBtn.addEventListener('click', async () => {
    if (!lastTransaction) {
        showSweetAlert('info', 'ไม่พบรายการ', 'ไม่พบรายการล่าสุดที่สามารถย้อนกลับได้');
        return;
    }

    const transactionToUndo = lastTransaction.data;
    const transactionKey = lastTransaction.key;

    const { isConfirmed } = await Swal.fire({
        title: 'คุณแน่ใจหรือไม่?',
        text: `คุณต้องการย้อนกลับรายการ: ${transactionToUndo.description || 'ไม่ระบุคำอธิบาย'}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ใช่, ย้อนกลับ!',
        cancelButtonText: 'ยกเลิก'
    });

    if (!isConfirmed) {
        return;
    }

    try {
        const updates = {};

        // Fetch current balances to ensure they exist before modification
        let fromPlayerBalance = 0;
        let toPlayerBalance = 0;

        if (transactionToUndo.fromPlayerId && transactionToUndo.fromPlayerId !== 'Bank') {
            const snap = await playersRef.child(transactionToUndo.fromPlayerId).once('value');
            fromPlayerBalance = snap.val() ? snap.val().balance : 0;
        }
        if (transactionToUndo.toPlayerId && transactionToUndo.toPlayerId !== 'Bank') {
            const snap = await playersRef.child(transactionToUndo.toPlayerId).once('value');
            toPlayerBalance = snap.val() ? snap.val().balance : 0;
        }

        switch (transactionToUndo.type) {
            case 'Transfer':
                updates[`players/${transactionToUndo.fromPlayerId}/balance`] = fromPlayerBalance + transactionToUndo.amount; // Give back to sender
                updates[`players/${transactionToUndo.toPlayerId}/balance`] = toPlayerBalance - transactionToUndo.amount; // Take back from receiver
                break;
            case 'BankToPlayer':
                updates[`players/${transactionToUndo.toPlayerId}/balance`] = toPlayerBalance - transactionToUndo.amount; // Take back from player
                break;
            case 'PlayerToBank':
                updates[`players/${transactionToUndo.fromPlayerId}/balance`] = fromPlayerBalance + transactionToUndo.amount; // Give back to player
                break;
            case 'Reset':
                // Reset cannot be undone in this specific way without complex history
                showSweetAlert('warning', 'ไม่สามารถย้อนกลับได้', 'ไม่สามารถย้อนกลับการรีเซ็ตเกมได้');
                return;
            default:
                showSweetAlert('error', 'ไม่สามารถย้อนกลับได้', 'ไม่สามารถย้อนกลับธุรกรรมประเภทนี้ได้');
                return;
        }

        updates[`transactions/${transactionKey}`] = null; // Remove the transaction record

        await db.ref().update(updates); // Atomic multi-path update for undo

        // Log the undo action to Google Sheets
        sendToGoogleSheets("Transactions", [
            new Date().toLocaleString('th-TH'),
            'System', 'System', transactionToUndo.amount, 'Undo',
            `ย้อนกลับรายการ [${transactionToUndo.type}]: ${transactionToUndo.description || ''}`,
            currentUser ? currentUser.email.split('@')[0] : 'Guest',
            transactionKey
        ]);

        lastTransaction = null; // Clear last transaction after undo
        showSweetAlert('success', 'ย้อนกลับสำเร็จ!', 'รายการถูกย้อนกลับเรียบร้อยแล้ว');
    } catch (error) {
        console.error("Error undoing transaction:", error);
        showSweetAlert('error', 'ย้อนกลับไม่สำเร็จ', 'เกิดข้อผิดพลาดในการย้อนกลับ: ' + error.message);
    }
});

// Reset Game
resetGameBtn.addEventListener('click', async () => {
    const { isConfirmed } = await Swal.fire({
        title: 'คุณแน่ใจหรือไม่?',
        text: 'คุณแน่ใจหรือไม่ที่ต้องการรีเซ็ตเกม? ยอดเงินผู้เล่นทั้งหมดจะถูกตั้งค่าเริ่มต้นและประวัติจะถูกล้าง!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, รีเซ็ตเกม!',
        cancelButtonText: 'ยกเลิก'
    });

    if (!isConfirmed) {
        return;
    }

    try {
        // 1. Fetch all players to reset their balances
        const playersSnapshot = await playersRef.once('value');
        const players = playersSnapshot.val();
        const playerUpdates = {};
        if (players) {
            Object.keys(players).forEach(uid => {
                playerUpdates[`${uid}/balance`] = 15000000; // ตั้งค่าเริ่มต้นเป็น 15,000,000 บาท
            });
            await playersRef.update(playerUpdates); // Update players balances
        }

        // 2. Clear all transactions
        await transactionsRef.remove();
        transactionHistoryDiv.innerHTML = '<p class="no-transactions-message">ยังไม่มีการทำรายการ</p>'; // Clear UI history immediately

        // 3. Generate a key for the reset transaction and add it
        const newTransactionRef = transactionsRef.push();
        const transactionKey = newTransactionRef.key;
        const resetTransactionData = {
            type: 'Reset',
            description: 'เกมถูกรีเซ็ต',
            initiatorId: currentUser ? currentUser.uid : 'N/A',
            initiatorName: currentUser ? currentUser.email.split('@')[0] : 'Guest',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            key: transactionKey
        };
        await newTransactionRef.set(resetTransactionData); // Add the reset log

        // Log the reset event to Google Sheets
        sendToGoogleSheets("Transactions", [
            new Date().toLocaleString('th-TH'),
            'System', 'System', 0, 'Reset', 'All balances reset and history cleared',
            resetTransactionData.initiatorName,
            resetTransactionData.key
        ]);

        showSweetAlert('success', 'รีเซ็ตเกมสำเร็จ!', 'ยอดเงินผู้เล่นถูกตั้งค่าเริ่มต้นและประวัติถูกล้างแล้ว');
        lastTransaction = null; // Clear last transaction

    } catch (error) {
        console.error("Error resetting game:", error);
        showSweetAlert('error', 'รีเซ็ตไม่สำเร็จ', 'เกิดข้อผิดพลาดในการรีเซ็ตเกม: ' + error.message);
    }
});