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
  // 1 yard of 54" fabric = 36" x 54" = 1944 sq in
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
    // Velcro runs same length as zipper would
    const totalVelcroIn = zipperLength * 2; // assuming 2 strips
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
  // margin% = (price - cost) / price * 100
  // price = cost / (1 - margin/100)
  const perCoverPrice = perCoverCost / (1 - marginPercent / 100);

  const totalCost = perCoverCost * quantity;
  const totalPrice = perCoverPrice * quantity;
  const profit = totalPrice - totalCost;

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

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Save quote
saveBtn.addEventListener('click', function() {
  const quoteName = document.getElementById('quote-name').value.trim();

  if (!quoteName) {
    alert('Please enter a name for this quote');
    return;
  }

  if (!currentResults) {
    alert('Please calculate an estimate first');
    return;
  }

  const quote = {
    id: Date.now(),
    name: quoteName,
    ...currentResults,
    savedAt: new Date().toISOString()
  };

  // Get existing quotes
  const quotes = getQuotes();
  quotes.unshift(quote);
  localStorage.setItem('coverall-quotes', JSON.stringify(quotes));

  // Clear input and refresh list
  document.getElementById('quote-name').value = '';
  renderQuotes();
});

// Get quotes from localStorage
function getQuotes() {
  const stored = localStorage.getItem('coverall-quotes');
  return stored ? JSON.parse(stored) : [];
}

// Render saved quotes
function renderQuotes() {
  const quotes = getQuotes();

  if (quotes.length === 0) {
    quotesList.innerHTML = '<p class="no-quotes">No saved quotes yet</p>';
    return;
  }

  const coverTypeLabels = {
    'all-clear': 'All Clear',
    'clear-vrn-top': 'Clear + VRN Top',
    'all-vrn': 'All VRN',
    'vrn-clear-window': 'VRN + Window'
  };

  quotesList.innerHTML = quotes.map(quote => `
    <div class="quote-item" data-id="${quote.id}">
      <div class="quote-info" onclick="loadQuote(${quote.id})">
        <div class="quote-name">${escapeHtml(quote.name)}</div>
        <div class="quote-details">
          ${quote.width}" × ${quote.depth}" × ${quote.height}" · ${coverTypeLabels[quote.coverType] || quote.coverType}
        </div>
      </div>
      <div class="quote-prices" onclick="loadQuote(${quote.id})">
        <div class="quote-cost">Cost: $${quote.perCoverCost.toFixed(2)}</div>
        <div class="quote-price">Price: $${quote.perCoverPrice.toFixed(2)}</div>
      </div>
      <button class="quote-delete" onclick="deleteQuote(${quote.id}, event)">Delete</button>
    </div>
  `).join('');
}

// Load a saved quote into the form
function loadQuote(id) {
  const quotes = getQuotes();
  const quote = quotes.find(q => q.id === id);

  if (!quote) return;

  document.getElementById('width').value = quote.width;
  document.getElementById('depth').value = quote.depth;
  document.getElementById('height').value = quote.height;
  document.getElementById('cover-type').value = quote.coverType;
  document.getElementById('closure').value = quote.closureType;
  document.getElementById('zipper-count').value = quote.zipperCount;
  document.getElementById('magnet-count').value = quote.magnetCount;
  document.getElementById('margin').value = quote.marginPercent;

  // Update visibility of closure options
  zipperCountGroup.style.display = quote.closureType === 'zipper' ? 'block' : 'none';
  magnetCountGroup.style.display = quote.closureType === 'magnet' ? 'block' : 'none';

  // Recalculate
  calculateEstimate();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Delete a quote
function deleteQuote(id, event) {
  event.stopPropagation();

  if (!confirm('Delete this quote?')) return;

  const quotes = getQuotes().filter(q => q.id !== id);
  localStorage.setItem('coverall-quotes', JSON.stringify(quotes));
  renderQuotes();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize quotes list on page load
renderQuotes();
