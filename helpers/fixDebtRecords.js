const mongoose = require('mongoose');
const Debt = require('../models/debt');
const config = require('../config/db');

mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

const fixDebtRecords = async () => {
  try {
    console.log('Starting debt records fix...');
    
    const allDebts = await Debt.find({});
    console.log(`Found ${allDebts.length} total debt records`);
    
    const today = new Date();
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const debt of allDebts) {
      let newStatus = debt.status; 
      
      if (debt.remainingAmount <= 0) {
        newStatus = 'paid';
      } else if (debt.dueDate < today) {
        newStatus = 'overdue';
      } else {
        newStatus = 'current';
      }

      if (debt.status !== newStatus) {
        console.log(`Updating debt ${debt._id}: ${debt.status} -> ${newStatus}`);
        debt.status = newStatus;
        await debt.save();
        updatedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }
    
    console.log('Debt records fix completed:');
    console.log(`- Updated: ${updatedCount} records`);
    console.log(`- Already correct: ${alreadyCorrectCount} records`);
    console.log(`- Total: ${allDebts.length} records`);
    
    await mongoose.disconnect();
    console.log('Database disconnected');
    
  } catch (error) {
    console.error('Error fixing debt records:', error);
  }
};

fixDebtRecords();