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
    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    //const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
    const { SMTP_USER } = process.env;
    
    await transporter.sendMail({
        from: `"Aisle-Net" <${SMTP_USER}>`,
        to: email,
        subject: 'Verify Your Email Address',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9fafb; }
                    .button { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Aisle-Net!</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Thank you for registering with Aisle-Net. Please verify your email address by clicking the button below:</p>
                        <p style="text-align: center;">
                            <a href="${verificationUrl}" class="button" style="color:#fff;">Verify Email Address</a>
                        </p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p><code>${verificationUrl}</code></p>
                        <p>This link will expire in 24 hours.</p>
                        ${userType === 'employee' ? '<p><strong>Note:</strong> After verification, an administrator will review and approve your registration before you can access the system.</p>' : ''}
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

// Send invitation email to employee with registration code
export const sendInviteEmail = async (email: string, code: string, expiresAt: Date, frontendUrl?: string) => {
    const expiresFormatted = expiresAt.toLocaleString();
    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    const registerUrl = `${baseUrl}/register?code=${code}&type=employee`;
    //const registerUrl = `${process.env.FRONTEND_URL || 'http://localhost'}/register?code=${code}&type=employee`;
    const { SMTP_USER } = process.env;
    
    await transporter.sendMail({
        from: `"Aisle-Net Admin" <${SMTP_USER}>`,
        to: email,
        subject: 'Employee Registration Invitation',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9fafb; }
                    .code { font-size: 24px; font-weight: bold; background: #e5e7eb; padding: 10px; text-align: center; letter-spacing: 2px; font-family: monospace; }
                    .button { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Aisle-Net!</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>You've been invited to register as an employee on the Aisle-Net platform.</p>
                        <p>Your registration code is:</p>
                        <div class="code">${code}</div>
                        <p>This code expires on: <strong>${expiresFormatted}</strong></p>
                        <p style="text-align: center;">
                            <a href="${registerUrl}" class="button">Complete Registration</a>
                        </p>
                        <p>Or copy and paste this link into your browser:</p>
                        <p><code>${registerUrl}</code></p>
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