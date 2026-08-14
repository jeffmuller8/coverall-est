// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAGx4VttTUoNZzJMEv4ijvQuPhDqBz2k40",
  authDomain: "coverall-estimator.firebaseapp.com",
  projectId: "coverall-estimator",
  storageBucket: "coverall-estimator.firebasestorage.app",
  messagingSenderId: "666486038639",
  appId: "1:666486038639:web:e1f79bb68f5f88ef5a6d9a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Current user ID
let currentUserId = null;

// Pricing constants
const PRICING = {
  fabric: {
    clear: 2.49, // per yard
    vrn: 4.48    // per yard
  },
  closure: {
    velcro: 0.45,  // per yard
    zipper: 0.59,  // per yard ($118 / 200 yds)
    magnet: 0.30   // each
  },
  zipperPull: 0.18,  // each
  laborRate: 17,     // per hour
  laborTime: 12,     // minutes per cover
  rollWidth: 54,     // inches
  zipperShorter: 1.5 // zipper is 1.5" shorter than height
};

// Calculate labor cost per cover
const LABOR_PER_COVER = (PRICING.laborRate / 60) * PRICING.laborTime;

// DOM elements
const form = document.getElementById('estimator-form');
const resultsSection = document.getElementById('results');
const closureSelect = document.getElementById('closure');
const zipperCountGroup = document.getElementById('zipper-count-group');
const magnetCountGroup = document.getElementById('magnet-count-group');
const saveBtn = document.getElementById('save-btn');
const quotesList = document.getElementById('quotes-list');
const syncStatus = document.getElementById('sync-status');

// Current calculation results (for saving)
let currentResults = null;

// Show/hide closure-specific inputs
closureSelect.addEventListener('change', function() {
  zipperCountGroup.style.display = this.value === 'zipper' ? 'block' : 'none';
  magnetCountGroup.style.display = this.value === 'magnet' ? 'block' : 'none';
});

// Form submission
form.addEventListener('submit', function(e) {
  e.preventDefault();
  calculateEstimate();
});

