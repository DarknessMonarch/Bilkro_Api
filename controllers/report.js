// Get sales reports
exports.getSalesReports = async (req, res) => {
    try {
      // Parse pagination
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const skip = (page - 1) * limit;
  
      // Parse date range (default to last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
  
      if (req.query.startDate) startDate.setTime(Date.parse(req.query.startDate));
      if (req.query.endDate) {
        endDate.setTime(Date.parse(req.query.endDate));
        endDate.setHours(23, 59, 59, 999); // Set to end of day
      }
  
      // Get reports with pagination
      const reports = await Report.find({
        date: { $gte: startDate, $lte: endDate }
      })
        .skip(skip)
        .limit(limit)
        .populate("saleId", "invoiceNumber customerInfo");
  
      // Get total count
      const total = await Report.countDocuments({
        date: { $gte: startDate, $lte: endDate }
      });
  
      res.status(200).json({
        success: true,
        count: reports.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        data: reports,
      });
    } catch (error) {
      console.error("Error fetching sales reports:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch sales reports",
        error: error.message,
      });
    }
  };
  

// Get product reports
exports.getProductReports = async (req, res) => {
try {
// Admin authorization check
if (!req.user.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized access'
  });
}

// Parse date range (default to last 30 days)
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

// Get date range from query params if provided
if (req.query.startDate) {
  startDate.setTime(Date.parse(req.query.startDate));
}
if (req.query.endDate) {
  endDate.setTime(Date.parse(req.query.endDate));
  // Set to end of day
  endDate.setHours(23, 59, 59, 999);
}

// Get product filter if provided
const productFilter = {};
if (req.query.productId) {
  productFilter["items.productId"] = req.query.productId;
}
if (req.query.category) {
  productFilter["items.category"] = req.query.category;
}

// Build match stage
const matchStage = {
  date: {
    $gte: startDate,
    $lte: endDate
  },
  ...productFilter
};

// Get top selling products
const topProducts = await Report.getTopSellingProducts(startDate, endDate, 10);

// Get profit margin by product
const profitMargins = await Report.getProfitMarginByProduct(startDate, endDate, 10);

// Get products with low margins
const lowMarginProducts = await Report.aggregate([
  {
    $match: matchStage
  },
  {
    $unwind: "$items"
  },
  {
    $group: {
      _id: "$items.productId",
      productName: { $first: "$items.productName" },
      productID: { $first: "$items.productID" },
      category: { $first: "$items.category" },
      totalRevenue: { $sum: "$items.revenue" },
      totalCost: { $sum: "$items.cost" },
      totalProfit: { $sum: "$items.profit" }
    }
  },
  {
    $project: {
      productId: "$_id",
      productName: 1,
      productID: 1,
      category: 1,
      totalRevenue: 1,
      totalCost: 1,
      totalProfit: 1,
      profitMargin: { 
        $cond: { 
          if: { $eq: ["$totalRevenue", 0] }, 
          then: 0, 
          else: { $multiply: [{ $divide: ["$totalProfit", "$totalRevenue"] }, 100] } 
        } 
      },
      _id: 0
    }
  },
  {
    $match: {
      profitMargin: { $lt: 20 }  // Products with less than 20% profit margin
    }
  },
  {
    $sort: { profitMargin: 1 }
  },
  {
    $limit: 10
  }
]);

// Get products by category
const productsByCategory = await Report.getReportsByCategory(startDate, endDate);

res.status(200).json({
  success: true,
  data: {
    topSellingProducts: topProducts,
    highMarginProducts: profitMargins,
    lowMarginProducts: lowMarginProducts,
    productsByCategory: productsByCategory
  }
});
} catch (error) {
console.error('Error fetching product reports:', error);
res.status(500).json({
  success: false,
  message: 'Failed to fetch product reports',
  error: error.message
});
}
};

// Get category reports
exports.getCategoryReports = async (req, res) => {
try {
// Admin authorization check
if (!req.user.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized access'
  });
}

// Parse date range (default to last 30 days)
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

// Get date range from query params if provided
if (req.query.startDate) {
  startDate.setTime(Date.parse(req.query.startDate));
}
if (req.query.endDate) {
  endDate.setTime(Date.parse(req.query.endDate));
  // Set to end of day
  endDate.setHours(23, 59, 59, 999);
}

// Get category stats
const categoryStats = await Report.getReportsByCategory(startDate, endDate);

