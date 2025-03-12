const Cart = require('../models/cart');
const Product = require('../models/product');
const Sale = require('../models/sale'); 
const Report = require('../models/report');

// Get user's active cart
exports.getCart = async (req, res) => {
  try {
    // Get user ID from auth middleware
    const userId = req.user.id;
    
    // Find or create cart
    let cart = await Cart.findOne({ 
      user: userId,
      status: 'active'
    }).populate('items.product', 'name productID quantity image');
    
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
      await cart.save();
    }
    
    // Check if any items in the cart have quantity issues (product no longer available)
    let hasUpdates = false;
    for (let i = cart.items.length - 1; i >= 0; i--) {
      const item = cart.items[i];
      const product = item.product;
      
      // Remove item if product no longer exists or is out of stock
      if (!product || product.quantity === 0) {
        cart.items.splice(i, 1);
        hasUpdates = true;
        continue;
      }
      
      // Adjust quantity if greater than available
      if (item.quantity > product.quantity) {
        item.quantity = product.quantity;
        hasUpdates = true;
      }
    }
    
    // Save cart if there were updates
    if (hasUpdates) {
      await cart.save();
    }
    
    res.status(200).json({
      success: true,
      data: {
        _id: cart._id,
        items: cart.items,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        note: cart.note,
        couponCode: cart.couponCode
      }
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart',
      error: error.message
    });
  }
};

// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    
    // Validate product exists and has sufficient quantity
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} units available`,
        availableQuantity: product.quantity
      });
    }
    
    // Find or create cart
    let cart = await Cart.findOne({ 
      user: userId,
      status: 'active'
    });
    
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }
    
    // Add item to cart
    await cart.addItem(productId, parseInt(quantity));
    
    // Return updated cart
    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      data: {
        _id: cart._id,
        items: cart.items,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total
      }
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message
    });
  }
};

exports.checkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethod, customerInfo } = req.body;
    
    // Find active cart
    const cart = await Cart.findOne({ 
      user: userId,
      status: 'active'
    }).populate('items.product');
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot checkout an empty cart'
      });
    }
    
    // Verify all items are still available
    let unavailableItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (!product || product.quantity < item.quantity) {
        unavailableItems.push({
          name: item.name,
          requested: item.quantity,
          available: product ? product.quantity : 0
        });
      }
    }
    
    if (unavailableItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some items are no longer available',
        unavailableItems
      });
    }
    
    // Create sale transaction
    const sale = new Sale({
      user: userId,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      total: cart.total,
      paymentMethod,
      customerInfo,
      note: cart.note,
      couponCode: cart.couponCode
    });
    
    await sale.save();
    
    // Generate report data
    const reportData = {
      saleId: sale._id,
      date: new Date(),
      items: [],
      totalRevenue: cart.total,
      totalCost: 0,
      totalProfit: 0,
      categories: {},
      paymentMethod
    };
    
    // Update product quantities and collect report data
    for (const item of cart.items) {
      const product = await Product.findById(item.product);
      if (product) {
        // Update product quantity
        product.quantity -= item.quantity;
        await product.save();
        
        // Calculate item profit
        const itemCost = product.buyingPrice * item.quantity;
        const itemRevenue = item.price * item.quantity;
        const itemProfit = itemRevenue - itemCost;
        
        // Add to report data
        reportData.items.push({
          productId: product._id,
          productName: product.name,
          productID: product.productID,
          category: product.category,
          quantity: item.quantity,
          unit: product.unit,
          buyingPrice: product.buyingPrice,
          sellingPrice: product.sellingPrice,
          cost: itemCost,
          revenue: itemRevenue,
          profit: itemProfit
        });
        
        // Update category stats
        if (!reportData.categories[product.category]) {
          reportData.categories[product.category] = {
            count: 0,
            revenue: 0,
            profit: 0
          };
        }
        reportData.categories[product.category].count += item.quantity;
        reportData.categories[product.category].revenue += itemRevenue;
        reportData.categories[product.category].profit += itemProfit;
        
        // Update total cost and profit
        reportData.totalCost += itemCost;
        reportData.totalProfit += itemProfit;
      }
    }
    
    // Create report
    const report = new Report(reportData);
    await report.save();
    
    // Update cart status
    cart.status = 'converted';
    await cart.save();
    
    // Return success response with sale and report info
    res.status(200).json({
      success: true,
      message: 'Checkout completed successfully',
      data: {
        saleId: sale._id,
        reportId: report._id,
        items: cart.items,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        totalProfit: reportData.totalProfit,
        categories: reportData.categories
      }
    });
  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete checkout',
      error: error.message
    });
  }
};

// Update item quantity in cart
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }
    
    // Find cart
    const cart = await Cart.findOne({ 
      user: userId,
      status: 'active'
    });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Update item quantity
    await cart.updateItemQuantity(itemId, parseInt(quantity));
    
    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      data: {
        _id: cart._id,
        items: cart.items,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total
      }
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart item',
      error: error.message
    });
  }
};

// Remove item from cart
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    
    // Find cart
    const cart = await Cart.findOne({ 
      user: userId,
      status: 'active'
    });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Remove item from cart
    await cart.removeItem(itemId);
    
    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: {
        _id: cart._id,
        items: cart.items,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total
      }
    });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message
    });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find cart
    const cart = await Cart.findOne({ 
      user: userId,
      status: 'active'
    });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }
    
    // Clear cart
    await cart.clearCart();
    
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        _id: cart._id,
        items: [],
        itemCount: 0,
        subtotal: 0,
        discount: 0,
        total: 0
      }
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};


/*************  ✨ Codeium Command ⭐  *************/
/******  96bb6249-96ec-439e-a531-636bbc5a33a3  *******/
exports.getAllCarts = async (req, res) => {
  try {
    // Only admins should be able to access this endpoint
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    const { 
      status = 'active',
      page = 1, 
      limit = 10
    } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Query carts
    const carts = await Cart.find({ status })
      .populate('user', 'username email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 });
    
    // Get total count
    const total = await Cart.countDocuments({ status });
    
    res.status(200).json({
      success: true,
      count: carts.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: carts
    });
  } catch (error) {
    console.error('Error fetching carts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch carts',
      error: error.message
    });
  }
};

