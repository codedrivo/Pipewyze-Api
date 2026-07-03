const nodemailer = require('nodemailer');
const config = require('../../config/config');

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const { host, port, secure, user, pass } = config.email.smtp;

  if (!user || !pass) {
    console.warn('[EMAIL] SMTP credentials are not configured. Falling back to console log email sending.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

const sendEmail = async (to, subject, text, html) => {
  const mailTransporter = getTransporter();
  const from = config.email.from || (config.email.smtp && config.email.smtp.user);

  if (!mailTransporter || !from) {
    console.log(`[DEV EMAIL LOG] (No SMTP Config) To: ${to} | Subject: ${subject} | Body: ${text || html}`);
    return true;
  }

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL] Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    // fallback to console log so it doesn't crash the server or process
    console.log(`[DEV EMAIL LOG] To: ${to} | Subject: ${subject} | Body: ${text || html}`);
    return false;
  }
};

module.exports = {
  sendEmail,
};