// Get monthly trends by category
const monthlyTrendsByCategory = await Report.aggregate([
  {
    $match: {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }
  },
  {
    $unwind: "$items"
  },
  {
    $group: {
      _id: {
        month: { $dateToString: { format: "%Y-%m", date: "$date" } },
        category: "$items.category"
      },
      totalRevenue: { $sum: "$items.revenue" },
      totalProfit: { $sum: "$items.profit" },
      count: { $sum: "$items.quantity" }
    }
  },
  {
    $project: {
      month: "$_id.month",
      category: "$_id.category",
      totalRevenue: 1,
      totalProfit: 1,
      count: 1,
      _id: 0
    }
  },
  {
    $sort: { month: 1, category: 1 }
  }
]);

// Group by category for chart data
const categories = [...new Set(monthlyTrendsByCategory.map(item => item.category))];
const months = [...new Set(monthlyTrendsByCategory.map(item => item.month))];

const categoryChartData = months.map(month => {
  const monthData = { month };
  categories.forEach(category => {
    const categoryData = monthlyTrendsByCategory.find(
      item => item.month === month && item.category === category
    );
    monthData[category] = categoryData ? categoryData.totalRevenue : 0;
  });
  return monthData;
});

// Format profit margin by category
const profitMarginByCategory = categoryStats.map(item => ({
  category: item.category,
  totalRevenue: item.totalRevenue,
  totalProfit: item.totalProfit,
  profitMargin: item.totalRevenue > 0 
    ? (item.totalProfit / item.totalRevenue * 100).toFixed(2) 
    : 0
}));

res.status(200).json({
  success: true,
  data: {
    categoryStats,
    categoryChartData,
    profitMarginByCategory
  }
});
} catch (error) {
console.error('Error fetching category reports:', error);
res.status(500).json({
  success: false,
  message: 'Failed to fetch category reports',
  error: error.message
});
}
};

// Get payment method reports
exports.getPaymentMethodReports = async (req, res) => {
try {
// Admin authorization check
if (!req.user.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized access'
  });
}

// Parse date range (default to last 30 days)
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

// Get date range from query params if provided
if (req.query.startDate) {
  startDate.setTime(Date.parse(req.query.startDate));
}
if (req.query.endDate) {
  endDate.setTime(Date.parse(req.query.endDate));
  // Set to end of day
  endDate.setHours(23, 59, 59, 999);
}

// Get payment method stats
const paymentMethodStats = await Report.getPaymentMethodStats(startDate, endDate);

// Get monthly trends by payment method
const monthlyTrendsByPaymentMethod = await Report.aggregate([
  {
    $match: {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }
  },
  {
    $group: {
      _id: {
        month: { $dateToString: { format: "%Y-%m", date: "$date" } },
        paymentMethod: "$paymentMethod"
      },
      totalRevenue: { $sum: "$totalRevenue" },
      totalProfit: { $sum: "$totalProfit" },
      count: { $sum: 1 }
    }
  },
  {
    $project: {
      month: "$_id.month",
      paymentMethod: "$_id.paymentMethod",
      totalRevenue: 1,
      totalProfit: 1,
      count: 1,
      _id: 0
    }
  },
  {
    $sort: { month: 1, paymentMethod: 1 }
  }
]);

// Format data for chart
const paymentMethods = [...new Set(monthlyTrendsByPaymentMethod.map(item => item.paymentMethod))];
const months = [...new Set(monthlyTrendsByPaymentMethod.map(item => item.month))];

const paymentMethodChartData = months.map(month => {
  const monthData = { month };
  paymentMethods.forEach(method => {
    const methodData = monthlyTrendsByPaymentMethod.find(
      item => item.month === month && item.paymentMethod === method
    );
    monthData[method] = methodData ? methodData.totalRevenue : 0;
  });
  return monthData;
});

res.status(200).json({
  success: true,
  data: {
    paymentMethodStats,
    paymentMethodChartData
  }
});
} catch (error) {
console.error('Error fetching payment method reports:', error);
res.status(500).json({
  success: false,
  message: 'Failed to fetch payment method reports',
  error: error.message
});
}
};

// Get detailed report for a specific sale
exports.getSaleReport = async (req, res) => {
try {
// Admin authorization check
if (!req.user.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized access'
  });
}

const { saleId } = req.params;

// Get report for the sale
const report = await Report.findOne({ saleId })
  .populate('saleId', 'invoiceNumber customerInfo status paymentMethod createdAt note couponCode');

if (!report) {
  return res.status(404).json({
    success: false,
    message: 'Report not found for this sale'
  });
}

