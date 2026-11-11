import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Send verification email after registration
export const sendVerificationEmail = async (email: string, token: string, userType: string, frontendUrl?: string) => {
    // Point the verification link to the FRONTEND, not the backend!
    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/service-connect/verify-email?token=${token}`;
    
    const { SMTP_USER } = process.env;
    
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to: email,
        subject: 'Verify Your Email Address',
        html: `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #667eea; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: #ffffff; margin: 0;">Welcome to ServiceConnect!</h1>
                    </div>
                    <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                        <p>Hello,</p>
                        <p>Thank you for registering with ServiceConnect. Please verify your email address by clicking the button below:</p>
                        <p style="text-align: center;">
                            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Verify Email Address</a>
                        </p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p><code>${verificationUrl}</code></p>
                        <p>This link will expire in 24 hours.</p>
                        ${userType === 'employee' || userType === 'provider' ? '<p><strong>Note:</strong> After verification, an administrator will review and approve your registration before you can access the system.</p>' : ''}
                    </div>
                    <div style="text-align: center; padding: 20px; font-size: 12px; color: #6b7280;">
                        <p>© ${new Date().getFullYear()} ServiceConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

// Send invitation email to employee with registration code
export const sendInviteEmail = async (
  email: string, 
  code: string, 
  expiresAt: Date, 
  role: 'EMPLOYEE' | 'PROVIDER', 
  frontendUrl?: string
) => {
    const expiresFormatted = expiresAt.toLocaleString();
    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Route to the exact correct component based on the role
    const registerPath = role === 'PROVIDER' 
      ? '/service-provider-register' 
      : '/register/employee';
      
    const registerUrl = `${baseUrl}${registerPath}?code=${code}`;
    const { SMTP_USER } = process.env;
    
    await transporter.sendMail({
        from: `"ServiceConnect Admin" <${SMTP_USER}>`,
        to: email,
        subject: 'Registration Invitation',
        html: `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #667eea; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: #ffffff; margin: 0;">Welcome to ServiceConnect!</h1>
                    </div>
                    <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                        <p>Hello,</p>
                        <p>You've been invited to register as a <strong>${role === 'PROVIDER' ? 'Service Provider' : 'Employee'}</strong> on the ServiceConnect platform.</p>
                        <p>Your registration code is:</p>
                        <div style="font-size: 24px; font-weight: bold; background: #e5e7eb; padding: 10px; text-align: center; letter-spacing: 2px; font-family: monospace; border-radius: 6px; margin: 15px 0; color: #111827;">${code}</div>
                        <p>This code expires on: <strong>${expiresFormatted}</strong></p>
                        <p style="text-align: center;">
                            <a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Complete Registration</a>
                        </p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p><code>${registerUrl}</code></p>
                    </div>
                    <div style="text-align: center; padding: 20px; font-size: 12px; color: #6b7280;">
                        <p>© ${new Date().getFullYear()} ServiceConnect. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

export const sendApprovalEmail = async (email: string, name: string) => {
    const { SMTP_USER } = process.env;

    await transporter.sendMail({
        from: `"Aisle-Net Admin" <${SMTP_USER}>`,
        to: email,
        subject: 'Account Approved!',
        html: `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #10b981; color: #ffffff; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0;">Welcome, ${name}!</h1>
                    </div>
                    <div style="padding: 20px; background: #f9fafb;">
                        <p>Congratulations! Your account has been approved by the administrator.</p>
                        <p>You can now log in and start using the Aisle-Net platform.</p>
                        <p style="text-align: center;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="display: inline-block; padding: 12px 24px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Log In Now</a>
                        </p>
                    </div>
                    <div style="text-align: center; padding: 20px; font-size: 12px; color: #6b7280;">
                        <p>© ${new Date().getFullYear()} Aisle-Net. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

export const sendRejectionEmail = async (email: string, reason: string) => {
    const { SMTP_USER } = process.env;

    await transporter.sendMail({
        from: `"Aisle-Net Admin" <${SMTP_USER}>`,
        to: email,
        subject: 'Registration Update',
        html: `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #ef4444; color: #ffffff; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0;">Registration Update</h1>
                    </div>
                    <div style="padding: 20px; background: #f9fafb;">
                        <p>Unfortunately, your registration could not be approved at this time.</p>
                        <p><strong>Reason:</strong> ${reason}</p>
                        <p>If you have questions, please contact support.</p>
                    </div>
                    <div style="text-align: center; padding: 20px; font-size: 12px; color: #6b7280;">
                        <p>© ${new Date().getFullYear()} Aisle-Net. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

// ============================================
// BOOKING & DISPUTE NOTIFICATIONS
// ============================================

const emailWrapper = (title: string, content: string) => `
    <!DOCTYPE html>
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #667eea; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0;">${title}</h1>
            </div>
            <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                ${content}
            </div>
            <div style="text-align: center; padding: 20px; font-size: 12px; color: #6b7280;">
                <p>© ${new Date().getFullYear()} ServiceConnect. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
`;

export const sendBookingRequestedEmail = async (to: string, providerName: string, clientName: string, serviceTitle: string, price: number, link: string) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to,
        subject: 'New Booking Request',
        html: emailWrapper('New Booking Request', `
            <p>Hello ${providerName},</p>
            <p>You have received a new booking request from <span style="font-weight: bold; color: #111;">${clientName}</span> for <span style="font-weight: bold; color: #111;">${serviceTitle}</span>.</p>
            <p>Suggested price: <strong>R${price.toLocaleString()}</strong></p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">View Request</a>
            </p>
        `)
    });
};

export const sendBookingAcceptedEmail = async (to: string, clientName: string, providerName: string, serviceTitle: string, fee: number, link: string) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to,
        subject: 'Booking Accepted!',
        html: emailWrapper('Booking Accepted', `
            <p>Hello ${clientName},</p>
            <p>Great news! <span style="font-weight: bold; color: #111;">${providerName}</span> has accepted your booking for <span style="font-weight: bold; color: #111;">${serviceTitle}</span>.</p>
            <p>To schedule the site visit, please pay the consultation fee of <strong>R${fee.toLocaleString()}</strong>.</p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Pay Consultation Fee</a>
            </p>
        `)
    });
};

export const sendBookingDeclinedEmail = async (to: string, clientName: string, providerName: string, serviceTitle: string, reason: string, link: string) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to,
        subject: 'Booking Declined',
        html: emailWrapper('Booking Declined', `
            <p>Hello ${clientName},</p>
            <p>Unfortunately, <span style="font-weight: bold; color: #111;">${providerName}</span> has declined your booking for <span style="font-weight: bold; color: #111;">${serviceTitle}</span>.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Browse Other Providers</a>
            </p>
        `)
    });
};

export const sendDisputeRaisedEmail = async (to: string, recipientName: string, raiserName: string, serviceTitle: string, category: string, reason: string, link: string) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect Support" <${SMTP_USER}>`,
        to,
        subject: 'Action Required: Dispute Raised',
        html: emailWrapper('Dispute Raised', `
            <p>Hello ${recipientName},</p>
            <p><span style="font-weight: bold; color: #111;">${raiserName}</span> has raised a dispute regarding <span style="font-weight: bold; color: #111;">${serviceTitle}</span>.</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Support will review this and coordinate between both sides.</p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">View Dispute</a>
            </p>
        `)
    });
};

export const sendPriceProposedEmail = async (
  to: string, 
  clientName: string, 
  providerName: string, 
  serviceTitle: string, 
  amount: number, 
  note: string | undefined, 
  link: string
) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to,
        subject: 'Final Price Proposed',
        html: emailWrapper('Final Price Proposed', `
            <p>Hello ${clientName},</p>
            <p><span style="font-weight: bold; color: #111;">${providerName}</span> has proposed a final price of <strong>R${amount.toLocaleString()}</strong> for <span style="font-weight: bold; color: #111;">${serviceTitle}</span>.</p>
            ${note ? `<p><strong>Note from provider:</strong> "${note}"</p>` : ''}
            <p>Please log in to your dashboard to accept, counter, or dispute this price.</p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Review Proposal</a>
            </p>
        `)
    });
};

// ============================================
// PAYMENT SUCCESS NOTIFICATIONS
// ============================================

export const sendPaymentSuccessClientEmail = async (
  to: string, 
  clientName: string, 
  providerName: string, 
  serviceTitle: string, 
  amount: number, 
  link: string
) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to,
        subject: 'Payment Successful - Consultation Fee',
        html: emailWrapper('Payment Successful', `
            <p>Hello ${clientName},</p>
            <p>Your payment of <strong>R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong> for the consultation of <span style="font-weight: bold; color: #111;">${serviceTitle}</span> was successful.</p>
            <p><span style="font-weight: bold; color: #111;">${providerName}</span> has been notified and will contact you shortly to schedule the site visit.</p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">View Booking</a>
            </p>
        `)
    });
};

export const sendPaymentSuccessProviderEmail = async (
  to: string, 
  providerName: string, 
  clientName: string, 
  serviceTitle: string, 
  amount: number, 
  link: string
) => {
    const { SMTP_USER } = process.env;
    await transporter.sendMail({
        from: `"ServiceConnect" <${SMTP_USER}>`,
        to,
        subject: 'Consultation Fee Received',
        html: emailWrapper('Consultation Fee Paid', `
            <p>Hello ${providerName},</p>
            <p>Great news! <span style="font-weight: bold; color: #111;">${clientName}</span> has paid the consultation fee of <strong>R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong> for <span style="font-weight: bold; color: #111;">${serviceTitle}</span>.</p>
            <p>You can now contact the client to arrange the site visit. Remember to generate your gate code when you arrive!</p>
            <p style="text-align: center;">
                <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Go to Provider Dashboard</a>
            </p>
        `)
    });
};