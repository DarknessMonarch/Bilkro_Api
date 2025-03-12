const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const saleItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  name: {
    type: String,
    required: true
  },
  productID: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  },
  unit: {
    type: String,
    default: 'pcs'
  }
});

const saleSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit', 'debit', 'bank_transfer', 'online', 'other'],
    required: true
  },
  customerInfo: {
    name: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    }
  },
  note: {
    type: String,
    default: ''
  },
  couponCode: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['completed', 'refunded', 'partially_refunded'],
    default: 'completed'
  },
  invoiceNumber: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate invoice number before saving
saleSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate a unique invoice number: INV-YYYYMMDD-XXXX
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Find the latest invoice number for today
    const latestSale = await this.constructor.findOne({
      invoiceNumber: { $regex: `^INV-${dateStr}-` }
    }).sort({ invoiceNumber: -1 });
    
    let sequenceNumber = 1;
    if (latestSale && latestSale.invoiceNumber) {
      // Extract the sequence number from the latest invoice
      const match = latestSale.invoiceNumber.match(/INV-\d{8}-(\d+)/);
      if (match && match[1]) {
        sequenceNumber = parseInt(match[1]) + 1;
      }
    }
    
    this.invoiceNumber = `INV-${dateStr}-${String(sequenceNumber).padStart(4, '0')}`;
  }
  next();
});

// Virtual for items count
saleSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Static method to get sales by date range
saleSchema.statics.getSalesByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 });
};

// Static method to get sales by user
saleSchema.statics.getSalesByUser = function(userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Sale', saleSchema);