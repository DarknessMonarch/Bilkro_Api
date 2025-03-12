const Handlebars = require('handlebars');
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require('path');
const fs = require('fs');

dotenv.config();

const emailTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
    secure: true,
  });
};



exports.sendWelcomeEmail = async (email, username) => {
  if (!email || !username) {
    throw new Error('Email and username are required to send a welcome email.');
  }

  try {
    const emailPath = path.join(__dirname, '../client/welcome.html');
    const template = fs.readFileSync(emailPath, 'utf-8');
    const personalizedTemplate = template.replace('{{username}}', username);

    let mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Welcome to bilkro',
      html: personalizedTemplate,
    };


    const transporter = emailTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, message: 'Welcome email sent successfully.' };
  } catch (error) {
    throw new Error('Failed to send the welcome email.');
  }
};


exports.sendOrderConfirmationEmail = async (email, customerName, orderDetails) => {
  if (!email || !customerName || !orderDetails) {
    throw new Error('Email, customer name, and order details are required to send an order confirmation email.');
  }
  
  try {
    // Get the email template
    const emailPath = path.join(__dirname, '../client/orderConfirmation.html');
    const templateSource = fs.readFileSync(emailPath, 'utf-8');
    
    // Compile the template with Handlebars
    const template = Handlebars.compile(templateSource);
    
    // Format date
    const orderDate = new Date(orderDetails.date || Date.now()).toLocaleString();
    
    // Prepare the data for the template
    const emailData = {
      customerName,
      orderId: orderDetails.saleId || 'N/A',
      orderDate,
      items: orderDetails.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price.toFixed(2),
        itemTotal: (item.price * item.quantity).toFixed(2)
      })),
      subtotal: orderDetails.subtotal.toFixed(2),
      discount: orderDetails.discount.toFixed(2),
      total: orderDetails.total.toFixed(2),
      customerEmail: email,
      customerPhone: orderDetails.customerInfo?.phone || 'N/A',
      customerAddress: orderDetails.customerInfo?.address || 'N/A',
      paymentMethod: orderDetails.paymentMethod || 'N/A',
      transactionId: orderDetails.transactionId || orderDetails.saleId || 'N/A',
      orderTrackingUrl: `${process.env.WEBSITE_LINK}/orders/${orderDetails.saleId}`
    };
    
    // Apply the data to the template
    const personalizedTemplate = template(emailData);
    
    // Set up email options
    let mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Your Order Confirmation - Bilkro',
      html: personalizedTemplate,
    };
    
    // Send the email
    const transporter = emailTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, message: 'Order confirmation email sent successfully.' };
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw new Error('Failed to send the order confirmation email.');
  }
};

exports.sendVerificationCodeEmail = async (email, username, verificationCode) => {
  if (!email || !username) {
    throw new Error('Email and username are required to send a welcome email.');
  }

  try {
    const emailPath = path.join(__dirname, '../client/verification.html');
    const template = fs.readFileSync(emailPath, 'utf-8');
    const personalizedTemplate = template.replace('{{username}}', username).replace('{{verificationCode}}', verificationCode);

    let mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Your Verification Code',
      html: personalizedTemplate,
    };

    const transporter = emailTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, message: 'Vip verification email sent successfully.' };
  } catch (error) {
    throw new Error('Failed to send the verification email.');
  }
};

exports.contactEmail = async (email, username, message) => {
  if (!email || !username || !message) {
    throw new Error('Email, username and message are required to send a contact email.');
  }

  try {
    const emailPath = path.join(__dirname, '../client/contact.html');
    const template = fs.readFileSync(emailPath, 'utf-8');
    const personalizedTemplate = template.replace('{{username}}', username).replace('{{email}}', email).replace('{{message}}', message);

    let mailOptions = {
      from: process.env.SUPPORT_EMAIL,
      to: process.env.SUPPORT_EMAIL,
      subject: 'Contact Us',
      html: personalizedTemplate,
    };


    const transporter = emailTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { success: true, message: 'Contact email sent successfully.' };
  } catch (error) {
    throw new Error('Failed to send the verification email.');
  }
};


exports.sendPasswordResetEmail = async (username, email, resetToken) => {

  try {
    const emailPath = path.join(__dirname, '../client/passwordEmailReset.html');
    const template = fs.readFileSync(emailPath, 'utf-8');
    const resetUrl = `${process.env.WEBSITE_LINK}/authentication/reset/${resetToken}`;
    const personalizedTemplate = template.replace('{{username}}', username).replace('{{resetUrl}}', resetUrl);


    let mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Password Reset Request',
      html: personalizedTemplate,
    };

    const transporter = emailTransporter();
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending reset email:', error);
  }
};

exports.sendResetSucessfulEmail = async (username, email) => {

  try {
    const emailPath = path.join(__dirname, '../client/passwordResetSuccesful.html');
    const template = fs.readFileSync(emailPath, 'utf-8');
    const personalizedTemplate = template.replace('{{username}}', username);


    let mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Password Reset Successful',
      html: personalizedTemplate,
    };

    const transporter = emailTransporter();
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending successful reset email:', error);
  }
};

exports.deleteAccountEmail = async (email, username, details) => {
  const subject = details.deletedByAdmin
    ? 'Your Account Has Been Deleted by Administrator'
    : 'Account Deletion Successful';

  const deletionDate = new Date(details.deletionDate).toLocaleString();

  let message = ``;

  if (details.deletedByAdmin) {
    message += `Your account has been deleted by an administrator on ${deletionDate}.`;
    if (details.bulkDeletion) {
      message += '\nThis action was part of a bulk account cleanup process.';
    }
  } else {
    message += `As requested, your account has been successfully deleted on ${deletionDate}.`;
  }


  try {
    const emailPath = path.join(__dirname, '../client/accountDeleted.html');
    const template = fs.readFileSync(emailPath, 'utf-8');
    const personalizedTemplate = template
      .replace('{{username}}', username)
      .replace('{{message}}', message);

    let mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: subject,
      html: personalizedTemplate,
    };

    const transporter = emailTransporter();
    await transporter.sendMail(mailOptions);

  } catch (error) {
    console.error('Error sending account deletion email:', error);
  }
};



module.exports = exports;