function calculateEstimate() {
  // Get inputs
  const width = parseFloat(document.getElementById('width').value);
  const depth = parseFloat(document.getElementById('depth').value);
  const height = parseFloat(document.getElementById('height').value);
  const coverType = document.getElementById('cover-type').value;
  const closureType = document.getElementById('closure').value;
  const zipperCount = parseInt(document.getElementById('zipper-count').value) || 2;
  const magnetCount = parseInt(document.getElementById('magnet-count').value) || 4;
  const quantity = parseInt(document.getElementById('quantity').value);
  const marginPercent = parseFloat(document.getElementById('margin').value);

  // Calculate panel areas (in square inches)
  const frontArea = width * height;
  const backArea = width * height;
  const sidesArea = 2 * (depth * height);
  const topArea = width * depth;

  // Determine which panels use which fabric based on cover type
  let clearSqIn = 0;
  let vrnSqIn = 0;

  switch (coverType) {
    case 'all-clear':
      clearSqIn = frontArea + backArea + sidesArea + topArea;
      break;
    case 'clear-vrn-top':
      clearSqIn = frontArea + backArea + sidesArea;
      vrnSqIn = topArea;
      break;
    case 'all-vrn':
      vrnSqIn = frontArea + backArea + sidesArea + topArea;
      break;
    case 'vrn-clear-window':
      clearSqIn = frontArea; // window = clear front
      vrnSqIn = backArea + sidesArea + topArea;
      break;
  }

  // Convert to yards with waste factor
  const sqInPerYard = 36 * PRICING.rollWidth;

  // Add waste factor based on roll width optimization (~35-40% waste typical)
  const wasteFactor = 1.38;

  const clearYards = clearSqIn > 0 ? (clearSqIn / sqInPerYard) * wasteFactor : 0;
  const vrnYards = vrnSqIn > 0 ? (vrnSqIn / sqInPerYard) * wasteFactor : 0;

  // Calculate fabric costs
  const clearCost = clearYards * PRICING.fabric.clear;
  const vrnCost = vrnYards * PRICING.fabric.vrn;

  // Calculate closure cost
  let closureCost = 0;
  const zipperLength = height - PRICING.zipperShorter;

  if (closureType === 'zipper') {
    const totalZipperIn = zipperLength * zipperCount;
    const totalZipperYds = totalZipperIn / 36;
    closureCost = (totalZipperYds * PRICING.closure.zipper) + (zipperCount * PRICING.zipperPull);
  } else if (closureType === 'velcro') {
    const totalVelcroIn = zipperLength * 2;
    const totalVelcroYds = totalVelcroIn / 36;
    closureCost = totalVelcroYds * PRICING.closure.velcro;
  } else if (closureType === 'magnet') {
    closureCost = magnetCount * PRICING.closure.magnet;
  }

  // Calculate totals
  const materialCost = clearCost + vrnCost + closureCost;
  const laborCost = LABOR_PER_COVER;
  const perCoverCost = materialCost + laborCost;

  // Calculate price with margin
  const perCoverPrice = perCoverCost / (1 - marginPercent / 100);

  const totalCost = perCoverCost * quantity;
  const totalPrice = perCoverPrice * quantity;
  const profit = totalPrice - totalCost;

  // Store results for saving
  currentResults = {
    width,
    depth,
    height,
    coverType,
    closureType,
    zipperCount,
    magnetCount,
    marginPercent,
    perCoverCost,
    perCoverPrice
  };

  // Display results
  document.getElementById('clear-fabric').textContent = clearYards > 0
    ? `${clearYards.toFixed(2)} yds = $${clearCost.toFixed(2)}`
    : '-';
  document.getElementById('vrn-fabric').textContent = vrnYards > 0
    ? `${vrnYards.toFixed(2)} yds = $${vrnCost.toFixed(2)}`
    : '-';
  document.getElementById('closure-cost').textContent = `$${closureCost.toFixed(2)}`;
  document.getElementById('labor-cost').textContent = `$${laborCost.toFixed(2)}`;
  document.getElementById('material-total').textContent = `$${materialCost.toFixed(2)}`;
  document.getElementById('per-cover-cost').textContent = `$${perCoverCost.toFixed(2)}`;
  document.getElementById('margin-display').textContent = marginPercent;
  document.getElementById('per-cover-price').textContent = `$${perCoverPrice.toFixed(2)}`;
  document.getElementById('qty-display').textContent = quantity;
  document.getElementById('total-cost').textContent = `$${totalCost.toFixed(2)}`;
  document.getElementById('total-price').textContent = `$${totalPrice.toFixed(2)}`;
  document.getElementById('profit').textContent = `$${profit.toFixed(2)}`;

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Save quote to Firebase
saveBtn.addEventListener('click', async function() {
  const quoteName = document.getElementById('quote-name').value.trim();

  if (!quoteName) {
    alert('Please enter a name for this quote');
    return;
  }

  if (!currentResults) {
    alert('Please calculate an estimate first');
    return;
  }

  syncStatus.textContent = 'Saving...';

  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'quotes'), {
      name: quoteName,
      ...currentResults,
      createdBy: user?.email || 'unknown',
      savedAt: new Date().toISOString()
    });

    document.getElementById('quote-name').value = '';
    syncStatus.textContent = 'Saved!';
    setTimeout(() => { syncStatus.textContent = ''; }, 2000);
  } catch (error) {
    console.error('Error saving quote:', error);
    syncStatus.textContent = 'Error saving';
    alert('Error saving quote. Check console for details.');
  }
});

// Cover type labels
const coverTypeLabels = {
  'all-clear': 'All Clear',
  'clear-vrn-top': 'Clear + VRN Top',
  'all-vrn': 'All VRN',
  'vrn-clear-window': 'VRN + Window'
};

