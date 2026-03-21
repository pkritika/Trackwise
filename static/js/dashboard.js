// CATEGORY COLORS (Updated for new design)
const CATEGORY_COLORS = {
  'Food & Dining': '#60B4FF',
  'Transport': '#FF6B6B',
  'Shopping': '#FFB347',
  'Entertainment': '#A78BFF',
  'Utilities': '#FF9F5A',
  'Health': '#5EEAD4',
  'Rent/Housing': '#FBB024',
  'Income': '#6EE7B7',
  'Subscriptions': '#FB7185',
  'Other': '#C8FF5F'
};

const CATEGORY_ICONS = {
  'Food & Dining': '◑',
  'Transport': '▷',
  'Shopping': '◻',
  'Entertainment': '◎',
  'Utilities': '⚡',
  'Health': '✚',
  'Rent/Housing': '◈',
  'Income': '↑',
  'Subscriptions': '◉',
  'Other': '◈'
};

let transactions = [];
let categorized = false;
let pieChart = null;

// LOAD DATA ON PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Categorize button
  document.getElementById('btnCategorize').addEventListener('click', categorizeTransactions);

  // Export button
  document.getElementById('btnExport').addEventListener('click', exportCSV);

  // Category filter
  document.getElementById('categoryFilter').addEventListener('change', filterByCategory);
});

// LOAD DATA FROM API
function loadData() {
  fetch('/api/data')
    .then(response => response.json())
    .then(data => {
      transactions = data.transactions || [];
      categorized = data.categorized || false;

      if (transactions.length === 0) {
        showEmptyState();
      } else {
        updateDashboard(data);
      }
    })
    .catch(error => {
      console.error('Error loading data:', error);
      showEmptyState();
    });
}

function showEmptyState() {
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('aiCard').classList.add('hidden');
  document.getElementById('metricsGrid').classList.add('hidden');
  document.getElementById('chartsGrid').classList.add('hidden');
  const mc = document.getElementById('merchantsCard');
  if (mc) mc.classList.add('hidden');
  document.getElementById('transactionsSection').classList.add('hidden');
  document.getElementById('dashSubtitle').textContent = 'No transactions yet';
}

function updateDashboard(data) {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('metricsGrid').classList.remove('hidden');
  document.getElementById('transactionsSection').classList.remove('hidden');
  document.getElementById('btnExport').classList.remove('hidden');

  // Update subtitle
  const subtitle = categorized
    ? `${data.count} transactions · Categorized by AI`
    : `${data.count} transactions · Ready to categorize`;
  document.getElementById('dashSubtitle').textContent = subtitle;

  // Show AI card if not categorized
  if (!categorized) {
    document.getElementById('aiCard').classList.remove('hidden');
  } else {
    document.getElementById('aiCard').classList.add('hidden');
  }

  // Update metrics
  updateMetrics(data.transactions);

  // Update transactions table
  updateTransactionsTable(data.transactions);

  // If categorized, show charts and breakdown
  const merchantsCard = document.getElementById('merchantsCard');
  if (categorized && data.summary && data.summary.length > 0) {
    document.getElementById('chartsGrid').classList.remove('hidden');
    if (merchantsCard) merchantsCard.classList.remove('hidden');
    document.getElementById('filterSection').classList.remove('hidden');
    document.getElementById('categoryHeader').classList.remove('hidden');

    updateCharts(data.summary);
    updateCategoryFilter(data.transactions);
    updateTopMerchants(data.transactions);
  } else if (categorized) {
    // Categorized but no expense data to chart
    document.getElementById('chartsGrid').classList.add('hidden');
    if (merchantsCard) merchantsCard.classList.remove('hidden');
    document.getElementById('filterSection').classList.remove('hidden');
    document.getElementById('categoryHeader').classList.remove('hidden');
    updateCategoryFilter(data.transactions);
    updateTopMerchants(data.transactions);
  }
}

function updateMetrics(txns) {
  const total = txns.length;

  // Detect if this is a credit card statement or bank statement
  // Credit card: purchases are positive, payments are negative
  // Bank statement: expenses are negative, income is positive
  const positiveCount = txns.filter(t => t.amount > 0).length;
  const negativeCount = txns.filter(t => t.amount < 0).length;
  const isCreditCard = positiveCount > negativeCount;

  let spent, income, net;

  if (isCreditCard) {
    // Credit card: purchases (positive) are spent, payments (negative) are income/credits
    spent = txns.filter(t => t.amount > 0 && t.category !== 'Income').reduce((sum, t) => sum + t.amount, 0);
    income = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    net = income - spent; // Net = payments made - purchases
  } else {
    // Bank statement: expenses (negative) are spent, deposits (positive) are income
    spent = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    income = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    net = income - spent; // Net = income - expenses
  }

  document.getElementById('metricTotal').textContent = total;
  document.getElementById('metricSpent').textContent = `$${spent.toFixed(2)}`;

  const incomeEl = document.getElementById('metricIncome');
  if (incomeEl) incomeEl.textContent = `$${income.toFixed(2)}`;

  const netEl = document.getElementById('metricNet');
  if (netEl) netEl.textContent = `$${Math.abs(net).toFixed(2)}`;

  // Update income label based on statement type
  const incomeLabel = document.getElementById('metricIncomeLabel');
  if (incomeLabel) {
    incomeLabel.textContent = isCreditCard ? 'Total paid' : 'Total income';
  }

  const badge = document.getElementById('metricNetBadge');
  if (badge) {
    badge.classList.remove('hidden');
    if (net >= 0) {
      badge.classList.remove('negative');
      badge.textContent = 'Positive';
    } else {
      badge.classList.add('negative');
      badge.textContent = 'Negative';
    }
  }
}

