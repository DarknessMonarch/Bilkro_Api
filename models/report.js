const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productID: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    default: 'pcs'
  },
  buyingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  revenue: {
    type: Number,
    required: true,
    min: 0
  },
  profit: {
    type: Number,
    required: true
  }
});

const reportCategorySchema = new Schema({
  name: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  }
});

const reportSchema = new Schema({
  saleId: {
    type: Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  items: [reportItemSchema],
  totalRevenue: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalProfit: {
    type: Number,
    required: true
  },
  categories: {
    type: Map,
    of: {
      count: Number,
      revenue: Number,
      profit: Number
    }
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit', 'debit', 'bank_transfer', 'online', 'other'],
    required: true
  }
}, {
  timestamps: true
});

// Static method to get reports by date range
reportSchema.statics.getReportsByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

// Static method to get aggregated reports by category
reportSchema.statics.getReportsByCategory = async function(startDate, endDate) {
  return this.aggregate([
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
        _id: "$items.category",
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: "$items.revenue" },
        totalProfit: { $sum: "$items.profit" },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        category: "$_id",
        totalQuantity: 1,
        totalRevenue: 1,
        totalProfit: 1,
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { totalRevenue: -1 }
    }
  ]);
};

// Static method to get top selling products
reportSchema.statics.getTopSellingProducts = async function(startDate, endDate, limit = 10) {
  return this.aggregate([
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
        _id: "$items.productId",
        productName: { $first: "$items.productName" },
        productID: { $first: "$items.productID" },
        category: { $first: "$items.category" },
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: "$items.revenue" },
        totalProfit: { $sum: "$items.profit" }
      }
    },
    {
      $project: {
        productId: "$_id",
        productName: 1,
        productID: 1,
        category: 1,
        totalQuantity: 1,
        totalRevenue: 1,
        totalProfit: 1,
        _id: 0
      }
    },
    {
      $sort: { totalRevenue: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get sales trends by date
reportSchema.statics.getSalesTrendsByDate = async function(startDate, endDate, interval = 'day') {
  let dateFormat;
  
  switch (interval) {
    case 'day':
      dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
      break;
    case 'week':
      dateFormat = { 
        $dateToString: { 
          format: "%Y-W%V", 
          date: "$date" 
        } 
      };
      break;
    case 'month':
      dateFormat = { $dateToString: { format: "%Y-%m", date: "$date" } };
      break;
    default:
      dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
  }
  
  return this.aggregate([
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
        _id: dateFormat,
        totalRevenue: { $sum: "$totalRevenue" },
        totalCost: { $sum: "$totalCost" },
        totalProfit: { $sum: "$totalProfit" },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        date: "$_id",
        totalRevenue: 1,
        totalCost: 1,
        totalProfit: 1,
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
};

// Static method to get payment method statistics
reportSchema.statics.getPaymentMethodStats = async function(startDate, endDate) {
  return this.aggregate([
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
        _id: "$paymentMethod",
        totalRevenue: { $sum: "$totalRevenue" },
        totalProfit: { $sum: "$totalProfit" },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        paymentMethod: "$_id",
        totalRevenue: 1,
        totalProfit: 1,
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { totalRevenue: -1 }
    }
  ]);
};

// Static method to get profit margin by product
reportSchema.statics.getProfitMarginByProduct = async function(startDate, endDate, limit = 10) {
  return this.aggregate([
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
      $sort: { profitMargin: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

module.exports = mongoose.model('Report', reportSchema);