// Render quotes
function renderQuotes(quotes) {
  if (quotes.length === 0) {
    quotesList.innerHTML = '<p class="no-quotes">No saved quotes yet</p>';
    return;
  }

  quotesList.innerHTML = quotes.map(quote => `
    <div class="quote-item" data-id="${quote.id}">
      <div class="quote-info" onclick="window.loadQuote('${quote.id}')">
        <div class="quote-name">${escapeHtml(quote.name)}</div>
        <div class="quote-details">
          ${quote.width}" × ${quote.depth}" × ${quote.height}" · ${coverTypeLabels[quote.coverType] || quote.coverType}
        </div>
      </div>
      <div class="quote-prices" onclick="window.loadQuote('${quote.id}')">
        <div class="quote-cost">Cost: $${quote.perCoverCost.toFixed(2)}</div>
        <div class="quote-price">Price: $${quote.perCoverPrice.toFixed(2)}</div>
      </div>
      <button class="quote-delete" onclick="window.deleteQuote('${quote.id}', event)">Delete</button>
    </div>
  `).join('');
}

// Store quotes for loading
let quotesCache = [];

// Load a saved quote into the form
window.loadQuote = function(id) {
  const quote = quotesCache.find(q => q.id === id);
  if (!quote) return;

  document.getElementById('width').value = quote.width;
  document.getElementById('depth').value = quote.depth;
  document.getElementById('height').value = quote.height;
  document.getElementById('cover-type').value = quote.coverType;
  document.getElementById('closure').value = quote.closureType;
  document.getElementById('zipper-count').value = quote.zipperCount;
  document.getElementById('magnet-count').value = quote.magnetCount;
  document.getElementById('margin').value = quote.marginPercent;

  zipperCountGroup.style.display = quote.closureType === 'zipper' ? 'block' : 'none';
  magnetCountGroup.style.display = quote.closureType === 'magnet' ? 'block' : 'none';

  calculateEstimate();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Delete a quote
window.deleteQuote = async function(id, event) {
  event.stopPropagation();
  if (!confirm('Delete this quote?')) return;

  syncStatus.textContent = 'Deleting...';

  try {
    await deleteDoc(doc(db, 'quotes', id));
    syncStatus.textContent = 'Deleted!';
    setTimeout(() => { syncStatus.textContent = ''; }, 2000);
  } catch (error) {
    console.error('Error deleting quote:', error);
    syncStatus.textContent = 'Error';
    alert('Error deleting quote.');
  }
};

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Unsubscribe function for quotes listener
let unsubscribeQuotes = null;

// Set up quotes listener (shared across all users)
function setupQuotesListener() {
  // Unsubscribe from previous listener if exists
  if (unsubscribeQuotes) {
    unsubscribeQuotes();
  }

  // All authenticated users see all quotes (shared workspace)
  unsubscribeQuotes = onSnapshot(collection(db, 'quotes'), (snapshot) => {
    quotesCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by savedAt descending
    quotesCache.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    renderQuotes(quotesCache);
    syncStatus.textContent = '';
  }, (error) => {
    console.error('Error listening to quotes:', error);
    quotesList.innerHTML = '<p class="no-quotes">Error loading quotes. Check Firebase setup.</p>';
  });
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Auth UI elements
const authSection = document.getElementById('auth-section');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userInfo = document.getElementById('user-info');
const appContent = document.getElementById('app-content');

// Sign in with Google
signInBtn.addEventListener('click', () => {
  signInWithPopup(auth, googleProvider).catch((error) => {
    console.error('Error signing in:', error);
    alert('Error signing in. Please try again.');
  });
});

// Sign out
signOutBtn.addEventListener('click', () => {
  signOut(auth).catch((error) => {
    console.error('Error signing out:', error);
  });
});

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log('Signed in as:', user.email);

    // Show app, hide sign-in
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    userInfo.textContent = user.email;
    userInfo.style.display = 'inline';
    appContent.style.display = 'block';

    setupQuotesListener();
  } else {
    currentUserId = null;

    // Show sign-in, hide app
    signInBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
    userInfo.style.display = 'none';
    appContent.style.display = 'none';
    quotesList.innerHTML = '';
    quotesCache = [];
  }
});