res.status(200).json({
  success: true,
  data: report
});
} catch (error) {
console.error('Error fetching sale report:', error);
res.status(500).json({
  success: false,
  message: 'Failed to fetch sale report',
  error: error.message
});
}
};

// Export sales data as CSV
exports.exportSalesReports = async (req, res) => {
try {
// Admin authorization check
if (!req.user.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized access'
  });
}

// Parse date range (default to last 30 days)
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

// Get date range from query params if provided
if (req.query.startDate) {
  startDate.setTime(Date.parse(req.query.startDate));
}
if (req.query.endDate) {
  endDate.setTime(Date.parse(req.query.endDate));
  // Set to end of day
  endDate.setHours(23, 59, 59, 999);
}

// Get reports
const reports = await Report.find({
  date: {
    $gte: startDate,
    $lte: endDate
  }
}).populate('saleId', 'invoiceNumber customerInfo');

// Format data for CSV
const csvData = [];

// Add header row
csvData.push([
  'Invoice Number',
  'Date',
  'Customer',
  'Total Revenue',
  'Total Cost',
  'Total Profit',
  'Profit Margin (%)',
  'Payment Method'
]);

// Add data rows
reports.forEach(report => {
  const row = [
    report.saleId ? report.saleId.invoiceNumber : 'N/A',
    report.date.toISOString().split('T')[0],
    report.saleId && report.saleId.customerInfo ? report.saleId.customerInfo.name : 'N/A',
    report.totalRevenue.toFixed(2),
    report.totalCost.toFixed(2),
    report.totalProfit.toFixed(2),
    (report.totalProfit / report.totalRevenue * 100).toFixed(2),
    report.paymentMethod
  ];
  csvData.push(row);
});

// Convert to CSV string
const csvString = csvData.map(row => row.join(',')).join('\n');

// Set appropriate headers for file download
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`);

// Send CSV data
res.status(200).send(csvString);
} catch (error) {
console.error('Error exporting sales reports:', error);
res.status(500).json({
  success: false,
  message: 'Failed to export sales reports',
  error: error.message
});
}
};

// Get inventory valuation report
exports.getInventoryValuationReport = async (req, res) => {
try {
// Admin authorization check
if (!req.user.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized access'
  });
}

// Get all products with inventory value
const products = await Product.find({}, {
  name: 1,
  productID: 1,
  category: 1,
  quantity: 1,
  unit: 1,
  buyingPrice: 1,
  sellingPrice: 1
});

// Calculate inventory valuation
const inventoryData = products.map(product => ({
  productId: product._id,
  productName: product.name,
  productID: product.productID,
  category: product.category,
  quantity: product.quantity,
  unit: product.unit,
  buyingPrice: product.buyingPrice,
  sellingPrice: product.sellingPrice,
  inventoryValue: product.quantity * product.buyingPrice,
  potentialRevenue: product.quantity * product.sellingPrice,
  potentialProfit: product.quantity * (product.sellingPrice - product.buyingPrice)
}));

// Group by category
const categoryGroups = {};
inventoryData.forEach(item => {
  if (!categoryGroups[item.category]) {
    categoryGroups[item.category] = {
      category: item.category,
      totalQuantity: 0,
      totalValue: 0,
      totalPotentialRevenue: 0,
      totalPotentialProfit: 0,
      items: []
    };
  }
  
  categoryGroups[item.category].totalQuantity += item.quantity;
  categoryGroups[item.category].totalValue += item.inventoryValue;
  categoryGroups[item.category].totalPotentialRevenue += item.potentialRevenue;
  categoryGroups[item.category].totalPotentialProfit += item.potentialProfit;
  categoryGroups[item.category].items.push(item);
});

// Calculate totals
const totalInventoryValue = inventoryData.reduce((sum, item) => sum + item.inventoryValue, 0);
const totalPotentialRevenue = inventoryData.reduce((sum, item) => sum + item.potentialRevenue, 0);
const totalPotentialProfit = inventoryData.reduce((sum, item) => sum + item.potentialProfit, 0);

res.status(200).json({
  success: true,
  data: {
    inventoryData,
    categoryGroups: Object.values(categoryGroups),
    summary: {
      totalInventoryValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      totalItems: products.length,
      totalQuantity: inventoryData.reduce((sum, item) => sum + item.quantity, 0)
    }
  }
});
} catch (error) {
console.error('Error fetching inventory valuation report:', error);
res.status(500).json({
  success: false,
  message: 'Failed to fetch inventory valuation report',
  error: error.message
});
}
};

module.exports = exports;