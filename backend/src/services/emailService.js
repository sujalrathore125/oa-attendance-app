const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter from env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a 6-digit OTP to the given email address
 */
const sendOTP = async (email, otp) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 16px; padding: 32px; text-align: center; color: white;">
        <h1 style="margin: 0 0 8px; font-size: 24px;">🎓 OA Attendance</h1>
        <p style="margin: 0; opacity: 0.8; font-size: 14px;">Email Verification</p>
      </div>
      <div style="padding: 32px 0; text-align: center;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Your verification code is:</p>
        <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; display: inline-block;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4F46E5; font-family: monospace;">
            ${otp}
          </span>
        </div>
        <p style="color: #9CA3AF; font-size: 13px; margin: 24px 0 0;">
          This code expires in <strong>10 minutes</strong>.<br/>
          If you didn't request this, please ignore this email.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"OA Attendance" <${from}>`,
      to: email,
      subject: 'Your OA Attendance Verification Code',
      html,
    });
    logger.info('OTP email sent', { email });
    return true;
  } catch (err) {
    logger.error('Failed to send OTP email', { email, error: err.message });
    throw new Error('Failed to send verification email');
  }
};

module.exports = { sendOTP };