function updateTransactionsTable(txns) {
  const tbody = document.getElementById('transactionsBody');
  tbody.innerHTML = '';

  txns.forEach(txn => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${txn.date}</td>
      <td>${txn.description}</td>
      <td class="${txn.amount >= 0 ? 'amount-positive' : 'amount-negative'}">
        ${txn.amount >= 0 ? '+' : '-'}$${Math.abs(txn.amount).toFixed(2)}
      </td>
      ${categorized ? `
      <td>
        <span class="category-badge" style="background:${CATEGORY_COLORS[txn.category] || '#a0a0a0'}30;color:${CATEGORY_COLORS[txn.category] || '#a0a0a0'}">
          ${txn.category || 'Other'}
        </span>
      </td>
      ` : ''}
    `;
  });

  document.getElementById('tableCount').textContent = `Showing ${txns.length} transactions`;
}

function updateCharts(summary) {
  // Filter out categories with $0 for charts
  const nonZeroSummary = summary.filter(s => s.total_spent > 0);

  // Prepare data
  const labels = nonZeroSummary.map(s => s.category);
  const data = nonZeroSummary.map(s => s.total_spent);
  const colors = labels.map(cat => CATEGORY_COLORS[cat] || '#a0a0a0');

  // Destroy old chart
  if (pieChart) pieChart.destroy();

  // Donut Chart (using Chart.js)
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  // Create custom legend
  const legendContainer = document.getElementById('pieLegend');
  legendContainer.innerHTML = '';
  labels.forEach((label, index) => {
    legendContainer.innerHTML += `
      <div class="dash-legend-item">
        <div class="dash-dot" style="background:${colors[index]}"></div>
        ${label}
      </div>
    `;
  });

  // Custom HTML Bar Chart
  // updateBarChart(summary);
}

// function updateBarChart(summary) {
//   const container = document.getElementById('barChartContainer');
//   container.innerHTML = '';

//   // Filter out zero values and get max for scaling
//   const nonZeroSummary = summary.filter(s => s.total_spent > 0);
//   const maxSpent = Math.max(...nonZeroSummary.map(s => s.total_spent));

//   nonZeroSummary.forEach(item => {
//     const width = (item.total_spent / maxSpent) * 100;
//     const color = CATEGORY_COLORS[item.category] || '#a0a0a0';
//     const categoryShort = item.category.length > 10 ? item.category.substring(0, 10) : item.category;

//     container.innerHTML += `
//       <div class="tw-bar-row">
//         <div class="tw-bar-cat">${categoryShort}</div>
//         <div class="tw-bar-track">
//           <div class="tw-bar-fill" style="width:${width}%;background:${color}"></div>
//         </div>
//         <div class="tw-bar-val">$${item.total_spent.toFixed(0)}</div>
//       </div>
//     `;
//   });
// }

function updateCategoryBreakdown(summary) {
  const container = document.getElementById('categorySection');
  container.innerHTML = '';

  const total = summary.reduce((sum, s) => sum + s.total_spent, 0);

  summary.forEach(item => {
    const width = total > 0 ? (item.total_spent / total) * 100 : 0;
    const color = CATEGORY_COLORS[item.category] || '#a0a0a0';
    const icon = CATEGORY_ICONS[item.category] || '◈';

    container.innerHTML += `
      <div class="tw-breakdown-row">
        <div class="tw-bd-icon">${icon}</div>
        <div class="tw-bd-cat">${item.category}</div>
        <div class="tw-bd-track">
          <div class="tw-bd-fill" style="width:${width}%;background:${color}"></div>
        </div>
        <div class="tw-bd-right">
          <div class="tw-bd-amt">$${item.total_spent.toFixed(0)}</div>
          <div class="tw-bd-count">×${item.count}</div>
        </div>
      </div>
    `;
  });
}

function updateCategoryFilter(txns) {
  const filter = document.getElementById('categoryFilter');
  const categories = [...new Set(txns.map(t => t.category))].filter(c => c).sort();

  filter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(cat => {
    filter.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

function filterByCategory() {
  const selected = document.getElementById('categoryFilter').value;

  if (selected === 'all') {
    updateTransactionsTable(transactions);
  } else {
    const filtered = transactions.filter(t => t.category === selected);
    updateTransactionsTable(filtered);
  }
}

// CATEGORIZE TRANSACTIONS
function categorizeTransactions() {
  const btn = document.getElementById('btnCategorize');
  const progress = document.getElementById('aiProgress');
  const progressFill = document.getElementById('aiProgressFill');
  const progressText = document.getElementById('aiProgressText');

  btn.disabled = true;
  progress.classList.remove('hidden');
  progressFill.style.width = '0%';

  // Simulate progress
  let prog = 0;
  const interval = setInterval(() => {
    prog += Math.random() * 15;
    if (prog > 90) prog = 90;
    progressFill.style.width = prog + '%';
  }, 300);

  fetch('/api/categorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
    .then(response => response.json())
    .then(data => {
      clearInterval(interval);
      progressFill.style.width = '100%';

      if (data.error) {
        alert('Categorization failed: ' + data.error);
        btn.disabled = false;
        progress.classList.add('hidden');
      } else {
        progressText.textContent = 'Categorization complete!';
        setTimeout(() => {
          location.reload();
        }, 1000);
      }
    })
    .catch(error => {
      clearInterval(interval);
      alert('Error: ' + error.message);
      btn.disabled = false;
      progress.classList.add('hidden');
    });
}

// TOP MERCHANTS
function updateTopMerchants(txns) {
  const merchantsList = document.getElementById('merchantsList');

  // Detect if this is a credit card statement
  const positiveCount = txns.filter(t => t.amount > 0).length;
  const negativeCount = txns.filter(t => t.amount < 0).length;
  const isCreditCard = positiveCount > negativeCount;

  // Filter expenses based on statement type
  let expenses;
  if (isCreditCard) {
    // Credit card: purchases (positive amounts) are expenses, excluding Income
    expenses = txns.filter(t => t.amount > 0 && t.category !== 'Income');
  } else {
    // Bank statement: negative amounts are expenses
    expenses = txns.filter(t => t.amount < 0);
  }

  if (expenses.length === 0) {
    merchantsList.innerHTML = `
      <div class="dash-merchant-row">
        <div class="dash-merchant-icon">📊</div>
        <div class="dash-merchant-info">
          <div class="dash-merchant-name">No expense transactions</div>
        </div>
      </div>
    `;
    return;
  }

  // Group by merchant (description)
  const merchantMap = {};
  expenses.forEach(txn => {
    const merchant = txn.description.trim();
    if (!merchantMap[merchant]) {
      merchantMap[merchant] = {
        name: merchant,
        count: 0,
        total: 0,
        category: txn.category || 'Other'
      };
    }
    merchantMap[merchant].count++;
    merchantMap[merchant].total += Math.abs(txn.amount);
  });

  // Convert to array and sort by total spent
  const merchantsArray = Object.values(merchantMap);
  merchantsArray.sort((a, b) => b.total - a.total);

  // Take top 5
  const topMerchants = merchantsArray.slice(0, 5);

  // Render
  merchantsList.innerHTML = '';
  topMerchants.forEach(merchant => {
    const merchantIcon = getMerchantIcon(merchant.name, merchant.category);
    const iconBg = CATEGORY_COLORS[merchant.category] || '#C8FF5F';

    merchantsList.innerHTML += `
      <div class="dash-merchant-row">
        <div class="dash-merchant-icon" style="background:${iconBg}20">${merchantIcon}</div>
        <div class="dash-merchant-info">
          <div class="dash-merchant-name">${merchant.name}</div>
          <div class="dash-merchant-sub">${merchant.count} transaction${merchant.count > 1 ? 's' : ''}</div>
        </div>
        <div class="dash-merchant-amt">$${merchant.total.toFixed(2)}</div>
      </div>
    `;
  });
}

// Get merchant icon based on name and category
function getMerchantIcon(name, category) {
  const nameLower = name.toLowerCase();

  // Check category first
  if (category === 'Food & Dining') return '♨';
  if (category === 'Transport') return '◉';
  if (category === 'Shopping') return '▣';
  if (category === 'Entertainment') return '◎';
  if (category === 'Utilities') return '⚡';
  if (category === 'Health') return '✚';
  if (category === 'Rent/Housing') return '◈';
  if (category === 'Subscriptions') return '◉';

  // Fallback to name-based detection
  if (nameLower.includes('food') || nameLower.includes('restaurant') || nameLower.includes('kitchen')) {
    return '♨';
  }
  if (nameLower.includes('gas') || nameLower.includes('uber') || nameLower.includes('hertz') || nameLower.includes('airline')) {
    return '✈';
  }
  if (nameLower.includes('target') || nameLower.includes('costco') || nameLower.includes('shopping')) {
    return '▣';
  }

  return '✦';
}

// EXPORT CSV
function exportCSV() {
  window.location.href = '/api/export';
}
