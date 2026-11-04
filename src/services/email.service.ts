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
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"> <!-- Fixed the missing '<' here! -->
                        <h1>Welcome to ServiceConnect!</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Thank you for registering with ServiceConnect. Please verify your email address by clicking the button below:</p>
                        <p style="text-align: center;">
                            <a href="${verificationUrl}" class="button" style="color:#fff;">Verify Email Address</a>
                        </p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p><code>${verificationUrl}</code></p>
                        <p>This link will expire in 24 hours.</p>
                        ${userType === 'employee' || userType === 'provider' ? '<p><strong>Note:</strong> After verification, an administrator will review and approve your registration before you can access the system.</p>' : ''}
                    </div>
                    <div class="footer">
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
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
                    .code { font-size: 24px; font-weight: bold; background: #e5e7eb; padding: 10px; text-align: center; letter-spacing: 2px; font-family: monospace; border-radius: 6px; margin: 15px 0; color: #111827; }
                    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to ServiceConnect!</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>You've been invited to register as a <strong>${role === 'PROVIDER' ? 'Service Provider' : 'Employee'}</strong> on the ServiceConnect platform.</p>
                        <p>Your registration code is:</p>
                        <div class="code">${code}</div>
                        <p>This code expires on: <strong>${expiresFormatted}</strong></p>
                        <p style="text-align: center;">
                            <a href="${registerUrl}" class="button" style="color: #ffffff;">Complete Registration</a>
                        </p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p><code>${registerUrl}</code></p>
                    </div>
                    <div class="footer">
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
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #10b981; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9fafb; }
                    .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome, ${name}!</h1>
                    </div>
                    <div class="content">
                        <p>Congratulations! Your account has been approved by the administrator.</p>
                        <p>You can now log in and start using the Aisle-Net platform.</p>
                        <p style="text-align: center;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="button">Log In Now</a>
                        </p>
                    </div>
                    <div class="footer">
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
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #ef4444; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9fafb; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Registration Update</h1>
                    </div>
                    <div class="content">
                        <p>Unfortunately, your registration could not be approved at this time.</p>
                        <p><strong>Reason:</strong> ${reason}</p>
                        <p>If you have questions, please contact support.</p>
                    </div>
                    <div class="footer">
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
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .highlight { font-weight: bold; color: #111; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${title}</h1>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
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
            <p>You have received a new booking request from <span class="highlight">${clientName}</span> for <span class="highlight">${serviceTitle}</span>.</p>
            <p>Suggested price: <strong>R${price.toLocaleString()}</strong></p>
            <p style="text-align: center;">
                <a href="${link}" class="button" style="color: #ffffff;">View Request</a>
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
            <p>Great news! <span class="highlight">${providerName}</span> has accepted your booking for <span class="highlight">${serviceTitle}</span>.</p>
            <p>To schedule the site visit, please pay the consultation fee of <strong>R${fee.toLocaleString()}</strong>.</p>
            <p style="text-align: center;">
                <a href="${link}" class="button">Pay Consultation Fee</a>
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
            <p>Unfortunately, <span class="highlight">${providerName}</span> has declined your booking for <span class="highlight">${serviceTitle}</span>.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p style="text-align: center;">
                <a href="${link}" class="button">Browse Other Providers</a>
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
            <p><span class="highlight">${raiserName}</span> has raised a dispute regarding <span class="highlight">${serviceTitle}</span>.</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Support will review this and coordinate between both sides.</p>
            <p style="text-align: center;">
                <a href="${link}" class="button">View Dispute</a>
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
            <p><span class="highlight">${providerName}</span> has proposed a final price of <strong>R${amount.toLocaleString()}</strong> for <span class="highlight">${serviceTitle}</span>.</p>
            ${note ? `<p><strong>Note from provider:</strong> "${note}"</p>` : ''}
            <p>Please log in to your dashboard to accept, counter, or dispute this price.</p>
            <p style="text-align: center;">
                <a href="${link}" class="button">Review Proposal</a>
            </p>
        `)
    });
};